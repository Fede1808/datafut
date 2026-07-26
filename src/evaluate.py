"""
Etapa 5 del pipeline: EVALUAR.

=============================================================================
POR QUE ESTE ARCHIVO ES TAN IMPORTANTE COMO EL MODELO
=============================================================================

Un modelo sin evaluacion no es un modelo: es una opinion con decimales.
Cualquier cosa te va a tirar numeros que parecen razonables. La pregunta no
es "tira numeros?", es "SIRVEN?".

REGLA DE ORO: nunca se evalua con los mismos partidos con los que se entreno.
Seria como rendir un examen habiendo visto las respuestas. Aca entrenamos con
el pasado y predecimos el futuro, temporada por temporada. Eso se llama
validacion temporal, y es la unica honesta cuando hay una linea de tiempo.


COMO SE MIDE
------------
NO se usa "porcentaje de aciertos". Y hay una razon: si el modelo dice que
River gana con 90% y pierde, se equivoco MUCHO mas que si hubiera dicho 40%.
El porcentaje de aciertos no ve esa diferencia. Estas dos si:

  LOG LOSS  - castiga muy fuerte estar seguro y equivocarse. Mas bajo, mejor.
  BRIER     - error cuadratico de la probabilidad. Mas bajo, mejor.

CONTRA QUIEN SE COMPARA
-----------------------
1. AZAR          - 33% a cada resultado. Si no le ganas a esto, esta roto.
2. FRECUENCIA    - siempre las proporciones historicas (43% local, 30% empate).
                   Sorprendentemente dificil de superar.
3. MERCADO       - las probabilidades que salen de las cuotas de las casas de
                   apuestas. Este es el rival de verdad: es el consenso de
                   mucha gente con mucha plata en juego.
4. ELO           - un modelo clasico y simple, para tener otra referencia.

Expectativa realista: EMPATAR con el mercado ya es un buen resultado. El
objetivo no es ganarle a las casas de apuestas, es tener probabilidades bien
calibradas.

Uso:
    python src/evaluate.py
    python src/evaluate.py --desde 2022 --vida-media 200
"""

from pathlib import Path
import argparse

import numpy as np
import pandas as pd

from model import cargar_partidos, entrenar, probabilidades_1x2

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "data" / "outputs" / "evaluacion.md"

RESULTADOS = ["H", "D", "A"]


# ---------------------------------------------------------------------------
# Metricas
# ---------------------------------------------------------------------------
def log_loss(probs, reales):
    """
    Promedio de -log(probabilidad que le diste al resultado que paso).

    Si le diste 100% al resultado correcto, aporta 0. Si le diste 1%, aporta
    4.6. Estar seguro y errar sale MUY caro. Mas bajo es mejor.
    """
    idx = [RESULTADOS.index(r) for r in reales]
    elegidas = probs[np.arange(len(reales)), idx]
    return float(-np.mean(np.log(np.clip(elegidas, 1e-15, 1))))


def brier(probs, reales):
    """Error cuadratico medio entre las probabilidades y lo que paso."""
    real = np.zeros_like(probs)
    for i, r in enumerate(reales):
        real[i, RESULTADOS.index(r)] = 1
    return float(np.mean(np.sum((probs - real) ** 2, axis=1)))


# ---------------------------------------------------------------------------
# Baselines
# ---------------------------------------------------------------------------
def probs_del_mercado(partidos):
    """
    Convierte las cuotas de las casas en probabilidades.

    Una cuota de 2.00 significa "pagamos el doble", o sea mas o menos 50% de
    probabilidad: 1/2.00 = 0.50.

    Pero si sumas 1/cuota de los tres resultados NO da 100%, da mas. Ese
    exceso es la ganancia de la casa: te pagan un poco menos de lo que
    corresponde. Se lo llama "margen" o "juice". Para comparar de igual a
    igual hay que sacarlo, y eso se hace dividiendo por la suma.

    (Este es el metodo mas simple. Hay otros mejores -Shin, power- que
    reparten el margen de forma despareja. Empezamos por el simple.)
    """
    crudas = 1 / partidos[["avgch", "avgcd", "avgca"]].to_numpy()
    return crudas / crudas.sum(axis=1, keepdims=True)


