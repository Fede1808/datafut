"""Etapa 1d del pipeline: BAJAR LAS IMAGENES.

Dos cosas distintas, con origenes y licencias distintas:

  1. Retratos de los jugadores del plantel -> web/public/jugadores/{id}.png
     Vienen del CDN de FotMob, indexados por el MISMO id de jugador que ya usa
     `data/clean/player_match_stats.csv`. No hay que adivinar nombres.

  2. La foto de portada -> web/public/portada.jpg
     De Wikimedia Commons, buscando por licencia. Se elige SOLO entre las
     licencias libres de la lista blanca de abajo, y la atribucion queda
     registrada. Bajar una foto de un diario habria sido tomar una obra ajena
     sin permiso; esto no.

Todo lo descargado queda registrado en `reference/fotos.csv` con su origen,
licencia, autor y fecha, igual que `reference/escudos.csv` para los escudos.

SOBRE EL RIESGO DE LAS FOTOS DE JUGADORES. El CLAUDE.md del proyecto decia
"fotos o retratos identificables de jugadores: prohibidos". El dueño levanto
esa restriccion explicitamente el 29/07/2026 sabiendo lo que implicaba. Los
dos motivos por los que estaba puesta siguen siendo ciertos y hay que
convivir con ellos: un retrato tiene un autor (casi siempre una agencia) y
ademas el derecho de imagen del jugador, y ninguno de los dos titulares es el
club. Si llega un reclamo, el camino de vuelta es borrar la carpeta y volver a
las iniciales sobre color: el layout ya funciona sin las fotos.

Uso:  python src/ingest_fotos.py
      python src/ingest_fotos.py --solo-portada
"""

from pathlib import Path
from urllib.parse import quote
import argparse
import csv
import json
import re
import sys
import time
import urllib.request

RAIZ = Path(__file__).resolve().parent.parent
CLUB_JSON = RAIZ / "web" / "data" / "club.json"
DESTINO_JUGADORES = RAIZ / "web" / "public" / "jugadores"
DESTINO_PORTADA = RAIZ / "web" / "public" / "portada.jpg"
REGISTRO = RAIZ / "reference" / "fotos.csv"

FOTO_JUGADOR = "https://images.fotmob.com/image_resources/playerimages/{id}.png"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
BUSQUEDA_PORTADA = "La Bombonera stadium"

# Lista blanca de licencias. Si la foto elegida no cae en una de estas, no se
# baja: mejor quedarse sin portada que publicar algo que no se puede publicar.
LICENCIAS_OK = ("cc0", "cc by", "cc by-sa", "public domain")

AGENTE = "datafut/1.0 (proyecto sin fines de lucro; contacto en el repo)"

# Ancho y calidad finales de la portada. 1600px con calidad 78 da ~250 KB, y
# encima va un velo oscuro con texto: el detalle fino no se ve ni se extraña.
# El thumb original de Commons pesaba 2,6 MB, diez veces mas, para nada.
#
# Ademas el sitio la sirve con next/image, que vuelve a comprimirla a WebP o
# AVIF segun el navegador. Este numero es el del archivo que se versiona, no
# el que baja el visitante.
ANCHO_PORTADA = 1600
CALIDAD_PORTADA = 78


def pedir(url, binario=True, intentos=3):
    pedido = urllib.request.Request(url, headers={"User-Agent": AGENTE})
    ultimo = None
    for n in range(intentos):
        try:
            with urllib.request.urlopen(pedido, timeout=30) as r:
                datos = r.read()
            return datos if binario else datos.decode("utf-8")
        except Exception as e:  # noqa: BLE001 - se reintenta y se reporta abajo
            ultimo = e
            time.sleep(1.5 * (n + 1))
    raise RuntimeError(f"no pude bajar {url}: {ultimo}")


def sin_html(texto):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", texto or "")).strip()


