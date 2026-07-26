"""
Etapa 6 del pipeline: SIMULAR (Monte Carlo).

=============================================================================
QUE ES MONTE CARLO, EN CRIOLLO
=============================================================================

El modelo sabe decir "River le gana a Boca con 45%, empatan 28%, pierde 27%".
Pero vos no queres saber eso: queres saber QUIEN SALE CAMPEON.

Monte Carlo es fuerza bruta pura, y por eso es hermoso:

    1. Agarras todos los partidos que faltan jugar.
    2. Los "jugas" tirando dados cargados con las probabilidades del modelo.
    3. Sumas los puntos, armas la tabla, jugas los playoffs.
    4. Anotas quien salio campeon.
    5. Repetis DIEZ MIL VECES.

Si River salio campeon en 3.200 de las 10.000, tiene 32% de chances. No hay
formula magica: se juega el torneo diez mil veces y se cuenta.

Y por que hace falta? Porque en Argentina el campeon NO es el que mas puntos
hace. Hay que llegar a los playoffs y despues ganar cuatro partidos unicos,
donde cualquiera te gana. Simular la tabla te diria quien termina primero;
esto te dice quien LEVANTA LA COPA, que no es lo mismo.


COMO SE JUEGA EL TORNEO (verificado contra el Apertura 2026)
------------------------------------------------------------
- 30 equipos en dos zonas de 15
- Cada equipo juega contra los 14 de su zona, mas 2 interzonales
- Clasifican los 8 mejores de CADA zona
- Octavos CRUZADOS: 1ro de una zona contra 8vo de la otra
- Todo a partido unico. Si empatan, penales (aca: moneda al aire)

Uso:
    python src/simulate.py
    python src/simulate.py --n 50000
"""

from pathlib import Path
import argparse
import json
import sys
from collections import Counter

import numpy as np
import pandas as pd

from model import cargar_partidos, matriz_marcadores, MAX_GOLES

RAIZ = Path(__file__).resolve().parent.parent
MODELO = RAIZ / "data" / "outputs" / "modelo.json"
ZONAS = RAIZ / "reference" / "zonas.csv"
DESTINO = RAIZ / "data" / "outputs" / "simulacion.md"

# El Clausura 2026 arranca el 23/07. Todo lo anterior de esa temporada es
# Apertura, que ya termino.
TEMPORADA = "2026"
INICIO_CLAUSURA = "2026-07-23"

CLASIFICAN_POR_ZONA = 8


# ---------------------------------------------------------------------------
# Preparar el escenario
# ---------------------------------------------------------------------------
def cargar_zonas(temporada):
    if not ZONAS.exists():
        sys.exit(f"ERROR: falta {ZONAS}")
    z = pd.read_csv(ZONAS, encoding="utf-8")
    z = z[z.season_id.astype(str) == str(temporada)]
    if z.empty:
        sys.exit(f"ERROR: no hay zonas cargadas para la temporada {temporada}.\n"
                 f"       Agregalas a mano en {ZONAS}")
    return dict(zip(z.equipo, z.zona))


def partidos_pendientes(zona, jugados, plantilla_interzonal):
    """
    Que partidos faltan jugar.

    Los de cada zona son faciles: todos contra todos, asi que sabemos
    exactamente quien le debe partido a quien. Restamos los ya jugados.

    Los interzonales NO se pueden deducir (salen de un sorteo), asi que
    usamos como plantilla los del torneo anterior, invirtiendo la localia.
    Es un supuesto, y esta marcado como tal en el reporte.
    """
    ya = {frozenset((f.home_team, f.away_team)) for f in jugados.itertuples()}
    pendientes = []

    for z in ("A", "B"):
        equipos = sorted([e for e in zona if zona[e] == z])
        for i, local in enumerate(equipos):
            for visita in equipos[i + 1:]:
                if frozenset((local, visita)) not in ya:
                    pendientes.append((local, visita))

    for local, visita in plantilla_interzonal:
        if frozenset((local, visita)) not in ya:
            pendientes.append((local, visita))

    return pendientes


def interzonales_del_torneo_anterior(partidos, zona):
    """Saca los cruces entre zonas del Apertura, con la localia invertida."""
    pares = []
    for f in partidos.itertuples():
        if zona.get(f.home_team) != zona.get(f.away_team):
            pares.append((f.away_team, f.home_team))  # invertida
    return pares


