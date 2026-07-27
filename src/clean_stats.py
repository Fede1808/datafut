"""
Etapa 2b del pipeline: NORMALIZAR ESTADISTICAS AVANZADAS.

Espejo de clean.py, pero para los JSON de FotMob que bajo ingest_stats.py.
Toma un archivo por partido y devuelve una tabla plana con DOS filas por
partido, una por equipo. Ese formato es el que sirve para todo despues: la
pagina de equipo es un filtro por equipo, la de partido es un filtro por
partido, y los promedios de temporada son un groupby.

Rige la misma regla central que clean.py: NUNCA ADIVINA.
Si aparece un id de equipo que no esta en reference/fotmob_teams.csv, el
script se detiene. Cuando ascienda un equipo esto va a explotar, y esta bien
que explote: es una linea de trabajo manual una vez por anio, contra el riesgo
de publicar meses de estadisticas atribuidas al club equivocado.

Uso:  python src/clean_stats.py
"""

from pathlib import Path
from datetime import datetime
import json
import sys

import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "data" / "raw" / "fotmob"
TABLA_EQUIPOS = RAIZ / "reference" / "fotmob_teams.csv"
DESTINO = RAIZ / "data" / "clean" / "team_match_stats.csv"


# ---------------------------------------------------------------------------
# Que columnas nos llevamos
# ---------------------------------------------------------------------------
# A la izquierda, la clave literal que devuelve FotMob (copiada de la
# respuesta, no inventada). A la derecha, el nombre que usamos nosotros.
#
# Un par de nombres merecen aclaracion, porque es facil venderlos por mas de
# lo que son:
#
#   - pases_campo_rival y toques_en_area_rival NO son "pases progresivos".
#     Los pases progresivos eran una metrica de Opta y desaparecieron de todas
#     las fuentes gratuitas en enero de 2026. Estos miden intencion ofensiva,
#     no progresion metro a metro. Llamarlos igual seria mentirle al que lee.
#
#   - xgot (xG on target) mide la calidad del remate DESPUES de pegarle: solo
#     cuenta los que van al arco. Un equipo con xgot muy por encima de xg
#     definio bien; al reves, definio mal o le atajaron todo.
COLUMNAS = {
    "BallPossesion": "posesion",

    "expected_goals": "xg",
    "expected_goals_open_play": "xg_jugada",
    "expected_goals_set_play": "xg_pelota_parada",
    "expected_goals_non_penalty": "xg_sin_penales",
    "expected_goals_on_target": "xgot",

    "total_shots": "remates",
    "ShotsOnTarget": "remates_al_arco",
    "ShotsOffTarget": "remates_afuera",
    "blocked_shots": "remates_bloqueados",
    "shots_inside_box": "remates_dentro_area",
    "shots_outside_box": "remates_fuera_area",
    "shots_woodwork": "palos",
    "big_chance": "chances_claras",
    "big_chance_missed_title": "chances_claras_erradas",

    "passes": "pases",
    "accurate_passes": "pases_completados",
    "own_half_passes": "pases_campo_propio",
    "opposition_half_passes": "pases_campo_rival",
    "long_balls_accurate": "pelotazos_completados",
    "accurate_crosses": "centros_completados",
    "touches_opp_box": "toques_en_area_rival",

    "matchstats.headers.tackles": "quites",
    "interceptions": "intercepciones",
    "shot_blocks": "bloqueos",
    "clearances": "rechazos",
    "keeper_saves": "atajadas",

    "duel_won": "duelos_ganados",
    "ground_duels_won": "duelos_suelo_ganados",
    "aerials_won": "duelos_aereos_ganados",
    "dribbles_succeeded": "gambetas_exitosas",

    "fouls": "faltas",
    "corners": "corners",
    "Offsides": "offsides",
    "yellow_cards": "amarillas",
    "red_cards": "rojas",
}

# Las de identificacion van primero para que el CSV se lea de izquierda a
# derecha como una frase: tal dia, tal equipo, contra tal rival, hizo esto.
IDENTIFICACION = [
    "match_id", "fecha", "temporada", "torneo", "ronda",
    "equipo", "rival", "condicion", "goles", "goles_rival",
]


def numero(valor):
    """FotMob mezcla tres formatos en el mismo campo:

        18          -> un entero pelado (posesion)
        '1.96'      -> un decimal como texto (xG)
        '31 (46%)'  -> el valor y su porcentaje pegados (duelos, pases)

    El tercero es el que obliga a esta funcion. Nos quedamos con el numerador
    y tiramos el porcentaje: el porcentaje siempre se puede recalcular despues
    (ganados sobre disputados), pero el numerador no se puede recuperar de un
    porcentaje. Guardamos el dato mas crudo de los dos.
    """
    if valor is None:
        return None
    if isinstance(valor, (int, float)):
        return valor

    texto = str(valor).split(" (")[0].strip()
    if texto in ("", "-"):
        return None
    try:
        return float(texto) if "." in texto else int(texto)
    except ValueError:
        # Si aparece un formato nuevo preferimos enterarnos ahora y no dentro
        # de seis meses mirando una columna llena de vacios.
        sys.exit(
            f"ERROR: no se como convertir a numero el valor {valor!r} de FotMob.\n"
            f"       Revisa la funcion numero() en src/clean_stats.py"
        )


def cargar_tabla_equipos():
    if not TABLA_EQUIPOS.exists():
        sys.exit(f"ERROR: falta la tabla de equipos en {TABLA_EQUIPOS}")

    tabla = pd.read_csv(TABLA_EQUIPOS, encoding="utf-8")
    return dict(zip(tabla["fotmob_id"].astype(int), tabla["canonical"]))


