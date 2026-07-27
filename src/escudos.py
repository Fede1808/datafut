"""
Generador de escudos propios para los 30 clubes de la Liga Profesional.

=============================================================================
QUE HACE Y POR QUE EXISTE
=============================================================================

El sitio mostraba cada club como un cuadradito de dos colores (`Chip.tsx`).
Se ve pobre. La alternativa NO es descargar escudos reales: son marca
registrada de cada club y no van a terminar commiteados en un repo público.
La alternativa es generar escudos propios — monogramas con forma de escudo
de fútbol, usando los colores oficiales verificados (`reference/colores.csv`)
y un patrón que evoca la camiseta real (bastones, banda, franja, la V de
Vélez). Bien hechos, no se ven como "30 círculos iguales".

Un SVG por club en `web/public/escudos/<slug>.svg`. El slug tiene que
coincidir con el que ya usa el sitio (mismo algoritmo que `src/export.py`,
copiado a propósito en vez de importado: este script no debe depender de
`export.py` porque otro agente lo está tocando en paralelo).

Uso:
    python src/escudos.py
"""

from pathlib import Path
import csv
import unicodedata

RAIZ = Path(__file__).resolve().parent.parent
COLORES = RAIZ / "reference" / "colores.csv"
SALIDA = RAIZ / "web" / "public" / "escudos"

# Forma de escudo de fútbol clásica: rectángulo arriba, termina en punta abajo.
SHIELD_D = "M8 6 H92 V56 C92 92 68 110 50 118 C32 110 8 92 8 56 Z"

# El borde parejo es la misma solución que ya usaba Chip.tsx: un gris medio
# se ve bien tanto sobre el fondo oscuro del sitio como recortando un escudo
# blanco puro (River, Vélez, Gimnasia M, Huracán) que si no, se funde con el
# fondo. Un solo color, sin ramas por club — la lección del Chip original.
BORDE = "#3a3d45"

# Siglas cortas y sin ambigüedad entre los 30 clubes. Se hardcodean en vez de
# derivarlas de las iniciales de `equipo` porque "Gimnasia (LP)" y
# "Gimnasia (M)" derivarían la misma sigla, y "Central Córdoba (SdE)" con
# iniciales automáticas daría algo irreconocible.
SIGLAS = {
    "Aldosivi": "ALD",
    "Argentinos Juniors": "ARG",
    "Atlético Tucumán": "ATU",
    "Banfield": "BAN",
    "Barracas Central": "BAR",
    "Belgrano": "BEL",
    "Boca Juniors": "BOC",
    "Central Córdoba (SdE)": "CC",
    "Defensa y Justicia": "DYJ",
    "Deportivo Riestra": "RIE",
    "Estudiantes (LP)": "ELP",
    "Estudiantes (RC)": "ERC",
    "Gimnasia (LP)": "GLP",
    "Gimnasia (M)": "GIM",
    "Huracán": "HUR",
    "Independiente": "IND",
    "Independiente Rivadavia": "IRI",
    "Instituto": "INS",
    "Lanús": "LAN",
    "Newell's Old Boys": "NOB",
    "Platense": "PLA",
    "Racing Club": "RAC",
    "River Plate": "RIV",
    "Rosario Central": "ROS",
    "San Lorenzo": "SLO",
    "Sarmiento (J)": "SAR",
    "Talleres (C)": "TAL",
    "Tigre": "TIG",
    "Unión": "UNI",
    "Vélez Sarsfield": "VEL",
}


def slug(nombre):
    """Copiado a propósito de src/export.py (no se importa: ver docstring)."""
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFD", nombre)
        if unicodedata.category(c) != "Mn"
    )
    limpio = "".join(c if c.isalnum() else "-" for c in sin_tildes.lower())
    return "-".join(p for p in limpio.split("-") if p)