def probs_frecuencia(train, cantidad):
    """Siempre las mismas proporciones historicas, sin mirar quien juega."""
    frec = np.array([(train.result == r).mean() for r in RESULTADOS])
    return np.tile(frec, (cantidad, 1))


def probs_elo(train, test, k=20, ventaja_local=65):
    """
    Elo clasico: cada equipo tiene un puntaje, se lo lleva el que gana.

    Elo nacio para ajedrez, donde no hay empates frecuentes, asi que da la
    probabilidad de "ganar". Para tener las tres, repartimos alrededor del
    porcentaje historico de empates. Es tosco pero sirve como referencia.
    """
    puntos = {}
    tasa_empate = float((train.result == "D").mean())

    def esperado(a, b):
        return 1 / (1 + 10 ** ((b - a) / 400))

    def actualizar(fila):
        h = puntos.setdefault(fila.home_team, 1500.0)
        a = puntos.setdefault(fila.away_team, 1500.0)
        e = esperado(h + ventaja_local, a)
        real = 1.0 if fila.result == "H" else (0.5 if fila.result == "D" else 0.0)
        puntos[fila.home_team] = h + k * (real - e)
        puntos[fila.away_team] = a - k * (real - e)

    for fila in train.itertuples():
        actualizar(fila)

    salida = []
    for fila in test.itertuples():
        h = puntos.get(fila.home_team, 1500.0)
        a = puntos.get(fila.away_team, 1500.0)
        e = esperado(h + ventaja_local, a)
        # Repartimos la masa del empate proporcionalmente entre los extremos.
        p_empate = tasa_empate
        resto = 1 - p_empate
        salida.append([e * resto, p_empate, (1 - e) * resto])
        actualizar(fila)  # el Elo se va actualizando partido a partido

    return np.array(salida)


# ---------------------------------------------------------------------------
# Evaluacion temporal
# ---------------------------------------------------------------------------
def evaluar(partidos, temporadas_test, vida_media):
    """
    Para cada temporada a evaluar: entrena SOLO con lo anterior y predice.

    Nunca se usa informacion del futuro. Es la unica forma honesta de saber
    como se habria comportado el modelo en su momento.
    """
    filas = []

    for temporada in temporadas_test:
        orden = partidos.loc[partidos.season_id == temporada, "season_order"].iloc[0]
        train = partidos[partidos.season_order < orden]
        test = partidos[partidos.season_id == temporada].copy()

        # Solo partidos entre equipos que el modelo ya vio: a un recien
        # ascendido no le podemos estimar la fuerza sin datos previos.
        conocidos = set(train.home_team) | set(train.away_team)
        test = test[test.home_team.isin(conocidos) & test.away_team.isin(conocidos)]
        if len(test) < 30:
            print(f"  {temporada}: muy pocos partidos evaluables, se saltea")
            continue

        print(f"  {temporada}: entrenando con {len(train):,} partidos previos, "
              f"evaluando {len(test):,}...")

        # fecha_ref = el arranque de la temporada a predecir. Estamos parados
        # ahi, no en el presente.
        modelo = entrenar(train, vida_media=vida_media,
                          fecha_ref=test.date.min(), verbose=False)

        dc = np.array([probabilidades_1x2(modelo, f.home_team, f.away_team)
                       for f in test.itertuples()])
        reales = test.result.to_numpy()

        candidatos = {
            "Azar (33/33/33)": np.full((len(test), 3), 1 / 3),
            "Frecuencia historica": probs_frecuencia(train, len(test)),
            "Elo simple": probs_elo(train, test),
            "MERCADO (cuotas)": probs_del_mercado(test),
            "Dixon-Coles": dc,
        }
        for nombre, p in candidatos.items():
            filas.append({
                "temporada": temporada,
                "modelo": nombre,
                "log_loss": log_loss(p, reales),
                "brier": brier(p, reales),
                "partidos": len(test),
            })

    return pd.DataFrame(filas)


