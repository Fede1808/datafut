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
FIXTURES = RAIZ / "data" / "raw" / "fixtures.csv"
TABLA_EQUIPOS = RAIZ / "reference" / "team_names.csv"
DESTINO = RAIZ / "data" / "outputs" / "simulacion.md"
DESTINO_JSON = RAIZ / "data" / "outputs" / "simulacion.json"

# El Clausura 2026 arranca el 23/07. Todo lo anterior de esa temporada es
# Apertura, que ya termino.
TEMPORADA = "2026"
INICIO_CLAUSURA = "2026-07-23"

CLASIFICAN_POR_ZONA = 8

# Umbral de confianza de los escenarios condicionales.
#
# Un condicional del tipo "si gana, llega a playoffs con X%" se calcula mirando
# SOLO las simulaciones en las que ese equipo gano ese partido. Si esa rama se
# quedo con pocas simulaciones, el porcentaje es ruido: con 100 simulaciones el
# error estandar de un 50% es 5 puntos porcentuales, y dos corridas del pipeline
# publicarian numeros visiblemente distintos sin que haya cambiado nada.
#
# Con 500 el error estandar en el peor caso (50%) baja a ~2,2 pp, que es el
# limite de lo que se puede mostrar con un decimal sin mentir. Debajo de eso la
# rama se marca no confiable y el sitio no la muestra: mejor no decir nada que
# decir un numero inventado por el azar del muestreo.
MIN_SIMS_RAMA = 500


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


def proximo_partido_por_equipo(equipos):
    """
    El proximo partido REAL de cada equipo, sacado del fixture.

    Ojo con la diferencia: `pendientes` es lo que la simulacion juega, y los
    cruces interzonales de ahi son inventados a partir del Apertura. El fixture,
    en cambio, es el calendario de verdad. Para contar "que se juega el equipo
    el domingo" hay que arrancar del fixture, no de `pendientes`.

    Si un equipo aparece en varias filas se toma la primera cronologicamente.
    Si no hay fixture, se devuelve vacio y el pipeline sigue: los escenarios son
    un extra, no pueden voltear la simulacion.
    """
    if not FIXTURES.exists():
        print(f"AVISO: no existe {FIXTURES}; no se calculan escenarios.")
        return {}

    nombres = pd.read_csv(TABLA_EQUIPOS, encoding="utf-8")
    canonico = dict(zip(nombres.raw, nombres.canonical))

    fx = pd.read_csv(FIXTURES, encoding="utf-8-sig")
    fx = fx[fx.Country == "Argentina"].copy()
    # El fixture trae la fecha como dd/mm/aaaa. Se parsea para ordenar de
    # verdad: alfabeticamente "26/07" iria antes que "3/08".
    fx["_cuando"] = pd.to_datetime(fx.Date + " " + fx.Time.fillna("00:00"),
                                   format="%d/%m/%Y %H:%M", errors="coerce")
    fx = fx.sort_values("_cuando", kind="stable")

    proximo = {}
    for f in fx.itertuples():
        local = canonico.get(f.Home, f.Home)
        visita = canonico.get(f.Away, f.Away)
        if local not in equipos or visita not in equipos:
            continue
        for equipo, rival, condicion in ((local, visita, "local"),
                                         (visita, local, "visita")):
            if equipo not in proximo:
                proximo[equipo] = {"rival": rival, "condicion": condicion,
                                   "fecha": f.Date, "hora": f.Time}
    return proximo


