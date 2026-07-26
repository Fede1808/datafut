# Stack del sitio y arquitectura de actualización

Decidido el 26/07/2026.

## La decisión en una línea

**Next.js (App Router) + TypeScript + Tailwind, generación estática, deploy en Vercel.**
El pipeline de Python escribe JSON; el sitio los lee en tiempo de build.

## Por qué

El `CLAUDE.md` ya definía Next.js y Vercel, y la decisión aguanta el análisis:

- **El sitio es casi estático.** Los datos cambian una vez por fecha, no en tiempo real.
  Eso pide generación estática (SSG), no un servidor consultando una base en cada visita.
- **El público está en el celular.** Páginas pre-generadas y servidas desde CDN son lo más
  rápido que existe. No hay espera de servidor ni de base de datos.
- **El SEO importa**, porque el objetivo es que el proyecto se haga conocido. HTML completo
  desde el primer byte es lo que Google necesita.
- **React ya lo conocés.** No tiene sentido sumar un framework nuevo para ganar milisegundos.

**Alternativa considerada y descartada: Astro.** Es técnicamente superior para contenido
puro (manda cero JavaScript por defecto). Se descartó porque la ventaja real es chica
cuando Next.js se usa bien con SSG, y no compensa aprender un stack nuevo.

**Alternativa descartada de entrada: base de datos.** Ni Supabase ni Postgres ni nada.
Los datos son treinta equipos y un par de cientos de partidos, se recalculan enteros una
vez por semana y no hay usuarios ni escritura. Una base sería una pieza más para mantener
sin ninguna ventaja. Archivos JSON en el repo alcanzan y sobran.

## Piezas

| Pieza | Qué | Por qué |
|---|---|---|
| Next.js 15, App Router | framework | SSG, metadata para SEO, rutas por archivo |
| TypeScript | tipado | los datos vienen de JSON generado; los tipos evitan errores tontos |
| Tailwind CSS | estilos | el diseño está definido por tokens (colores, tamaños), que es exactamente como funciona Tailwind |
| Vercel | hosting | deploy automático desde git, CDN global, gratis para esto |
| GitHub Actions | automatización | corre el pipeline después de cada fecha |

Sin librería de gráficos: los tres componentes visuales del diseño (barra de tres tramos,
chip de color partido en diagonal, celdas de marcadores) son CSS puro. **Meter una librería
de charts para eso sería sumar 100 KB al celular de alguien a cambio de nada.**

## Cómo se actualiza solo (esto es la v1)

Tu criterio de terminado es: *"termina una fecha y, sin que yo toque nada, el sitio muestra
las probabilidades actualizadas"*. Así se cumple:

```
  [GitHub Actions, por ejemplo cada lunes]
              |
              v
   python src/ingest.py      baja los resultados nuevos
   python src/clean.py       normaliza
   python src/model.py       reentrena el modelo
   python src/simulate.py    vuelve a simular el torneo
              |
              v
   escribe los JSON en web/data/
              |
              v
   commit + push automatico
              |
              v
   [Vercel detecta el push y reconstruye el sitio]
              |
              v
   sitio actualizado, sin que nadie toque nada
```

Nadie interviene. Y hay un beneficio que no es obvio: como cada actualización queda
**commiteada en git**, tenés el historial completo de lo que el modelo predijo en cada
momento. Eso permite mostrar después qué tan bien le viene pegando — que es una de las
páginas del diseño y algo que casi nadie hace.

## Qué falta construir

**1. Que el pipeline escriba JSON, no solo Markdown.**
Hoy `simulate.py` y `evaluate.py` generan `.md` para leer en la terminal. Hace falta que
generen además JSON para el sitio. Esa misma salida va a alimentar después las placas de
redes: **una fuente, dos consumidores**.

Archivos previstos en `web/data/`:

| Archivo | Contenido |
|---|---|
| `fecha.json` | partidos de la próxima fecha con 1X2, goles esperados y marcadores probables |
| `titulo.json` | los 30 equipos con probabilidad de campeón y de playoffs |
| `equipos.json` | ataque, defensa y recorrido posible de cada equipo |
| `meta.json` | cuándo se actualizó, cuántas simulaciones, cómo viene acertando el modelo |

**2. `reference/colores.csv`** — los dos colores de cada uno de los 30 clubes. El diseño
depende de esto y no se puede inferir de ningún lado: es un dato editorial que va a mano.

**3. La app Next.js** en `web/`, con tres rutas:
`/` (la fecha) · `/equipo/[slug]` · `/partido/[slug]`

## Reglas de implementación

- **Ningún número se escribe a mano en el código.** Todos salen del JSON. Los números de
  los mockups son ilustrativos.
- **Ningún escudo, logo ni foto de jugador.** Identidad por color y nombre. Ver `CLAUDE.md`.
- **El aviso de "no oficial" siempre visible**, no en el pie de página.
- **Mobile primero.** El diseño de escritorio se deriva del de celular, no al revés.
- **Nada de "por si acaso".** Si el sitio no necesita autenticación, buscador ni modo
  offline, no se construyen.
