"""
Etapa 2c del pipeline: NORMALIZAR EL FIXTURE.

Espejo de clean_stats.py, pero para el calendario que baja ingest_fixture.py.
Toma el JSON crudo de los partidos que faltan jugar y devuelve una tabla plana,
una fila por partido: cuando, que fecha del torneo, quien de local y quien de
visitante, con los nombres canonicos del proyecto.

Rige la misma regla central que clean.py y clean_stats.py: NUNCA ADIVINA.

Y aca esa regla vale mas que en ningun otro lado. Un CSV de estadisticas al que
le falta un equipo se nota: la ficha de ese club aparece vacia. Un FIXTURE al
que le falta un equipo NO se nota: la simulacion juega un torneo con menos
partidos, reparte menos puntos, y publica probabilidades de titulo y de
descenso equivocadas para los 30 equipos sin que nada se vea roto. Es
exactamente la clase de bug silencioso que el proyecto ya se comio una vez
(ver el comentario de `stats_avanzadas` en src/export.py, el `int(temporada)`
que devolvia vacio y salia a produccion diciendo "OK").

Por eso: si un id de equipo no esta en reference/fotmob_teams.csv, el script se
DETIENE. Cuando ascienda un equipo esto va a explotar, y esta bien que explote.

EL MAPEO VA POR ID, NUNCA POR NOMBRE
-------------------------------------
FotMob escribe "Central Cordoba de Santiago", "Gimnasia LP", "Club Atletico
Platense", "Velez Sarsfield". El proyecto usa "Central Córdoba (SdE)",
"Gimnasia (LP)", "Platense", "Vélez Sarsfield". Cualquier match por texto
(exacto o difuso) contra esa lista es una trampa: la liga tiene CUATRO
homonimos — Estudiantes (LP) / Estudiantes (RC) y Gimnasia (LP) / Gimnasia (M)
— y un fuzzy match les asigna los datos de los clubes grandes a los chicos del
interior sin avisar. Esta probado en este mismo proyecto.

El id entero de FotMob no puede fallar asi. Es el mismo mecanismo, y la misma
tabla (reference/fotmob_teams.csv), que ya usa clean_stats.py.

reference/team_names.csv NO se usa aca: esa tabla traduce los nombres de
football-data.co.uk, que es la OTRA fuente. FotMob se mapea por id.

Uso:  python src/clean_fixture.py
"""

from pathlib import Path
from datetime import datetime, timedelta
import json
import sys

import pandas as pd

# TEMPORADA e INICIO_CLAUSURA viven en simulate.py, que es donde el proyecto ya
# define el calendario del torneo, y export.py ya los importa de ahi. Se
# reusan en vez de repetir la fecha: dos copias de "cuando arranca el Clausura"
# es garantia de que en tres meses una quede vieja.
from simulate import TEMPORADA, INICIO_CLAUSURA

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "data" / "raw" / "fotmob"
TABLA_EQUIPOS = RAIZ / "reference" / "fotmob_teams.csv"
DESTINO = RAIZ / "data" / "clean" / "fixture.csv"

# Argentina esta en UTC-3 todo el anio: no mueve el reloj desde 2009. Por eso
# alcanza con restar tres horas y no hace falta traer una libreria de zonas
# horarias. Si algun dia vuelve el horario de verano, esto hay que cambiarlo.
HORAS_ARGENTINA = -3

COLUMNAS = ["match_id", "utc", "fecha", "hora", "ronda", "torneo",
            "local", "visitante", "aplazado"]


def cargar_tabla_equipos():
    if not TABLA_EQUIPOS.exists():
        sys.exit(f"ERROR: falta la tabla de equipos en {TABLA_EQUIPOS}")

    tabla = pd.read_csv(TABLA_EQUIPOS, encoding="utf-8")
    return dict(zip(tabla["fotmob_id"].astype(int), tabla["canonical"]))


