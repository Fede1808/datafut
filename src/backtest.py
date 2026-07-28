"""
Etapa 5-bis del pipeline: BACKTEST WALK-FORWARD (el examen de verdad).

=============================================================================
POR QUE ESTE ARCHIVO EXISTE, SI YA ESTABA evaluate.py
=============================================================================

`evaluate.py` entrena UNA vez por temporada y con eso predice la temporada
entera. Sirve para comparar configuraciones entre si (por eso se uso para
tunear el shrinkage), pero NO es como el modelo va a vivir en produccion. En
produccion reentrenamos despues de CADA FECHA. Y `model.py:51-53` dejo escrito,
negro sobre blanco, que eso habia que volver a medirlo con ese esquema.

Esto es eso: WALK-FORWARD. Para cada dia con partidos, se entrena un modelo
NUEVO con todo lo jugado ANTES de ese dia, se predicen los partidos de ese dia,
y recien despues se "descubre" el resultado y se pasa al dia siguiente. Es
caminar la historia hacia adelante sin poder mirar atras de la hoja.

Son ~875 reentrenamientos completos si se evalua desde 2022. Tarda unos 35-40
minutos. Es lento a proposito: cualquier atajo aca es un atajo hacia el
autoengano.


=============================================================================
LA REGLA QUE NO SE ROMPE: CERO FUGA DE INFORMACION (leakage)
=============================================================================

Un backtest con fuga de informacion da numeros hermosos y es BASURA. Te dice
que el modelo es un genio cuando en realidad estaba espiando la respuesta. Y lo
peor es que no se nota: no rompe nada, no tira error, simplemente miente.

Los cuatro lugares por donde se cuela, y como estan tapados aca:

1) EL CORTE ES ESTRICTO: `date < fecha`, NUNCA `<=`.
   Si el sabado juegan seis partidos, ninguno de los seis entrena al otro
   cinco. Los seis se predicen con el mismo modelo, entrenado hasta el
   VIERNES a la noche. Con `<=` cada partido se estaria entrenando a si mismo:
   es la fuga mas clasica y la mas facil de cometer sin darse cuenta.

   (Como el dataset solo tiene el DIA y no la hora de cada partido, agrupar por
   dia es lo mas fino que se puede hacer sin inventar informacion. Si un
   domingo a las 14 hs jugaron dos equipos y a las 19 hs otros dos, en la vida
   real el segundo partido si podria haber usado el primero. No lo usamos.
   Eso hace al backtest un poquito PESIMISTA, que es exactamente el lado del
   que uno quiere errar.)

2) EL DECAIMIENTO TEMPORAL SE MIDE DESDE LA FECHA DE CORTE.
   `entrenar(..., fecha_ref=fecha)`. Si se dejara el default, la antiguedad se
   contaria desde el ultimo partido del set de entrenamiento, que se va
   moviendo, y peor: al comparar dias distintos los pesos no serian
   comparables. Fecha de corte = donde estariamos parados ese dia.

3) TODO SE REESTIMA ADENTRO DE CADA VENTANA.
   Ataque, defensa, base, ventaja de local, rho: los estima `entrenar()` de
   cero en cada iteracion, solo con el pasado. No hay ningun parametro
   calculado una vez sobre el dataset completo y reusado.

   El shrinkage (25.0) y la vida media (1800 dias) son la excepcion honesta y
   hay que declararla: son HIPERparametros elegidos en `evaluate.py` mirando
   datos de 2022 en adelante, o sea mirando parte del periodo que este script
   despues evalua. Eso es una fuga de segundo orden, real aunque chica (la
   meseta de shrinkage entre 20 y 40 se mueve 0.0001, ver model.py:124-129).
   Se declara y no se disimula. Para un numero 100% limpio habria que elegir
   los hiperparametros con datos anteriores a 2022 y nunca volver a tocarlos.

4) LA BASELINE DE FRECUENCIA TAMBIEN SE CALCULA CON LA VENTANA.
   "43% local, 30% empate" es un dato del futuro si se calcula sobre todo el
   csv. Aca sale de `train`, igual que el modelo.

Equipos sin historial (recien ascendidos): el modelo NO puede predecirlos, no
tiene con que estimarles la fuerza. Se los EXCLUYE y se los CUENTA, uno por
uno, en el informe. No se los rellena con un equipo promedio inventado ni se
los esconde: si el modelo no sabe, el informe dice que no sabe.


=============================================================================
CONTRA QUIEN SE COMPARA
=============================================================================

- MERCADO: las cuotas de cierre promedio del mercado (`AvgC*`), sin el margen
  de la casa. Este es el rival de verdad.
- FRECUENCIA HISTORICA: repetir las proporciones del pasado. El piso decente.
- AZAR (33/33/33): el piso del piso. Si no le ganas a esto, esta roto.

OJO CON LA COMPARACION CONTRA EL MERCADO: solo vale en los partidos donde
HAY cuotas Y el modelo pudo predecir. El informe usa ese conjunto comun EXACTO
para todos, y aparte reporta cuantos partidos quedaron afuera y por que.

Reproducibilidad: no hay ni una linea de aleatoriedad en todo el circuito
(L-BFGS-B es determinista y arranca siempre del mismo punto inicial), asi que
no hay semilla que fijar. Mismo csv + mismo comando = misma salida, siempre.

Uso:
    python src/backtest.py                    desde 2022 (tarda ~35 min)
    python src/backtest.py --desde 2025       mas rapido, para probar
"""

