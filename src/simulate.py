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


DE DONDE SALEN LOS PARTIDOS QUE FALTAN
---------------------------------------
Del calendario REAL (data/clean/fixture.csv), que baja ingest_fixture.py de
FotMob y normaliza clean_fixture.py. Este script no arma ningun partido.

Hasta julio de 2026 los fabricaba: todos contra todos dentro de la zona menos
los jugados, con la localia invertida respecto del Apertura y los interzonales
copiados del torneo anterior. Eran los mismos 225 partidos que la fuente ya
publicaba de una — con la diferencia de que la localia era un supuesto, y la
localia vale ~30% mas goles esperados para el que la tiene.

Asi que antes de correr esto:

    python src/ingest_fixture.py
    python src/clean_fixture.py


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
# El calendario REAL de lo que falta jugar, que arma clean_fixture.py con los
# datos de FotMob. Antes esto se fabricaba a mano aca adentro; ver
# `partidos_pendientes`.
FIXTURE = RAIZ / "data" / "clean" / "fixture.csv"
DESTINO = RAIZ / "data" / "outputs" / "simulacion.md"
DESTINO_JSON = RAIZ / "data" / "outputs" / "simulacion.json"

# El Clausura 2026 arranca el 23/07. Todo lo anterior de esa temporada es
# Apertura, que ya termino.
TEMPORADA = "2026"
INICIO_CLAUSURA = "2026-07-23"

# Como se llama el torneo en curso. Es la etiqueta con la que clean_fixture.py
# marca cada partido del calendario, y con la que se filtra el fixture.
TORNEO = "Clausura"

CLASIFICAN_POR_ZONA = 8

# --- Descensos -------------------------------------------------------------
#
# Reglamento vigente 2026 (ver reference/formato-torneos.md, seccion
# "Descensos"): bajan DOS equipos.
#
#   1. El ultimo de la tabla de PROMEDIOS: puntos divididos partidos jugados
#      sobre las ultimas tres temporadas (2024, 2025 y 2026).
#   2. El ultimo de la tabla ANUAL: solo la temporada en curso, sumando
#      Apertura y Clausura.
#
# Si el mismo club queda ultimo en las dos, el cupo de la anual pasa al
# siguiente de esa tabla.
#
# ATENCION, esto no es un detalle: el reglamento cambio TRES veces en tres
# anios (3 descensos hasta 2022, 2 en 2023, CERO en 2024, 2 desde 2025). Hay
# que reverificarlo cada temporada antes de publicar estos numeros.
TEMPORADAS_PROMEDIO = ["2024", "2025", "2026"]

# Que torneos suman para el promedio. Se incluye la Copa de la Liga porque en
# 2024 fue uno de los dos torneos oficiales del anio, no una copa aparte.
#
# Es la decision mas discutible de todo este bloque, asi que se midio en vez de
# suponerla: se calculo la tabla de promedios con las cuatro combinaciones
# posibles (con y sin Copa de la Liga, con y sin partidos de playoffs) y los
# DOS ultimos son los mismos en las cuatro -- Estudiantes (RC) ~0.31 y Aldosivi
# ~0.72/0.86 -- con mas de 0.20 de distancia hasta el tercero. O sea que la
# pelea por el descenso por promedio no depende de esta eleccion.
COMPETENCIAS_PROMEDIO = ("liga", "copa_liga")

# El formato vigente (2025-2026): cada equipo juega 16 partidos de fase regular,
# 14 contra su zona y 2 interzonales. Ver reference/formato-torneos.md.
PARTIDOS_FASE_REGULAR = 16
INTERZONALES_POR_EQUIPO = 2

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


