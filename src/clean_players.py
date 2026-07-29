"""
Etapa 2d del pipeline: NORMALIZAR ESTADISTICAS DE JUGADOR Y REMATES.

Hermano de clean_stats.py. Lee exactamente los mismos JSON de FotMob que ya
bajo ingest_stats.py -- no descarga nada nuevo -- y rescata las dos cosas que
clean_stats.py descarta por quedarse solo con el agregado por equipo:

  1. content.playerStats  -> data/clean/player_match_stats.csv
     Una fila por jugador y por partido. ~30 metricas por fila.

  2. content.shotmap      -> data/clean/shots.csv
     Una fila por remate, con coordenadas y xG del remate.

Se genera para TODA la liga, no solo para un club. El recorte por equipo es
un filtro de la capa de presentacion, no del pipeline: el dia que quieras
comparar a un jugador contra el resto de la liga, el dato ya esta.

Rige la misma regla central que clean.py y clean_stats.py: NUNCA ADIVINA.
Si aparece un id de equipo que no esta en reference/fotmob_teams.csv, el
script se detiene.

Uso:  python src/clean_players.py
"""

from pathlib import Path
from datetime import datetime
import json
import sys

import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "data" / "raw" / "fotmob"
TABLA_EQUIPOS = RAIZ / "reference" / "fotmob_teams.csv"
DESTINO_JUGADORES = RAIZ / "data" / "clean" / "player_match_stats.csv"
DESTINO_REMATES = RAIZ / "data" / "clean" / "shots.csv"


# ---------------------------------------------------------------------------
# Que metricas de jugador nos llevamos
# ---------------------------------------------------------------------------
# A la izquierda, la clave literal `key` que devuelve FotMob (copiada de la
# respuesta real, no inventada). A la derecha, el nombre que usamos nosotros.
#
# IMPORTANTE, y es el gotcha central de este archivo: FotMob agrupa estas
# claves en cuatro bloques ('top_stats', 'attack', 'defense', 'duels') y
# MUEVE la misma clave de bloque segun el jugador. Un arquero trae `tackles`
# dentro de 'top_stats'; un defensor la trae dentro de 'defense'. Por eso la
# busqueda es por clave a lo largo de TODOS los bloques y nunca por posicion.
# Medido: 'defensive_actions' aparece en dos bloques distintos en el mismo
# archivo.
METRICAS = {
    "rating_title": "rating",
    "minutes_played": "minutos",

    "goals": "goles",
    "assists": "asistencias",
    "expected_goals": "xg",
    "expected_assists": "xa",
    "xg_and_xa": "xg_mas_xa",
    "expected_goals_on_target_variant": "xgot",
    "expected_goals_non_penalty": "xg_sin_penales",

    "total_shots": "remates",
    "ShotsOnTarget": "remates_al_arco",
    "ShotsOffTarget": "remates_afuera",
    "blocked_shots": "remates_bloqueados",
    "shots_woodwork": "palos",
    "big_chance_created_team_title": "chances_claras_creadas",
    "big_chance_missed_title": "chances_claras_erradas",
    "chances_created": "chances_creadas",

    "accurate_passes": "pases_completados",
    "passes_into_final_third": "pases_ultimo_tercio",
    "long_balls_accurate": "pelotazos_completados",
    "accurate_crosses": "centros_completados",
    "touches": "toques",
    "touches_opp_box": "toques_en_area_rival",
    "dribbles_succeeded": "gambetas_exitosas",
    "dispossessed": "perdidas",

    "defensive_actions": "acciones_defensivas",
    "matchstats.headers.tackles": "quites",
    "interceptions": "intercepciones",
    "recoveries": "recuperaciones",
    "clearances": "rechazos",
    "headed_clearance": "rechazos_de_cabeza",
    "shot_blocks": "bloqueos",
    "dribbled_past": "lo_gambetearon",
    "errors_led_to_goal": "errores_que_terminaron_en_gol",

    "duel_won": "duelos_ganados",
    "duel_lost": "duelos_perdidos",
    "ground_duels_won": "duelos_suelo_ganados",
    "aerials_won": "duelos_aereos_ganados",
    "was_fouled": "faltas_recibidas",
    "fouls": "faltas_cometidas",
    "penalties_won": "penales_ganados",
    "conceded_penalties": "penales_cometidos",

    # Solo vienen pobladas para arqueros.
    "saves": "atajadas",
    "goals_conceded": "goles_recibidos",
    "expected_goals_on_target_faced": "xgot_en_contra",
}