def bajar_portada(registro):
    """Elige la mejor foto libre de la Bombonera y la baja.

    'Mejor' = licencia libre + mas ancha, con un tope de 2400px de ancho para
    el thumb. El original de 5568x3712 pesa varios MB y a nadie le sirve
    esperarlo para ver una portada.
    """
    consulta = (
        f"{COMMONS_API}?action=query&generator=search"
        f"&gsrsearch={quote(BUSQUEDA_PORTADA)}&gsrnamespace=6&gsrlimit=20"
        f"&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=2400&format=json"
    )
    datos = json.loads(pedir(consulta, binario=False))
    paginas = (datos.get("query") or {}).get("pages") or {}

    candidatas = []
    for p in paginas.values():
        info = (p.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata") or {}
        licencia = sin_html((meta.get("LicenseShortName") or {}).get("value", ""))
        if not any(ok in licencia.lower() for ok in LICENCIAS_OK):
            continue
        url = info.get("thumburl") or info.get("url")
        if not url:
            continue
        candidatas.append({
            "titulo": p.get("title", ""),
            "url": url,
            "pagina": info.get("descriptionurl", ""),
            "ancho": info.get("width") or 0,
            "licencia": licencia,
            "autor": sin_html((meta.get("Artist") or {}).get("value", "")) or "desconocido",
        })

    if not candidatas:
        print("AVISO: ninguna foto de la portada tiene licencia libre. "
              "No se baja nada y el bloque queda sin foto.")
        return None

    # Se prefiere una foto del estadio y no del escudo/logo, que la busqueda
    # tambien devuelve. El filtro es por titulo porque es lo unico confiable.
    def puntaje(c):
        titulo = c["titulo"].lower()
        es_logo = "logo" in titulo or "escudo" in titulo
        return (not es_logo, c["ancho"])

    elegida = max(candidatas, key=puntaje)
    DESTINO_PORTADA.parent.mkdir(parents=True, exist_ok=True)
    DESTINO_PORTADA.write_bytes(pedir(elegida["url"]))

    # El thumb de Commons a 2400px de ancho pesa ~2,6 MB. Eso en una portada es
    # inaceptable: es la PRIMERA cosa que carga el sitio y en un celular con
    # datos son varios segundos de pantalla vacia. Se reescala a 1920 y se
    # recomprime, que para una foto de fondo con texto encima es de sobra.
    try:
        from PIL import Image

        with Image.open(DESTINO_PORTADA) as im:
            original = im.size
            im = im.convert("RGB")
            if im.width > ANCHO_PORTADA:
                alto = round(im.height * ANCHO_PORTADA / im.width)
                im = im.resize((ANCHO_PORTADA, alto), Image.LANCZOS)
            im.save(DESTINO_PORTADA, "JPEG", quality=CALIDAD_PORTADA,
                    optimize=True, progressive=True)
        print(f"    reescalada {original[0]}x{original[1]} -> {im.width}x{im.height}")
    except ImportError:
        print("    AVISO: sin Pillow no se reescala; la portada queda pesada.")

    registro.append({
        "archivo": "portada.jpg",
        "que": "portada",
        "nombre": elegida["titulo"],
        "origen": elegida["pagina"] or elegida["url"],
        "licencia": elegida["licencia"],
        "autor": elegida["autor"],
        "bajado": time.strftime("%Y-%m-%d"),
    })
    kb = DESTINO_PORTADA.stat().st_size / 1024
    print(f"OK  portada -> {DESTINO_PORTADA.name}  {kb:.0f} KB")
    print(f"    {elegida['titulo']}")
    print(f"    {elegida['licencia']} · {elegida['autor']}")
    print(f"    ATENCION: esta licencia EXIGE atribuir al autor en la pagina.")
    return elegida


def bajar_jugadores(registro):
    if not CLUB_JSON.exists():
        sys.exit(
            f"ERROR: falta {CLUB_JSON}\n"
            f"       Primero corre:  python src/export_boca.py"
        )
    club = json.loads(CLUB_JSON.read_text(encoding="utf-8"))
    plantel = club["plantel"]

    DESTINO_JUGADORES.mkdir(parents=True, exist_ok=True)
    bajados = 0
    faltan = []
    for j in plantel:
        destino = DESTINO_JUGADORES / f"{j['id']}.png"
        if destino.exists() and destino.stat().st_size > 0:
            continue
        try:
            datos = pedir(FOTO_JUGADOR.format(id=j["id"]))
        except RuntimeError:
            faltan.append(j["jugador"])
            continue
        # El CDN devuelve 200 con un placeholder minusculo cuando no tiene la
        # foto. Un PNG real de estos pesa 8-20 KB; por debajo de 2 KB es el
        # placeholder y guardarlo seria peor que no tener nada.
        if len(datos) < 2048:
            faltan.append(j["jugador"])
            continue
        destino.write_bytes(datos)
        bajados += 1
        registro.append({
            "archivo": f"jugadores/{j['id']}.png",
            "que": "jugador",
            "nombre": j["jugador"],
            "origen": FOTO_JUGADOR.format(id=j["id"]),
            "licencia": "sin licencia libre — ver el aviso en el encabezado",
            "autor": "FotMob (redistribuye de terceros)",
            "bajado": time.strftime("%Y-%m-%d"),
        })
        time.sleep(0.25)

    ya = len(list(DESTINO_JUGADORES.glob("*.png")))
    print(f"OK  jugadores -> {DESTINO_JUGADORES}")
    print(f"    {bajados} nuevas · {ya} en total sobre {len(plantel)} del plantel")
    if faltan:
        print(f"    sin foto ({len(faltan)}): {', '.join(faltan[:6])}"
              + (" ..." if len(faltan) > 6 else ""))
        print(f"    esos van con la inicial sobre el color del club")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--solo-portada", action="store_true")
    ap.add_argument("--solo-jugadores", action="store_true")
    args = ap.parse_args()

    registro = []
    if not args.solo_jugadores:
        bajar_portada(registro)
    if not args.solo_portada:
        bajar_jugadores(registro)

    if registro:
        nuevo = not REGISTRO.exists()
        with REGISTRO.open("a", newline="", encoding="utf-8") as f:
            campos = ["archivo", "que", "nombre", "origen", "licencia", "autor", "bajado"]
            w = csv.DictWriter(f, fieldnames=campos)
            if nuevo:
                w.writeheader()
            w.writerows(registro)
        print(f"    registradas {len(registro)} filas en {REGISTRO.name}")


if __name__ == "__main__":
    main()