def fase_regular(partidos):
    """
    Se queda solo con la fase regular del torneo, tirando los playoffs.

    POR QUE HACE FALTA. El Apertura que se usa de molde para el Clausura no es
    solo la fase regular: adentro vienen tambien los 15 partidos de playoffs. Y
    los playoffs son CRUZADOS por construccion (1ro de una zona contra 8vo de la
    otra), asi que sin filtrarlos se cuelan como si fueran interzonales de fase
    regular. Eso daba 39 interzonales en vez de 30, y catorce equipos jugando 17
    partidos y dos jugando 18 en un torneo de 16: partidos de mas para sumar
    puntos, o sea probabilidades infladas.

    EL CRITERIO: los primeros 16 partidos de cada equipo son su fase regular,
    y un partido es de fase regular solo si lo es PARA LOS DOS. Sale de contar
    partidos por equipo, que es como este proyecto ya venia infiriendo la ronda
    (16 = no clasifico, 17 = perdio octavos, 18 = cuartos, ... ver
    reference/formato-torneos.md).

    Por que este y no los otros que se evaluaron:

    - **Por fecha de corte**: no hay corte que encontrar. Entre la ultima fecha
      regular (05/05) y los octavos (09/05) hay 4 dias, los mismos que entre dos
      fechas regulares (28/04 y 02/05). El hueco que separa Apertura de Clausura
      existe (60 dias); este no.
    - **Los ultimos 15 partidos son los playoffs**: depende de que el total
      cierre en 255, y el Apertura 2026 tiene 254. Con un partido menos se comeria
      un partido de fase regular. La consigna es justamente que el criterio no
      puede depender de que el numero cierre.
    - **Los primeros 30 cruces entre zonas**: es circular (usa el resultado para
      decidir el criterio) y ademas el orden de las filas mandaria sobre el
      resultado.

    EL DETALLE QUE HACE QUE FUNCIONE, y que no es cosmetico: se pide que el
    partido sea de los primeros 16 de AMBOS equipos, no de alguno. Cuando se
    escribio esto, al Apertura 2026 le faltaba un partido de fase regular
    (`Estudiantes (LP)` vs `Lanus`), asi que esos dos llegaban a sus octavos
    habiendo jugado 15 y no 16. Con "alguno" esos dos octavos entraban como fase
    regular; con "ambos" quedaban afuera porque el rival de cada uno si llegaba
    con 16. El agujero despues se tapo (clean.py completa los resultados con
    FotMob y el Apertura cierra en 255), pero el criterio se mantiene: la fuente
    ya demostro que pierde partidos y va a volver a pasar.

    LO QUE ESTE CRITERIO NO AGUANTA: que los DOS equipos de un mismo partido de
    playoffs vengan con un agujero. Como la fuente ya demostro que pierde
    partidos, el resultado no se da por bueno: se chequea contra el formato
    (30 interzonales, 2 por equipo) y si no cierra, avisa fuerte.
    """
    orden = partidos.sort_values("date", kind="stable")
    jugados = Counter()
    de_fase_regular = []
    for f in orden.itertuples():
        de_fase_regular.append(jugados[f.home_team] < PARTIDOS_FASE_REGULAR and
                               jugados[f.away_team] < PARTIDOS_FASE_REGULAR)
        jugados[f.home_team] += 1
        jugados[f.away_team] += 1
    return orden[de_fase_regular]


def cargar_fixture(zona):
    """
    El calendario REAL de lo que falta jugar del torneo en curso.

    Sale de data/clean/fixture.csv (ingest_fixture.py + clean_fixture.py), que
    baja el calendario de FotMob. Viene ordenado cronologicamente y con los
    nombres ya canonicos.

    Falla ruidosamente por lo mismo que falla clean_fixture.py: un fixture
    incompleto NO se ve roto. La simulacion simplemente juega un torneo con
    menos partidos, reparte menos puntos, y publica probabilidades de titulo y
    de descenso equivocadas para los 30 equipos sin que nada avise. Si aparece
    un equipo que no esta en las zonas cargadas, se corta.
    """
    if not FIXTURE.exists():
        sys.exit(
            f"ERROR: no existe {FIXTURE}\n"
            f"       Primero corre:  python src/ingest_fixture.py\n"
            f"                       python src/clean_fixture.py"
        )

    fx = pd.read_csv(FIXTURE, encoding="utf-8")
    fx = fx[fx.torneo == TORNEO].sort_values(["utc", "match_id"], kind="stable")
    if fx.empty:
        sys.exit(
            f"ERROR: {FIXTURE} no tiene ningun partido del {TORNEO}.\n"
            f"       Si el torneo no termino, volve a bajar el fixture:\n"
            f"       python src/ingest_fixture.py"
        )

    afuera = sorted((set(fx.local) | set(fx.visitante)) - set(zona))
    if afuera:
        sys.exit(
            "ERROR: el fixture trae equipos que no estan en reference/zonas.csv:\n"
            + "\n".join(f"  - {e}" for e in afuera)
            + f"\n       Cargalos en la zona que les corresponde para la temporada "
              f"{TEMPORADA}."
        )
    return fx