def clasificar_patron(equipo, nota):
    """
    Qué dibujar adentro del escudo, a partir de la nota verificada en el CSV.

    La regla es textual sobre `nota`, no una lista fija de clubes: así, si el
    día de mañana se corrige una nota en el CSV, el escudo se actualiza solo.
    La única excepción hardcodeada es Boca (franja horizontal), porque la
    nota del CSV solo dice "azul y amarillo" y no describe el patrón — el
    pedido original la menciona aparte.
    """
    n = nota.lower()
    if equipo == "Boca Juniors":
        return "franja"
    if "con v" in n:
        return "v"
    if "banda" in n:
        return "banda"
    if "a bastones" in n:
        return "bastones"
    if "vivos" in n:
        return "vivos"
    return "mitades"


def patron_mitades(secundario):
    # El mismo split diagonal que usaba el Chip: triángulo inferior-derecho.
    return f'<polygon points="0,120 100,0 100,120" fill="{secundario}" />'


def patron_bastones(secundario):
    # Rayas verticales: 7 franjas, la secundaria en las impares.
    ancho = 100 / 7
    rects = []
    for i in range(7):
        if i % 2 == 1:
            x = i * ancho
            rects.append(
                f'<rect x="{x:.2f}" y="0" width="{ancho:.2f}" height="120" fill="{secundario}" />'
            )
    return "".join(rects)


def patron_banda(secundario):
    # Banda diagonal tipo River: un rectángulo ancho, rotado, cruzando el escudo.
    return (
        f'<rect x="-20" y="48" width="160" height="26" '
        f'transform="rotate(-32 50 60)" fill="{secundario}" />'
    )


def patron_v(secundario):
    # La V de Vélez: dos trazos gruesos que bajan y se cruzan en el centro.
    return (
        f'<polyline points="22,14 50,74 78,14" fill="none" stroke="{secundario}" '
        f'stroke-width="15" stroke-linecap="round" stroke-linejoin="round" />'
    )


def patron_vivos(secundario):
    # Vivos: un ribete fino calcado del contorno del escudo, hacia adentro.
    return (
        f'<path d="{SHIELD_D}" fill="none" stroke="{secundario}" '
        f'stroke-width="4" transform="translate(50 60) scale(0.88) translate(-50 -60)" />'
    )


def patron_franja(secundario):
    # Franja horizontal tipo Boca: banda ancha cruzando el medio del escudo.
    return f'<rect x="0" y="46" width="100" height="30" fill="{secundario}" />'


PATRONES = {
    "mitades": patron_mitades,
    "bastones": patron_bastones,
    "banda": patron_banda,
    "v": patron_v,
    "vivos": patron_vivos,
    "franja": patron_franja,
}


def generar_svg(equipo, primario, secundario, nota):
    tipo = clasificar_patron(equipo, nota)
    patron = PATRONES[tipo](secundario)
    sigla = SIGLAS[equipo]
    # Sigla de 2 letras entra más grande que una de 3.
    tam_fuente = 30 if len(sigla) <= 2 else 24

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120">
  <defs>
    <clipPath id="recorte">
      <path d="{SHIELD_D}" />
    </clipPath>
  </defs>
  <g clip-path="url(#recorte)">
    <rect x="0" y="0" width="100" height="120" fill="{primario}" />
    {patron}
  </g>
  <path d="{SHIELD_D}" fill="none" stroke="{BORDE}" stroke-width="3" />
  <rect x="14" y="80" width="72" height="27" rx="3" fill="#0a0b0e" fill-opacity="0.62" />
  <text x="50" y="99" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
        font-weight="700" font-size="{tam_fuente}" fill="#ffffff" letter-spacing="0.5">{sigla}</text>
</svg>
"""


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    with COLORES.open(encoding="utf-8") as f:
        filas = list(csv.DictReader(f))

    generados = []
    for fila in filas:
        equipo = fila["equipo"]
        if equipo not in SIGLAS:
            raise SystemExit(f"ERROR: falta sigla para '{equipo}' en SIGLAS")
        svg = generar_svg(equipo, fila["primario"], fila["secundario"], fila["nota"])
        destino = SALIDA / f"{slug(equipo)}.svg"
        destino.write_text(svg, encoding="utf-8")
        generados.append(destino.name)

    print(f"Generados {len(generados)} escudos en {SALIDA}")
    for nombre in generados:
        print(f"  {nombre}")


if __name__ == "__main__":
    main()
