"""
Etapa 7 del pipeline: EXPORTAR para el sitio.

=============================================================================
QUE HACE Y POR QUE EXISTE
=============================================================================

Todo lo anterior deja archivos pensados para leer en la terminal. Este script
los junta y escribe JSON, que es lo que el sitio web puede consumir.

La regla que ordena todo el proyecto: **una fuente, dos consumidores**. Estos
mismos JSON van a alimentar despues el generador de placas para redes. Si
cada uno calculara sus propios numeros, tarde o temprano se contradirian y
publicarias dos verdades distintas el mismo dia.

Escribe ocho archivos en web/data/:

  fecha.json       los partidos de la PROXIMA FECHA, con probabilidades, la
                   probabilidad implicita del mercado y la diferencia entre
                   las dos
  calendario.json  el torneo entero fecha por fecha: quien juega contra quien,
                   cuando, con que probabilidades y —en lo ya jugado— con el
                   resultado. Va aparte de fecha.json a proposito: ver el
                   comentario de la seccion 1b
  titulo.json      los 30 equipos con su chance de salir campeon
  tabla.json       la tabla de posiciones de las dos zonas
  equipos.json     ataque, defensa, descenso, distribucion de puntos, racha,
                   rendimiento contra el mercado y estadisticas avanzadas
                   (xG, posesion, duelos, remates) de cada equipo
  estadisticas.json  las 40 metricas de FotMob de cada equipo, con el puesto
                   en cada una. Va aparte de equipos.json a proposito: ver el
                   comentario de CLAVES_FICHA
  escenarios.json  cuanto cambia el futuro de cada equipo segun como le vaya
  meta.json        cuando se actualizo y que tan bien viene acertando el modelo

Uso:
    python src/export.py
"""

from pathlib import Path
from datetime import datetime, timezone
import json
import sys
import unicodedata

import numpy as np
import pandas as pd

from model import cargar_partidos, matriz_marcadores, probabilidades_1x2, MAX_GOLES
# La tabla se calcula en simulate.py y se importa: es la misma cuenta con la que
# arranca la simulacion. Duplicarla aca seria garantizar que en tres meses el
# sitio y el modelo muestren dos tablas distintas.
from simulate import (cargar_zonas, cargar_fixture, jugados_del_clausura,
                      tabla_posiciones, CLASIFICAN_POR_ZONA, TEMPORADA, TORNEO)
# La desmarginalizacion de cuotas ya vive en evaluate.py: es la misma cuenta con
# la que se mide al modelo contra el mercado. Si el sitio usara otra, el
# "diferencial modelo vs mercado" no coincidiria con la evaluacion publicada.
from evaluate import probs_del_mercado

RAIZ = Path(__file__).resolve().parent.parent
MODELO = RAIZ / "data" / "outputs" / "modelo.json"
SIMULACION = RAIZ / "data" / "outputs" / "simulacion.json"
FIXTURES = RAIZ / "data" / "raw" / "fixtures.csv"
TABLA_EQUIPOS = RAIZ / "reference" / "team_names.csv"
COLORES = RAIZ / "reference" / "colores.csv"
STATS = RAIZ / "data" / "clean" / "team_match_stats.csv"
SALIDA = RAIZ / "web" / "data"
HISTORIAL = SALIDA / "historial.json"

# Medido con validacion temporal sobre 1.236 partidos (2024-2026).
# Se recalcula con `python src/evaluate.py`; si cambia, actualizar aca.
ACIERTO = 41.7

# Cuantos partidos entran en la racha. Seis y no cinco porque con dos torneos
# por anio (Apertura y Clausura) cinco a veces no alcanza para cruzar el parate.
FORMA_N = 6


def slug(nombre):
    """Convierte 'Vélez Sarsfield' en 'velez-sarsfield' para usarlo en la URL."""
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFD", nombre)
        if unicodedata.category(c) != "Mn"
    )
    limpio = "".join(c if c.isalnum() else "-" for c in sin_tildes.lower())
    return "-".join(p for p in limpio.split("-") if p)


def leer_json(ruta, comando):
    if not ruta.exists():
        sys.exit(f"ERROR: no existe {ruta}\n       Primero corre:  {comando}")
    return json.loads(ruta.read_text(encoding="utf-8"))


def implicitas(cuota_local, cuota_empate, cuota_visita):
    """
    Que probabilidad le pone el mercado a cada resultado, sin el margen.

    Una cuota de 2.00 significa "te pagamos el doble", o sea mas o menos 50%:
    1/2.00 = 0.50. Pero si sumas 1/cuota de los tres resultados no da 100%, da
    mas: ese exceso es la ganancia de la casa. Se saca dividiendo por la suma.

    La cuenta no se escribe aca: se reusa `probs_del_mercado` de evaluate.py,
    que es la que se usa para medir al modelo contra el mercado.

    Devuelve None si falta alguna cuota. Pasa con los partidos que todavia no
    abrieron mercado, y es un caso normal, no un error: el sitio muestra el
    numero del modelo igual y omite la comparacion.
    """
    valores = [cuota_local, cuota_empate, cuota_visita]
    if any(v is None or not np.isfinite(v) or v <= 1 for v in valores):
        return None
    fila = pd.DataFrame([{"avgch": valores[0], "avgcd": valores[1],
                          "avgca": valores[2]}])
    p = probs_del_mercado(fila)[0]
    local, empate, visita = _porcentajes(p)
    return {"local": local, "empate": empate, "visita": visita}


def _porcentajes(probabilidades):
    """
    Pasa tres probabilidades a porcentaje con un decimal, sin romper la suma.

    Redondear cada una por separado a veces da 100.1 o 99.9, y en una tabla que
    se presenta como "esto es lo que dice el mercado, sin el margen de la casa"
    un 100.1 hace dudar de toda la cuenta. Se reparte el sobrante por resto
    mayor: el decimo que falta o sobra va al valor que quedo mas cerca de subir.
    """
    decimas = [p * 1000 for p in probabilidades]
    piso = [int(d) for d in decimas]
    faltan = 1000 - sum(piso)
    # Los que quedaron mas cerca del siguiente decimo se llevan el sobrante.
    orden = sorted(range(3), key=lambda i: decimas[i] - piso[i], reverse=True)
    for i in orden[:faltan]:
        piso[i] += 1
    return [round(v / 10, 1) for v in piso]


def forma_reciente(partidos, n=FORMA_N):
    """
    Los ultimos n partidos de cada equipo, del mas viejo al mas nuevo.

    Se usan todos los partidos oficiales del historico, sin filtrar torneo: la
    racha es "como viene jugando", no "como viene en esta tabla". Van con
    rival y marcador porque una racha de tres victorias contra los tres
    ultimos no dice lo mismo que contra los tres primeros.
    """
    orden = partidos.sort_values("date", kind="stable")
    forma = {}
    for f in orden.itertuples():
        for equipo, rival, gf, gc, condicion in (
            (f.home_team, f.away_team, f.home_goals, f.away_goals, "local"),
            (f.away_team, f.home_team, f.away_goals, f.home_goals, "visita"),
        ):
            forma.setdefault(equipo, []).append({
                "r": "G" if gf > gc else ("E" if gf == gc else "P"),
                "rival": rival,
                "rival_slug": slug(rival),
                "gf": int(gf),
                "gc": int(gc),
                "condicion": condicion,
                "fecha": str(pd.Timestamp(f.date).date()),
            })
    return {e: v[-n:] for e, v in forma.items()}