def partidos_pendientes(fixture, jugados):
    """
    Que partidos faltan jugar, y quien los juega de local.

    Es una lectura del calendario de verdad, y nada mas. Antes esto FABRICABA
    los partidos: armaba el todos contra todos de cada zona, restaba los
    jugados, y para decidir quien era local invertia la localia del Apertura
    (que es como suele funcionar el torneo argentino, pero era un supuesto);
    los cruces interzonales se copiaban tal cual del torneo anterior.

    Eran los MISMOS 225 partidos que FotMob publica de una, en el mismo JSON
    del que ya se bajaban los partidos jugados. Ahora se leen.

    Que se gano, concretamente: la localia. No es cosmetico. El modelo le da al
    local una ventaja de ~0.27 en goles esperados (~30% mas goles), asi que cada
    partido en el que el supuesto se equivocaba de lado inclinaba las
    probabilidades del sitio para los dos equipos.

    LO UNICO QUE SE DESCARTA son los partidos que el historico ya da por
    jugados. No es "por las dudas": el fixture lo publica FotMob y los
    resultados salen de football-data.co.uk, y las dos fuentes no se enteran de
    un partido al mismo tiempo. En la ventana entre una y otra, el mismo partido
    puede estar en las dos listas, y simularlo ademas de contarlo le regalaria
    puntos a los dos equipos. Es el mismo cuidado que ya tiene export.py con los
    partidos del fixture que ya se jugaron.
    """
    ya = {frozenset((f.home_team, f.away_team)) for f in jugados.itertuples()}
    return [(f.local, f.visitante) for f in fixture.itertuples()
            if frozenset((f.local, f.visitante)) not in ya]


def revisar_fixture(zona, jugados, pendientes):
    """
    Contrasta jugados + pendientes contra el formato del torneo.

    No corrige nada: avisa. Cada equipo tiene que terminar el torneo con
    PARTIDOS_FASE_REGULAR partidos; si a alguno le faltan, es que la fuente
    perdio un partido, y eso no se ve roto en ningun lado — el equipo
    simplemente juega menos, suma menos puntos y aparece con menos chances.

    Tambien se cuentan los interzonales, que por formato son
    INTERZONALES_POR_EQUIPO por equipo. Es la comprobacion mas barata de que el
    calendario que bajamos es el de este torneo y no una mezcla.
    """
    total = Counter()
    inter = Counter()
    for f in jugados.itertuples():
        for e, otro in ((f.home_team, f.away_team), (f.away_team, f.home_team)):
            total[e] += 1
            if zona.get(e) != zona.get(otro):
                inter[e] += 1
    for local, visita in pendientes:
        for e, otro in ((local, visita), (visita, local)):
            total[e] += 1
            if zona.get(e) != zona.get(otro):
                inter[e] += 1

    raros = {e: (total[e], inter[e]) for e in sorted(zona)
             if total[e] != PARTIDOS_FASE_REGULAR
             or inter[e] != INTERZONALES_POR_EQUIPO}
    if raros:
        print(f"AVISO: por formato cada equipo juega {PARTIDOS_FASE_REGULAR} "
              f"partidos ({INTERZONALES_POR_EQUIPO} interzonales). No cierra en:")
        for e, (t, i) in raros.items():
            print(f"       {e}: {t} partidos, {i} interzonales")
        print("       Volve a bajar el fixture:  python src/ingest_fixture.py")