from pathlib import Path
import argparse
import time

import numpy as np
import pandas as pd

from model import cargar_partidos, entrenar, probabilidades_1x2, SHRINKAGE_DEFAULT
from evaluate import log_loss, brier, RESULTADOS

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "data" / "outputs" / "backtest-walkforward.md"
DESTINO_CSV = RAIZ / "data" / "outputs" / "backtest-walkforward.csv"

# Minimo de partidos en la ventana para molestarse en entrenar. Con menos que
# esto el ajuste es puro ruido y encima el optimizador tarda igual.
MIN_PARTIDOS_TRAIN = 300

# Ancho de los bins de calibracion. 0.05 deja ~12 bins utiles: fino como para
# ver la forma de la curva, grueso como para que cada bin tenga muestra.
ANCHO_BIN = 0.05


# ---------------------------------------------------------------------------
# El mercado, sin el margen de la casa
# ---------------------------------------------------------------------------
def quitar_vig(fila_cuotas):
    """
    Convierte tres cuotas en tres probabilidades que suman 1.

    Una cuota de 2.00 significa "te pago el doble", o sea ~50%: 1/2.00 = 0.50.
    Pero si sumas 1/cuota de los tres resultados NO da 1, da tipo 1.05. Ese
    exceso de 5% es la ganancia de la casa -el "vig", "margen" o "juice"-: te
    pagan un poquito menos de lo que corresponde, siempre.

    Aca se saca con el metodo MULTIPLICATIVO (o "proporcional"): dividir cada
    1/cuota por la suma de los tres. Es decir, se asume que la casa le carga el
    mismo porcentaje de margen a los tres resultados.

    LIMITACION QUE HAY QUE DECLARAR: eso no es del todo cierto. Existe el sesgo
    favorito-tapado (favourite-longshot bias): las casas cargan MAS margen en
    los resultados improbables. Metodos como Shin o el power method reparten el
    margen desparejo y son mas fieles. Con el multiplicativo, las
    probabilidades chicas quedan un toque INFLADAS, lo que hace al mercado
    parecer un poquito PEOR de lo que es. O sea: el error va en contra del
    mercado y a favor nuestro. Si igual el mercado nos gana, nos gana de verdad.
    """
    crudas = 1 / fila_cuotas
    return crudas / crudas.sum(axis=1, keepdims=True)


