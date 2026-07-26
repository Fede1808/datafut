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

# Tamano minimo aceptable. A julio de 2026 el archivo pesa ~854 KB.
# Si baja mucho de esto, algo salio mal (una pagina de error, un corte de red)
# y preferimos enterarnos ahora y no cuando el modelo tire numeros raros.
MIN_BYTES = 400_000

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "data" / "raw" / "ARG.csv"


def main():
    print(f"Descargando {URL}")

    # Algunos servidores rechazan pedidos sin User-Agent porque los toman por bots.
    pedido = Request(URL, headers={"User-Agent": "datafut/0.1"})

    try:
        with urlopen(pedido, timeout=60) as respuesta:
            contenido = respuesta.read()
    except HTTPError as e:
        sys.exit(
            f"ERROR: el servidor respondio {e.code} en vez de 200.\n"
            f"       Puede ser un corte temporal o que hayan movido el archivo."
        )
    except URLError as e:
        sys.exit(f"ERROR: no se pudo conectar con football-data.co.uk -> {e.reason}")

    if len(contenido) < MIN_BYTES:
        sys.exit(
            f"ERROR: el archivo pesa {len(contenido):,} bytes y se esperaban al menos "
            f"{MIN_BYTES:,}.\n"
            f"       Probablemente bajamos una pagina de error en vez del CSV.\n"
            f"       No se guardo nada para no pisar la descarga anterior."
        )

    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_bytes(contenido)

    # Contamos lineas para dar una senal rapida de que el archivo tiene sentido.
    # -1 por el encabezado.
    partidos = len(contenido.splitlines()) - 1

    print(f"OK  -> {DESTINO}")
    print(f"    {len(contenido):,} bytes | {partidos:,} partidos")
    print(f"    descargado el {datetime.now():%d/%m/%Y %H:%M}")


if __name__ == "__main__":
    main()