def estadisticas_del_partido(detalle):
    """Aplana el bloque de stats de un matchDetails a {clave: [local, visitante]}.

    FotMob lo entrega en grupos ('Top stats', 'Shots', 'Duels'...) y repite
    algunas claves: una vez como titulo del grupo, con valores [None, None], y
    otra vez con el dato real. Por eso se descartan las filas de tipo 'title'.
    """
    stats = (detalle.get("content") or {}).get("stats") or {}
    periodos = stats.get("Periods") or {}
    todo = periodos.get("All") or {}

    plano = {}
    for grupo in todo.get("stats", []):
        for fila in grupo.get("stats", []):
            if fila.get("type") == "title":
                continue
            valores = fila.get("stats")
            if isinstance(valores, list) and len(valores) == 2:
                plano[fila.get("key")] = valores
    return plano


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

    filas = []
    sin_stats = 0
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

            # --- Equipos: por id entero, NUNCA por nombre ---
            # El nombre cambia de temporada a temporada y ademas hay cuatro
            # homonimos que un fuzzy match confunde sin avisar: Estudiantes
            # (LP) con Estudiantes (RC), y Gimnasia (LP) con Gimnasia (M).
            # Probado: el fuzzy match le asigna los datos de los clubes grandes
            # de La Plata a los chicos del interior. El id no puede fallar asi.
            ids = [int(general["homeTeam"]["id"]), int(general["awayTeam"]["id"])]
            nombres = [general["homeTeam"]["name"], general["awayTeam"]["name"]]
            falta = False
            for equipo_id, nombre in zip(ids, nombres):
                if equipo_id not in equipos:
                    desconocidos.setdefault(equipo_id, nombre)
                    falta = True
            if falta:
                # Seguimos recorriendo para juntar TODOS los ids que falten y
                # listarlos de una, en vez de hacerte agregar uno por corrida.
                continue

            # --- Fecha ---
            # Se usa la fecha UTC a proposito, aunque suene raro para una liga
            # argentina. Se comparo contra data/clean/matches.csv sobre los 270
            # partidos de 2026: con fecha UTC coinciden 248, con hora argentina
            # (UTC-3) solo 165. football-data.co.uk publica en horario del Reino
            # Unido, y UTC es lo que mas cerca queda de eso.
            # Gotcha conocido: quedan 9 partidos de abril de 2026 con un dia de
            # desfase, porque en abril el Reino Unido esta en UTC+1. Si alguna
            # vez el join por (fecha, equipo) deja huecos, empeza por aca.
            utc = datetime.strptime(
                general["matchTimeUTCDate"], "%Y-%m-%dT%H:%M:%S.%fZ"
            )
            fecha = utc.date().isoformat()

            plano = estadisticas_del_partido(detalle)
            if not plano:
                # Pasa en las temporadas viejas: FotMob tiene el resultado pero
                # no las estadisticas. La fila se escribe igual, con los goles y
                # las columnas de stats vacias. No se inventa nada.
                sin_stats += 1

            for lado, condicion in ((0, "local"), (1, "visitante")):
                otro = 1 - lado
                fila = {
                    "match_id": general["matchId"],
                    "fecha": fecha,
                    "temporada": temporada,
                    "torneo": general["leagueName"],
                    "ronda": general["leagueRoundName"],
                    "equipo": equipos[ids[lado]],
                    "rival": equipos[ids[otro]],
                    "condicion": condicion,
                    "goles": marcadores[lado]["score"],
                    "goles_rival": marcadores[otro]["score"],
                }
                for clave, columna in COLUMNAS.items():
                    valores = plano.get(clave)
                    fila[columna] = numero(valores[lado]) if valores else None
                filas.append(fila)

    if desconocidos:
        sys.exit(
            "ERROR: hay equipos de FotMob que no estan en reference/fotmob_teams.csv:\n"
            + "\n".join(f"  - id {i}  ({n})" for i, n in sorted(desconocidos.items()))
            + "\n\n       Agregalos a mano al archivo, con su nombre canonico exacto\n"
            "       (el mismo que usa reference/colores.csv).\n"
            "       NO los completo yo: los cuatro homonimos de la liga\n"
            "       (Estudiantes LP/RC, Gimnasia LP/M) se confunden solos."
        )

    salida = pd.DataFrame(filas, columns=IDENTIFICACION + list(COLUMNAS.values()))
    salida = salida.sort_values(["fecha", "match_id", "condicion"]).reset_index(drop=True)

    # --- Chequeo duro de completitud ---
    # Cada partido tiene que aportar exactamente dos filas. Si el numero es
    # impar hay un partido a medio parsear, y un promedio calculado sobre eso
    # sale mal sin que nada avise.
    if len(salida) % 2 != 0:
        sys.exit(
            f"ERROR: quedaron {len(salida)} filas, un numero impar.\n"
            f"       Cada partido tiene que aportar dos: hay uno a medio parsear."
        )

    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    salida.to_csv(DESTINO, index=False, encoding="utf-8")

    print(f"OK  -> {DESTINO}")
    print(f"    {len(salida):,} filas | {len(salida) // 2:,} partidos | "
          f"{salida['equipo'].nunique()} equipos | {len(salida.columns)} columnas")
    con_xg = salida["xg"].notna().sum()
    print(f"    con xG: {con_xg:,} filas ({con_xg / len(salida):.0%})")
    if sin_stats:
        print(f"    OJO: {sin_stats} partidos sin estadisticas en FotMob "
              f"(filas escritas con los goles y el resto vacio)")


if __name__ == "__main__":
    main()