# ---------------------------------------------------------------------------
# El corazon: caminar la historia hacia adelante
# ---------------------------------------------------------------------------
def caminar(partidos, evaluables, vida_media, shrinkage, verbose=True):
    """
    Un modelo nuevo por cada dia con partidos, entrenado SOLO con el pasado.

    Devuelve un DataFrame con una fila por partido evaluado, con las
    probabilidades de cada competidor. Los partidos que el modelo no pudo
    predecir (equipo sin historial) quedan igual en la tabla, marcados.
    """
    fechas = np.sort(evaluables.date.unique())
    filas = []
    arranque = time.time()

    for i, fecha in enumerate(fechas, 1):
        # ---- EL CORTE. Estricto. Nada del mismo dia, nada posterior. ----
        train = partidos[partidos.date < fecha]
        if len(train) < MIN_PARTIDOS_TRAIN:
            continue

        del_dia = evaluables[evaluables.date == fecha]
        conocidos = set(train.home_team) | set(train.away_team)

        # fecha_ref = el corte: la antiguedad se mide desde donde estamos
        # parados hoy, no desde el final del csv.
        modelo = entrenar(train, vida_media=vida_media, shrinkage=shrinkage,
                          fecha_ref=pd.Timestamp(fecha), verbose=False)

        # La frecuencia historica tambien sale de la ventana, no del csv entero.
        frec = np.array([(train.result == r).mean() for r in RESULTADOS])

        for f in del_dia.itertuples():
            conoce = f.home_team in conocidos and f.away_team in conocidos
            p = probabilidades_1x2(modelo, f.home_team, f.away_team) if conoce else (np.nan,) * 3
            filas.append({
                "date": f.date,
                "season_id": f.season_id,
                "home_team": f.home_team,
                "away_team": f.away_team,
                "result": f.result,
                "partidos_train": len(train),
                "conoce_equipos": conoce,
                "dc_H": p[0], "dc_D": p[1], "dc_A": p[2],
                "frec_H": frec[0], "frec_D": frec[1], "frec_A": frec[2],
                "avgch": f.avgch, "avgcd": f.avgcd, "avgca": f.avgca,
            })

        if verbose and (i % 25 == 0 or i == len(fechas)):
            transcurrido = time.time() - arranque
            print(f"  {i:>4}/{len(fechas)} fechas · {pd.Timestamp(fecha).date()} · "
                  f"{len(filas):,} partidos · {transcurrido / 60:.1f} min "
                  f"(faltan ~{transcurrido / i * (len(fechas) - i) / 60:.0f} min)")

    return pd.DataFrame(filas)


# ---------------------------------------------------------------------------
# Calibracion
# ---------------------------------------------------------------------------
def calibracion(probs, reales, ancho=ANCHO_BIN):
    """
    Compara "cuando decis 60%, cuantas veces pasa?" con la respuesta real.

    Se tiran las tres probabilidades de cada partido (local, empate, visita) a
    la misma bolsa: son 3 predicciones por partido, cada una con su acierto o
    su error. Se agrupan por rango de probabilidad y se compara el promedio de
    lo que dijiste contra la frecuencia de lo que efectivamente paso.

    Si en el bin del 60% pasa el 50% de las veces, sos CONFIADO DE MAS. Si
    pasa el 70%, sos confiado de menos (deberias animarte mas).
    """
    real = np.zeros_like(probs)
    for i, r in enumerate(reales):
        real[i, RESULTADOS.index(r)] = 1

    p = probs.ravel()
    y = real.ravel()
    bins = np.floor(p / ancho).astype(int)

    filas = []
    for b in sorted(set(bins)):
        m = bins == b
        filas.append({
            "desde": b * ancho,
            "hasta": (b + 1) * ancho,
            "n": int(m.sum()),
            "predicha": float(p[m].mean()),
            "observada": float(y[m].mean()),
        })
    tabla = pd.DataFrame(filas)
    # ECE = error de calibracion esperado: el promedio de |dicho - pasado|
    # pesado por cuantas predicciones cayeron en cada bin. Un solo numero
    # resumen; mas bajo es mejor.
    tabla["peso"] = tabla.n / tabla.n.sum()
    ece = float((tabla.peso * (tabla.predicha - tabla.observada).abs()).sum())
    return tabla, ece


