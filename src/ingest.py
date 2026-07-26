"""
Etapa 1 del pipeline: DESCARGAR.

Lo unico que hace este script es bajar el CSV original y guardarlo tal cual,
sin tocarle una coma. Esa es toda su responsabilidad.

Por que separarlo de la limpieza? Porque asi el dato crudo queda intacto en
data/raw/. Si manana descubrimos que limpiamos algo mal, corregimos clean.py y
volvemos a correr, sin tener que bajar todo de nuevo ni preguntarnos si el
archivo original ya estaba modificado.

Usa urllib, que viene incluido en Python. No hace falta instalar nada: para un
solo GET no vale la pena sumar una libreria externa.

Uso:  python src/ingest.py
"""

from pathlib import Path
from datetime import datetime
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
import sys

URL = "https://www.football-data.co.uk/new/ARG.csv"

# Los partidos que se vienen, con sus cuotas. Ojo: este archivo trae solo la
# PROXIMA FECHA, no el fixture completo del torneo. Alcanza para la portada;
# para simular el resto del torneo, simulate.py deriva los partidos que
# faltan a partir del formato.
URL_FIXTURES = "https://www.football-data.co.uk/new_league_fixtures.csv"

# Tamano minimo aceptable. A julio de 2026 el archivo pesa ~854 KB.
# Si baja mucho de esto, algo salio mal (una pagina de error, un corte de red)
# y preferimos enterarnos ahora y no cuando el modelo tire numeros raros.
MIN_BYTES = 400_000
MIN_BYTES_FIXTURES = 500

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "data" / "raw" / "ARG.csv"
DESTINO_FIXTURES = RAIZ / "data" / "raw" / "fixtures.csv"


def bajar(url, minimo):
    """Descarga una URL y verifica que el contenido tenga sentido."""
    # Algunos servidores rechazan pedidos sin User-Agent porque los toman por bots.
    pedido = Request(url, headers={"User-Agent": "datafut/0.1"})

    try:
        with urlopen(pedido, timeout=60) as respuesta:
            contenido = respuesta.read()
    except HTTPError as e:
        sys.exit(
            f"ERROR: el servidor respondio {e.code} en vez de 200 para {url}\n"
            f"       Puede ser un corte temporal o que hayan movido el archivo."
        )
    except URLError as e:
        sys.exit(f"ERROR: no se pudo conectar con football-data.co.uk -> {e.reason}")

    if len(contenido) < minimo:
        sys.exit(
            f"ERROR: {url} devolvio {len(contenido):,} bytes y se esperaban al menos "
            f"{minimo:,}.\n"
            f"       Probablemente bajamos una pagina de error en vez del CSV.\n"
            f"       No se guardo nada para no pisar la descarga anterior."
        )

    return contenido


def main():
    print(f"Descargando {URL}")
    contenido = bajar(URL, MIN_BYTES)

    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_bytes(contenido)

    # Contamos lineas para dar una senal rapida de que el archivo tiene sentido.
    # -1 por el encabezado.
    partidos = len(contenido.splitlines()) - 1

    print(f"OK  -> {DESTINO}")
    print(f"    {len(contenido):,} bytes | {partidos:,} partidos")

    print(f"\nDescargando {URL_FIXTURES}")
    fixtures = bajar(URL_FIXTURES, MIN_BYTES_FIXTURES)
    DESTINO_FIXTURES.write_bytes(fixtures)
    argentinos = sum(1 for l in fixtures.splitlines()[1:] if l.startswith(b"Argentina"))
    print(f"OK  -> {DESTINO_FIXTURES}")
    print(f"    {len(fixtures):,} bytes | {argentinos} partidos de Argentina")

    print(f"\nDescargado el {datetime.now():%d/%m/%Y %H:%M}")


if __name__ == "__main__":
    main()
