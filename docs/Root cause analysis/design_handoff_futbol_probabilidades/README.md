# Handoff: Sitio de probabilidades — dirección "Laboratorio de datos" (opción 1b)

## Overview
Sitio público, gratis y sin registro, que publica probabilidades propias (modelo Dixon-Coles + Monte Carlo) sobre la Liga Profesional argentina. Esta dirección visual — "Laboratorio de datos" — comunica un instrumento de precisión: modo oscuro, tipografía técnica, cifras en monoespaciada. Es la dirección elegida entre tres propuestas (1a editorial de archivo, 1b laboratorio de datos ← ESTA, 1c planilla de cancha).

## About the Design Files
Los archivos de este paquete son **referencias de diseño hechas en HTML** — prototipos que muestran el look & feel buscado, no código de producción para copiar tal cual. La tarea es **recrear este diseño en el entorno real del proyecto** (el framework/stack que uses) siguiendo sus propios patrones — o, si todavía no hay stack elegido, elegir el más adecuado para un sitio público de contenido/datos con mucho tráfico mobile (por ejemplo Next.js/React con SSG/ISR, dado que los datos se recalculan una vez por fecha).

Archivo de referencia: `diseno-referencia.dc.html` (abrí en el navegador; contiene las tres direcciones exploradas — la relevante para implementar es la sección con id `1b`).

## Fidelity
**Alta fidelidad (hifi)** en paleta, tipografía, jerarquía y estructura de los tres módulos mostrados (portada mobile, portada desktop, componente de partido). Son mockups estáticos de un subconjunto de partidos — no incluyen las 12 fechas completas ni las páginas de equipo/partido completas descritas en el brief; esas se diseñan con el mismo lenguaje visual.

## Screens / Views