def imprimir_calibracion(tabla, escribir, titulo):
    escribir(f"**{titulo}**")
    escribir()
    escribir("| Rango | n | Predicha | Observada | Diferencia |")
    escribir("|---|---:|---:|---:|---:|")
    for f in tabla.itertuples():
        escribir(f"| {f.desde:.2f}-{f.hasta:.2f} | {f.n:,} | {f.predicha:.3f} | "
                 f"{f.observada:.3f} | {f.predicha - f.observada:+.3f} |")
    escribir()


def main():
    ap = argparse.ArgumentParser(description="Backtest walk-forward, reentrenando por fecha")
    ap.add_argument("--desde", default="2022",
                    help="primera temporada a evaluar (default: 2022, igual que evaluate.py)")
    ap.add_argument("--vida-media", type=int, default=1800)
    ap.add_argument("--shrinkage", type=float, default=SHRINKAGE_DEFAULT)
    args = ap.parse_args()

    partidos = cargar_partidos().sort_values("date").reset_index(drop=True)
    orden = partidos.loc[partidos.season_id == args.desde, "season_order"]
    if orden.empty:
        raise SystemExit(f"ERROR: no existe la temporada {args.desde!r}")
    evaluables = partidos[partidos.season_order >= orden.iloc[0]]

    print(f"Backtest walk-forward desde {args.desde} "
          f"(vida media: {args.vida_media} dias, shrinkage: {args.shrinkage:g})")
    print(f"{len(evaluables):,} partidos a evaluar en {evaluables.date.nunique():,} fechas.")
    print("Se reentrena el modelo de cero en CADA fecha, solo con lo anterior. "
          "Esto tarda.\n")

    res = caminar(partidos, evaluables, args.vida_media, args.shrinkage)

    DESTINO_CSV.parent.mkdir(parents=True, exist_ok=True)
    res.to_csv(DESTINO_CSV, index=False, encoding="utf-8")

    # --- Quien queda adentro de la comparacion ---
    tiene_cuotas = res[["avgch", "avgcd", "avgca"]].notna().all(axis=1)
    # reset_index para que el indice del DataFrame coincida con la posicion en
    # los arrays de probabilidades. Sin esto, el corte por temporada de mas
    # abajo indexaria con etiquetas viejas y mezclaria partidos.
    comun = res[res.conoce_equipos & tiene_cuotas].reset_index(drop=True)
    sin_modelo = res[~res.conoce_equipos]
    sin_cuotas = res[res.conoce_equipos & ~tiene_cuotas]

    reales = comun.result.to_numpy()
    dc = comun[["dc_H", "dc_D", "dc_A"]].to_numpy()
    mercado = quitar_vig(comun[["avgch", "avgcd", "avgca"]].to_numpy())
    frecuencia = comun[["frec_H", "frec_D", "frec_A"]].to_numpy()
    azar = np.full((len(comun), 3), 1 / 3)

    lineas = []

    def escribir(t=""):
        print(t)
        lineas.append(t)

    escribir()
    escribir("# Backtest walk-forward")
    escribir()
    escribir(f"Desde la temporada **{args.desde}** · vida media **{args.vida_media} dias** · "
             f"shrinkage **{args.shrinkage:g}**")
    escribir()
    escribir("Un modelo entrenado de cero por CADA fecha, con corte estricto "
             "(`date < fecha`): ningun partido participa de su propio entrenamiento, "
             "ni del de los que se juegan el mismo dia.")
    escribir()

    escribir("## De cuantos partidos hablamos")
    escribir()
    escribir(f"| Concepto | Partidos |")
    escribir("|---|---:|")
    escribir(f"| Evaluados en total | {len(res):,} |")
    escribir(f"| Sin prediccion del modelo (equipo sin historial) | {len(sin_modelo):,} |")
    escribir(f"| Con modelo pero sin cuotas | {len(sin_cuotas):,} |")
    escribir(f"| **Conjunto comun (modelo vs mercado)** | **{len(comun):,}** |")
    escribir()

    if len(sin_modelo):
        equipos = sorted(set(sin_modelo.home_team) | set(sin_modelo.away_team))
        escribir("Equipos involucrados en los partidos que el modelo no pudo predecir "
                 "(alguno de los dos no tenia historial en la ventana):")
        escribir()
        for e in equipos:
            n = ((sin_modelo.home_team == e) | (sin_modelo.away_team == e)).sum()
            escribir(f"- {e} ({n} partidos)")
        escribir()
    if len(sin_cuotas):
        escribir(f"Los {len(sin_cuotas)} partidos sin cuotas quedan afuera de TODA la "
                 "comparacion (no solo de la del mercado), para que las metricas se "
                 "midan sobre el mismisimo conjunto de partidos.")
        escribir()

    escribir("## Resultados")
    escribir()
    escribir(f"Conjunto comun: **{len(comun):,} partidos**. Mas bajo es mejor "
             "en las dos metricas.")
    escribir()
    escribir("| Competidor | Log loss | Brier |")
    escribir("|---|---:|---:|")
    marcas = {
        "MERCADO (cuotas sin vig)": mercado,
        "Dixon-Coles (walk-forward)": dc,
        "Frecuencia historica": frecuencia,
        "Azar (33/33/33)": azar,
    }
    metricas = {n: (log_loss(p, reales), brier(p, reales)) for n, p in marcas.items()}
    for nombre, (ll, br) in sorted(metricas.items(), key=lambda kv: kv[1][0]):
        destacar = "**" if nombre.startswith(("MERCADO", "Dixon")) else ""
        escribir(f"| {destacar}{nombre}{destacar} | {ll:.4f} | {br:.4f} |")
    escribir()

    brecha = metricas["Dixon-Coles (walk-forward)"][0] - metricas["MERCADO (cuotas sin vig)"][0]
    piso = metricas["Frecuencia historica"][0] - metricas["Dixon-Coles (walk-forward)"][0]
    escribir(f"- Mercado vs modelo: **{brecha:+.4f}** de log loss "
             "(positivo = el mercado gana)")
    escribir(f"- Modelo vs frecuencia historica: **{piso:+.4f}** "
             "(positivo = el modelo aporta informacion real)")
    escribir()

    escribir("## Por temporada (log loss)")
    escribir()
    escribir("| Temporada | n | Mercado | Dixon-Coles | Frecuencia | Azar |")
    escribir("|---|---:|---:|---:|---:|---:|")
    for temporada, g in comun.groupby("season_id"):
        m = g.index.to_numpy()
        r = g.result.to_numpy()
        escribir(f"| {temporada} | {len(g):,} | {log_loss(mercado[m], r):.4f} | "
                 f"{log_loss(dc[m], r):.4f} | {log_loss(frecuencia[m], r):.4f} | "
                 f"{log_loss(azar[m], r):.4f} |")
    escribir()

    escribir("## Calibracion")
    escribir()
    escribir("Se juntan las tres probabilidades de cada partido (local/empate/visita) "
             "en la misma bolsa y se agrupan por rango. `Predicha` es el promedio de "
             "lo que se dijo; `Observada`, cuantas veces paso de verdad. Diferencia "
             "positiva = **confiado de mas**.")
    escribir()
    cal_dc, ece_dc = calibracion(dc, reales)
    cal_mk, ece_mk = calibracion(mercado, reales)
    imprimir_calibracion(cal_dc, escribir, "Dixon-Coles")
    imprimir_calibracion(cal_mk, escribir, "Mercado")
    escribir(f"Error de calibracion esperado (ECE): modelo **{ece_dc:.4f}** · "
             f"mercado **{ece_mk:.4f}**. Mas bajo es mejor.")
    escribir()

    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text("\n".join(lineas) + "\n", encoding="utf-8")
    print(f"OK  -> {DESTINO}")
    print(f"OK  -> {DESTINO_CSV}  (una fila por partido, para revisar a mano)")


if __name__ == "__main__":
    main()