def calcular_escenarios(equipos, pendientes, gl, gv, campeon, clasifico, proximos):
    """
    Que se juega cada equipo en su proximo partido.

    LA IDEA, QUE ES LO IMPORTANTE: no hace falta volver a simular nada. Cada una
    de las 10.000 simulaciones ya contiene el resultado sorteado de ese partido
    Y el desenlace final del torneo. Entonces alcanza con AGRUPAR:

        P(playoffs | gana) = (simulaciones donde gano Y clasifico)
                             / (simulaciones donde gano)

    Es gratis: son las mismas simulaciones miradas en tres montones.

    Un detalle que hay que respetar: el partido del fixture puede no estar en
    `pendientes` (los interzonales de la simulacion son inventados). En ese caso
    el equipo NO tiene escenarios. No se aproxima con otro partido.

    Y otro: en `pendientes` la localia de los partidos de zona es arbitraria
    (sale del orden alfabetico), asi que el par se busca sin orden y despues se
    mira de que lado quedo el equipo para saber cuando gano y cuando perdio.
    """
    n = gl.shape[1]
    idx = {e: i for i, e in enumerate(equipos)}

    # Indice de partidos pendientes por par de equipos, sin importar quien
    # figura de local.
    donde = {}
    for i, (local, visita) in enumerate(pendientes):
        donde.setdefault(frozenset((local, visita)), (i, local))

    salida = []
    for equipo in equipos:
        p = proximos.get(equipo)
        if p is None:
            continue
        ubicacion = donde.get(frozenset((equipo, p["rival"])))
        if ubicacion is None:
            continue
        i, local_en_sim = ubicacion

        # int16 para que la resta no desborde el int8 de los goles.
        dif = gl[i].astype(np.int16) - gv[i].astype(np.int16)
        if local_en_sim == equipo:
            gana, pierde = dif > 0, dif < 0
        else:
            gana, pierde = dif < 0, dif > 0
        empata = dif == 0

        je = idx[equipo]
        ramas = []
        for resultado, mask in (("gana", gana), ("empata", empata),
                                ("pierde", pierde)):
            sims = int(mask.sum())
            confiable = sims >= MIN_SIMS_RAMA
            ramas.append({
                "resultado": resultado,
                "simulaciones": sims,
                "prob_resultado": round(100 * sims / n, 2),
                "campeon": round(100 * float((campeon[mask] == je).mean()), 2)
                           if sims else None,
                "playoffs": round(100 * float(clasifico[mask, je].mean()), 2)
                            if sims else None,
                "confiable": confiable,
            })

        salida.append({
            "equipo": equipo,
            "rival": p["rival"],
            "condicion": p["condicion"],
            "fecha": p["fecha"],
            "hora": p["hora"],
            "ramas": ramas,
        })
    return salida


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
    """
    El registro completo de lo que ya se jugo, equipo por equipo.

    Devuelve mas que puntos (ganados, empatados, perdidos, goles en contra)
    porque el sitio publica la tabla de posiciones y el simulador arranca de
    esa misma base. Una sola cuenta para los dos consumidores: si cada uno
    sumara los puntos por su lado, tarde o temprano dirian cosas distintas.
    """
    reg = {e: {"pj": 0, "pg": 0, "pe": 0, "pp": 0,
               "gf": 0, "gc": 0, "dif": 0, "pts": 0} for e in equipos}
    for f in jugados.itertuples():
        gl, gv = int(f.home_goals), int(f.away_goals)
        local, visita = reg[f.home_team], reg[f.away_team]
        local["pj"] += 1
        visita["pj"] += 1
        local["gf"] += gl
        local["gc"] += gv
        visita["gf"] += gv
        visita["gc"] += gl
        if gl > gv:
            local["pg"] += 1
            visita["pp"] += 1
            local["pts"] += 3
        elif gv > gl:
            visita["pg"] += 1
            local["pp"] += 1
            visita["pts"] += 3
        else:
            local["pe"] += 1
            visita["pe"] += 1
            local["pts"] += 1
            visita["pts"] += 1
    for r in reg.values():
        r["dif"] = r["gf"] - r["gc"]
    return reg


def tabla_posiciones(jugados, zona):
    """
    La tabla de posiciones de cada zona, ya ordenada y con el puesto puesto.

    El orden usa los mismos criterios de desempate que la simulacion (puntos,
    diferencia de gol, goles a favor). El nombre al final no es un criterio
    real del reglamento: esta para que dos equipos empatados en todo salgan
    siempre en el mismo orden y el pipeline sea reproducible.
    """
    reg = puntos_iniciales(jugados, sorted(zona))
    filas = []
    for z in ("A", "B"):
        equipos = sorted(
            (e for e in zona if zona[e] == z),
            key=lambda e: (-reg[e]["pts"], -reg[e]["dif"], -reg[e]["gf"], e),
        )
        for puesto, e in enumerate(equipos, start=1):
            filas.append({"equipo": e, "zona": z, "puesto": puesto, **reg[e]})
    return filas