# ---------------------------------------------------------------------------
# Que metricas se exportan, y en que orden se rankean
# ---------------------------------------------------------------------------
# Cada entrada es (clave, primero_el_mas_alto). El booleano decide UNICAMENTE
# el orden del puesto, no si la metrica es buena o mala: eso lo dice la UI,
# que es donde se lee. Recibir mucho xG en contra ordena al reves (el mejor es
# el que menos concede) y por eso va en False.
#
# Las metricas ambiguas de verdad -- posesion, corners, palos, pases, centros,
# pelotazos, quites, intercepciones, bloqueos, rechazos, atajadas, offsides --
# van en True porque hay que ordenarlas de alguna manera, pero la pagina las
# marca como "depende del contexto" y no como logro. Un equipo que hace 32
# rechazos por partido no defiende mejor: defiende mas seguido, que es otra
# cosa y muchas veces peor.
#
# La regla es: toda metrica que la pagina marque "depende" se ordena de mayor
# a menor (True). Si aca dijera False y alla "depende", el ranking mostraria
# primero al que MENOS tiene mientras el texto jura que no hay un mejor.
METRICAS = [
    # --- Ataque ---
    ("xg", True),
    ("xg_pp", True),
    ("goles_pp", True),
    ("chances_claras", True),
    ("toques_en_area_rival", True),
    ("remates", True),
    ("remates_dentro_area", True),
    ("corners", True),
    ("xg_pelota_parada", True),
    # --- Definicion ---
    ("conversion", True),
    ("sobre_xg", True),
    ("punteria", True),
    ("xg_por_remate", True),
    ("xgot", True),
    ("chances_claras_erradas", False),
    ("palos", True),
    # --- Posesion y pase ---
    ("posesion", True),
    ("precision_pase", True),
    ("pases", True),
    ("pases_campo_rival", True),
    ("centros_completados", True),
    ("pelotazos_completados", True),
    # --- Defensa ---
    ("xg_contra", False),
    ("xg_contra_pp", False),
    ("goles_contra_pp", False),
    ("xg_dif", True),
    ("quites", True),
    ("intercepciones", True),
    ("bloqueos", True),
    ("rechazos", True),
    ("atajadas", True),
    # --- Duelos ---
    ("duelos_pct", True),
    ("duelos_aereos_pct", True),
    ("duelos_suelo_pct", True),
    ("gambetas_exitosas", True),
    # --- Disciplina ---
    ("faltas", False),
    ("amarillas", False),
    ("rojas", False),
    ("offsides", True),
]

# Lo que se copia dentro de equipos.json.
#
# POR QUE NO VA TODO. equipos.json ya pesa 92 KB y lo lee TODO el sitio: la
# portada, la tabla y las 30 fichas lo importan por lib/datos.ts. Meterle 40
# metricas mas por equipo lo llevaria a ~150 KB para que las use una sola
# pagina. El resto vive en estadisticas.json, que solo lee /estadisticas.
#
# Esta lista es exactamente lo que la ficha de equipo ya mostraba: no se le
# saca nada a lo que ya funciona.
CLAVES_FICHA = [
    "pj", "goles", "goles_contra", "xg", "xg_contra", "xg_dif", "sobre_xg",
    "posesion", "remates", "chances_claras", "duelos_ganados",
    "toques_en_area_rival", "pases_campo_rival",
    "puesto_xg", "puesto_xg_contra", "puesto_xg_dif", "puesto_posesion",
]


def _div(numerador, denominador, decimales):
    """
    Una division que devuelve None en vez de inventar un numero.

    Si el denominador es cero o falta el dato, la respuesta honesta es "no se
    puede calcular". Un 0 ahi seria peor que un hueco: se lee como "este
    equipo tiene precision de pase cero", que es falso.
    """
    if denominador is None or numerador is None:
        return None
    if pd.isna(numerador) or pd.isna(denominador) or denominador == 0:
        return None
    return round(float(numerador) / float(denominador), decimales)


def recorte_ficha(stats):
    """Las claves de CLAVES_FICHA, o None si el equipo no tiene datos."""
    if stats is None:
        return None
    return {k: stats[k] for k in CLAVES_FICHA if k in stats}