def momento(utc):
    """El instante del partido, en UTC y en hora argentina.

    FotMob manda dos formatos en el mismo campo segun el partido:
    '2026-07-28T22:00:00.000Z' (con milisegundos) en los normales y
    '2026-08-30T20:00:00Z' (sin) en los postergados. Se prueban los dos y si
    aparece un tercero se corta, porque una fecha mal parseada ordena mal el
    calendario entero.
    """
    for formato in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            t = datetime.strptime(utc, formato)
            break
        except ValueError:
            continue
    else:
        sys.exit(
            f"ERROR: no se como leer la fecha {utc!r} que devolvio FotMob.\n"
            f"       Revisa la funcion momento() en src/clean_fixture.py"
        )

    hora_local = t + timedelta(hours=HORAS_ARGENTINA)
    # El UTC se reescribe SIEMPRE con el mismo formato (los milisegundos de
    # FotMob se tiran) para que ordenar el CSV por esta columna como texto de el
    # orden cronologico de verdad. Con los dos formatos mezclados, dos partidos
    # a la misma hora salen en un orden que depende de como los escribio la API.
    #
    # El dd/mm/aaaa + HH:MM de al lado es el formato que el sitio ya muestra tal
    # cual en la portada y en la ficha de partido. Se respeta para no tocar la UI.
    return (t.strftime("%Y-%m-%dT%H:%M:%SZ"),
            hora_local.strftime("%d/%m/%Y"),
            hora_local.strftime("%H:%M"))


def main():
    origen = ORIGEN / f"fixture_{TEMPORADA}.json"
    if not origen.exists():
        sys.exit(
            f"ERROR: no existe {origen}\n"
            f"       Primero corre:  python src/ingest_fixture.py"
        )

    crudo = json.loads(origen.read_text(encoding="utf-8"))
    equipos = cargar_tabla_equipos()

    print(f"{origen.name}: {len(crudo['partidos'])} partidos por jugar "
          f"(temporada {crudo['temporada']}, bajado el {crudo['descargado']})")

    filas = []
    desconocidos = {}

    for p in crudo["partidos"]:
        # Se juntan TODOS los ids que falten antes de cortar, en vez de hacerte
        # agregar uno por corrida. Mismo criterio que clean_stats.py.
        ids = [int(p["local_id"]), int(p["visitante_id"])]
        nombres = [p["local_nombre"], p["visitante_nombre"]]
        falta = False
        for equipo_id, nombre in zip(ids, nombres):
            if equipo_id not in equipos:
                desconocidos.setdefault(equipo_id, nombre)
                falta = True
        if falta:
            continue

        utc, fecha, hora = momento(p["utc"])
        filas.append({
            "match_id": p["id"],
            "utc": utc,
            "fecha": fecha,
            "hora": hora,
            "ronda": int(p["ronda"]),
            # El Apertura y el Clausura numeran sus fechas igual (1 a 16), asi
            # que la ronda sola no identifica nada: hay que decir de que torneo
            # es. Se parte por fecha de calendario, que es el mismo corte con el
            # que simulate.py separa los dos torneos del anio.
            "torneo": "Clausura" if utc[:10] >= INICIO_CLAUSURA else "Apertura",
            "local": equipos[ids[0]],
            "visitante": equipos[ids[1]],
            # Postergado: se va a jugar, pero la fecha de arriba es provisoria.
            "aplazado": bool(p["aplazado"]),
        })

    if desconocidos:
        sys.exit(
            "ERROR: hay equipos de FotMob que no estan en reference/fotmob_teams.csv:\n"
            + "\n".join(f"  - id {i}  ({n})" for i, n in sorted(desconocidos.items()))
            + "\n\n       Agregalos a mano al archivo, con su nombre canonico exacto\n"
            "       (el mismo que usa reference/colores.csv).\n"
            "       NO los completo yo: los cuatro homonimos de la liga\n"
            "       (Estudiantes LP/RC, Gimnasia LP/M) se confunden solos.\n"
            "       Y OJO: sin esto el fixture sale incompleto y la simulacion\n"
            "       reparte menos puntos de los que el torneo tiene. Por eso corta."
        )

    salida = pd.DataFrame(filas, columns=COLUMNAS)
    salida = salida.sort_values(["utc", "match_id"]).reset_index(drop=True)

    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    salida.to_csv(DESTINO, index=False, encoding="utf-8")

    # --- Que salio ---
    por_ronda = salida.groupby(["torneo", "ronda"]).size()
    equipos_fixture = pd.concat([salida["local"], salida["visitante"]])
    por_equipo = equipos_fixture.value_counts()

    print(f"OK  -> {DESTINO}")
    print(f"    {len(salida)} partidos | {por_equipo.size} equipos | "
          f"{salida['ronda'].nunique()} rondas")
    print(f"    rondas {salida['ronda'].min()} a {salida['ronda'].max()}, "
          f"{sorted(set(por_ronda.values))} partidos por ronda")
    print(f"    del {salida['utc'].min()} al {salida['utc'].max()}")
    print(f"    partidos por equipo: {sorted(set(por_equipo.values))}")
    aplazados = int(salida["aplazado"].sum())
    if aplazados:
        print(f"    {aplazados} postergados (fecha provisoria, se juegan igual)")


if __name__ == "__main__":
    main()