# ---------------------------------------------------------------------------
# El corazon: simular
# ---------------------------------------------------------------------------
def sortear_marcadores(modelo, pendientes, n):
    """
    Para cada partido pendiente, sortea n marcadores segun el modelo.

    Se calcula la matriz de probabilidades UNA vez por partido y despues se
    samplea de golpe. Si se hiciera partido por partido y simulacion por
    simulacion, tardaria horas en vez de segundos.
    """
    goles_local = np.empty((len(pendientes), n), dtype=np.int8)
    goles_visita = np.empty((len(pendientes), n), dtype=np.int8)
    lado = MAX_GOLES + 1

    for i, (local, visita) in enumerate(pendientes):
        plano = matriz_marcadores(modelo, local, visita).ravel()
        elegidos = np.random.choice(len(plano), size=n, p=plano)
        goles_local[i] = elegidos // lado
        goles_visita[i] = elegidos % lado

    return goles_local, goles_visita


def puntos_iniciales(jugados, equipos):
    """Puntos, diferencia de gol y goles a favor de lo que ya se jugo."""
    pts = {e: 0 for e in equipos}
    dif = {e: 0 for e in equipos}
    gf = {e: 0 for e in equipos}
    for f in jugados.itertuples():
        gl, gv = f.home_goals, f.away_goals
        pts[f.home_team] += 3 if gl > gv else (1 if gl == gv else 0)
        pts[f.away_team] += 3 if gv > gl else (1 if gl == gv else 0)
        dif[f.home_team] += gl - gv
        dif[f.away_team] += gv - gl
        gf[f.home_team] += gl
        gf[f.away_team] += gv
    return pts, dif, gf


def simular(modelo, zona, jugados, pendientes, n, semilla=None):
    if semilla is not None:
        np.random.seed(semilla)

    equipos = sorted(zona)
    idx = {e: i for i, e in enumerate(equipos)}
    ne = len(equipos)

    pts0, dif0, gf0 = puntos_iniciales(jugados, equipos)
    base_pts = np.array([pts0[e] for e in equipos], dtype=np.int32)
    base_dif = np.array([dif0[e] for e in equipos], dtype=np.int32)
    base_gf = np.array([gf0[e] for e in equipos], dtype=np.int32)

    print(f"Sorteando {len(pendientes)} partidos x {n:,} simulaciones...")
    gl, gv = sortear_marcadores(modelo, pendientes, n)

    # Acumulamos puntos de todas las simulaciones a la vez.
    pts = np.tile(base_pts, (n, 1))
    dif = np.tile(base_dif, (n, 1))
    gf = np.tile(base_gf, (n, 1))

    for i, (local, visita) in enumerate(pendientes):
        il, iv = idx[local], idx[visita]
        gana_l, gana_v = gl[i] > gv[i], gv[i] > gl[i]
        empate = ~gana_l & ~gana_v
        pts[:, il] += 3 * gana_l + empate
        pts[:, iv] += 3 * gana_v + empate
        dif[:, il] += gl[i] - gv[i]
        dif[:, iv] += gv[i] - gl[i]
        gf[:, il] += gl[i]
        gf[:, iv] += gv[i]

    # Criterio de orden: puntos, despues diferencia de gol, despues goles a
    # favor. Se combinan en un solo numero para poder ordenar de una.
    ranking = pts * 1_000_000 + (dif + 500) * 1_000 + gf

    zona_a = [idx[e] for e in equipos if zona[e] == "A"]
    zona_b = [idx[e] for e in equipos if zona[e] == "B"]

    print(f"Jugando {n:,} veces los playoffs...")
    campeon = np.empty(n, dtype=np.int32)
    clasifica = np.zeros(ne, dtype=np.int64)

    for s in range(n):
        # Top 8 de cada zona, de mejor a peor.
        top_a = sorted(zona_a, key=lambda i: -ranking[s, i])[:CLASIFICAN_POR_ZONA]
        top_b = sorted(zona_b, key=lambda i: -ranking[s, i])[:CLASIFICAN_POR_ZONA]
        for e in top_a + top_b:
            clasifica[e] += 1

        # Octavos cruzados: 1ro de una zona contra 8vo de la otra.
        # El local siempre es el mejor ubicado (menos en la final, pero ahi la
        # ventaja de local se cancela porque la cancha es neutral).
        llave = ([(top_a[k], top_b[7 - k]) for k in range(4)] +
                 [(top_b[k], top_a[7 - k]) for k in range(4)])

        # 8 llaves -> 4 -> 2 -> 1. Cuando queda una sola, esa es la final.
        while len(llave) > 1:
            ganadores = [_ganador(modelo, equipos, a, b) for a, b in llave]
            llave = [(ganadores[k], ganadores[k + 1])
                     for k in range(0, len(ganadores), 2)]

        campeon[s] = _ganador(modelo, equipos, *llave[0])

    return {
        "equipos": equipos,
        "campeon": Counter(campeon.tolist()),
        "clasifica": clasifica,
        "n": n,
    }