def proximo_partido_por_equipo(fixture, equipos):
    """
    El proximo partido de cada equipo, sacado del mismo fixture que se simula.

    Antes esto leia el fixture de football-data.co.uk, que es otra fuente y
    llegaba tarde: publica una fecha por vez y tarda dias despues de cada
    jornada. En esa ventana no habia proximo partido para nadie y el sitio se
    quedaba sin escenarios (medido: 0 de 30 equipos). Leyendo el calendario
    completo de FotMob eso no puede volver a pasar.

    Y hay un segundo beneficio, que era el bug de fondo: como la simulacion
    inventaba la localia, el partido del fixture podia no coincidir con el
    partido simulado y el equipo se quedaba sin escenarios. Ahora las dos cosas
    salen de la misma fila del mismo archivo.

    `fixture` viene ordenado cronologicamente, asi que la primera aparicion de
    cada equipo es su proximo partido.
    """
    proximo = {}
    for f in fixture.itertuples():
        if f.local not in equipos or f.visitante not in equipos:
            continue
        for equipo, rival, condicion in ((f.local, f.visitante, "local"),
                                         (f.visitante, f.local, "visita")):
            if equipo not in proximo:
                proximo[equipo] = {"rival": rival, "condicion": condicion,
                                   "fecha": f.fecha, "hora": f.hora,
                                   "ronda": int(f.ronda)}
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

    El proximo partido y los partidos que se simulan salen ahora del MISMO
    fixture, asi que el partido siempre esta en `pendientes` y la localia es la
    misma en los dos lados. Antes no: la simulacion inventaba la localia y el
    proximo partido venia de otra fuente, y cuando no coincidian el equipo se
    quedaba sin escenarios.

    Aun asi el par se sigue buscando SIN ORDEN (frozenset). Es barato y cubre el
    unico caso que queda: que football-data ya haya publicado el resultado de un
    partido que FotMob todavia da por pendiente. Ahi el partido no esta en
    `pendientes` y el equipo se queda sin escenarios, que es lo correcto — no se
    aproxima con otro partido.
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
            "ronda": p["ronda"],
            "fecha": p["fecha"],
            "hora": p["hora"],
            "ramas": ramas,
        })
    return salida


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