IDENTIFICACION_JUGADOR = [
    "match_id", "fecha", "temporada", "torneo", "ronda",
    "equipo", "rival", "condicion", "goles_equipo", "goles_rival",
    "jugador_id", "jugador", "camiseta", "es_arquero", "titular",
]

COLUMNAS_REMATE = [
    "match_id", "fecha", "temporada", "torneo", "ronda",
    "equipo", "rival", "condicion",
    "jugador_id", "jugador", "minuto", "periodo",
    "x", "y", "xg", "xgot",
    "situacion", "tipo_remate", "resultado",
    "es_gol", "es_gol_en_contra", "es_tanda", "al_arco", "bloqueado",
]


def mapa_de_nombres(*tabla):
    """Un jugador_id, un solo nombre.

    FotMob escribe al MISMO jugador con y sin acentos segun el partido:
    'Tomas Aranda' y 'Tomas Aranda' con tilde comparten el id 1899032. Medido
    sobre Boca 2026: 33 jugadores reales aparecian como 40, con las
    estadisticas de siete de ellos partidas en dos.

    Es el mismo principio que ya rige para los equipos en clean_stats.py --
    unir por id, NUNCA por nombre -- aplicado a las personas. El id manda; el
    nombre es una etiqueta que hay que elegir.

    Criterio, en orden: gana la variante con mas caracteres acentuados (en
    castellano 'Tomas' sin tilde es la degradada, no la correcta); si empatan,
    la que aparezca en mas partidos; si vuelven a empatar, la primera
    alfabeticamente, para que dos corridas den siempre el mismo resultado.

    Devuelve el mapa {jugador_id: nombre}. Se construye una sola vez sobre
    las dos tablas juntas, para que un jugador no se llame distinto en
    player_match_stats.csv que en shots.csv.
    """
    juntas = pd.concat(tabla, ignore_index=True)
    juntas = juntas.dropna(subset=["jugador_id", "jugador"])
    if juntas.empty:
        return {}

    def acentos(nombre):
        return sum(1 for c in str(nombre) if ord(c) > 127)

    canonico = {}
    for jugador_id, grupo in juntas.groupby("jugador_id")["jugador"]:
        conteo = grupo.value_counts()
        canonico[jugador_id] = sorted(
            conteo.items(),
            key=lambda par: (-acentos(par[0]), -par[1], str(par[0])),
        )[0][0]
    return canonico


def cargar_tabla_equipos():
    if not TABLA_EQUIPOS.exists():
        sys.exit(f"ERROR: falta la tabla de equipos en {TABLA_EQUIPOS}")

    tabla = pd.read_csv(TABLA_EQUIPOS, encoding="utf-8")
    return dict(zip(tabla["fotmob_id"].astype(int), tabla["canonical"]))


def metricas_del_jugador(jugador):
    """Aplana los bloques de stats de un jugador a {clave_fotmob: valor}.

    Devuelve tambien los intentos de pase, que FotMob esconde en un lugar
    distinto del resto: la clave `accurate_passes` viene con tipo
    'fractionWithPercentage' y trae `value` (completados) y `total`
    (intentados) en el mismo objeto. Sin el total, un 34 de pases no se
    puede leer: no es lo mismo 34 de 38 que 34 de 90.
    """
    plano = {}
    pases_intentados = None

    for bloque in jugador.get("stats") or []:
        for entrada in (bloque.get("stats") or {}).values():
            clave = entrada.get("key")
            if not clave:
                # 'Shotmap' viene con key nula y valor booleano: no es una
                # metrica, es un flag de interfaz. Se ignora.
                continue
            dato = entrada.get("stat") or {}
            if clave not in plano:
                plano[clave] = dato.get("value")
            if clave == "accurate_passes" and dato.get("total") is not None:
                pases_intentados = dato.get("total")

    return plano, pases_intentados


