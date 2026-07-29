"""Etapa final del pipeline: ARMAR EL JSON DEL CLUB PARA EL SITIO.

El sitio dejo de ser "la liga con una pagina por equipo" y paso a ser un sitio
sobre Boca. El modelo NO cambio por eso: sigue estimando los 30 equipos, porque
la fuerza de Boca solo significa algo en relacion al resto. Lo que cambia es la
salida, y esta etapa es la que la arma.

Lee lo que ya produjeron las etapas anteriores:
  data/clean/player_match_stats.csv   (clean_players.py)
  data/clean/shots.csv                (clean_players.py)
  web/data/equipos.json               (export.py)

Y escribe un solo archivo:
  web/data/club.json

Se mantiene aparte de export.py a proposito: aquel ya pasa las mil lineas y
resuelve otra cosa. Cada etapa tiene que poder correrse sola.

Uso:  python src/export_boca.py
"""

from pathlib import Path
import json
import sys

import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
JUGADORES = RAIZ / "data" / "clean" / "player_match_stats.csv"
REMATES = RAIZ / "data" / "clean" / "shots.csv"
EQUIPO = RAIZ / "data" / "clean" / "team_match_stats.csv"
EQUIPOS = RAIZ / "web" / "data" / "equipos.json"
DESTINO = RAIZ / "web" / "data" / "club.json"

CLUB = "Boca Juniors"

# Minimo de partidos para entrar a la tabla del plantel. Con uno solo, un
# suplente que entro diez minutos y metio un gol aparece con numeros de crack.
# No se lo esconde: se lo deja afuera de la tabla y su ficha sigue existiendo.
MIN_PARTIDOS = 2

# Metricas de CONTEO: cuando FotMob las omite es porque el jugador no registro
# el evento, asi que ahi el vacio SI se lee como cero.
# Las de TASA -- rating, xg, xa -- quedan afuera de esta lista a proposito: en
# esas el vacio es ausencia real y rellenarlo con cero hundiria el promedio.
CONTEO = [
    "goles", "asistencias", "remates", "remates_al_arco",
    "pases_completados", "pases_intentados", "pases_ultimo_tercio",
    "pelotazos_completados", "centros_completados", "toques",
    "toques_en_area_rival", "gambetas_exitosas", "perdidas",
    "chances_creadas", "chances_claras_creadas",
    "acciones_defensivas", "quites", "intercepciones", "recuperaciones",
    "rechazos", "bloqueos", "lo_gambetearon",
    "duelos_ganados", "duelos_perdidos", "duelos_suelo_ganados",
    "duelos_aereos_ganados", "faltas_cometidas", "faltas_recibidas",
    "atajadas", "goles_recibidos",
]

# Lo que se muestra por 90 minutos en la ficha, agrupado como se lee un
# partido: con la pelota, creando, sin la pelota, y en los duelos.
GRUPOS = [
    ("Con la pelota", ["toques", "pases_completados", "pases_ultimo_tercio",
                       "toques_en_area_rival", "gambetas_exitosas",
                       "centros_completados", "perdidas"]),
    ("Creación y remate", ["remates", "remates_al_arco", "chances_creadas",
                           "chances_claras_creadas"]),
    ("Sin la pelota", ["recuperaciones", "quites", "intercepciones",
                       "rechazos", "bloqueos", "lo_gambetearon"]),
    ("Duelos", ["duelos_ganados", "duelos_perdidos", "duelos_aereos_ganados",
                "faltas_recibidas", "faltas_cometidas"]),
]


def leer_csv(ruta, comando):
    if not ruta.exists():
        sys.exit(f"ERROR: falta {ruta}\n       Primero corre:  {comando}")
    return pd.read_csv(ruta, encoding="utf-8", low_memory=False)


def redondear(valor, decimales=2):
    if valor is None or pd.isna(valor):
        return None
    return round(float(valor), decimales)