def bases_de_descenso(partidos, apertura_regular, jugados, pendientes, equipos):
    """
    Todo lo que hay que saber ANTES de simular para calcular los descensos.

    Las dos tablas del descenso arrancan con puntos que ya estan hechos y solo
    les falta sumarles el Clausura. Eso es lo que se prepara aca:

      anual_*    lo que cada equipo hizo en la FASE REGULAR del Apertura 2026.
                 Los playoffs quedan afuera a proposito: la tabla anual suma
                 los dos torneos del anio, no la copa que se juega adentro de
                 cada uno.
      prom_pts   puntos de las ultimas tres temporadas SIN el Clausura, que la
                 simulacion agrega despues.
      prom_pj    partidos jugados que le corresponden a cada equipo al final
                 del torneo. A un recien ascendido se le divide solo por lo
                 que jugo en primera: Estudiantes (RC) y Gimnasia (M) tienen
                 una temporada, Aldosivi dos, el resto tres.

    Los devuelve como arrays alineados con `equipos` para poder hacer la cuenta
    de las 10.000 simulaciones de una.
    """
    en_liga = set(equipos)
    indice = {e: i for i, e in enumerate(equipos)}

    anual = puntos_iniciales(apertura_regular, equipos)
    anual_pts = np.array([anual[e]["pts"] for e in equipos], dtype=np.int32)
    anual_dif = np.array([anual[e]["dif"] for e in equipos], dtype=np.int32)
    anual_gf = np.array([anual[e]["gf"] for e in equipos], dtype=np.int32)

    # Las tres temporadas del promedio, menos el Clausura: esos partidos entran
    # despues por la simulacion (los jugados como base y los pendientes
    # sorteados). Contarlos aca seria contarlos dos veces.
    tres = partidos[partidos.season_id.isin(TEMPORADAS_PROMEDIO) &
                    partidos.competition.isin(COMPETENCIAS_PROMEDIO)]
    previo = tres[~((tres.season_id == TEMPORADA) &
                    (tres.date >= INICIO_CLAUSURA))]

    prom_pts = np.zeros(len(equipos), dtype=np.int32)
    prom_pj = np.zeros(len(equipos), dtype=np.int32)
    for f in previo.itertuples():
        for equipo, gf, gc in ((f.home_team, f.home_goals, f.away_goals),
                               (f.away_team, f.away_goals, f.home_goals)):
            # Los equipos que ya se fueron de primera aparecen como rivales en
            # 2024 y 2025: sus partidos cuentan para el que sigue en la liga,
            # pero ellos no tienen fila en esta tabla.
            if equipo not in en_liga:
                continue
            i = indice[equipo]
            prom_pj[i] += 1
            prom_pts[i] += 3 if gf > gc else (1 if gf == gc else 0)

    # Cuantos partidos de Clausura va a haber jugado cada equipo al final.
    pj_clausura = np.zeros(len(equipos), dtype=np.int32)
    for f in jugados.itertuples():
        pj_clausura[indice[f.home_team]] += 1
        pj_clausura[indice[f.away_team]] += 1
    for local, visita in pendientes:
        pj_clausura[indice[local]] += 1
        pj_clausura[indice[visita]] += 1

    return {
        "anual_pts": anual_pts,
        "anual_dif": anual_dif,
        "anual_gf": anual_gf,
        "prom_pts": prom_pts,
        "prom_pj": prom_pj + pj_clausura,
    }


def contar_descensos(pts, dif, gf, bases):
    """
    Quien se va a la B en cada una de las simulaciones.

    Recibe las tablas finales del Clausura de las 10.000 simulaciones y les
    suma lo que ya estaba hecho, para armar las dos tablas que definen el
    descenso. Despues, en cada simulacion:

      - el ULTIMO de la tabla de promedios se va;
      - el ULTIMO de la tabla anual se va tambien, y si resulta ser el mismo
        club, el cupo pasa al anteultimo de la anual (asi lo dice el
        reglamento).

    Devuelve, para cada equipo, en cuantas simulaciones descendio por cada via
    y en cuantas descendio por alguna.

    Detalle de reproducibilidad: los empates exactos se resuelven por orden
    alfabetico (que es como viene `equipos`), no al azar. Es arbitrario y esta
    bien que lo sea; lo que importa es que dos corridas del pipeline con los
    mismos datos publiquen el mismo numero.
    """
    n, ne = pts.shape

    # Tabla anual: Apertura (fase regular) + Clausura completo.
    anual = bases["anual_pts"] + pts
    anual_dif = bases["anual_dif"] + dif
    anual_gf = bases["anual_gf"] + gf
    orden_anual = anual * 1_000_000 + (anual_dif + 500) * 1_000 + anual_gf

    # Tabla de promedios: puntos de tres temporadas sobre partidos jugados.
    promedio = (bases["prom_pts"] + pts) / bases["prom_pj"]

    peor_promedio = np.argmin(promedio, axis=1)

    # Los dos peores de la anual. El segundo solo se usa si el peor ya se fue
    # por promedio.
    dos_peores = np.argsort(orden_anual, axis=1, kind="stable")[:, :2]
    peor_anual = np.where(dos_peores[:, 0] == peor_promedio,
                          dos_peores[:, 1], dos_peores[:, 0])

    filas = np.arange(n)
    baja = np.zeros((n, ne), dtype=bool)
    baja[filas, peor_promedio] = True
    baja[filas, peor_anual] = True

    return {
        "promedio": np.bincount(peor_promedio, minlength=ne),
        "anual": np.bincount(peor_anual, minlength=ne),
        "alguna": baja.sum(axis=0),
    }