def _stats_avanzadas_bloque(d):
    """
    Lo que genero y lo que le generaron a cada equipo, sobre el recorte de
    partidos que le pasen (temporada completa, o solo Apertura, o solo
    Clausura -- ver `stats_avanzadas`, que es quien arma ese recorte).

    Sale de team_match_stats.csv, que arma clean_stats.py con los datos de
    FotMob. Es la unica parte del sitio que NO se puede calcular desde los
    goles: xG, posesion, duelos y remates vienen medidos partido a partido.

    Por que el xG importa aca: los goles dicen que paso, el xG dice que tan
    seguido tendria que pasar. Un equipo que hace 29 goles con 36 de xG no
    esta teniendo suerte, esta desperdiciando; uno que hace 29 con 20 no va a
    seguir asi. Esa distancia es todo el valor de la metrica.

    LA REGLA QUE ORDENA TODO ESTO: lo que depende de cuantos partidos jugaste
    va como PROMEDIO POR PARTIDO. Los equipos de un mismo recorte pueden traer
    cantidades de partidos distintas (mas claro todavia separado por torneo:
    el Clausura recien arranco), asi que comparar remates totales o faltas
    totales no mide quien remata mas, mide quien jugo mas. Los unicos
    totales que sobreviven son los de xG (xg, xg_contra, xg_dif, sobre_xg),
    que se leen asi en todos lados y que la UI aclara explicitamente; para
    comparar de a dos estan igual sus versiones _pp.

    LAS DERIVADAS son mas interesantes que las crudas y por eso se calculan
    aca y no en el navegador:
      conversion      goles / xG        -- define mejor o peor de lo que genera
      xg_por_remate   xG / remates      -- pocas chances buenas o muchas malas
      punteria        al arco / remates -- cuanto de lo que patea va al arco
      precision_pase  completados/pases -- cuanto de lo que intenta le sale
      duelos_pct      ganados / totales -- el crudo es un conteo, no un %

    OJO CON LOS DUELOS. La columna `duelos_ganados` del CSV es un CONTEO, no
    un porcentaje: los dos equipos de un partido suman ~106 entre los dos, no
    100 (verificado sobre los 270 partidos de 2026). Como el total de duelos
    de un partido cambia mucho de partido a partido, el conteo crudo no
    compara bien, y el porcentaje sobre los duelos disputados de ESE partido
    si. Por eso se calcula la version _pct.

    Devuelve {} si el recorte vino vacio (por ejemplo, un torneo que todavia
    no tiene partidos jugados). El sitio tiene que poder construirse sin esta
    capa. Las probabilidades, que son el criterio de terminado del proyecto,
    salen del Dixon-Coles y no de aca.
    """
    if d.empty:
        return {}

    # El xG EN CONTRA de un equipo es el xG que generaron sus rivales cuando
    # jugaron contra el. Como cada partido son dos filas (una por equipo), eso
    # es exactamente agrupar por la columna "rival".
    xg_en_contra = d[d["xg"].notna()].groupby("rival")["xg"].sum()

    # Total de duelos disputados en cada partido = los que gano uno mas los
    # que gano el otro. `transform` lo pega en las dos filas del partido, que
    # es lo que hace falta para dividir fila por fila.
    COLS_DUELO = ["duelos_ganados", "duelos_suelo_ganados", "duelos_aereos_ganados"]
    for col in COLS_DUELO:
        d[f"_total_{col}"] = d.groupby("match_id")[col].transform("sum")

    por_equipo = {}
    for equipo, g in d.groupby("equipo"):
        # Solo los partidos que tienen la medicion. FotMob tiene algun partido
        # suelto sin estadisticas y promediar sobre partidos vacios ensuciaria
        # el numero sin avisar.
        con_xg = g[g["xg"].notna()]
        if con_xg.empty:
            continue

        pj = len(con_xg)

        def media(col, decimales=1):
            """Promedio por partido. None si la columna no tiene ningun dato."""
            v = con_xg[col].mean()
            return None if pd.isna(v) else round(float(v), decimales)

        def suma(col):
            v = con_xg[col].sum(min_count=1)
            return None if pd.isna(v) else float(v)

        def ratio_de_duelos(col):
            """
            Porcentaje de los duelos disputados que gano el equipo.

            Se suman los ganados de toda la temporada sobre los disputados de
            toda la temporada, y no se promedian los porcentajes partido a
            partido: asi un partido trabado de 150 duelos pesa lo que tiene
            que pesar y no lo mismo que uno de 60.
            """
            return _div(100 * suma(col), suma(f"_total_{col}"), 1)

        goles = int(con_xg["goles"].sum())
        goles_contra = int(con_xg["goles_rival"].sum())
        xg = round(float(con_xg["xg"].sum()), 1)
        xg_contra = round(float(xg_en_contra.get(equipo, 0.0)), 1)
        remates_totales = suma("remates")

        por_equipo[equipo] = {
            "pj": pj,
            # --- Totales de xG. Se dejan totales a proposito (asi se leen en
            #     todos lados) y la pagina avisa que los partidos no son los
            #     mismos para todos. Al lado va siempre la version _pp.
            "goles": goles,
            "goles_contra": goles_contra,
            "xg": xg,
            "xg_contra": xg_contra,
            "xg_dif": round(xg - xg_contra, 1),
            # Positivo = mete mas de lo que genera. Negativo = desperdicia.
            "sobre_xg": round(goles - xg, 1),

            # --- Ataque, por partido ---
            "xg_pp": _div(xg, pj, 2),
            "goles_pp": _div(goles, pj, 2),
            "chances_claras": media("chances_claras"),
            "toques_en_area_rival": media("toques_en_area_rival"),
            "remates": media("remates"),
            "remates_dentro_area": media("remates_dentro_area"),
            "corners": media("corners"),
            "xg_pelota_parada": media("xg_pelota_parada", 2),

            # --- Definicion ---
            # Arriba de 1.00 mete mas goles de los que la calidad de sus
            # situaciones sugiere. Abajo, desperdicia.
            "conversion": _div(goles, suma("xg"), 2),
            "punteria": _div(100 * suma("remates_al_arco"), remates_totales, 1),
            # Cuanto peligro tiene, en promedio, cada remate que patea. Alto =
            # pocas situaciones pero buenas; bajo = patea de cualquier lado.
            "xg_por_remate": _div(suma("xg"), remates_totales, 3),
            # xGOT mide la calidad del remate DESPUES de pegarle, contando
            # solo los que van al arco. Por partido, no total.
            "xgot": media("xgot", 2),
            "chances_claras_erradas": media("chances_claras_erradas"),
            "palos": media("palos", 2),

            # --- Posesion y pase ---
            "posesion": media("posesion"),
            "precision_pase": _div(100 * suma("pases_completados"),
                                   suma("pases"), 1),
            "pases": media("pases", 0),
            # Ojo: NO son "pases progresivos". Esa metrica era de Opta y no
            # existe en ninguna fuente gratuita desde enero de 2026. Llamarla
            # asi seria mentir; esto es otra cosa y se llama por su nombre.
            # Un decimal y no cero: asi equipos.json queda byte a byte igual
            # que antes de esta ampliacion. La UI lo muestra redondeado.
            "pases_campo_rival": media("pases_campo_rival"),
            "centros_completados": media("centros_completados"),
            "pelotazos_completados": media("pelotazos_completados"),

            # --- Defensa ---
            "xg_contra_pp": _div(xg_contra, pj, 2),
            "goles_contra_pp": _div(goles_contra, pj, 2),
            "quites": media("quites"),
            "intercepciones": media("intercepciones"),
            "bloqueos": media("bloqueos"),
            "rechazos": media("rechazos"),
            "atajadas": media("atajadas"),

            # --- Duelos ---
            # El conteo crudo se mantiene porque lo usa la ficha de equipo.
            "duelos_ganados": media("duelos_ganados"),
            "duelos_pct": ratio_de_duelos("duelos_ganados"),
            "duelos_aereos_pct": ratio_de_duelos("duelos_aereos_ganados"),
            "duelos_suelo_pct": ratio_de_duelos("duelos_suelo_ganados"),
            "gambetas_exitosas": media("gambetas_exitosas"),

            # --- Disciplina ---
            "faltas": media("faltas"),
            "amarillas": media("amarillas"),
            "rojas": media("rojas", 2),
            "offsides": media("offsides"),
        }

    # El puesto convierte un numero suelto en informacion: "36.4 de xG" no
    # dice nada solo, "el mas alto de los 30" si.
    #
    # Los equipos sin el dato quedan SIN puesto (la clave no existe) en vez de
    # empujados al final: un puesto 30 inventado se leeria como "es el peor".
    #
    # LOS EMPATES COMPARTEN PUESTO. Hay metricas donde el empate es la norma y
    # no la excepcion: doce equipos tienen 0.0 rojas por partido. Desempatarlos
    # por orden alfabetico y publicar "1ro en fair play" al que salio sorteado
    # seria inventar una diferencia que no existe. Con puestos compartidos, tres
    # equipos mostrando "1ro" dicen solos que estan empatados. Es el mismo
    # criterio de una tabla de posiciones: 1, 2, 2, 4.
    for clave, primero_el_mas_alto in METRICAS:
        ordenados = sorted(
            (e for e in por_equipo if por_equipo[e].get(clave) is not None),
            key=lambda e: por_equipo[e][clave],
            reverse=primero_el_mas_alto,
        )
        puesto = 0
        anterior = object()  # nunca igual a un numero: fuerza el primer salto
        for i, equipo in enumerate(ordenados, start=1):
            valor = por_equipo[equipo][clave]
            if valor != anterior:
                puesto = i
                anterior = valor
            por_equipo[equipo][f"puesto_{clave}"] = puesto

    return por_equipo


# Como se reconoce cada torneo dentro de la columna `torneo` de
# team_match_stats.csv. FotMob ya viene separado ("Liga Profesional Apertura",
# "Liga Profesional Apertura Playoff", "Liga Profesional Clausura", ...): no
# hace falta inventar un corte por fecha como el que describe
# reference/formato-torneos.md para separar Apertura de Clausura sobre
# matches.csv (ahi si hace falta, porque esa fuente no trae el torneo). Aca la
# fuente ya lo dice, asi que se usa esa columna y no una regla propia. Entra
# el Playoff de cada torneo (startswith y no una igualdad exacta) porque un
# ranking de "mejor ataque del Apertura" que dejara afuera los octavos, cuartos
# y semis estaria mostrando un torneo incompleto.
PREFIJOS_TORNEO = {
    "apertura": "Liga Profesional Apertura",
    "clausura": "Liga Profesional Clausura",
}


