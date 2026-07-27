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
    partido sea de los primeros 16 de AMBOS equipos, no de alguno. Al Apertura
    2026 le falta un partido de fase regular (`Estudiantes (LP)` vs `Lanus`), asi
    que esos dos llegan a sus octavos habiendo jugado 15 y no 16. Con "alguno"
    esos dos octavos entrarian como fase regular; con "ambos" quedan afuera
    porque el rival de cada uno si llegaba con 16.

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


def revisar_interzonales(plantilla, zona):
    """
    Contrasta la plantilla de interzonales contra el formato del torneo.

    No corrige nada: avisa. Existe porque el criterio de `fase_regular` se apoya
    en una fuente que ya se sabe incompleta, y un interzonal de menos no rompe
    nada visible — simplemente un equipo simula 15 partidos en vez de 16 y nadie
    se entera. Un aviso ruidoso hoy vale mas que un dato sucio que no ves durante
    seis meses.
    """
    esperados = len(zona) * INTERZONALES_POR_EQUIPO // 2
    por_equipo = Counter()
    for local, visita in plantilla:
        por_equipo[local] += 1
        por_equipo[visita] += 1
    raros = {e: por_equipo[e] for e in sorted(zona)
             if por_equipo[e] != INTERZONALES_POR_EQUIPO}
    if len(plantilla) != esperados or raros:
        print(f"AVISO: la plantilla de interzonales tiene {len(plantilla)} cruces "
              f"y por formato deberian ser {esperados}.")
        for e, n in raros.items():
            print(f"       {e}: {n} interzonales en vez de {INTERZONALES_POR_EQUIPO}")
        print("       Revisa si a la fuente le faltan partidos del torneo anterior.")


def localia_del_torneo_anterior(partidos):
    """
    Quien fue local en cada cruce del torneo anterior: par de equipos -> local.

    Recibe SOLO la fase regular (ver `fase_regular`), que es la que se invierte
    para el torneo siguiente. Ahi cada par se cruzo una sola vez, asi que no hay
    ambiguedad posible sobre quien puso la cancha.

    El par va sin orden (frozenset) porque la pregunta es "de estos dos, quien
    puso la cancha", no "quien figura primero".

    Se ordena por fecha antes de recorrer para que el resultado no dependa del
    orden de las filas del CSV, que es lo que mantiene reproducible al pipeline.
    Y se guarda la primera aparicion de cada par por si en el futuro entrara un
    partido repetido: mejor quedarse con el mas viejo de forma determinista que
    con el que casualmente venga ultimo.
    """
    orden = partidos.sort_values("date", kind="stable")
    localia = {}
    for f in orden.itertuples():
        localia.setdefault(frozenset((f.home_team, f.away_team)), f.home_team)
    return localia