def main():
    ap = argparse.ArgumentParser(description="Evalua el modelo contra baselines")
    ap.add_argument("--desde", default="2022",
                    help="primera temporada a evaluar (default: 2022)")
    ap.add_argument("--vida-media", type=int, default=1800)
    args = ap.parse_args()

    partidos = cargar_partidos()
    orden_desde = partidos.loc[partidos.season_id == args.desde, "season_order"]
    if orden_desde.empty:
        raise SystemExit(f"ERROR: no existe la temporada {args.desde!r}")

    temporadas = (partidos[partidos.season_order >= orden_desde.iloc[0]]
                  .sort_values("season_order").season_id.unique())

    print(f"Validacion temporal desde {args.desde} (vida media: {args.vida_media} dias)")
    print("Se entrena solo con el pasado de cada temporada.\n")
    res = evaluar(partidos, temporadas, args.vida_media)

    lineas = []

    def escribir(t=""):
        print(t)
        lineas.append(t)

    escribir()
    escribir("# Evaluacion del modelo")
    escribir()
    escribir(f"Validacion temporal desde **{args.desde}** · vida media "
             f"**{args.vida_media} dias** · **{res.partidos.iloc[0] if len(res) else 0}**+ partidos por temporada")
    escribir()
    escribir("Mas bajo es mejor en las dos metricas.")
    escribir()

    resumen = (res.groupby("modelo")
                 .apply(lambda g: pd.Series({
                     "log_loss": np.average(g.log_loss, weights=g.partidos),
                     "brier": np.average(g.brier, weights=g.partidos),
                 }), include_groups=False)
                 .sort_values("log_loss"))

    escribir("## Global")
    escribir()
    escribir("| Modelo | Log loss | Brier |")
    escribir("|---|---:|---:|")
    for nombre, f in resumen.iterrows():
        destacar = "**" if nombre in ("Dixon-Coles", "MERCADO (cuotas)") else ""
        escribir(f"| {destacar}{nombre}{destacar} | {f.log_loss:.4f} | {f.brier:.4f} |")
    escribir()

    escribir("## Por temporada (log loss)")
    escribir()
    tabla = res.pivot(index="temporada", columns="modelo", values="log_loss")
    cols = [c for c in ["MERCADO (cuotas)", "Dixon-Coles", "Elo simple",
                        "Frecuencia historica", "Azar (33/33/33)"] if c in tabla.columns]
    tabla = tabla[cols]
    escribir("| Temporada | " + " | ".join(cols) + " |")
    escribir("|---" * (len(cols) + 1) + "|")
    for temporada, f in tabla.iterrows():
        escribir(f"| {temporada} | " + " | ".join(f"{v:.4f}" for v in f) + " |")
    escribir()

    # --- Veredicto ---
    dc = resumen.loc["Dixon-Coles"]
    mercado = resumen.loc["MERCADO (cuotas)"]
    frec = resumen.loc["Frecuencia historica"]
    brecha = dc.log_loss - mercado.log_loss

    escribir("## Veredicto")
    escribir()
    if dc.log_loss >= frec.log_loss:
        escribir("**El modelo NO le gana a repetir las proporciones historicas.** "
                 "Algo esta mal: revisar antes de seguir.")
    elif brecha <= 0:
        escribir(f"**El modelo le gana al mercado** por {abs(brecha):.4f} de log loss. "
                 "Resultado inusual: vale la pena revisar que no haya fuga de "
                 "informacion del futuro antes de festejar.")
    elif brecha < 0.01:
        escribir(f"**El modelo esta a la par del mercado** ({brecha:+.4f} de log loss). "
                 "Es un muy buen resultado: significa probabilidades bien calibradas.")
    else:
        escribir(f"**El mercado le gana al modelo** por {brecha:.4f} de log loss, "
                 "pero el modelo le gana a los baselines simples. Es un punto de "
                 "partida sano; hay margen para mejorar con mas parametros.")
    escribir()
    escribir(f"- Dixon-Coles vs frecuencia historica: **{frec.log_loss - dc.log_loss:+.4f}** "
             "(positivo = el modelo aporta informacion real)")

    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text("\n".join(lineas) + "\n", encoding="utf-8")
    print(f"\nOK  -> {DESTINO}")


if __name__ == "__main__":
    main()
