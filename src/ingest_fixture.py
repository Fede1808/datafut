"""
Etapa 1c del pipeline: DESCARGAR EL FIXTURE (los partidos que FALTAN jugar).

Hermano de ingest_stats.py, y del mismo endpoint. Aquel se queda con los
partidos TERMINADOS para bajarles las estadisticas; este se queda con los que
todavia no se jugaron, que es el calendario del torneo.

Igual que ingest.py e ingest_stats.py, lo unico que hace es bajar y guardar
crudo. No mapea nombres, no valida equipos, no calcula nada. De eso se ocupa
clean_fixture.py.

POR QUE EXISTE ESTE ARCHIVO
---------------------------
Hasta ahora el simulador FABRICABA los partidos que faltan: armaba el todos
contra todos de cada zona, restaba los jugados, y para decidir quien era local
invertia la localia del Apertura (que es como suele funcionar el torneo
argentino, pero es un supuesto). Los cruces interzonales se copiaban del
torneo anterior directamente.

Y todo eso era innecesario: FotMob publica el calendario REAL en el mismo
JSON del que ya bajabamos los partidos jugados. Son los mismos 225 partidos;
la unica diferencia era que unos estaban inventados y otros no. Con el
calendario de verdad la localia deja de ser un supuesto, y eso no es
cosmetico: el modelo le da al local una ventaja de ~0.27 en goles esperados
(~30% mas goles), asi que repartir mal la localia inclina TODAS las
probabilidades que publica el sitio.

ACA NO HAY CACHE, Y ES A PROPOSITO
-----------------------------------
Esta es LA diferencia con ingest_stats.py, y conviene tenerla clara porque es
justo al reves.

Un partido jugado no cambia nunca: el xG del River-Boca del sabado va a ser el
mismo dentro de diez anios. Por eso alla cada partido se baja UNA vez y queda
como archivo suelto para siempre.

Un partido PENDIENTE cambia todo el tiempo:

  - se reprograma (la AFA mueve fechas enteras por copas internacionales),
  - le cambian el horario (television),
  - se suspende y se juega otro dia,
  - y en el limite se le cambia la sede, o sea la localia.

Cachear eso seria guardar un calendario viejo y simular con el. Por eso este
script BAJA TODO DE NUEVO EN CADA CORRIDA y pisa el archivo anterior. Es un
solo request: no hay nada que optimizar y si hay mucho que perder.

Consecuencia practica: si FotMob nos bloquea, este archivo NO se puede
reconstruir de disco como el cache de estadisticas. Se queda el ultimo que
bajamos, que es viejo pero sirve; clean_fixture.py imprime la fecha de
descarga justamente para que se vea cuando pasa.

LOS PARTIDOS SUSPENDIDOS ENTRAN IGUAL (gotcha caro)
----------------------------------------------------
FotMob marca `cancelled: true` a los partidos POSTERGADOS, con
`reason.short == "PP"` (postponed). Al 28/07/2026 hay 12 asi, todos de la
fecha 7.

Un partido postergado NO esta cancelado: se va a jugar, con fecha a confirmar.
Si se filtrara por `cancelled` como hace ingest_stats.py, el fixture pasaria de
225 partidos a 213 y doce equipos simularian 15 partidos en vez de 16 — o sea
menos puntos en juego, probabilidades de titulo y de descenso mal calculadas, y
nada avisando. Por eso el criterio de este script es UNO SOLO: `not finished`.

La marca de postergado no se tira, se guarda: clean_fixture.py la propaga a la
columna `aplazado` para que se sepa cuales tienen fecha provisoria.

Sin paralelizar y con pausa de 0.2s entre pedidos, igual que ingest_stats.py.
Aca es un unico request, pero la constante se mantiene para que el dia que este
script pida algo mas siga el mismo criterio.

Uso:  python src/ingest_fixture.py                 # temporada en curso
      python src/ingest_fixture.py --temporada 2026
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
    """Un GET que falla ruidosamente. Mismo criterio que ingest_stats.py."""
    try:
        respuesta = requests.get(url, headers=HEADERS, timeout=60)
    except requests.RequestException as e:
        sys.exit(f"ERROR: no se pudo conectar con FotMob -> {e}")

    if respuesta.status_code != 200:
        sys.exit(
            f"ERROR: FotMob respondio {respuesta.status_code} en vez de 200 para\n"
            f"       {url}\n"
            f"       Si es 403 o 429, probablemente nos estan limitando. NO insistas\n"
            f"       automaticamente: esperá y fijate si vuelve solo. El fixture que\n"
            f"       ya esta bajado sigue en disco, viejo pero usable."
        )

    try:
        return respuesta.json()
    except ValueError:
        sys.exit(
            f"ERROR: FotMob respondio 200 pero el cuerpo no es JSON valido.\n"
            f"       {url}\n"
            f"       Suele pasar cuando devuelven una pagina de error disfrazada."
        )


def nombre_fixture(temporada):
    """Las temporadas viejas se llaman '2019/2020' y la barra no va en un nombre
    de archivo. La reemplazamos, pero adentro del JSON guardamos la original."""
    return DESTINO / f"fixture_{temporada.replace('/', '-')}.json"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--temporada",
        help="Temporada de FotMob, por ejemplo 2026. "
             "Si no se pasa, usa la que FotMob tenga en curso.",
    )
    args = parser.parse_args()

    url = URL_LIGA.format(liga=LIGA)
    if args.temporada:
        url += f"&season={args.temporada}"

    print(f"Pidiendo el calendario de la liga -> {url}")
    liga = pedir(url)
    time.sleep(PAUSA)

    temporada = str(liga["details"]["selectedSeason"])
    if args.temporada and temporada != args.temporada:
        sys.exit(
            f"ERROR: pedi la temporada {args.temporada} y FotMob devolvio {temporada}.\n"
            f"       Temporadas disponibles: {liga.get('allAvailableSeasons')}"
        )

    todos = liga["fixtures"]["allMatches"]

    # UNICO criterio: lo que no termino, falta jugarse. Ver el docstring: los
    # postergados vienen con `cancelled: true` y TIENEN que entrar igual, porque
    # se van a jugar. Filtrarlos dejaria a doce equipos con un partido menos.
    pendientes = [m for m in todos if not m["status"].get("finished")]

    aplazados = sum(1 for m in pendientes if m["status"].get("cancelled"))
    print(f"Temporada {temporada}: {len(todos)} partidos en el calendario | "
          f"{len(todos) - len(pendientes)} terminados | {len(pendientes)} por jugar")
    if aplazados:
        print(f"    de esos, {aplazados} figuran postergados (fecha provisoria)")

    if not pendientes:
        # No es un error: puede ser el final del torneo. Pero es raro suficiente
        # como para que convenga verlo escrito y no deducirlo de un CSV vacio.
        print("AVISO: FotMob no devolvio ningun partido pendiente. Si el torneo no "
              "termino, revisa la temporada.")

    DESTINO.mkdir(parents=True, exist_ok=True)

    # Se guarda plano y ya recortado a lo que hace falta: id, ronda, cuando, y
    # los dos equipos por ID. El nombre viaja al lado del id SOLO para que un
    # humano pueda leer el archivo; el que manda para mapear es el id (los
    # nombres de FotMob cambian de temporada a temporada y hay cuatro homonimos
    # en la liga que un match por nombre confunde sin avisar).
    #
    # `descargado` no es decoracion: como acá no hay cache, es lo unico que
    # distingue un fixture de hoy de uno de hace tres semanas.
    salida = {
        "temporada": temporada,
        "liga": LIGA,
        "descargado": datetime.now().isoformat(timespec="seconds"),
        "partidos": [
            {
                "id": m["id"],
                "ronda": m["round"],
                "utc": m["status"]["utcTime"],
                "aplazado": bool(m["status"].get("cancelled")),
                "local_id": m["home"]["id"],
                "local_nombre": m["home"]["name"],
                "visitante_id": m["away"]["id"],
                "visitante_nombre": m["away"]["name"],
            }
            for m in pendientes
        ],
    }

    destino = nombre_fixture(temporada)
    destino.write_text(
        json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8"
    )

    print(f"OK  -> {destino}")
    print(f"    {len(pendientes)} partidos por jugar | se pisa entero en cada corrida")


if __name__ == "__main__":
    main()