def main():
    if not ORIGEN.exists():
        sys.exit(
            f"ERROR: no existe {ORIGEN}\n"
            f"       Primero corre:  python src/ingest_stats.py"
        )

    indices = sorted(ORIGEN.glob("indice_*.json"))
    if not indices:
        sys.exit(
            f"ERROR: no hay ningun indice en {ORIGEN}\n"
            f"       Primero corre:  python src/ingest_stats.py"
        )

    equipos = cargar_tabla_equipos()

    filas_jugadores = []
    filas_remates = []
    sin_jugadores = 0
    sin_remates = 0
    desconocidos = {}

    for ruta_indice in indices:
        indice = json.loads(ruta_indice.read_text(encoding="utf-8"))
        temporada = indice["temporada"]
        print(f"{ruta_indice.name}: {len(indice['partidos'])} partidos "
              f"(temporada {temporada})")

        for partido in indice["partidos"]:
            ruta = ORIGEN / f"{partido['id']}.json"
            if not ruta.exists():
                sys.exit(
                    f"ERROR: falta el JSON del partido {partido['id']}, que el indice\n"
                    f"       {ruta_indice.name} dice que existe.\n"
                    f"       Corre de nuevo:  python src/ingest_stats.py"
                    + (f" --temporada {temporada}" if temporada else "")
                )

            detalle = json.loads(ruta.read_text(encoding="utf-8"))
            general = detalle["general"]
            marcadores = detalle["header"]["teams"]
            contenido = detalle.get("content") or {}

            # --- Equipos: por id entero, NUNCA por nombre ---
            # Mismo motivo que en clean_stats.py: los cuatro homonimos de la
            # liga (Estudiantes LP/RC, Gimnasia LP/M) se confunden solos con
            # cualquier fuzzy match.
            ids = [int(general["homeTeam"]["id"]), int(general["awayTeam"]["id"])]
            nombres = [general["homeTeam"]["name"], general["awayTeam"]["name"]]
            falta = False
            for equipo_id, nombre in zip(ids, nombres):
                if equipo_id not in equipos:
                    desconocidos.setdefault(equipo_id, nombre)
                    falta = True
            if falta:
                continue

            # Misma decision de fecha que clean_stats.py: UTC, para que el join
            # por (fecha, equipo) contra matches.csv siga cerrando.
            utc = datetime.strptime(
                general["matchTimeUTCDate"], "%Y-%m-%dT%H:%M:%S.%fZ"
            )
            fecha = utc.date().isoformat()

            contexto = {
                "match_id": general["matchId"],
                "fecha": fecha,
                "temporada": temporada,
                "torneo": general["leagueName"],
                "ronda": general["leagueRoundName"],
            }

            # Un equipo por id, para resolver rival y condicion de cada jugador
            # sin volver a mirar el JSON.
            lado_de = {ids[0]: 0, ids[1]: 1}

            # --- Titulares: salen del lineup, no de playerStats ---
            # playerStats no dice quien arranco jugando. El lineup si, y separa
            # `starters` de `subs`. Un jugador con 90 minutos casi seguro fue
            # titular, pero "casi seguro" no alcanza para escribirlo en un CSV.
            titulares = set()
            lineup = contenido.get("lineup") or {}
            for clave_lado in ("homeTeam", "awayTeam"):
                equipo_lineup = lineup.get(clave_lado) or {}
                for jugador in equipo_lineup.get("starters") or []:
                    if jugador.get("id") is not None:
                        titulares.add(int(jugador["id"]))

            # --- Jugadores ---
            player_stats = contenido.get("playerStats") or {}
            if not player_stats:
                # Pasa en las temporadas viejas: FotMob tiene el resultado del
                # partido pero no las fichas de los jugadores. No se inventa
                # nada; el partido simplemente no aporta filas.
                sin_jugadores += 1

            for jugador in player_stats.values():
                equipo_id = jugador.get("teamId")
                if equipo_id is None or int(equipo_id) not in lado_de:
                    continue
                lado = lado_de[int(equipo_id)]
                otro = 1 - lado

                plano, pases_intentados = metricas_del_jugador(jugador)

                jugador_id = jugador.get("id")
                fila = dict(contexto)
                fila.update({
                    "equipo": equipos[ids[lado]],
                    "rival": equipos[ids[otro]],
                    "condicion": "local" if lado == 0 else "visitante",
                    "goles_equipo": marcadores[lado]["score"],
                    "goles_rival": marcadores[otro]["score"],
                    "jugador_id": jugador_id,
                    "jugador": jugador.get("name"),
                    "camiseta": jugador.get("shirtNumber"),
                    "es_arquero": bool(jugador.get("isGoalkeeper")),
                    "titular": (int(jugador_id) in titulares
                                if jugador_id is not None else None),
                })
                for clave, columna in METRICAS.items():
                    fila[columna] = plano.get(clave)
                fila["pases_intentados"] = pases_intentados
                filas_jugadores.append(fila)

            # --- Remates ---
            # El shotmap es lo mas parecido a datos de evento que tiene el
            # proyecto: cada remate con su coordenada y su xG propio.
            # `x`/`y` vienen en el sistema de FotMob (cancha de 105x68 con el
            # arco atacado a la derecha). No se reproyecta nada aca: la etapa
            # clean normaliza nombres, no unidades.
            remates = (contenido.get("shotmap") or {}).get("shots") or []
            if not remates:
                sin_remates += 1

            for remate in remates:
                equipo_id = remate.get("teamId")
                if equipo_id is None or int(equipo_id) not in lado_de:
                    continue
                lado = lado_de[int(equipo_id)]
                otro = 1 - lado

                tipo_evento = remate.get("eventType")
                en_contra = bool(remate.get("isOwnGoal"))
                fila = dict(contexto)
                fila.update({
                    "equipo": equipos[ids[lado]],
                    "rival": equipos[ids[otro]],
                    "condicion": "local" if lado == 0 else "visitante",
                    "jugador_id": remate.get("playerId"),
                    "jugador": remate.get("playerName"),
                    "minuto": remate.get("min"),
                    "periodo": remate.get("period"),
                    "x": remate.get("x"),
                    "y": remate.get("y"),
                    "xg": remate.get("expectedGoals"),
                    "xgot": remate.get("expectedGoalsOnTarget"),
                    "situacion": remate.get("situation"),
                    "tipo_remate": remate.get("shotType"),
                    "resultado": tipo_evento,
                    # `es_gol` significa "gol A FAVOR del equipo que remato".
                    # Los dos descuentos de abajo no son cosmeticos: sin ellos
                    # la suma de goles del shotmap no cierra con el marcador en
                    # el 8% de los pares equipo-partido. Medido, no estimado.
                    #
                    #   - Gol en contra (99 en el dataset): FotMob lo registra
                    #     con el teamId del que la mando adentro, que es el
                    #     equipo PERJUDICADO. Contarlo como gol suyo suma uno
                    #     de mas a el y deja uno de menos al rival.
                    #   - Tanda de penales (67 goles en 8 partidos de playoff):
                    #     no forman parte del marcador ni del xG del partido.
                    #     Se conservan las filas -- son dato real -- pero
                    #     marcadas, para que la agregacion las excluya.
                    "es_gol": tipo_evento == "Goal" and not en_contra,
                    "es_gol_en_contra": en_contra,
                    "es_tanda": remate.get("period") == "PenaltyShootout",
                    "al_arco": bool(remate.get("isOnTarget")),
                    "bloqueado": bool(remate.get("isBlocked")),
                })
                filas_remates.append(fila)

    if desconocidos:
        sys.exit(
            "ERROR: hay equipos de FotMob que no estan en reference/fotmob_teams.csv:\n"
            + "\n".join(f"  - id {i}  ({n})" for i, n in sorted(desconocidos.items()))
            + "\n\n       Agregalos a mano al archivo, con su nombre canonico exacto\n"
            "       (el mismo que usa reference/colores.csv).\n"
            "       NO los completo yo: los cuatro homonimos de la liga\n"
            "       (Estudiantes LP/RC, Gimnasia LP/M) se confunden solos."
        )

    columnas_jugador = (IDENTIFICACION_JUGADOR
                        + list(METRICAS.values())
                        + ["pases_intentados"])
    jugadores = pd.DataFrame(filas_jugadores, columns=columnas_jugador)
    jugadores = jugadores.sort_values(
        ["fecha", "match_id", "equipo", "jugador"]
    ).reset_index(drop=True)

    remates = pd.DataFrame(filas_remates, columns=COLUMNAS_REMATE)

    # Un jugador_id, un solo nombre, igual en los dos archivos.
    nombres = mapa_de_nombres(
        jugadores[["jugador_id", "jugador"]], remates[["jugador_id", "jugador"]]
    )
    antes = jugadores["jugador"].nunique()
    for tabla in (jugadores, remates):
        tabla["jugador"] = (tabla["jugador_id"].map(nombres)
                            .fillna(tabla["jugador"]))
    unificados = antes - jugadores["jugador"].nunique()

    remates = remates.sort_values(
        ["fecha", "match_id", "minuto"]
    ).reset_index(drop=True)

    DESTINO_JUGADORES.parent.mkdir(parents=True, exist_ok=True)
    jugadores.to_csv(DESTINO_JUGADORES, index=False, encoding="utf-8")
    remates.to_csv(DESTINO_REMATES, index=False, encoding="utf-8")

    print(f"OK  -> {DESTINO_JUGADORES}")
    print(f"    {len(jugadores):,} filas | "
          f"{jugadores['match_id'].nunique():,} partidos | "
          f"{jugadores['jugador_id'].nunique():,} jugadores | "
          f"{len(jugadores.columns)} columnas")
    con_rating = jugadores["rating"].notna().sum()
    print(f"    con rating: {con_rating:,} filas "
          f"({con_rating / max(len(jugadores), 1):.0%})")
    if unificados:
        print(f"    {unificados} nombres unificados por id "
              f"(FotMob escribe al mismo jugador con y sin acentos)")

    print(f"OK  -> {DESTINO_REMATES}")
    print(f"    {len(remates):,} remates | "
          f"{remates['match_id'].nunique():,} partidos | "
          f"{int(remates['es_gol'].sum()):,} goles")
    con_xg = remates["xg"].notna().sum()
    print(f"    con xG: {con_xg:,} remates "
          f"({con_xg / max(len(remates), 1):.0%})")

    if sin_jugadores:
        print(f"    OJO: {sin_jugadores} partidos sin fichas de jugador en FotMob "
              f"(no aportan filas; no se inventa nada)")
    if sin_remates:
        print(f"    OJO: {sin_remates} partidos sin shotmap en FotMob")

    # Las metricas que FotMob OMITE cuando el jugador no registro el evento
    # quedan vacias, no en cero. Es a proposito y hay que saberlo antes de
    # promediar: `xg` viene solo para los que remataron. Un promedio de xg
    # ignorando los vacios mide "cuanto genera el que remata", no "cuanto
    # genera el plantel". Para las metricas de conteo, el vacio se lee como
    # cero -- pero esa decision es de la etapa que agrega, no de esta.
    print()
    print("    NOTA: las columnas vacias son ausencias de FotMob, no ceros.")
    print("          Ver el comentario al pie de src/clean_players.py.")


if __name__ == "__main__":
    main()