def _ganador(modelo, equipos, i_local, i_visita):
    """Un partido de eliminacion directa. Devuelve el indice del que pasa."""
    m = matriz_marcadores(modelo, equipos[i_local], equipos[i_visita]).ravel()
    e = np.random.choice(len(m), p=m)
    lado = MAX_GOLES + 1
    gl, gv = e // lado, e % lado
    if gl != gv:
        return i_local if gl > gv else i_visita
    # Empataron: penales. Moneda al aire, que es lo mas honesto que se puede
    # decir de una tanda de penales.
    return i_local if np.random.random() < 0.5 else i_visita


def main():
    ap = argparse.ArgumentParser(description="Simula el torneo con Monte Carlo")
    ap.add_argument("--n", type=int, default=10000, help="cantidad de simulaciones")
    ap.add_argument("--semilla", type=int, default=42,
                    help="para que el resultado sea reproducible")
    args = ap.parse_args()

    if not MODELO.exists():
        sys.exit(f"ERROR: no existe {MODELO}\n       Primero corre:  python src/model.py")
    modelo = json.loads(MODELO.read_text(encoding="utf-8"))

    zona = cargar_zonas(TEMPORADA)
    partidos = cargar_partidos()
    temporada = partidos[(partidos.season_id == TEMPORADA) &
                         (partidos.competition == "liga")]
    apertura = temporada[temporada.date < INICIO_CLAUSURA]
    jugados = temporada[temporada.date >= INICIO_CLAUSURA]

    desconocidos = [e for e in zona if e not in modelo["ataque"]]
    if desconocidos:
        sys.exit("ERROR: el modelo no conoce a estos equipos:\n"
                 + "\n".join(f"  - {e}" for e in desconocidos)
                 + "\n       Reentrena con:  python src/model.py")

    plantilla = interzonales_del_torneo_anterior(apertura, zona)
    pendientes = partidos_pendientes(zona, jugados, plantilla)

    print(f"Clausura {TEMPORADA}: {len(jugados)} partidos jugados, "
          f"{len(pendientes)} por jugar\n")

    res = simular(modelo, zona, jugados, pendientes, args.n, semilla=args.semilla)

    equipos, n = res["equipos"], res["n"]
    filas = []
    for i, e in enumerate(equipos):
        filas.append({
            "equipo": e,
            "zona": zona[e],
            "campeon": 100 * res["campeon"].get(i, 0) / n,
            "playoffs": 100 * res["clasifica"][i] / n,
        })
    tabla = pd.DataFrame(filas).sort_values("campeon", ascending=False)

    lineas = []

    def escribir(t=""):
        print(t)
        lineas.append(t)

    escribir(f"# Simulacion del Clausura {TEMPORADA}")
    escribir()
    escribir(f"**{n:,} simulaciones** · {len(jugados)} partidos jugados · "
             f"{len(pendientes)} por jugar")
    escribir()
    escribir("| Equipo | Zona | Campeon | Llega a playoffs |")
    escribir("|---|:--:|---:|---:|")
    for f in tabla.itertuples():
        escribir(f"| {f.equipo} | {f.zona} | {f.campeon:.1f}% | {f.playoffs:.1f}% |")
    escribir()
    escribir("## Como leer esto")
    escribir()
    escribir("Se jugo el torneo que falta " + f"{n:,} veces" + ", con las probabilidades del")
    escribir("modelo. Si un equipo salio campeon en 1.500 de esas veces, tiene 15%.")
    escribir()
    escribir("**Supuestos** (importan para saber cuanto confiar):")
    escribir()
    escribir("- Los cruces interzonales del Clausura no se conocen: se usan los del")
    escribir("  Apertura con la localia invertida. Los 28 partidos de cada zona si son")
    escribir("  exactos, porque todos juegan contra todos.")
    escribir("- Los penales se resuelven con una moneda al aire (50/50).")
    escribir("- El modelo no sabe de lesiones, refuerzos ni cambios de tecnico.")

    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text("\n".join(lineas) + "\n", encoding="utf-8")
    print(f"\nOK  -> {DESTINO}")


if __name__ == "__main__":
    main()