def main():
    jugadores = leer_csv(JUGADORES, "python src/clean_players.py")
    remates = leer_csv(REMATES, "python src/clean_players.py")

    if not EQUIPOS.exists():
        sys.exit(f"ERROR: falta {EQUIPOS}\n       Primero corre:  python src/export.py")
    equipos = json.loads(EQUIPOS.read_text(encoding="utf-8"))["equipos"]

    ficha = next((e for e in equipos if e["equipo"] == CLUB), None)
    if ficha is None:
        sys.exit(
            f"ERROR: {CLUB} no esta en {EQUIPOS.name}.\n"
            f"       Revisa que el nombre coincida con reference/colores.csv."
        )

    # La temporada sale del dato, no de una constante: asi el 1 de enero el
    # sitio no se queda mostrando el anio pasado porque nadie toco el codigo.
    temporada = int(jugadores["temporada"].max())

    del_club = jugadores[
        (jugadores["equipo"] == CLUB)
        & (jugadores["temporada"] == temporada)
        & (jugadores["minutos"] > 0)
    ].copy()
    if del_club.empty:
        sys.exit(
            f"ERROR: no hay ni un jugador de {CLUB} en la temporada {temporada}.\n"
            f"       Revisa data/clean/player_match_stats.csv"
        )

    for columna in CONTEO:
        if columna not in del_club.columns:
            del_club[columna] = 0
        del_club[columna] = del_club[columna].fillna(0)

    # --- Chequeo duro: un id, un nombre ---
    # Si esto salta, clean_players.py dejo de unificar los nombres y la tabla
    # del plantel va a mostrar al mismo jugador dos veces con las
    # estadisticas partidas al medio. Paso de verdad con los acentos de
    # FotMob ('Tomas Aranda' / 'Tomas Aranda' con tilde, mismo id).
    if del_club["jugador_id"].nunique() != del_club["jugador"].nunique():
        repetidos = (del_club.groupby("jugador_id")["jugador"].nunique() > 1)
        sys.exit(
            "ERROR: hay jugadores con un mismo id y mas de un nombre:\n"
            + "\n".join(
                f"  - id {i}: {sorted(del_club[del_club.jugador_id == i].jugador.unique())}"
                for i in repetidos[repetidos].index
            )
            + "\n\n       Lo resuelve mapa_de_nombres() en src/clean_players.py."
        )

    plantel, fichas = [], {}
    for (jugador_id, nombre), g in del_club.groupby(["jugador_id", "jugador"]):
        minutos = float(g["minutos"].sum())
        totales = {c: float(g[c].sum()) for c in CONTEO}
        partidos = int(len(g))

        plantel.append({
            "id": int(jugador_id),
            "jugador": nombre,
            "arquero": bool(g["es_arquero"].max()),
            "pj": partidos,
            "titular": int(g["titular"].fillna(False).sum()),
            "minutos": int(minutos),
            "rating": redondear(g["rating"].mean()),
            "goles": int(totales["goles"]),
            "asistencias": int(totales["asistencias"]),
            "xg": redondear(g["xg"].fillna(0).sum()),
            "xa": redondear(g["xa"].fillna(0).sum()),
            "remates": int(totales["remates"]),
            "chances_creadas": int(totales["chances_creadas"]),
            "duelos_ganados": int(totales["duelos_ganados"]),
            "recuperaciones": int(totales["recuperaciones"]),
        })

        fichas[str(int(jugador_id))] = {
            "totales": {c: redondear(v, 1) for c, v in totales.items()},
            # Por 90 y no en bruto: comparar a un titular con un suplente por
            # totales no dice nada. La division es por los minutos REALES.
            "por90": {c: redondear(v / minutos * 90) if minutos else None
                      for c, v in totales.items()},
            "serie": [
                {"fecha": r.fecha, "rival": r.rival, "condicion": r.condicion,
                 "minutos": int(r.minutos), "rating": redondear(r.rating),
                 "goles": int(r.goles), "asistencias": int(r.asistencias)}
                for r in g.sort_values("fecha").itertuples()
            ],
        }

    plantel.sort(key=lambda p: -p["minutos"])

    # --- Remates ---
    # Sin la tanda de penales: no forma parte del marcador ni del xG.
    del_anio = (remates["temporada"] == temporada) & (~remates["es_tanda"])
    a_favor = remates[(remates["equipo"] == CLUB) & del_anio]
    en_contra = remates[(remates["rival"] == CLUB) & del_anio]

    # --- Goles por franja del partido ---
    # Se cuentan sobre los REMATES que terminaron en gol, no sobre los goles
    # del marcador: el shotmap trae el minuto y el marcador no. Los goles en
    # contra y la tanda quedan afuera (`es_gol` ya los excluye).
    #
    # La ultima franja es 76-90+ y se lleva el tiempo agregado: FotMob reporta
    # el minuto 90+3 como 90, asi que un gol al final del partido cae ahi de
    # todos modos. Decir "76-90" seria mentir por omision.
    FRANJAS = [(1, 15), (16, 30), (31, 45), (46, 60), (61, 75), (76, 200)]
    goles_del_anio = a_favor[a_favor["es_gol"]]
    contra_del_anio = en_contra[en_contra["es_gol"]]
    franjas = []
    for desde, hasta in FRANJAS:
        en_franja = goles_del_anio["minuto"].between(desde, hasta)
        en_contra_franja = contra_del_anio["minuto"].between(desde, hasta)
        franjas.append({
            "etiqueta": f"{desde}-{'90+' if hasta > 90 else hasta}",
            "favor": int(en_franja.sum()),
            "contra": int(en_contra_franja.sum()),
        })

    # --- De local y de visitante ---
    equipo = leer_csv(EQUIPO, "python src/clean_stats.py")
    del_club_eq = equipo[equipo["equipo"] == CLUB]
    del_anio_eq = del_club_eq[del_club_eq["temporada"] == temporada]

    def bloque_condicion(d, etiqueta):
        if d.empty:
            return None
        ganados = int((d["goles"] > d["goles_rival"]).sum())
        empatados = int((d["goles"] == d["goles_rival"]).sum())
        perdidos = int((d["goles"] < d["goles_rival"]).sum())
        pj = int(len(d))
        return {
            "condicion": etiqueta,
            "pj": pj,
            "g": ganados, "e": empatados, "p": perdidos,
            "gf": int(d["goles"].sum()),
            "gc": int(d["goles_rival"].sum()),
            "pts": ganados * 3 + empatados,
            # Puntos por partido, que es lo unico comparable cuando de local
            # jugaste 9 y de visitante 9 pero en otra temporada 21 y 16.
            "pts_pp": redondear((ganados * 3 + empatados) / pj) if pj else None,
            "xg": redondear(d["xg"].sum(), 1) if d["xg"].notna().any() else None,
        }

    local_visita = [
        b for b in (
            bloque_condicion(del_anio_eq[del_anio_eq["condicion"] == "local"], "Local"),
            bloque_condicion(
                del_anio_eq[del_anio_eq["condicion"] == "visitante"], "Visitante"
            ),
        ) if b is not None
    ]

    # --- Temporada a temporada ---
    # Son las que HAY, no las que quedarian lindas: FotMob arranca en 2023.
    # Mas nueva primero, porque el torneo en curso es el que se mira.
    temporadas = []
    for anio, g in sorted(del_club_eq.groupby("temporada"), key=lambda x: -x[0]):
        bloque = bloque_condicion(g, str(int(anio)))
        if bloque:
            bloque["temporada"] = int(anio)
            bloque.pop("condicion")
            temporadas.append(bloque)

    salida = {
        "club": CLUB,
        "temporada": temporada,
        "franjas": franjas,
        "local_visita": local_visita,
        "temporadas": temporadas,
        "slug": ficha["slug"],
        "colores": ficha.get("colores"),
        "min_partidos": MIN_PARTIDOS,
        "grupos_por90": [{"titulo": t, "metricas": m} for t, m in GRUPOS],
        "plantel": plantel,
        "fichas": fichas,
        "remates": [
            {"x": redondear(r.x, 2), "y": redondear(r.y, 2),
             "xg": redondear(r.xg, 3), "gol": bool(r.es_gol),
             "al_arco": bool(r.al_arco), "situacion": r.situacion,
             "jugador_id": None if pd.isna(r.jugador_id) else int(r.jugador_id),
             "jugador": r.jugador, "minuto": None if pd.isna(r.minuto) else int(r.minuto),
             "rival": r.rival, "fecha": r.fecha}
            for r in a_favor.itertuples()
        ],
        "resumen": {
            "remates": int(len(a_favor)),
            "al_arco": int(a_favor["al_arco"].sum()),
            "xg": redondear(a_favor["xg"].sum(), 1),
            "goles": int(a_favor["es_gol"].sum()),
            "remates_en_contra": int(len(en_contra)),
            "xg_en_contra": redondear(en_contra["xg"].sum(), 1),
            "goles_en_contra": int(en_contra["es_gol"].sum()),
        },
    }

    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(json.dumps(salida, ensure_ascii=False), encoding="utf-8")

    print(f"OK  -> {DESTINO}")
    print(f"    {CLUB} {temporada} | {len(plantel)} jugadores | "
          f"{len(salida['remates'])} remates | {DESTINO.stat().st_size/1024:.0f} KB")
    print(f"    resumen: {salida['resumen']}")

    # Aviso, no error: que un jugador no tenga rating es normal (FotMob no lo
    # publica para todos los partidos). Que no lo tenga NINGUNO seria raro.
    sin_rating = [p["jugador"] for p in plantel if p["rating"] is None]
    if sin_rating:
        print(f"    {len(sin_rating)} sin rating: {', '.join(sin_rating[:5])}"
              + (" ..." if len(sin_rating) > 5 else ""))


if __name__ == "__main__":
    main()