def stats_avanzadas(temporada):
    """
    Las 39 metricas de cada equipo, en tres recortes: la temporada completa
    (como siempre se calculo) y cada torneo por separado (Apertura, Clausura).

    POR QUE SE PUEDE SEPARAR SIN INVENTAR NADA: team_match_stats.csv ya trae
    la columna `torneo` con el nombre completo de cada partido ("Liga
    Profesional Apertura", "Liga Profesional Clausura", ...). Es la MISMA
    columna con la que `jugados_con_ronda` (mas arriba en este archivo) ya
    separa el Clausura para el calendario. No hay que adivinar un corte de
    fechas: la fuente lo dice.

    Devuelve {"temporada": {...}, "apertura": {...}, "clausura": {...}}, cada
    uno con la forma que ya devolvia esta funcion (equipo -> metricas +
    puestos). El bloque "temporada" es EXACTAMENTE el mismo calculo de antes
    de este cambio -- mismo filtro, mismo orden -- para no romper equipos.json
    ni la vista por defecto de /estadisticas.
    """
    if not STATS.exists():
        print("    (sin team_match_stats.csv: se exporta sin stats avanzadas)")
        return {"temporada": {}, "apertura": {}, "clausura": {}}

    d = pd.read_csv(STATS)
    # TEMPORADA viaja como texto ('2026') y la columna del CSV es entera. Sin
    # este int() la comparacion no matchea nunca, y lo peor es que no falla:
    # devuelve vacio y el sitio sale a produccion sin stats diciendo "OK".
    d = d[d["temporada"] == int(temporada)]
    if d.empty:
        print(f"    (sin stats para la temporada {temporada})")
        return {"temporada": {}, "apertura": {}, "clausura": {}}

    torneo_col = d["torneo"].astype(str)
    return {
        "temporada": _stats_avanzadas_bloque(d),
        "apertura": _stats_avanzadas_bloque(
            d[torneo_col.str.startswith(PREFIJOS_TORNEO["apertura"])]),
        "clausura": _stats_avanzadas_bloque(
            d[torneo_col.str.startswith(PREFIJOS_TORNEO["clausura"])]),
    }


def rendimiento_vs_mercado(partidos, temporada):
    """
    Puntos reales menos los que el mercado esperaba, en la temporada en curso.

    De cada partido salen las probabilidades implicitas de las cuotas de
    cierre; multiplicadas por los puntos que reparte cada resultado
    (3 - 1 - 0) dan los puntos ESPERADOS antes de jugar. La resta contra los
    puntos que el equipo hizo de verdad contesta la unica pregunta que la
    gente le pide al xG: **este equipo, esta rindiendo mejor o peor de lo que
    se esperaba?**

    Y la contesta con una ventaja sobre el xG que conviene no perder de vista:
    las cuotas ya tienen adentro las lesiones, las suspensiones y la rotacion,
    que el xG post-partido ni ve.

    Ojo con como se lee: un +5 no es merito puro. Puede ser que el equipo
    juegue mejor de lo que el mercado cree, o simplemente que le viene
    saliendo todo. Con 16 partidos no se puede distinguir una cosa de la otra.
    """
    t = partidos[(partidos.season_id == str(temporada)) &
                 partidos.avgch.notna() & partidos.avgcd.notna() &
                 partidos.avgca.notna()]
    if t.empty:
        return {}

    p = probs_del_mercado(t)
    esperados_local = 3 * p[:, 0] + p[:, 1]
    esperados_visita = 3 * p[:, 2] + p[:, 1]

    acum = {}
    for i, f in enumerate(t.itertuples()):
        gl, gv = int(f.home_goals), int(f.away_goals)
        for equipo, pts, esp in (
            (f.home_team, 3 if gl > gv else (1 if gl == gv else 0),
             esperados_local[i]),
            (f.away_team, 3 if gv > gl else (1 if gl == gv else 0),
             esperados_visita[i]),
        ):
            r = acum.setdefault(equipo, {"pj": 0, "pts": 0, "esp": 0.0})
            r["pj"] += 1
            r["pts"] += pts
            r["esp"] += float(esp)

    return {e: {"pj": r["pj"], "pts": r["pts"],
                "pts_esperados": round(r["esp"], 1),
                "dif": round(r["pts"] - r["esp"], 1)}
            for e, r in acum.items()}


def jugados_con_ronda(temporada):
    """
    Los partidos del torneo que YA SE JUGARON, con la fecha del torneo a la que
    pertenecen y el resultado.

    DE DONDE SALE LA RONDA, que es lo unico dificil de esto. `fixture.csv` trae
    SOLO lo que falta jugar: ingest_fixture.py descarta todo lo `finished`, asi
    que la fecha 1 del Clausura no esta en el calendario y a medida que el
    torneo avanza van desapareciendo mas fechas. La ronda de lo jugado si esta
    en `team_match_stats.csv`, porque FotMob la publica en cada partido y
    clean_stats.py la guarda. Es la MISMA fuente que el fixture y la misma
    numeracion de fechas: no hay que adivinar nada.

    Cada partido son dos filas en ese CSV (una por equipo), asi que se filtra
    por `condicion == "local"` para quedarse con una sola y que el local sea el
    que de verdad jugo de local.

    Devuelve [] si todavia no hay stats: el sitio tiene que poder construirse
    sin esta capa, igual que en `stats_avanzadas`.
    """
    if not STATS.exists():
        return []

    d = pd.read_csv(STATS)
    d = d[(d["temporada"] == int(temporada)) &
          (d["torneo"].astype(str).str.endswith(TORNEO)) &
          (d["condicion"] == "local")]
    # La columna `ronda` es texto porque en los playoffs trae "final",
    # "semifinal" y compania. La fase regular es la que numera fechas; el resto
    # no entra en una vista fecha a fecha.
    d = d[d["ronda"].astype(str).str.fullmatch(r"\d+")]
    if d.empty:
        return []

    return sorted(
        ({"ronda": int(f.ronda), "dia": str(f.fecha), "local": f.equipo,
          "visita": f.rival, "goles_local": int(f.goles),
          "goles_visita": int(f.goles_rival)}
         for f in d.itertuples()),
        key=lambda p: (p["ronda"], p["dia"], p["local"]),
    )


def resumen_partido(modelo, local, visita):
    """Todo lo que el sitio necesita saber de un partido, en un solo lugar."""
    pl, pe, pv = probabilidades_1x2(modelo, local, visita)
    m = matriz_marcadores(modelo, local, visita)
    goles = np.arange(MAX_GOLES + 1)

    marcadores = sorted(
        ((m[i, j], i, j) for i in range(6) for j in range(6)), reverse=True
    )[:5]

    # Estos derivados salen todos de la misma matriz. Es la ventaja de que el
    # modelo devuelva la probabilidad de CADA marcador y no solo quien gana.
    menos_25 = float(sum(m[i, j] for i in range(11) for j in range(11) if i + j <= 2))
    ambos = float(m[1:, 1:].sum())

    prob = {
        "local": round(100 * float(pl), 1),
        "empate": round(100 * float(pe), 1),
        "visita": round(100 * float(pv), 1),
    }

    return {
        "local": local,
        "visita": visita,
        "local_slug": slug(local),
        "visita_slug": slug(visita),
        "prob": prob,
        "goles_esperados": {
            "local": round(float((goles * m.sum(axis=1)).sum()), 2),
            "visita": round(float((goles * m.sum(axis=0)).sum()), 2),
        },
        "marcadores": [
            {"marcador": f"{i}-{j}", "prob": round(100 * float(p), 1)}
            for p, i, j in marcadores
        ],
        "menos_de_2_5": round(100 * menos_25, 1),
        "ambos_convierten": round(100 * ambos, 1),
    }


