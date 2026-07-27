"""
Descarga los escudos reales de los 30 clubes desde TheSportsDB.

=============================================================================
QUE HACE Y POR QUE EXISTE
=============================================================================

`src/escudos.py` genera escudos propios (monogramas con los colores del club).
Siguen existiendo como red de seguridad, pero la prioridad la tienen los
escudos reales: este script los baja, los normaliza a 128x128 PNG y los deja
en `web/public/escudos/reales/<slug>.png`.

Se separan en una subcarpeta a propósito: así el componente puede intentar el
real primero y caer al generado sin ambigüedad de nombres, y se ve de un
vistazo qué club tiene cuál.

-----------------------------------------------------------------------------
POR QUE EL MAPEO ES UNA TABLA DE IDs Y NO UNA BUSQUEDA POR NOMBRE
-----------------------------------------------------------------------------

Este es EL punto delicado de todo el script. La liga tiene cuatro clubes que
se llaman casi igual de a pares:

    Estudiantes (LP)  vs  Estudiantes (RC)
    Gimnasia (LP)     vs  Gimnasia (M)

Cualquier match por similitud de texto les asigna el escudo del club
equivocado — y el error es silencioso: el sitio se ve perfecto, solo que
Estudiantes de Río Cuarto tiene el escudo del Pincha. Por eso acá se guarda
el `idTeam` numérico de TheSportsDB, verificado uno por uno contra el nombre
completo que devuelve la API ("Estudiantes de La Plata" vs "Estudiantes de
Río Cuarto"). Un ID no se confunde.

Los IDs salieron de enumerar los partidos de la liga 4406 (endpoint
`eventsround.php`), no de `searchteams.php`: la key pública de test corta las
respuestas a 10 resultados y las búsquedas por nombre devuelven un solo
equipo, que para los homónimos es justamente el equivocado.

-----------------------------------------------------------------------------
KEY DE LA API
-----------------------------------------------------------------------------

`3` es la key de test pública y documentada de TheSportsDB. No hay cuenta ni
registro de por medio, a propósito.

Uso:
    python src/escudos_reales.py
"""

from datetime import date
from io import BytesIO
from pathlib import Path
import csv
import time
import urllib.request

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "web" / "public" / "escudos" / "reales"
TRAZA = RAIZ / "reference" / "escudos.csv"

API = "https://www.thesportsdb.com/api/v1/json/3"
FICHA = "https://www.thesportsdb.com/team/{id}"

# Los usos reales son 16px en las filas de la tabla y 44px en la cabecera de
# equipo. 128 da margen de sobra para pantallas 2x y mantiene el peso bajo.
LADO = 128

# slug del sitio (web/data/equipos.json) -> idTeam de TheSportsDB.
# El nombre del comentario es el `strTeam` que devuelve la API, que es como se
# verificó cada línea. No tocar sin volver a mirar la ficha del club.
EQUIPOS = {
    "aldosivi": 135150,                  # Aldosivi
    "argentinos-juniors": 135151,        # Argentinos Juniors
    "atletico-tucuman": 135681,          # Atlético Tucumán
    "banfield": 135154,                  # Banfield
    "barracas-central": 137771,          # Barracas Central
    "belgrano": 135155,                  # Belgrano
    "boca-juniors": 135156,              # Boca Juniors
    "central-cordoba-sde": 137603,       # Central Córdoba de Santiago del Estero
    "defensa-y-justicia": 135159,        # Defensa y Justicia
    "deportivo-riestra": 137782,         # Deportivo Riestra
    "estudiantes-lp": 135160,            # Estudiantes de La Plata      <- homónimo
    "estudiantes-rc": 137773,            # Estudiantes de Río Cuarto    <- homónimo
    "gimnasia-lp": 135161,               # Gimnasia y Esgrima de La Plata <- homónimo
    "gimnasia-m": 137778,                # Gimnasia y Esgrima de Mendoza  <- homónimo
    "huracan": 135163,                   # Huracán
    "independiente": 135164,             # Independiente
    "independiente-rivadavia": 137777,   # Independiente Rivadavia
    "instituto": 137786,                 # Instituto
    "lanus": 135165,                     # Lanús
    "newell-s-old-boys": 135166,         # Newell's Old Boys
    "platense": 137775,                  # Platense
    "racing-club": 135170,               # Racing Club
    "river-plate": 135171,               # River Plate
    "rosario-central": 135172,           # Rosario Central
    "san-lorenzo": 135173,               # San Lorenzo
    "sarmiento-j": 135175,               # Sarmiento
    "talleres-c": 136674,                # Talleres de Córdoba
    "tigre": 135177,                     # Tigre
    "union": 135178,                     # Unión
    "velez-sarsfield": 135179,           # Vélez Sarsfield
}