def partidos_pendientes(zona, jugados, plantilla_interzonal, localia_anterior):
    """
    Que partidos faltan jugar, y quien los juega de local.

    QUIENES juegan contra quienes, dentro de una zona, es facil: todos contra
    todos, asi que sabemos exactamente quien le debe partido a quien. Restamos
    los ya jugados.

    DONDE se juega es otra historia, y no es un detalle: el modelo le suma al
    local una ventaja de alrededor de 30% en goles esperados (el valor exacto
    lo estima `model.py`). Repartir mal la localia inclina todas las
    probabilidades del sitio.

    El fixture del Clausura no se conoce de antemano, pero el futbol argentino
    invierte la localia entre Apertura y Clausura: si en el Apertura A recibio a
    B, en el Clausura recibe B. Asi que la sacamos de ahi, exactamente igual que
    ya se hacia con los interzonales.

    Es un supuesto, y esta marcado como tal en el reporte.
    """
    ya = {frozenset((f.home_team, f.away_team)) for f in jugados.itertuples()}
    pendientes = []

    for z in ("A", "B"):
        equipos = sorted([e for e in zona if zona[e] == z])
        for i, a in enumerate(equipos):
            for b in equipos[i + 1:]:
                par = frozenset((a, b))
                if par in ya:
                    continue
                local_anterior = localia_anterior.get(par)
                if local_anterior is None:
                    # Sin antecedente en el Apertura no hay nada que invertir.
                    # Pasa en un solo partido de los 237 y es consecuencia de un
                    # agujero conocido de la fuente: al Apertura 2026 le falta
                    # `Estudiantes (LP)` vs `Lanus` (254 partidos en vez de 255,
                    # ver README y reference/formato-torneos.md).
                    #
                    # Criterio: local el primero alfabeticamente. No pretende ser
                    # el verdadero: es un desempate ARBITRARIO y DETERMINISTA,
                    # para que dos corridas del pipeline no publiquen numeros
                    # distintos sin que haya cambiado ningun dato.
                    local, visita = a, b
                else:
                    local = b if local_anterior == a else a
                    visita = a if local == b else b
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

    Y otro: el par se busca SIN ORDEN, y despues se mira de que lado quedo el
    equipo para saber cuando gano y cuando perdio. No es por las dudas: la
    localia que la simulacion le asigna a un partido sale de invertir la del
    Apertura, y la del fixture es la real. Cuando las dos coinciden, buscar por
    tupla ordenada daria lo mismo; cuando no coinciden (fixture real distinto
    del supuesto, o el partido sin antecedente en el Apertura), buscar por tupla
    ordenada no encontraria el partido y el equipo se quedaria sin escenarios
    por un detalle de orden. Buscando sin orden, el escenario se muestra igual y
    la unica diferencia es de que lado estimo el modelo la ventaja de local.
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
    """
    Saca los cruces entre zonas del Apertura, con la localia invertida.

    `partidos` tiene que venir filtrado por `fase_regular`: los playoffs son
    cruzados por construccion y si entran se hacen pasar por interzonales.
    """
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

    # El Apertura trae fase regular Y playoffs. Para armar el molde del Clausura
    # sirve solo la fase regular: los playoffs son cruces de eliminacion directa,
    # no fixture que se repita.
    regular = fase_regular(apertura)
    print(f"Apertura {TEMPORADA}: {len(regular)} partidos de fase regular "
          f"de {len(apertura)} ({len(apertura) - len(regular)} de playoffs)")

    plantilla = interzonales_del_torneo_anterior(regular, zona)
    revisar_interzonales(plantilla, zona)
    pendientes = partidos_pendientes(zona, jugados, plantilla,
                                     localia_del_torneo_anterior(regular))

    print(f"Clausura {TEMPORADA}: {len(jugados)} partidos jugados, "
          f"{len(pendientes)} por jugar\n")

    proximos = proximo_partido_por_equipo(set(zona))
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
    escribir("**Supuestos** (importan para saber cuanto confiar):")
    escribir()
    escribir("- QUIENES juegan contra quienes dentro de cada zona es exacto: todos")
    escribir("  juegan contra todos. Los cruces interzonales no, porque salen de un")
    escribir("  sorteo: se usan los {} de la FASE REGULAR del Apertura. Los partidos"
             .format(len(plantilla)))
    escribir("  de playoffs del Apertura quedan afuera a proposito: son cruzados por")
    escribir("  construccion (1ro de una zona contra 8vo de la otra) y si se colaran")
    escribir("  pasarian por interzonales, dandole a algunos equipos mas de los 16")
    escribir("  partidos que el formato les da.")
    escribir("- DONDE se juega cada partido es un supuesto: el fixture del Clausura no")
    escribir("  se conoce de antemano, asi que se toma la localia del Apertura y se")
    escribir("  invierte, que es como funciona el torneo argentino. Importa porque el")
    escribir("  modelo le da al local un +{:.4f} en goles esperados.".format(
        modelo["ventaja_local"]))
    escribir("- Un solo partido del Clausura no tiene antecedente en el Apertura")
    escribir("  (`Estudiantes (LP)` vs `Lanus`, que falta en la fuente): ahi la localia")
    escribir("  se resuelve con un desempate arbitrario y fijo.")
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
