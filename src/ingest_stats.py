"""
Etapa 1b del pipeline: DESCARGAR ESTADISTICAS AVANZADAS.

Hermano de ingest.py. Aquel baja resultados y cuotas de football-data.co.uk;
este baja las estadisticas de cada partido (xG, duelos, posesion, pases) de
FotMob. Son dos ramas separadas del pipeline que recien se juntan en outputs:
el modelo Dixon-Coles se sigue entrenando con los 6.238 partidos de
football-data, que tienen 14 anios de historico contra los 3 de FotMob.
Las stats avanzadas son una capa ADICIONAL, no un reemplazo.

Igual que ingest.py, lo unico que hace es bajar y guardar crudo. No parsea,
no limpia, no calcula nada. De eso se ocupa clean_stats.py.

EL CACHE NO ES UNA OPTIMIZACION, ES LA RED DE SEGURIDAD
--------------------------------------------------------
Un partido ya jugado no cambia nunca: el xG del River-Boca del sabado va a ser
el mismo dentro de diez anios. Por eso cada partido se baja UNA sola vez y
queda como archivo suelto en data/raw/fotmob/.

Eso tiene dos consecuencias practicas:

  1. La corrida post-fecha son ~15 requests (~20 segundos), no 270 (~5 minutos).
  2. Si manana FotMob nos bloquea, TODO lo que ya bajamos sigue en disco. El
     pipeline se degrada, no se muere.

El segundo punto es el importante. Se usa esta fuente asumiendo a conciencia
que sus Terminos de Uso prohiben la recuperacion sistematica de datos
(ver docs/fuentes-stats-avanzadas.md, seccion 7). Tener el crudo guardado es
lo que hace que esa decision sea reversible.

Sin paralelizar y con pausa de 0.2s entre pedidos. No hay ningun apuro y si
hay riesgo de que nos corten por golpear fuerte.

Uso:  python src/ingest_stats.py                 # temporada en curso
      python src/ingest_stats.py --temporada 2023  # backfill
"""

from pathlib import Path
from datetime import datetime
import argparse
import json
import sys
import time

import requests

# 112 es la Liga Profesional Argentina en FotMob. Verificado el 27/07/2026.
LIGA = 112
URL_LIGA = "https://www.fotmob.com/api/data/leagues?id={liga}"
URL_PARTIDO = "https://www.fotmob.com/api/data/matchDetails?matchId={partido}"

# Un User-Agent de navegador. No es para disfrazarse: muchos servidores
# rechazan de plano los pedidos sin User-Agent. Con esto alcanza — no hace
# falta ni API key, ni cookies, ni falsificar la huella TLS.
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    )
}

PAUSA = 0.2

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "data" / "raw" / "fotmob"


def pedir(url):
    """Un GET que falla ruidosamente. Mismo criterio que ingest.py."""
    try:
        respuesta = requests.get(url, headers=HEADERS, timeout=60)
    except requests.RequestException as e:
        sys.exit(f"ERROR: no se pudo conectar con FotMob -> {e}")

    if respuesta.status_code != 200:
        sys.exit(
            f"ERROR: FotMob respondio {respuesta.status_code} en vez de 200 para\n"
            f"       {url}\n"
            f"       Si es 403 o 429, probablemente nos estan limitando. NO insistas\n"
            f"       automaticamente: esperá y fijate si vuelve solo. Lo que ya esta\n"
            f"       bajado en data/raw/fotmob/ sigue sirviendo."
        )

    try:
        return respuesta.json()
    except ValueError:
        sys.exit(
            f"ERROR: FotMob respondio 200 pero el cuerpo no es JSON valido.\n"
            f"       {url}\n"
            f"       Suele pasar cuando devuelven una pagina de error disfrazada."
        )


def nombre_indice(temporada):
    """Las temporadas viejas se llaman '2019/2020' y la barra no va en un nombre
    de archivo. La reemplazamos, pero adentro del JSON guardamos la original."""
    return DESTINO / f"indice_{temporada.replace('/', '-')}.json"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--temporada",
        help="Temporada de FotMob, por ejemplo 2026 o 2023. "
             "Si no se pasa, usa la que FotMob tenga en curso.",
    )
    args = parser.parse_args()

    url = URL_LIGA.format(liga=LIGA)
    if args.temporada:
        url += f"&season={args.temporada}"

    print(f"Pidiendo el calendario de la liga -> {url}")
    liga = pedir(url)

    temporada = str(liga["details"]["selectedSeason"])
    if args.temporada and temporada != args.temporada:
        sys.exit(
            f"ERROR: pedi la temporada {args.temporada} y FotMob devolvio {temporada}.\n"
            f"       Temporadas disponibles: {liga.get('allAvailableSeasons')}"
        )

    # Solo los partidos terminados. Los que se estan jugando cambian minuto a
    # minuto y los que no empezaron no tienen estadisticas: bajarlos seria
    # guardar basura y romper el cache (habria que volver a bajarlos despues).
    terminados = [
        m for m in liga["fixtures"]["allMatches"]
        if m["status"].get("finished") and not m["status"].get("cancelled")
    ]
    print(f"Temporada {temporada}: {len(terminados)} partidos terminados")

    DESTINO.mkdir(parents=True, exist_ok=True)

    # Aca esta todo el truco del incremental: un archivo por partido, y si el
    # archivo existe no se vuelve a pedir. Sin base de datos, sin estado extra.
    faltantes = [
        m for m in terminados
        if not (DESTINO / f"{m['id']}.json").exists()
    ]

    print(f"En cache: {len(terminados) - len(faltantes)} | a bajar: {len(faltantes)}")

    arranque = time.time()
    for i, partido in enumerate(faltantes, start=1):
        detalle = pedir(URL_PARTIDO.format(partido=partido["id"]))
        (DESTINO / f"{partido['id']}.json").write_text(
            json.dumps(detalle, ensure_ascii=False), encoding="utf-8"
        )

        if i == 1 or i % 20 == 0 or i == len(faltantes):
            print(f"  {i}/{len(faltantes)}  {time.time() - arranque:.0f}s")

        time.sleep(PAUSA)

    # El indice guarda a que temporada pertenece cada partido. Hace falta porque
    # el matchDetails NO trae la temporada por ningun lado, y clean_stats.py
    # tiene que poder armar el CSV sin volver a pedirle nada a la red.
    #
    # Se escribe AL FINAL, y no antes de bajar, a proposito: el indice es la
    # lista de lo que clean_stats.py va a exigir que exista en disco. Si lo
    # escribieramos primero y la descarga se cortara a la mitad (un 403, un
    # corte de red), el indice prometeria partidos que no estan y clean_stats.py
    # se caeria. Escribiendolo al final, una corrida interrumpida deja el estado
    # anterior intacto: se pierde el trabajo del indice, no el CSV.
    indice = {
        "temporada": temporada,
        "liga": LIGA,
        "descargado": datetime.now().isoformat(timespec="seconds"),
        "partidos": [
            {
                "id": m["id"],
                "ronda": m["round"],
                "utc": m["status"]["utcTime"],
                "local_id": m["home"]["id"],
                "visitante_id": m["away"]["id"],
                "marcador": m["status"]["scoreStr"],
            }
            for m in terminados
        ],
    }
    nombre_indice(temporada).write_text(
        json.dumps(indice, ensure_ascii=False, indent=1), encoding="utf-8"
    )

    print(f"OK  -> {DESTINO}")
    print(f"    {len(terminados)} partidos en el indice | "
          f"{len(faltantes)} nuevos en {time.time() - arranque:.0f}s")


if __name__ == "__main__":
    main()