def jugados_del_clausura(partidos):
    """
    Los partidos que cuentan para la tabla: liga (no copa), temporada actual,
    desde que arranco el Clausura. Vive aca para que la simulacion y el
    export miren exactamente el mismo universo de partidos.
    """
    t = partidos[(partidos.season_id == TEMPORADA) &
                 (partidos.competition == "liga")]
    return t[t.date >= INICIO_CLAUSURA]


def simular(modelo, zona, jugados, pendientes, n, semilla=None, proximos=None):
    if semilla is not None:
        np.random.seed(semilla)

    equipos = sorted(zona)
    idx = {e: i for i, e in enumerate(equipos)}
    ne = len(equipos)

    reg = puntos_iniciales(jugados, equipos)
    base_pts = np.array([reg[e]["pts"] for e in equipos], dtype=np.int32)
    base_dif = np.array([reg[e]["dif"] for e in equipos], dtype=np.int32)
    base_gf = np.array([reg[e]["gf"] for e in equipos], dtype=np.int32)

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
    # Se guarda QUIEN clasifico en CADA simulacion, no solo el total. Cuesta
    # 30 bits por simulacion y es lo que despues permite cruzar el desenlace
    # del torneo con el resultado de un partido puntual, sin volver a simular.
    clasifico = np.zeros((n, ne), dtype=bool)

    for s in range(n):
        # Top 8 de cada zona, de mejor a peor.
        top_a = sorted(zona_a, key=lambda i: -ranking[s, i])[:CLASIFICAN_POR_ZONA]
        top_b = sorted(zona_b, key=lambda i: -ranking[s, i])[:CLASIFICAN_POR_ZONA]
        clasifico[s, top_a + top_b] = True

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

    escenarios = calcular_escenarios(equipos, pendientes, gl, gv, campeon,
                                     clasifico, proximos or {})

    return {
        "equipos": equipos,
        "campeon": Counter(campeon.tolist()),
        "clasifica": clasifico.sum(axis=0),
        "n": n,
        "escenarios": escenarios,
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
    jugados = jugados_del_clausura(partidos)

    desconocidos = [e for e in zona if e not in modelo["ataque"]]
    if desconocidos:
        sys.exit("ERROR: el modelo no conoce a estos equipos:\n"
                 + "\n".join(f"  - {e}" for e in desconocidos)
                 + "\n       Reentrena con:  python src/model.py")

    plantilla = interzonales_del_torneo_anterior(apertura, zona)
    pendientes = partidos_pendientes(zona, jugados, plantilla)

    print(f"Clausura {TEMPORADA}: {len(jugados)} partidos jugados, "
          f"{len(pendientes)} por jugar\n")

    proximos = proximo_partido_por_equipo(set(zona))
    res = simular(modelo, zona, jugados, pendientes, args.n,
                  semilla=args.semilla, proximos=proximos)

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

    # Ademas del reporte para leer, guardamos los datos crudos. El .md es para
    # una persona; el .json es para el sitio y para el generador de placas.
    DESTINO_JSON.write_text(json.dumps({
        "temporada": TEMPORADA,
        "torneo": "Clausura",
        "simulaciones": n,
        "partidos_jugados": len(jugados),
        "partidos_pendientes": len(pendientes),
        "equipos": [
            {"equipo": f.equipo, "zona": f.zona,
             "campeon": round(f.campeon, 2), "playoffs": round(f.playoffs, 2)}
            for f in tabla.itertuples()
        ],
        "min_simulaciones_rama": MIN_SIMS_RAMA,
        "escenarios": res["escenarios"],
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK  -> {DESTINO_JSON}")
    print(f"    escenarios de {len(res['escenarios'])} de {len(equipos)} equipos")


if __name__ == "__main__":
    main()