def clave_historial(temporada, torneo, local, visita):
    """
    La clave que decide si un partido ya esta registrado en el historial.

    NO PUEDE LLEVAR LA FECHA NI LA RONDA. El torneo reprograma partidos todo
    el tiempo -esta documentado que la fecha 2 del Clausura 2026 se juega el
    28-30/07 para unos equipos y el 5-6/08 para otros- y si la fecha fuera
    parte de la clave, un partido postergado se registraria dos veces (una
    prediccion "antes" de saber que se pospuso y otra "despues"), o directo no
    se encontraria nunca el resultado porque la fecha real de cuando se jugo
    no coincide con la fecha que tenia el partido cuando se predijo.

    Lo unico que de verdad no cambia es QUIENES JUEGAN. Y alcanza con eso: el
    formato es de una rueda simple (cada equipo juega una vez contra cada
    rival de su zona, mas dos interzonales), asi que un mismo par de equipos
    aparece UNA sola vez por torneo y temporada. Se usa frozenset y no una
    tupla ordenada porque de local puede figurar cualquiera de los dos segun
    la fuente (fixture.csv vs matches.csv no siempre coinciden en eso).
    """
    return f"{temporada}-{torneo}-{'|'.join(sorted((local, visita)))}"


def actualizar_historial(fixture, prob_fixture, cuotas, jugados, temporada, torneo):
    """
    El registro de lo que el modelo predijo, para poder medirlo despues.

    LA REGLA QUE ORDENA TODO ESTO Y QUE NO SE NEGOCIA: una prediccion, una vez
    guardada, NUNCA se recalcula ni se pisa. Aunque se reentrene el modelo,
    aunque cambie una feature, aunque se arregle un bug -la entrada vieja
    queda tal cual. El valor entero de este archivo es ser una foto congelada
    de lo que el modelo creia ANTES de que se jugara el partido; si se
    recalculara con datos de despues, dejaria de ser una prueba y pasaria a
    ser una opinion circular sobre si mismo.

    Por eso el flujo es "leer lo que ya existe, agregar solo lo nuevo":

      1. Cada partido del fixture que el modelo sabe predecir (esta en
         `prob_fixture`) y que TODAVIA no tiene una clave en el historial se
         agrega con su prediccion, sus cuotas si las hay, y el resultado en
         None.
      2. Cada partido que YA se jugo (viene de `jugados`, la misma tabla con
         la que export.py arma tabla.json) completa el resultado de la
         entrada que ya estaba, sin tocarle la prediccion ni las cuotas.

    Un partido que se jugo ANTES de que este archivo existiera se pierde para
    siempre -nunca estuvo pendiente mientras el historial corria, asi que no
    hay prediccion que registrar-. No es un bug: es la razon por la que cada
    corrida sin esto es evidencia que no se recupera.
    """
    existentes = {}
    if HISTORIAL.exists():
        existentes = {e["clave"]: e
                     for e in json.loads(HISTORIAL.read_text(encoding="utf-8"))}

    ahora = datetime.now(timezone.utc).isoformat(timespec="seconds")
    nuevos = 0
    for f in fixture.itertuples():
        prob = prob_fixture.get(f.match_id)
        if prob is None:
            continue  # el modelo no conoce a algun equipo; ver "sin_datos" arriba
        clave = clave_historial(temporada, torneo, f.local, f.visitante)
        if clave in existentes:
            continue

        c = cuotas.get(frozenset((f.local, f.visitante)))
        if c is None:
            cuotas_partido = None
        else:
            local_en_cuotas, ch, cd, ca = c
            if local_en_cuotas != f.local:
                ch, ca = ca, ch  # la otra fuente lo tenia al reves
            valores = [ch, cd, ca]
            cuotas_partido = (
                {"local": ch, "empate": cd, "visita": ca}
                if all(v is not None and np.isfinite(v) for v in valores)
                else None
            )

        existentes[clave] = {
            "clave": clave,
            "temporada": temporada,
            "torneo": torneo,
            "local": f.local,
            "visita": f.visitante,
            "ronda": int(f.ronda),
            "fecha": f.fecha,
            "prediccion": {"prob": prob, "registrado": ahora},
            "cuotas": cuotas_partido,
            "resultado": None,
        }
        nuevos += 1

    completados = 0
    for j in jugados.itertuples():
        clave = clave_historial(temporada, torneo, j.home_team, j.away_team)
        entrada = existentes.get(clave)
        if entrada is None or entrada["resultado"] is not None:
            continue  # no estaba pendiente, o ya tiene resultado: no se toca
        gl, gv = int(j.home_goals), int(j.away_goals)
        entrada["resultado"] = {
            "goles_local": gl,
            "goles_visita": gv,
            "ganador": "local" if gl > gv else ("visita" if gv > gl else "empate"),
        }
        completados += 1

    salida = sorted(existentes.values(),
                    key=lambda e: (e["ronda"], e["fecha"], e["local"]))
    HISTORIAL.write_text(json.dumps(salida, ensure_ascii=False, indent=2),
                         encoding="utf-8")
    return nuevos, completados, len(salida)