### 1. Portada mobile (340×680 en el mockup, diseñar mobile-first)
- **Propósito**: mostrar la fecha en curso; la probabilidad de campeón debe verse sin scrollear.
- **Layout**: columna única. De arriba a abajo: header con nombre del sitio → banner de aviso "no oficial" (fondo #2a2c33, texto #c9cbd1) → módulo "Prob. de campeón" (2 columnas grandes: Boca 18.7%, River 16.5% + fila secundaria con 3 equipos más chicos + nota del máximo) → lista de próximos partidos (cards apiladas, cada una con: nombres + chip de color por equipo + barra horizontal de 3 tramos local/empate/visitante + números debajo) → link "Ver los 12 partidos".
- **Componentes clave**: chip de equipo = cuadrado 10×10px partido en diagonal (`linear-gradient(135deg, colorA 50%, colorB 50%)`) con los dos colores del club — nunca escudo. Barra de probabilidad = 3 segmentos flex proporcionales a los porcentajes.

  **REGLA DE COLOR DE LA BARRA — CORREGIDA (26/07/2026).** El handoff original decía
  "local = color del equipo local, visita = color del equipo visitante", pero los mockups
  mezclaban eso con colores genéricos. Hay que resolverlo, porque tiene un caso que rompe:
  **River vs Independiente** son los dos rojos, y la barra quedaría rojo-gris-rojo,
  ilegible. Lo mismo con cualquier cruce de colores parecidos.

  Regla definitiva:

  - **La barra usa SIEMPRE colores fijos**, no los del club:
    local `#5c7cfa` · empate `#565962` · visitante `#ff5c7a`
  - **La identidad del club vive solo en el chip** partido en diagonal, que está al lado
    del nombre y nunca compite con otro chip por el mismo espacio.

  Se gana consistencia (la barra siempre se lee igual, el usuario aprende una sola vez qué
  significa cada color) y se elimina de raíz el problema de los colores que chocan.

### 2. Portada desktop (~1280px real; mockup a 400px es una versión reducida, no escalada literal)
- **Layout**: header full-width con nombre + aviso no-oficial a la derecha. Debajo, dos columnas: principal (1.5fr) con próximos partidos en lista/grid; sidebar (1fr) con ranking de candidatos al título, siempre visible sin scroll.
- Mismos componentes que mobile, filas más anchas.

### 3. Componente de partido individual (se repite en portada, página de equipo y página de partido)
- **Layout**: card ~340px. Header: nombre local (izq) — "vs" — nombre visitante (der), cada uno con su chip de color.
- 1X2 en grande: 3 columnas centradas, número en `IBM Plex Mono` 24px + etiqueta LOCAL/EMPATE/VISITA en mayúscula, 9px, color `#7c8089`.
- Marcadores más probables: 4 celdas en fila (fondo `#1e2027`, radius 2px), cada una con el marcador (ej. "1-1") en mono 14px + porcentaje debajo en 9px.
- Nota inferior de incertidumbre en mono 9.5px color `#565962` — este texto de honestidad estadística debe estar SIEMPRE presente, no es opcional.

  **CORREGIDO (26/07/2026) — la versión original de este handoff tenía dos datos falsos:**

  | Decía | Debe decir | Por qué |
  |---|---|---|
  | `xG 1.4 — 1.2` | `Goles esperados 1.27 — 1.04` | **No usar la sigla xG.** xG (*expected goals*) se calcula con la calidad de cada remate y necesita datos de evento, que están fuera del alcance de la v1. Lo que produce el modelo es otra cosa: goles esperados **antes** de jugarse el partido. Usar mal el término quema credibilidad justo con el público que más entiende. Además el número estaba mal: verificado contra el modelo, es 1.27 — 1.04. |
  | `el modelo falla ~4/10 veces` | `el modelo acierta 4 de cada 10` | Medido sobre 1.236 partidos con validación temporal: acierta **41.7%**, o sea **falla el 58.3%** (casi 6 de cada 10). La versión original exageraba la precisión del modelo, y en un sitio cuyo diferencial es la honestidad estadística eso es lo peor que puede pasar. |

  El 1X2 del componente también se corrigió: era `41 / 30 / 29` y los valores reales son
  `40.4 / 30.5 / 29.2` → se muestran como **40 / 31 / 29**.

  Regla general para quien implemente: **ningún número del sitio se escribe a mano.** Todos
  salen del JSON que genera el pipeline. Los del mockup son ilustrativos.

## Interactions & Behavior
- No hay estados de carga simulados en el mockup (datos estáticos por fecha, se recalculan server-side una vez por fecha — no hace falta polling ni loading spinners recurrentes).
- Hover en cards de partido: se puede usar un leve `background` más claro (`#1e2027` → `#24262d`) para indicar que es clickeable hacia la página de partido.
- El aviso "no oficial" debe ser siempre visible (no colapsable, no en footer).
- Responsive: mobile-first; el layout de 2 columnas del desktop colapsa a columna única en mobile con el mismo orden (partidos primero, candidatos al título arriba de todo — visible sin scroll).

## State Management
- Datos de fecha: lista de partidos (local, visitante, prob. local/empate/visitante, goles esperados local/visitante).
- Ranking de candidatos al título: lista ordenada de {equipo, prob. campeón}, 30 equipos, mostrar top 5-6 en portada con link a tabla completa.
- Página de partido: además de 1X2, distribución completa de marcadores (probabilidad por cada combinación de goles) para el gráfico de marcadores más probables.
- Colores por equipo: mapa estático `equipo → [colorA, colorB]` (no viene del modelo, es un dato de configuración editorial).

## Design Tokens

**Colores**
- Fondo: `#15161a`
- Fondo de card secundaria: `#1e2027`
- Texto principal: `#f2f1ec`
- Texto secundario/labels: `#7c8089`
- Texto terciario/notas: `#565962`
- Bordes/separadores: `#2a2c33`
- Acento (dato exclusivo — prob. de campeón): `#ffcf5c`
- Local (genérico cuando no se usa color de equipo): `#5c7cfa`
- Visita (genérico): `#ff5c7a`
- Empate/neutro: `#565962`

**Tipografía**
- Display/títulos: `Space Grotesk` 600/700
- Toda cifra y dato (porcentajes, marcadores, xG): `IBM Plex Mono` 400/500/600
- Tamaños: título de sitio 18–19px, número destacado de campeón 26px, 1X2 en componente de partido 24px, labels 9–10px con letter-spacing.

**Espaciado**: base 4px; paddings de card 14–20px; gap entre filas 8–9px.

**Radios**: 2–4px en cards y celdas (nunca pill grande).

## Assets
No hay imágenes, logos ni fotos de jugadores (prohibido por el brief). La única "imaginería" son los chips de color partidos en diagonal generados por CSS (`linear-gradient`). Fuentes vía Google Fonts: Space Grotesk, IBM Plex Mono, IBM Plex Sans.

### Colores de los equipos — CORREGIDO (26/07/2026)

Los colores ya no se eligen a ojo: están en **`reference/colores.csv`**, con los 30 clubes
de la temporada 2026 verificados. El mockup tenía dos mal:

| Club | El mockup usaba | Es en realidad |
|---|---|---|
| Barracas Central | verde `#2f6b3a` | **rojo y blanco** `#C8102E` / `#FFFFFF` |
| Deportivo Riestra | naranja `#e2751a` | **negro y blanco** `#111111` / `#FFFFFF` |

**Problema detectado al cargar los colores reales:** el fondo del sitio es `#15161a`, casi
negro, y hay dos clubes cuyo color principal es negro — **Central Córdoba (SdE)** y
**Deportivo Riestra**. Sus chips se volverían invisibles.

Solución a aplicar en la implementación: todo chip lleva un borde sutil de `1px solid
#3a3d45`. Se ve bien en todos los casos y resuelve el de los negros sin excepciones ni
casos especiales en el código.

Ojo también con los clubes de blanco puro (River, Vélez, Huracán, Gimnasia de Mendoza): el
mismo borde los delimita contra el fondo oscuro.

## Files
- `diseno-referencia.dc.html` — prototipo completo con las 3 direcciones (abrir y anclar en `#1b` para ver la elegida).
