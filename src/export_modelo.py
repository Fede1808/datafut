"""Etapa 7c del pipeline: ¿SE LE PUEDE CREER AL MODELO?

Convierte el backtest walk-forward en algo que se pueda leer sin saber que es
un log loss.

De donde sale todo: `data/outputs/backtest-walkforward.csv`, que produce
`src/backtest.py` reentrenando el modelo DE CERO en cada una de las fechas,
con corte estricto (`date < fecha`). Ningun partido participa de su propio
entrenamiento. Por eso estos numeros son honestos y no una autoevaluacion
complaciente.

Escribe `web/data/modelo.json`.

POR QUE ESTA ETAPA EXISTE. Las metricas del modelo vivian solo en
`evaluacion.md` y `backtest-walkforward.md`, en tablas de markdown que nadie
que no sea el que las escribio va a leer. Un sitio que publica probabilidades
tiene que poder contestar "¿y por que te creo?" -- y contestarlo con el numero
en la mano, incluido el que queda mal.

Uso:  python src/export_modelo.py
"""

from pathlib import Path
import json
import sys

import numpy as np
import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
BACKTEST = RAIZ / "data" / "outputs" / "backtest-walkforward.csv"
DESTINO = RAIZ / "web" / "data" / "modelo.json"

CLUB = "Boca Juniors"

# Las tres columnas del modelo y las tres del mercado, en el mismo orden que
# `result` (H/D/A). El orden importa: se indexan juntas mas abajo.
COLS_MODELO = ["dc_H", "dc_D", "dc_A"]
COLS_MERCADO = ["avgch", "avgcd", "avgca"]
COLS_FRECUENCIA = ["frec_H", "frec_D", "frec_A"]
RESULTADOS = ["H", "D", "A"]


def sin_vig(cuotas):
    """Las cuotas de una casa suman mas de 100% de probabilidad: esa diferencia
    es su margen (el 'vig'). Se reparte proporcionalmente para poder comparar
    contra un modelo, que si suma 100 exacto.

    Sin este paso el mercado arrancaria con una ventaja falsa de ~5 puntos.
    """
    inversas = 1.0 / cuotas
    return inversas / inversas.sum(axis=1, keepdims=True)


def log_loss(probs, indices):
    """Cuanta probabilidad le puso al resultado que efectivamente paso.

    Mas bajo es mejor. Se recorta en 1e-15 para que una prediccion de 0% no
    devuelva infinito y arruine el promedio de toda la serie.
    """
    elegidas = probs[np.arange(len(indices)), indices]
    return float(-np.log(np.clip(elegidas, 1e-15, 1)).mean())


def brier(probs, indices):
    reales = np.zeros_like(probs)
    reales[np.arange(len(indices)), indices] = 1.0
    return float(((probs - reales) ** 2).sum(axis=1).mean())


def calibracion(probs, indices, pasos=10):
    """Cuando el modelo dice 60%, ¿pasa el 60% de las veces?

    Se meten las TRES probabilidades de cada partido en la misma bolsa (local,
    empate y visita son tres afirmaciones independientes sobre las que el
    modelo se jugo) y se agrupan por rango. `predicha` es el promedio de lo que
    dijo; `observada`, cuantas veces paso de verdad.

    Es el grafico mas honesto que puede publicar un sitio de pronosticos: si la
    curva se va por encima de la diagonal, el modelo es confiado de mas.
    """
    planas = probs.ravel()
    reales = np.zeros_like(probs)
    reales[np.arange(len(indices)), indices] = 1.0
    reales = reales.ravel()

    bordes = np.linspace(0, 1, pasos + 1)
    salida = []
    for lo, hi in zip(bordes[:-1], bordes[1:]):
        dentro = (planas >= lo) & (planas < hi)
        n = int(dentro.sum())
        # Los rangos con menos de 20 casos se omiten: con 1 o 2 observaciones
        # el "observada" salta entre 0% y 100% y dibuja una curva que parece
        # informacion pero es ruido.
        if n < 20:
            continue
        salida.append({
            "desde": round(float(lo), 2),
            "hasta": round(float(hi), 2),
            "n": n,
            "predicha": round(float(planas[dentro].mean()), 3),
            "observada": round(float(reales[dentro].mean()), 3),
        })
    return salida