def main():
    modelo = leer_json(MODELO, "python src/model.py")
    simulacion = leer_json(SIMULACION, "python src/simulate.py")

    colores = pd.read_csv(COLORES, encoding="utf-8")
    mapa_color = {r.equipo: [r.primario, r.secundario] for r in colores.itertuples()}

    nombres = pd.read_csv(TABLA_EQUIPOS, encoding="utf-8")
    canonico = dict(zip(nombres.raw, nombres.canonical))

    SALIDA.mkdir(parents=True, exist_ok=True)

    # Se carga aca arriba y no mas abajo porque la seccion 1 lo necesita para
    # descartar del fixture los partidos que ya se jugaron.
    partidos_hist = cargar_partidos()

    zona = cargar_zonas(TEMPORADA)

    # --- 1. Los partidos que se vienen ---
    #
    # QUE CAMBIO Y POR QUE. Esta lista salia del fixture de football-data.co.uk,
    # que publica una jornada por vez y tarda dias en publicar la siguiente. En
    # esa ventana el sitio se quedaba sin partidos proximos: al 28/07/2026 el
    # archivo solo tenia la fecha 1 del Clausura, ya jugada, y fecha.json salia
    # con CERO partidos.
    #
    # Ahora salen del calendario real (data/clean/fixture.csv, de FotMob), que
    # trae el torneo entero. De football-data se sigue usando lo unico que
    # FotMob no da: las CUOTAS, que son las que permiten comparar el modelo
    # contra el mercado. Cuando el partido todavia no tiene cuotas, `implicita`
    # queda en null, que es un caso que el sitio ya contempla.
    fixture = cargar_fixture(zona)

    # El fixture sigue anunciando partidos que YA se jugaron: la fuente no los
    # saca de ahi hasta que registra el resultado, y las dos fuentes no se
    # enteran al mismo tiempo. Sin este filtro el mismo partido aparece jugado
    # en la tabla y anunciado como proximo en la portada.
    jugados_recientes = {
        (f.home_team, f.away_team)
        for f in partidos_hist[partidos_hist["date"] >= pd.Timestamp.now() -
                               pd.Timedelta(days=30)].itertuples()
    }

    # Las cuotas, indexadas por par de equipos ya canonizado. Se busca SIN orden
    # porque las dos fuentes pueden diferir en quien figura de local, y el que
    # manda para la localia es el fixture de FotMob. Si difieren, la cuota se
    # da vuelta junto con el partido.
    cuotas = {}
    if FIXTURES.exists():
        fx = pd.read_csv(FIXTURES, encoding="utf-8-sig")
        for f in fx[fx.Country == "Argentina"].itertuples():
            local = canonico.get(f.Home, f.Home)
            visita = canonico.get(f.Away, f.Away)
            cuotas[frozenset((local, visita))] = (
                local,
                getattr(f, "AvgH", None), getattr(f, "AvgD", None),
                getattr(f, "AvgA", None),
            )
    else:
        print(f"AVISO: no existe {FIXTURES}; los partidos salen sin cuotas.")

    pendientes, sin_datos, ya_jugados = [], [], 0

    # El 1X2 de CADA partido del fixture, calculado UNA sola vez. De este mismo
    # diccionario salen fecha.json y calendario.json: es literalmente el mismo
    # objeto en los dos archivos, no dos cuentas que dan parecido. Si cada uno
    # lo calculara por su lado, el dia que alguien toque el redondeo el sitio
    # publicaria dos numeros distintos para el mismo partido.
    prob_fixture = {}

    for f in fixture.itertuples():
        local, visita = f.local, f.visitante
        if local not in modelo["ataque"] or visita not in modelo["ataque"]:
            sin_datos.append(f"{local} vs {visita}")
            continue
        p = resumen_partido(modelo, local, visita)
        prob_fixture[f.match_id] = p["prob"]
        if (local, visita) in jugados_recientes:
            ya_jugados += 1
            continue

        # Lo que dice el mercado del mismo partido, y en cuanto difiere del
        # modelo. Es el unico numero del sitio que no se puede copiar de
        # ningun lado: "el modelo ve algo distinto que las casas, y esto".
        # Se usa `Avg*` (promedio de todas las casas) por la misma razon que
        # el resto del proyecto: Bet365 y Pinnacle vienen con huecos.
        c = cuotas.get(frozenset((local, visita)))
        if c is None:
            imp = None
        else:
            local_en_cuotas, ch, cd, ca = c
            if local_en_cuotas != local:
                ch, ca = ca, ch  # la otra fuente lo tenia al reves
            imp = implicitas(ch, cd, ca)
        p["implicita"] = imp
        p["diferencial"] = None if imp is None else {
            k: round(p["prob"][k] - imp[k], 1)
            for k in ("local", "empate", "visita")
        }

        p["ronda"] = int(f.ronda)
        p["fecha"] = f.fecha
        p["hora"] = f.hora
        p["utc"] = f.utc
        # Postergado: se juega, pero la fecha de arriba es provisoria.
        p["aplazado"] = bool(f.aplazado)
        pendientes.append(p)

    # fecha.json lleva SOLO la proxima jornada, no el torneo entero: lo importa
    # web/lib/datos.ts, o sea toda la navegacion del sitio. El calendario
    # completo va en su propio archivo (seccion 1b).
    proxima_ronda = min((p["ronda"] for p in pendientes), default=None)
    partidos = [p for p in pendientes if p["ronda"] == proxima_ronda]

    # Los resultados de la ultima fecha jugada.
    #
    # POR QUE: entre una fecha y la siguiente, football-data tarda dias en
    # publicar el fixture nuevo. En esa ventana el sitio se quedaba con la
    # portada vacia ("0 partidos"), justo cuando mas gente entra: el dia
    # despues de que se jugo. Mostrar lo que acaba de pasar es mejor que
    # mostrar un hueco, y es lo que hace cualquier diario deportivo.
    ultimos = []
    if len(partidos_hist):
        ultima_fecha = partidos_hist["date"].max()
        # La "fecha" del futbol argentino se juega en cuatro dias (viernes a
        # lunes), asi que se toma esa ventana y no solo el ultimo dia.
        ventana = partidos_hist[
            partidos_hist["date"] >= ultima_fecha - pd.Timedelta(days=4)
        ].sort_values("date")
        for f in ventana.itertuples():
            ultimos.append({
                "fecha": str(pd.Timestamp(f.date).date()),
                "local": f.home_team,
                "visita": f.away_team,
                "local_slug": slug(f.home_team),
                "visita_slug": slug(f.away_team),
                "goles_local": int(f.home_goals),
                "goles_visita": int(f.away_goals),
                "colores_local": mapa_color.get(f.home_team, ["#7c8089", "#f2f1ec"]),
                "colores_visita": mapa_color.get(f.away_team, ["#7c8089", "#f2f1ec"]),
            })

    if sin_datos:
        print("AVISO: estos partidos se omiten porque el modelo no conoce a algun equipo:")
        for p in sin_datos:
            print(f"   - {p}")

    (SALIDA / "fecha.json").write_text(json.dumps({
        "torneo": TORNEO,
        "ronda": proxima_ronda,
        "partidos": partidos,
        "ultimos": ultimos,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    # --- 1b. El torneo entero, fecha por fecha ---
    #
    # ARCHIVO PROPIO, Y NO UNA RAMA DE fecha.json. Es el mismo criterio que
    # separo estadisticas.json de equipos.json: `fecha.json` lo importa
    # web/lib/datos.ts y eso lo arrastra a TODA la navegacion del sitio. Este
    # pesa ~200 KB y lo lee UNA sola pagina, /calendario, que lo importa
    # directo. Meterlo en datos.ts seria cobrarle esos 200 KB a la portada, a la
    # tabla y a las 30 fichas para que no lo usen.
    #
    # AHORA VA CON PROBABILIDADES, y antes no. El motivo del cambio: el 1X2 de
    # una fecha lejana no es basura, es una estimacion peor, y el sitio ya sabe
    # decir cuanto vale cada numero. Cada partido viene marcado con `estimado`
    # para que la pagina lo aclare en vez de esconderlo.
    #
    # LAS PROBABILIDADES NO SE RECALCULAN: salen de `prob_fixture`, el mismo
    # diccionario con el que se armo fecha.json. Una fuente, dos consumidores.
    #
    # Y ARRANCA EN LA FECHA 1, no en la 2. El fixture solo trae lo que falta
    # jugar, asi que las fechas ya jugadas no estan ahi; se recuperan de
    # `jugados_con_ronda` con su resultado. Sin eso la vista fecha a fecha
    # empezaria en la fecha 2 y el torneo se veria arrancando por la mitad.
    def _dia_iso(ddmmaaaa):
        """'28/07/2026' -> '2026-07-28'. El ISO es el que ordena y agrupa."""
        d, m, a = ddmmaaaa.split("/")
        return f"{a}-{m}-{d}"

    def _entrada(ronda, dia, hora, aplazado, local, visita, prob,
                 goles_local=None, goles_visita=None):
        return {
            "ronda": ronda,
            # El dia va en ISO porque es lo que se agrupa y se ordena. El
            # `dd/mm/aaaa` que muestra el resto del sitio se arma en la UI.
            "dia": dia,
            # None en los jugados (no hace falta la hora de un partido que ya
            # pasó) y en los postergados sin dia confirmado.
            "hora": hora,
            "aplazado": aplazado,
            "local": local,
            "visita": visita,
            "local_slug": slug(local),
            "visita_slug": slug(visita),
            "colores_local": mapa_color.get(local, ["#7c8089", "#f2f1ec"]),
            "colores_visita": mapa_color.get(visita, ["#7c8089", "#f2f1ec"]),
            # None en los jugados: un 1X2 de un partido que ya termino no es
            # una probabilidad, es ruido. Ahi lo que se muestra es el marcador.
            "prob": prob,
            # True = el 1X2 es de una fecha lejana. El modelo estima fuerza a
            # partir de goles, asi que no se entera de una lesion o de un
            # refuerzo hasta varias fechas despues. La pagina lo dice.
            "estimado": prob is not None and ronda != proxima_ronda,
            "goles_local": goles_local,
            "goles_visita": goles_visita,
        }

    jugados_calendario = jugados_con_ronda(TEMPORADA)
    # Un partido jugado no puede volver a aparecer como pendiente. Pasa de
    # verdad: las dos fuentes no se enteran del resultado al mismo tiempo.
    ya_estan = {(p["local"], p["visita"]) for p in jugados_calendario}

    calendario = [
        _entrada(p["ronda"], p["dia"], None, False, p["local"], p["visita"],
                 None, p["goles_local"], p["goles_visita"])
        for p in jugados_calendario
    ] + [
        _entrada(int(f.ronda), _dia_iso(f.fecha),
                 # Un postergado sin dia confirmado arrastra una hora
                 # provisoria que no significa nada. Mejor un hueco que un
                 # numero que no se puede cumplir.
                 None if bool(f.aplazado) else f.hora,
                 bool(f.aplazado), f.local, f.visitante,
                 prob_fixture.get(f.match_id))
        for f in fixture.itertuples()
        if (f.local, f.visitante) not in ya_estan
    ]

    (SALIDA / "calendario.json").write_text(json.dumps({
        "torneo": TORNEO,
        "temporada": TEMPORADA,
        "proxima_ronda": proxima_ronda,
        "partidos": calendario,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    # --- 1c. Historial de predicciones: la unica fuente que no se recalcula ---
    #
    # Todo lo demas en este script se recalcula de cero cada corrida a proposito
    # (es "una fuente, dos consumidores"). Este archivo es la excepcion adrede:
    # una prediccion ya guardada no se toca nunca mas, porque el dia que se
    # reentrene el modelo o se arregle un bug, este es el unico lugar que sigue
    # diciendo que creia el modelo ANTES de saber el resultado. Sin esto no hay
    # forma de medir calibracion ni log loss real, ni de mostrarle a nadie que
    # el modelo funciona: solo quedaria la version recalculada de hoy, que no
    # prueba nada.
    #
    # `jugados_del_clausura` es la misma tabla con la que se arma tabla.json
    # (seccion 3, mas abajo): un partido jugado es el mismo partido jugado para
    # los dos consumidores.
    jugados_clausura = jugados_del_clausura(partidos_hist)
    nuevos, completados, total = actualizar_historial(
        fixture, prob_fixture, cuotas, jugados_clausura, TEMPORADA, TORNEO,
    )

    # --- 2. Candidatos al titulo ---
    # Solo los campos que necesita la tabla de candidatos y la placa de redes.
    # La distribucion de puntos y el detalle del descenso no van aca: viven en
    # equipos.json, que es el archivo de la ficha de cada equipo. Este se
    # mantiene chico a proposito porque lo lee la imagen de OpenGraph.
    equipos_sim = [{
        "equipo": e["equipo"],
        "zona": e["zona"],
        "campeon": e["campeon"],
        "playoffs": e["playoffs"],
        "descenso": e["descenso"],
        "slug": slug(e["equipo"]),
        "colores": mapa_color.get(e["equipo"], ["#7c8089", "#f2f1ec"]),
    } for e in simulacion["equipos"]]
    (SALIDA / "titulo.json").write_text(json.dumps({
        "torneo": simulacion["torneo"],
        "temporada": simulacion["temporada"],
        "simulaciones": simulacion["simulaciones"],
        "equipos": equipos_sim,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    # --- 3. La tabla de posiciones ---
    # Sin esto el sitio muestra probabilidades flotando en el aire: no se puede
    # saber si un 40% de playoffs es de un puntero o de un equipo que viene ultimo.
    jugados = jugados_del_clausura(partidos_hist)
    filas_tabla = [
        {**f,
         "slug": slug(f["equipo"]),
         "colores": mapa_color.get(f["equipo"], ["#7c8089", "#f2f1ec"])}
        for f in tabla_posiciones(jugados, zona)
    ]
    (SALIDA / "tabla.json").write_text(json.dumps({
        "torneo": simulacion["torneo"],
        "temporada": simulacion["temporada"],
        "partidos_jugados": len(jugados),
        "clasifican_por_zona": CLASIFICAN_POR_ZONA,
        "equipos": filas_tabla,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    # --- 4. Fuerza de cada equipo ---
    sim_por_equipo = {e["equipo"]: e for e in simulacion["equipos"]}
    forma = forma_reciente(partidos_hist)
    rendimiento = rendimiento_vs_mercado(partidos_hist, TEMPORADA)
    avanzadas = stats_avanzadas(TEMPORADA)

    fichas = []
    for equipo in sorted(zona):
        s = sim_por_equipo.get(equipo, {})
        fichas.append({
            "equipo": equipo,
            "slug": slug(equipo),
            "zona": zona[equipo],
            "colores": mapa_color.get(equipo, ["#7c8089", "#f2f1ec"]),
            "ataque": modelo["ataque"].get(equipo),
            "defensa": modelo["defensa"].get(equipo),
            "campeon": s.get("campeon"),
            "playoffs": s.get("playoffs"),
            "descenso": s.get("descenso"),
            "descenso_promedio": s.get("descenso_promedio"),
            "descenso_anual": s.get("descenso_anual"),
            "puntos": s.get("puntos"),
            "puntos_dist": s.get("puntos_dist"),
            "ultimos": forma.get(equipo, []),
            "rendimiento": rendimiento.get(equipo),
            # None si el equipo no tiene partidos medidos. El sitio tiene que
            # aguantarlo: no todos los equipos ni todas las temporadas estan
            # cubiertos, y poner 0 seria inventar que genero cero peligro.
            #
            # Va recortado a CLAVES_FICHA: este archivo lo lee TODO el sitio y
            # las 40 metricas las usa una sola pagina. Ver estadisticas.json.
            # Siempre el bloque "temporada" (la temporada completa): la ficha
            # de equipo no separa por torneo, es la misma cuenta que se hacia
            # antes de este cambio.
            "stats": recorte_ficha(avanzadas["temporada"].get(equipo)),
        })
    (SALIDA / "equipos.json").write_text(json.dumps({
        "equipos": fichas,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    # --- 4b. Las 40 metricas de FotMob, para la pagina de estadisticas ---
    # Archivo propio y no una rama de equipos.json: ese ya pesa 92 KB y lo
    # importa toda la nav. Este lo lee una pagina sola.
    #
    # Se guarda el nombre, el slug y los colores de cada equipo para que la
    # pagina se arme sin tener que cruzar contra equipos.json.
    def _armar_equipos_stats(bloque):
        return [{
            "equipo": equipo,
            "slug": slug(equipo),
            "colores": mapa_color.get(equipo, ["#7c8089", "#f2f1ec"]),
            **bloque[equipo],
        } for equipo in sorted(bloque)]

    def _bloque_json(bloque):
        """
        Un bloque de estadisticas.json: la lista de equipos mas el rango de
        partidos jugados (pj_min/pj_max), que es el dato de muestra que el
        sitio tiene que mostrar al lado de cada numero. Sin esto, un ranking
        del Clausura con un partido jugado se lee igual que uno de la
        temporada entera, y ESO es lo que el dueno pidio explicitamente que no
        pasara.
        """
        equipos_stats = _armar_equipos_stats(bloque)
        return {
            "pj_min": min(e["pj"] for e in equipos_stats) if equipos_stats else 0,
            "pj_max": max(e["pj"] for e in equipos_stats) if equipos_stats else 0,
            "equipos": equipos_stats,
        }

    # El bloque "temporada" va tambien al nivel de arriba, con las mismas
    # claves que tenia este archivo antes de separar por torneo (equipos,
    # pj_min, pj_max). Es lo que evita romper nada: cualquier lectura vieja de
    # estadisticas.json sigue viendo exactamente lo mismo. Los otros dos
    # torneos van aparte, en "torneos", porque son la parte nueva.
    bloque_temporada = _bloque_json(avanzadas["temporada"])
    (SALIDA / "estadisticas.json").write_text(json.dumps({
        "temporada": simulacion["temporada"],
        "fuente": "FotMob",
        # Cuantos partidos jugo el que menos y el que mas, EN LA TEMPORADA
        # COMPLETA (Apertura + Clausura). La pagina lo muestra: sin eso,
        # comparar totales entre equipos engania.
        "pj_min": bloque_temporada["pj_min"],
        "pj_max": bloque_temporada["pj_max"],
        "equipos": bloque_temporada["equipos"],
        # Los mismos 39 rankings, pero recortados a un solo torneo. Cada uno
        # trae su propio pj_min/pj_max porque la muestra cambia por completo:
        # el Clausura recien arranco y sus partidos por equipo no tienen nada
        # que ver con los de la temporada completa.
        "torneos": {
            "apertura": _bloque_json(avanzadas["apertura"]),
            "clausura": _bloque_json(avanzadas["clausura"]),
        },
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    # --- 5. Que se juega cada equipo en su proximo partido ---
    # El sitio ya dice "llega a playoffs: 41%", que es un numero quieto. Esto
    # contesta la pregunta que se hace el hincha de verdad: y si ganamos el
    # domingo? Sale de las MISMAS simulaciones, agrupadas segun como salio ese
    # partido; no se vuelve a simular nada.
    escenarios = [
        {**e, "slug": slug(e["equipo"]), "rival_slug": slug(e["rival"])}
        for e in simulacion.get("escenarios", [])
    ]
    (SALIDA / "escenarios.json").write_text(json.dumps({
        "simulaciones": simulacion["simulaciones"],
        "min_simulaciones_rama": simulacion.get("min_simulaciones_rama"),
        "equipos": escenarios,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    # --- 6. Metadatos: de donde salen los numeros ---
    meta = {
        "actualizado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "partidos_historicos": len(partidos_hist),
        "ultimo_partido": str(partidos_hist.date.max().date()),
        "simulaciones": simulacion["simulaciones"],
        "vida_media_dias": modelo["vida_media_dias"],
        "ventaja_local": modelo["ventaja_local"],
        # Honestidad estadistica: este numero va SIEMPRE visible en el sitio.
        # No se redondea para arriba.
        "acierto_pct": ACIERTO,
        "modelo": "Dixon-Coles + Monte Carlo",
    }

    # "actualizado" es la hora en que corrio el script, asi que cambia siempre.
    # Por si solo alcanza para que git vea un cambio y la Action commitee todos
    # los lunes aunque no se haya jugado un solo partido. Si todo el resto del
    # meta quedo igual, conservamos la marca de tiempo anterior: entonces no hay
    # diff, no hay commit, y el historial de git guarda cuando cambiaron los
    # numeros DE VERDAD. Eso es lo que despues permite medir que tan bien
    # predijo el modelo en cada momento.
    destino_meta = SALIDA / "meta.json"
    if destino_meta.exists():
        previo = json.loads(destino_meta.read_text(encoding="utf-8"))
        sin_hora = lambda m: {k: v for k, v in m.items() if k != "actualizado"}
        if sin_hora(previo) == sin_hora(meta):
            meta["actualizado"] = previo["actualizado"]

    destino_meta.write_text(json.dumps(meta, ensure_ascii=False, indent=2),
                            encoding="utf-8")

    print(f"OK  -> {SALIDA}")
    con_cuotas = sum(1 for p in partidos if p["implicita"])
    print(f"    fecha.json    fecha {proxima_ronda}: {len(partidos)} partidos "
          f"| {con_cuotas} con cuotas para comparar contra el mercado")
    if ya_jugados:
        print(f"                  ({ya_jugados} del fixture ya se jugaron y se "
              f"descartaron)")
    con_prob = sum(1 for c in calendario if c["prob"])
    print(f"    calendario.json  {len(calendario)} partidos | "
          f"fechas {min(c['ronda'] for c in calendario)} a "
          f"{max(c['ronda'] for c in calendario)} | "
          f"{len(calendario) - con_prob} jugados con marcador | "
          f"{con_prob} con 1X2 "
          f"({sum(1 for c in calendario if c['estimado'])} estimados)")
    print(f"    titulo.json   {len(equipos_sim)} equipos")
    print(f"    tabla.json    {len(filas_tabla)} equipos | {len(jugados)} partidos jugados")
    print(f"    equipos.json  {len(fichas)} equipos")
    print(f"    estadisticas.json  {len(bloque_temporada['equipos'])} equipos | "
          f"{len(METRICAS)} metricas rankeadas | "
          f"temporada completa: de {bloque_temporada['pj_min']} "
          f"a {bloque_temporada['pj_max']} partidos por equipo")
    bloque_apertura = avanzadas["apertura"]
    bloque_clausura = avanzadas["clausura"]
    pj_apertura = [v["pj"] for v in bloque_apertura.values()]
    pj_clausura = [v["pj"] for v in bloque_clausura.values()]
    print(f"                       Apertura: de {min(pj_apertura, default=0)} "
          f"a {max(pj_apertura, default=0)} partidos por equipo "
          f"({len(bloque_apertura)} equipos)")
    print(f"                       Clausura: de {min(pj_clausura, default=0)} "
          f"a {max(pj_clausura, default=0)} partidos por equipo "
          f"({len(bloque_clausura)} equipos)")
    print(f"    escenarios.json  {len(escenarios)} de {len(fichas)} equipos")
    print(f"    meta.json     acierto {ACIERTO}% | {len(partidos_hist):,} partidos historicos")
    print(f"    historial.json  {total} partidos registrados "
          f"({nuevos} nuevos, {completados} resultados completados esta corrida)")


if __name__ == "__main__":
    main()