def distribucion_de_puntos(columna):
    """
    El histograma de puntos finales de un equipo, comprimido para el JSON.

    El promedio solo miente por omision: "termina con 30 puntos" suena a
    certeza cuando en realidad el rango realista puede ir de 20 a 42. Esto
    guarda la forma completa de la distribucion, que es lo que despues permite
    dibujarla en el sitio.

    Formato: `desde` es el puntaje del primer bin y `probs` son los porcentajes
    de cada puntaje consecutivo a partir de ahi.

    Las colas se recortan en 0.05% (5 simulaciones de 10.000). No es solo por
    tamano del JSON: una cola de veinte barras invisibles estira el eje y
    achica justo la parte del grafico donde esta todo lo que importa.
    """
    conteo = np.bincount(columna)
    prob = 100 * conteo / len(columna)
    llenos = np.nonzero(prob >= 0.05)[0]
    desde, hasta = int(llenos[0]), int(llenos[-1])
    return {
        "desde": desde,
        "probs": [round(float(p), 2) for p in prob[desde:hasta + 1]],
    }


def simular(modelo, zona, jugados, pendientes, n, semilla=None, proximos=None,
            bases=None):
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

    # La distribucion de puntos ya estaba adentro de `pts`: hasta ahora se
    # tiraba y se publicaba solo el promedio.
    puntos = {
        "promedio": pts.mean(axis=0),
        "p10": np.percentile(pts, 10, axis=0),
        "p50": np.percentile(pts, 50, axis=0),
        "p90": np.percentile(pts, 90, axis=0),
        "dist": [distribucion_de_puntos(pts[:, i]) for i in range(ne)],
    }

    return {
        "equipos": equipos,
        "campeon": Counter(campeon.tolist()),
        "clasifica": clasifico.sum(axis=0),
        "n": n,
        "escenarios": escenarios,
        "puntos": puntos,
        "descenso": contar_descensos(pts, dif, gf, bases) if bases else None,
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

    # El Apertura trae fase regular Y playoffs. Para la tabla ANUAL (que define
    # uno de los dos descensos) sirve solo la fase regular: los playoffs son la
    # copa que se juega adentro del torneo, no puntos de la tabla del anio.
    regular = fase_regular(apertura)
    print(f"Apertura {TEMPORADA}: {len(regular)} partidos de fase regular "
          f"de {len(apertura)} ({len(apertura) - len(regular)} de playoffs)")

    fixture = cargar_fixture(zona)
    pendientes = partidos_pendientes(fixture, jugados)
    revisar_fixture(zona, jugados, pendientes)

    print(f"{TORNEO} {TEMPORADA}: {len(jugados)} partidos jugados, "
          f"{len(pendientes)} por jugar (fixture real de FotMob)\n")

    proximos = proximo_partido_por_equipo(fixture, set(zona))
    bases = bases_de_descenso(partidos, regular, jugados, pendientes,
                              sorted(zona))
    res = simular(modelo, zona, jugados, pendientes, args.n,
                  semilla=args.semilla, proximos=proximos, bases=bases)

    equipos, n = res["equipos"], res["n"]
    desc, puntos = res["descenso"], res["puntos"]
    filas = []
    for i, e in enumerate(equipos):
        filas.append({
            "equipo": e,
            "zona": zona[e],
            "campeon": 100 * res["campeon"].get(i, 0) / n,
            "playoffs": 100 * res["clasifica"][i] / n,
            "descenso": 100 * desc["alguna"][i] / n,
            "descenso_promedio": 100 * desc["promedio"][i] / n,
            "descenso_anual": 100 * desc["anual"][i] / n,
            "puntos": puntos["promedio"][i],
            "puntos_p10": puntos["p10"][i],
            "puntos_p50": puntos["p50"][i],
            "puntos_p90": puntos["p90"][i],
            "puntos_dist": puntos["dist"][i],
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
    escribir("| Equipo | Zona | Campeon | Llega a playoffs | Puntos (p10-p90) | Desciende |")
    escribir("|---|:--:|---:|---:|:--:|---:|")
    for f in tabla.itertuples():
        escribir(f"| {f.equipo} | {f.zona} | {f.campeon:.1f}% | {f.playoffs:.1f}% | "
                 f"{f.puntos:.1f} ({f.puntos_p10:.0f}-{f.puntos_p90:.0f}) | "
                 f"{f.descenso:.1f}% |")
    escribir()
    escribir("## Como leer esto")
    escribir()
    escribir("Se jugo el torneo que falta " + f"{n:,} veces" + ", con las probabilidades del")
    escribir("modelo. Si un equipo salio campeon en 1.500 de esas veces, tiene 15%.")
    escribir()
    escribir("**Que es dato y que es supuesto** (importa para saber cuanto confiar):")
    escribir()
    escribir("- El FIXTURE ES REAL, no se supone nada. Los {} partidos que faltan salen"
             .format(len(pendientes)))
    escribir("  del calendario que publica FotMob: quienes juegan, en que fecha del")
    escribir("  torneo, que dia y —lo que mas pesa— QUIEN JUEGA DE LOCAL. Eso ultimo")
    escribir("  no es un detalle: el modelo le da al local un +{:.4f} en goles".format(
        modelo["ventaja_local"]))
    escribir("  esperados, asi que equivocarse de lado inclina las probabilidades de")
    escribir("  los dos equipos. Hasta julio de 2026 la localia se suponia invirtiendo")
    escribir("  la del Apertura y los interzonales se copiaban de ahi; ya no.")
    escribir("- {} de esos partidos figuran POSTERGADOS en la fuente: se van a jugar,"
             .format(int(fixture.aplazado.sum())))
    escribir("  pero con fecha a confirmar. Entran a la simulacion igual, porque los")
    escribir("  puntos se reparten lo mismo se jueguen el sabado o dos meses despues.")
    escribir("- Los penales se resuelven con una moneda al aire (50/50).")
    escribir("- El modelo no sabe de lesiones, refuerzos ni cambios de tecnico.")
    escribir("- El descenso usa el reglamento 2026: bajan dos, el ultimo de la tabla")
    escribir("  de promedios (2024-2026) y el ultimo de la tabla anual (Apertura +")
    escribir("  Clausura, fase regular). Ese reglamento cambio tres veces en tres")
    escribir("  anios: **hay que reverificarlo cada temporada**.")
    escribir("- Para el promedio se suman los partidos de liga y de Copa de la Liga.")
    escribir("  Se probaron las cuatro combinaciones posibles (con y sin copa, con y")
    escribir("  sin playoffs) y los dos ultimos son los mismos en las cuatro, asi que")
    escribir("  la pelea del descenso no depende de esa eleccion.")

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
             "campeon": round(f.campeon, 2), "playoffs": round(f.playoffs, 2),
             "descenso": round(f.descenso, 2),
             "descenso_promedio": round(f.descenso_promedio, 2),
             "descenso_anual": round(f.descenso_anual, 2),
             "puntos": {
                 "promedio": round(float(f.puntos), 1),
                 "p10": int(f.puntos_p10),
                 "p50": int(f.puntos_p50),
                 "p90": int(f.puntos_p90),
             },
             "puntos_dist": f.puntos_dist}
            for f in tabla.itertuples()
        ],
        "min_simulaciones_rama": MIN_SIMS_RAMA,
        "escenarios": res["escenarios"],
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK  -> {DESTINO_JSON}")
    print(f"    escenarios de {len(res['escenarios'])} de {len(equipos)} equipos")


if __name__ == "__main__":
    main()