def bajar(url):
    """
    La key pública tiene un límite de requests bajo y contesta 429 apenas se
    lo pasa. Reintento con espera creciente en vez de fallar: son 60 llamadas
    en total, no vale la pena complicarlo más que esto.
    """
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    for intento in range(6):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or intento == 5:
                raise
            time.sleep(5 * (intento + 1))
    raise RuntimeError(f"no se pudo bajar {url}")


def ficha(id_equipo):
    """Devuelve (strTeam, strBadge) del club. Sirve además para verificar el ID."""
    import json

    datos = json.loads(bajar(f"{API}/lookupteam.php?id={id_equipo}"))
    equipo = datos["teams"][0]
    return equipo["strTeam"], equipo.get("strBadge") or ""


def normalizar(binario):
    """
    Recorta el transparente sobrante, escala a LADO y centra sobre un lienzo
    cuadrado. El recorte importa: varios badges vienen con mucho margen vacío
    y sin él el escudo se ve mucho más chico que el de al lado en la tabla.
    """
    img = Image.open(BytesIO(binario)).convert("RGBA")
    caja = img.getbbox()
    if caja:
        img = img.crop(caja)

    escala = LADO / max(img.size)
    nuevo = (max(1, round(img.width * escala)), max(1, round(img.height * escala)))
    img = img.resize(nuevo, Image.LANCZOS)

    lienzo = Image.new("RGBA", (LADO, LADO), (0, 0, 0, 0))
    lienzo.paste(img, ((LADO - img.width) // 2, (LADO - img.height) // 2))

    # Paleta de 128 colores en vez de RGBA completo: baja el total de 421 KB a
    # 100 KB y a 16/44px no se nota ninguna diferencia (se comparó a 128px y ya
    # ahí son indistinguibles). Esto se sirve en cada carga de página, así que
    # el ahorro vale más que unos colores que nadie va a ver.
    return lienzo.quantize(colors=128, method=Image.FASTOCTREE)


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    hoy = date.today().isoformat()
    filas = []

    for slug, id_equipo in EQUIPOS.items():
        nombre, badge = ficha(id_equipo)
        if not badge:
            print(f"  SIN BADGE {slug} ({nombre}) -> queda el generado")
            filas.append([slug, "generado", "", "SVG propio (src/escudos.py)", hoy])
            continue

        img = normalizar(bajar(badge))
        destino = SALIDA / f"{slug}.png"
        img.save(destino, "PNG", optimize=True)
        peso = destino.stat().st_size // 1024
        print(f"  {slug:26} {nombre:38} {peso:>3} KB")

        filas.append([
            slug,
            "TheSportsDB",
            FICHA.format(id=id_equipo),
            "Contenido comunitario de TheSportsDB; el escudo es marca del club, uso editorial",
            hoy,
        ])
        time.sleep(2)

    with TRAZA.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["slug", "fuente", "url_origen", "licencia", "fecha_descarga"])
        w.writerows(sorted(filas))

    print(f"\n{len(filas)} escudos en {SALIDA}")
    print(f"Trazabilidad en {TRAZA}")


if __name__ == "__main__":
    main()