def main():
    if not BACKTEST.exists():
        sys.exit(
            f"ERROR: falta {BACKTEST}\n"
            f"       Corre:  python src/backtest.py   (tarda ~31 min)"
        )

    d = pd.read_csv(BACKTEST, encoding="utf-8")
    total_evaluados = len(d)

    # El conjunto comun: solo los partidos donde HAY prediccion del modelo Y
    # cuotas del mercado. Comparar sobre conjuntos distintos es la forma mas
    # facil de mentir sin darse cuenta.
    completo = d.dropna(subset=COLS_MODELO + COLS_MERCADO + ["result"]).copy()
    completo = completo[completo["result"].isin(RESULTADOS)]
    if completo.empty:
        sys.exit("ERROR: el backtest no tiene ni un partido con modelo y cuotas.")

    indices = completo["result"].map({r: i for i, r in enumerate(RESULTADOS)}).to_numpy()
    modelo = completo[COLS_MODELO].to_numpy(dtype=float)
    mercado = sin_vig(completo[COLS_MERCADO].to_numpy(dtype=float))
    frecuencia = completo[COLS_FRECUENCIA].to_numpy(dtype=float)
    azar = np.full_like(modelo, 1 / 3)

    competidores = {
        "modelo": modelo,
        "mercado": mercado,
        "frecuencia": frecuencia,
        "azar": azar,
    }
    metricas = {
        nombre: {"log_loss": round(log_loss(p, indices), 4),
                 "brier": round(brier(p, indices), 4)}
        for nombre, p in competidores.items()
    }

    # --- Los partidos del club ---
    del_club = completo[
        (completo["home_team"] == CLUB) | (completo["away_team"] == CLUB)
    ].copy()
    idx_club = del_club["result"].map(
        {r: i for i, r in enumerate(RESULTADOS)}
    ).to_numpy()
    modelo_club = del_club[COLS_MODELO].to_numpy(dtype=float)
    mercado_club = sin_vig(del_club[COLS_MERCADO].to_numpy(dtype=float))

    # "Le puso favorito y acerto": el resultado mas probable segun el modelo
    # fue el que paso. NO es la metrica con la que se evalua un modelo
    # probabilistico -- para eso estan log loss y Brier -- pero es la que
    # cualquiera entiende, y por eso se publica al lado de las otras.
    favorito = modelo_club.argmax(axis=1)
    acerto = favorito == idx_club

    # El partido donde mas se equivoco: le puso la MENOR probabilidad a lo que
    # termino pasando. Es el dato mas incomodo del sitio y el mas valioso.
    puestas = modelo_club[np.arange(len(idx_club)), idx_club]
    peor = int(np.argmin(puestas)) if len(puestas) else None

    def describir(pos):
        f = del_club.iloc[pos]
        probs = modelo_club[pos]
        return {
            "fecha": str(f["date"])[:10],
            "local": f["home_team"],
            "visita": f["away_team"],
            "resultado": f["result"],
            "prob": {"local": round(100 * float(probs[0]), 1),
                     "empate": round(100 * float(probs[1]), 1),
                     "visita": round(100 * float(probs[2]), 1)},
            "le_puso": round(100 * float(puestas[pos]), 1),
            "mercado_le_puso": round(
                100 * float(mercado_club[pos][idx_club[pos]]), 1
            ),
        }

    # Por temporada, para ver si el modelo mejora o empeora con el tiempo.
    por_temporada = []
    for temporada, g in completo.groupby("season_id"):
        i = g["result"].map({r: k for k, r in enumerate(RESULTADOS)}).to_numpy()
        por_temporada.append({
            "temporada": str(temporada),
            "n": int(len(g)),
            "modelo": round(log_loss(g[COLS_MODELO].to_numpy(dtype=float), i), 4),
            "mercado": round(
                log_loss(sin_vig(g[COLS_MERCADO].to_numpy(dtype=float)), i), 4
            ),
        })
    por_temporada.sort(key=lambda t: t["temporada"], reverse=True)

    salida = {
        "club": CLUB,
        "partidos_evaluados": int(total_evaluados),
        "conjunto_comun": int(len(completo)),
        "metricas": metricas,
        # Los dos numeros que resumen todo. El primero queda MAL a proposito:
        # el mercado le gana. Publicarlo es el punto.
        "contra_mercado": round(
            metricas["mercado"]["log_loss"] - metricas["modelo"]["log_loss"], 4
        ),
        "contra_frecuencia": round(
            metricas["frecuencia"]["log_loss"] - metricas["modelo"]["log_loss"], 4
        ),
        "calibracion": calibracion(modelo, indices),
        "calibracion_mercado": calibracion(mercado, indices),
        "por_temporada": por_temporada,
        "club_partidos": int(len(del_club)),
        "club_aciertos": int(acerto.sum()),
        "club_peor": describir(peor) if peor is not None else None,
        "fechas": {
            "desde": str(completo["date"].min())[:10],
            "hasta": str(completo["date"].max())[:10],
        },
    }

    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(json.dumps(salida, ensure_ascii=False), encoding="utf-8")

    print(f"OK  -> {DESTINO}")
    print(f"    {salida['conjunto_comun']:,} partidos en el conjunto comun "
          f"({salida['fechas']['desde']} a {salida['fechas']['hasta']})")
    print(f"    log loss  modelo {metricas['modelo']['log_loss']} · "
          f"mercado {metricas['mercado']['log_loss']} · "
          f"frecuencia {metricas['frecuencia']['log_loss']}")
    print(f"    contra el mercado {salida['contra_mercado']:+.4f} "
          f"(negativo = nos gana) · "
          f"contra la frecuencia {salida['contra_frecuencia']:+.4f} "
          f"(positivo = el modelo aporta)")
    print(f"    {CLUB}: {salida['club_aciertos']}/{salida['club_partidos']} "
          f"favoritos acertados")
    if salida["club_peor"]:
        p = salida["club_peor"]
        print(f"    peor error: {p['fecha']} {p['local']} vs {p['visita']} "
              f"-> {p['resultado']}, le habia puesto {p['le_puso']}%")
    print(f"    calibracion: {len(salida['calibracion'])} rangos con n>=20")


if __name__ == "__main__":
    main()
