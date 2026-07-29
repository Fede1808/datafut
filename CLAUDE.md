# Contexto del proyecto

## Qué estamos construyendo

**Un sitio público en español sobre Boca Juniors**, con un modelo estadístico propio
adentro, que se actualiza solo después de cada fecha de la Liga Profesional.

No es un juego. No es una app de resultados en vivo tipo Promiedos. No es una herramienta de apuestas. No es una cuenta que regrafica datos ajenos: el modelo es propio y es lo que distingue al proyecto.

### El giro de producto (29/07/2026)

Hasta esa fecha el sitio era sobre la liga entera, con una página por equipo. Se
reencuadró para hablar de un solo club. **Lo que cambió es la capa de presentación,
no el pipeline** — y esta distinción es la más importante de todo el archivo:

> **El modelo sigue estimando los 30 equipos y no se toca.** Dixon-Coles estima la
> fuerza de Boca **en relación al resto**: sus parámetros de ataque y defensa sólo
> significan algo comparados con los de los demás. Si alguien recorta el pipeline a
> Boca, el modelo se muere — no hay con qué comparar, no hay simulación de torneo, no
> hay probabilidad de campeón ni de rival. Se convierte en una planilla.

Las cuatro secciones del sitio, ordenadas por la pregunta que contesta cada una y no
por el orden en que se construyeron:

| Sección | Contesta | Ruta |
|---|---|---|
| Hoy | ¿qué viene? | `/` |
| Temporada | ¿cómo venimos? | `/temporada` |
| Juego | ¿cómo juega el equipo? | `/juego` |
| Plantel | ¿quiénes juegan? | `/plantel`, `/plantel/[id]` |

**Las pantallas de liga siguen existiendo y funcionando**: `/liga` (la portada vieja),
`/tabla`, `/titulo`, `/calendario`, `/estadisticas`, `/equipo/[slug]` y
`/partido/[slug]`. No se borraron: salieron de la navegación. Se llega desde los
enlaces del contenido.

## Definición de terminado para la v1

Termina una fecha y, sin que yo toque nada, el sitio muestra las probabilidades actualizadas de todos los equipos de la liga.

Ese es el único criterio de la v1. Si algo no contribuye a eso, va al backlog.

## Alcance de la v1

Adentro:

1. Pipeline de datos reproducible (raw → clean → outputs)
2. Modelo Dixon-Coles entrenado sobre el histórico de resultados
3. Simulación Monte Carlo de la temporada restante
4. Tres pantallas: estado de la liga, página de equipo, página de partido
5. Actualización automática post-fecha

Afuera (backlog explícito, no discutir en la v1):

- Autenticación, pagos, cuentas de usuario
- Resultados en vivo

**Tres cosas salieron del backlog el 29/07/2026, porque están hechas** — y la razón por
la que se pudieron hacer no fue conseguir una fuente nueva, sino **dejar de tirar la que
ya teníamos**. Los JSON que `ingest_stats.py` venía bajando desde el 27/07 traen
`content.playerStats` y `content.shotmap`, y `clean_stats.py` los descartaba en cada
corrida por quedarse sólo con el agregado por equipo:

- ~~Páginas de jugador~~ → `/plantel/[id]`, con métricas por 90 minutos
- ~~Datos de evento (xG por disparo, coordenadas)~~ → `data/clean/shots.csv`
- ~~Mapas de tiros y visualizaciones espaciales~~ → `MapaRemates.tsx`

## Fuentes de datos ya verificadas

**Histórico de resultados — la fuente principal:**
`https://www.football-data.co.uk/new/ARG.csv`

- Descarga directa, gratis, sin API key ni registro
- Liga Profesional desde la temporada 2012/2013 hasta hoy
- Columnas: `Country, League, Season, Date, Time, Home, Away, HG, AG, Res` + cuotas de cierre de varias casas (`PSCH/PSCD/PSCA` de Pinnacle, `MaxCH/D/A`, `AvgCH/D/A`, Bet365, Betfair Exchange)

Problemas conocidos — **verificados sobre el archivo real (26/07/2026, 6.238 partidos)**.
Varias de las suposiciones originales resultaron falsas; quedan corregidas acá:

- **El archivo trae un BOM UTF-8.** Hay que leerlo con `encoding='utf-8-sig'`. Con `utf-8`
  a secas la primera columna se llama `'﻿Country'` y cualquier acceso a `Country`
  explota con `KeyError`
- **`Season` no cambia de formato una sola vez: va y vuelve.** La secuencia real es
  `2012/2013 → 2013/2014 → 2014 → 2015 → 2016 → 2016/2017 → 2017/2018 → 2018/2019 →
  2019/2020 → 2020 → 2021 → … → 2026`. No sirve una regla del tipo "si tiene barra,
  partila": hace falta una tabla explícita temporada por temporada. Ojo además con que
  `2016` y `2016/2017` son dos temporadas distintas que arrancan el mismo año
- **Nombres de equipo inconsistentes.** El caso crítico es `Colon Santa FE` (300 partidos)
  vs `Colon Santa Fe` (66): mismo club, difieren en una letra en mayúscula. Sin normalizar,
  el modelo los toma como dos equipos y estima mal la fuerza de ambos. Pero cuidado con el
  error inverso: `San Martin S.J.` (San Juan) y `San Martin T.` (Tucumán) son clubes
  **distintos** y no hay que fusionarlos. Por eso la tabla es manual y versionada, no
  un `fuzzy match`. Son **45 nombres crudos = 44 clubes reales**
- **`League` tiene tres valores, no uno:** `'Liga Profesional '` (con espacio final, 2.114),
  `'Liga Profesional'` (3.204) y `'Copa De La Liga Profesional'` (920)
- **CORRECCIÓN: la Copa de la Liga SÍ está en el archivo.** Son **920 partidos** desde 2020,
  mezclados con los de la liga. La versión anterior de este documento decía que no había
  copas; era falso. Decisión tomada: se conservan etiquetados (`competition`), se usan para
  **entrenar** (mismos equipos, +17% de señal) y se **excluyen al simular** la tabla
- **CORRECCIÓN: las cuotas de Bet365 son inutilizables.** `B365CH` viene vacía en **5.786 de
  6.238 filas (93%)**. Pinnacle (`PSC*`) tiene 310 huecos. La única con cobertura 100% es
  `AvgC*` (promedio del mercado) → **ese es el baseline**, no Bet365
- Sigue siendo cierto **de este archivo**: solo primera división, sin ascenso ni
  Libertadores, y sin jugadores, formaciones ni goleadores. Los jugadores salen de
  FotMob, no de acá — ver `src/clean_players.py`

**Jugadores y remates: de FotMob, sin descargar nada nuevo.** `src/clean_players.py`
(etapa 2c) lee los mismos JSON que `clean_stats.py` y escribe
`data/clean/player_match_stats.csv` (70.305 filas, 2.135 jugadores) y
`data/clean/shots.csv` (36.882 remates, xG en el 100%). Cuatro gotchas, los cuatro
medidos y todos resueltos en ese archivo:

- **FotMob mueve la misma clave de bloque según el jugador.** Un arquero trae `tackles`
  en `top_stats`, un defensor en `defense`. Hay que buscar por clave en TODOS los
  bloques, nunca por posición de bloque
- **Las métricas ausentes NO son ceros.** FotMob omite la stat cuando el jugador no
  registró el evento: `expected_goals` viene en 5.638 de 12.235 filas, sólo los que
  remataron. Se guardan vacías a propósito; leerlas como cero es decisión de la etapa
  que agrega, y sólo vale para las de conteo
- **Los goles en contra van con el `teamId` del equipo perjudicado** (99 en el dataset).
  Contarlos como gol suyo rompía el marcador
- **Las tandas de penales están en el shotmap** (67 goles en 8 partidos de playoff) y no
  forman parte del marcador ni del xG. Se conservan con la columna `es_tanda`

**El chequeo que hay que repetir si se toca este script**: los goles reconstruidos desde
el shotmap tienen que coincidir con el marcador real en **3.070 de 3.070** pares
equipo-partido. Antes de arreglar los dos últimos puntos daba 91,7%.

**Y uno más, que es el peor porque no rompe nada visible: un jugador, un id.** FotMob
escribe al mismo jugador con y sin acentos según el partido — `Tomas Aranda` y
`Tomás Aranda` comparten el id 1899032. Sin unificar, aparece dos veces con las
estadísticas partidas al medio. Son **498 nombres** en el dataset completo. Lo resuelve
`mapa_de_nombres()`, con el mismo principio que ya regía para los equipos: **unir por
id, NUNCA por nombre**. `export_boca.py` corta la corrida si detecta que volvió a pasar.

Lo que sí salió mejor de lo esperado: **cero** valores faltantes en `HG`/`AG`/`Res`, **cero**
inconsistencias entre resultado y goles, **cero** duplicados. Y media ≈ varianza de goles
(local 1.262/1.249 · visitante 0.965/1.051), o sea que **Poisson es la distribución correcta**,
no una suposición cómoda. Con 30.3% de empates, la corrección τ de Dixon-Coles se justifica sola.

## El formato del torneo — el problema abierto más importante

El campeón del fútbol argentino actual **no es el que más puntos hace, sino el que gana los
playoffs**. Eso se ve en los propios datos, contando partidos por equipo dentro de cada
temporada (en una liga de todos contra todos, todos juegan lo mismo):

| Temporada | Equipos | Reparto (equipos × partidos) | Lectura |
|---|---:|---|---|
| 2024 | 28 | `28x27` | liga simétrica |
| 2025 | 30 | `3x37, 4x36, 6x35, 3x34, 5x33, 9x32` | **cuadro de eliminación** |
| 2026 | 30 | `1x21, 3x20, 4x18, 9x17, 13x16` | **cuadro de eliminación** |

**Consecuencia:** simular "la tabla final" y ver quién queda primero responde la pregunta
equivocada. La simulación tiene que replicar zonas → clasificados → cruces → final.

**Investigado el 26/07/2026 → ver `reference/formato-torneos.md`** (formato año por año
2019-2026, descensos, ascensos, fuentes). Resumen de lo que se resolvió y lo que no:

Resuelto ✅
- Formato vigente 2025-2026: 30 equipos, 2 zonas de 15, fase regular de 16 partidos por
  equipo, clasifican los 8 mejores de cada zona, playoffs a **partido único**
- **Apertura y Clausura se pueden separar sin fuente externa**: hay un parate largo entre
  los dos (40 días en 2025, 60 en 2026). Hueco > 30 días ⇒ cambio de torneo
- **La ronda de playoffs se infiere contando partidos por equipo**: 16 = no clasificó,
  17 = perdió octavos, 18 = cuartos, 19 = semis, 20 = jugó la final. Verificado contra
  2025, donde da exacto (255 + 255 = 510 partidos)
- Descensos vigentes: bajan 2 (último de promedios sobre las últimas 3 temporadas, y último
  de la tabla anual). **Cambió 3 veces en 3 años → reverificar cada temporada**
- Ascensos 2026 confirmados: Gimnasia (M) y Estudiantes (RC)

Sigue pendiente ⚠️
- **La zona (A o B) de cada equipo no está en los datos y no se puede inferir.** Hay que
  cargarla a mano por temporada. Sin eso no se puede simular la fase regular.
  **Dónde copiarla**: FBref publica las tablas de Zona A / Zona B de 2026 con id explícito
  (`results2026211Zone-A_overall`), y ESPN la trae estructurada. Las dos coinciden. Sigue
  cargándose a mano en `reference/zonas.csv`, pero ahora hay contra qué validarla
- **Filtrar las estadísticas por torneo (Apertura / Clausura) — esperar a que haya fechas.**
  El dato ya está: `data/clean/team_match_stats.csv` tiene la columna `torneo`, que FotMob
  etiqueta explícita (`Apertura` / `Clausura` / `Playoff`), y `stats_avanzadas()` en
  `export.py` hoy agrega por TEMPORADA completa (Apertura + playoffs + Clausura).
  **Por qué no se hizo el 27/07/2026**: el Clausura llevaba UNA fecha jugada. Filtrar por
  torneo habría mostrado un xG calculado sobre 1 partido, que es ruido — el mismo problema
  que tenía el modelo con Estudiantes (RC) y sus 16 partidos, y que se arregló con
  shrinkage. **Retomar cuando el torneo lleve ~8 fechas.** Si se implementa antes, poner un
  mínimo de partidos por debajo del cual no se muestra el número

Resuelto ✅
- ~~**Falta al menos un partido en el Apertura 2026**: hay 254 y deberían ser 255~~
  **Resuelto el 27/07/2026.** Era `Estudiantes (LP) 0-1 Lanús` del 13/03/2026, que
  football-data.co.uk nunca publicó. Apareció al incorporar FotMob: `clean.py` ahora
  completa los partidos jugados que la fuente principal todavía no publicó. El Apertura
  cierra en **255** y los **16** clasificados tienen 17+ partidos, como corresponde.
  Queda pendiente igual el **chequeo automático de completitud por temporada**: esta vez se
  encontró de casualidad

**FBref (competición 21 = Liga Profesional Argentina):** ⚠️ **YA NO SIRVE PARA STATS AVANZADAS**
Este archivo decía hasta el 27/07/2026 que FBref "tiene datos avanzados provistos por Opta
(xG, xA, pases progresivos, duelos)". **Era cierto y dejó de serlo: Opta le cortó el feed a
Sports Reference en enero de 2026.** Verificado corriendo código el 27/07/2026: se bajó el
HTML real de la página (1.229.535 bytes) y hay **0 ocurrencias de xG**. No existen las
secciones `passing`, `possession` ni `defense`. La tabla de passing todavía se renderiza
pero viene **entera en NaN** — son cáscaras vacías.

No es un problema de cobertura de Argentina: el mismo conteo sobre la **Premier League**
2025/26 también da **0 xG**. Es un cambio del sitio completo.

Lo que FBref SÍ conserva (comp 21, 2014→2026): goles, tiros, tiros al arco, tarjetas,
faltas, córners, offsides, intercepciones, penales. Nada de eso justifica el costo:
FBref está detrás de un challenge de Cloudflare y exige **Chrome headless**
(`requests` da 403 hasta en `/robots.txt`).

**Lo único valioso que queda de FBref:** publica la asignación de **Zona A / Zona B de
2026** en tablas con id explícito (`results2026211Zone-A_overall`), 15 y 15. Sirve para
copiar y validar `reference/zonas.csv`, que se sigue cargando a mano.

**Pases progresivos: no existen en ninguna fuente gratuita hoy.** Era una métrica definida
por Opta y se fue con Opta. Sustitutos honestos (que NO son lo mismo y hay que nombrar
distinto): pases en campo rival, toques en el área rival.

Informe completo con toda la evidencia: `docs/fuentes-stats-avanzadas.md`.

**Fixtures de la fecha que viene:**
El mismo football-data.co.uk publica próximos partidos con cuotas, o API-Football en su tier gratuito (unas 100 requests por día, suficiente cacheando).

**Escudos y metadatos:** TheSportsDB tiene API gratuita con cobertura de la liga.

## El modelo

**Base:** Poisson bivariado con corrección de Dixon-Coles. Parámetros de ataque y defensa por equipo, ventaja de local, decaimiento temporal para que los partidos viejos pesen menos.

**Salida:** una matriz de probabilidades de marcador, no solo quién gana. De ahí sale todo lo demás.

**Evaluación:** log loss y Brier score, no accuracy. El baseline a superar son las probabilidades implícitas de las cuotas de cierre que vienen en el mismo CSV, desmarginalizadas. Baselines adicionales: predecir siempre local, y un Elo simple.

Expectativa realista: igualar al mercado ya es un buen resultado. El objetivo no es ganarle a las casas de apuestas, es tener probabilidades bien calibradas.

**Monte Carlo:** simular la temporada restante muchas veces (arrancar con 10.000) y contar finales para obtener probabilidad de campeón, de clasificación a Libertadores y de descenso.

**Atención con los promedios:** el descenso en el fútbol argentino se define por promedio de puntos sobre varias temporadas, y el reglamento cambió más de una vez en los últimos años. Antes de implementarlo hay que verificar el reglamento vigente de la temporada actual. No asumir.

## Stack

- Python para datos y modelo
- Frontend en Next.js, deploy en Vercel
- Supabase si hace falta persistencia
- Todo el pipeline reproducible desde cero con un comando

## Restricciones legales (no negociables)

- Nombres de clubes y jugadores: permitidos, es uso editorial
- **Escudos oficiales: permitidos desde el 27/07/2026** (decisión revertida, ver abajo).
  Se usan para identificar al club, que es uso nominativo. Origen y licencia de cada
  uno quedan registrados en `reference/escudos.csv`. Camisetas oficiales: siguen prohibidas
- Fotos o retratos identificables de jugadores: prohibidos
- Cobrar por el producto: no, en ninguna forma
- Aviso visible de que es un proyecto no oficial, sin afiliación con ningún club
- No presentarlo ni diseñarlo como herramienta de apuestas

## Primera tarea — HECHA (26/07/2026)

El pipeline de ingesta, limpieza y reporte está implementado y corriendo:
`src/ingest.py` → `src/clean.py` → `src/report.py`. Ver `README.md`.

Salidas: `data/clean/matches.csv` (6.238 partidos, 44 clubes) y `data/clean/report.md`.

**Siguiente paso:** leer y entender el reporte. Nada de modelo hasta entonces.

## Cómo explicar (regla permanente)

Explicar siempre en lenguaje natural y simple, sin jerga y sin dar por supuesto
conocimiento previo, cada vez que aparezca código o estadística. El motivo no es
cortesía: si no se entiende **por qué** el modelo dice lo que dice, no hay forma de
detectar cuándo se equivoca — y los modelos estadísticos se equivocan con mucha seguridad.

## Extensibilidad — cómo se hace acá

Se resuelve con **etapas separadas** (`raw → clean → features → modelo → outputs`), no con
abstracciones anticipadas. Agregar un parámetro nuevo (días de descanso, altura de la
cancha, si el equipo viene de jugar Libertadores) toca **solo `features`**.

Regla explícita: **no crear capas de configuración, sistemas de plugins ni clases genéricas
"por si acaso"**. Eso no es escalar, es construir andamio y nunca el edificio.

Dos requisitos que ya están cubiertos por el diseño y **no necesitan código extra**:

- *"Que se corrija con el paso de las fechas"* → Dixon-Coles usa **decaimiento temporal**:
  los partidos viejos pesan menos. Reentrenar después de cada fecha ajusta el modelo solo.
- *"Análisis detallado por equipo"* → la salida del modelo es una **matriz de probabilidades
  de todos los marcadores**, no un ganador. De ahí salen goles esperados a favor y en contra,
  probabilidad de valla invicta, over/under, etc. Una salida, muchas lecturas.

## Redes sociales — v1.5

Objetivo prioritario **apenas termine la v1**, no dentro de ella: mantiene intacto el
criterio de terminado de una sola frase. Implicación de diseño desde ahora: la etapa
`outputs` emite datos estructurados neutrales, de modo que el sitio y el generador de
placas lean **la misma fuente**.

Sobre los escudos: la prohibición **se levantó el 27/07/2026**, por decisión explícita del
dueño. Quedan registrados acá los dos argumentos que la sostenían, porque siguen siendo
ciertos y hay que convivir con ellos:

1. **Riesgo en redes.** El escenario realista no es una demanda sino un reclamo de propiedad
   intelectual en Meta → strikes → pérdida de la cuenta, que es el activo que el proyecto
   quiere construir. **Ese riesgo se asumió a conciencia**, no se resolvió. Si llega un
   reclamo, el camino de vuelta es rápido: los escudos generados siguen en el repo
   (`src/escudos.py`) y `Escudo.tsx` ya cae en ellos como fallback.
2. **Riesgo de producto.** Con escudos el sitio se parece más a las cuentas que regrafican
   datos ajenos. Se compensa con lo que ninguna de esas cuentas tiene: modelo propio y
   comparación contra el mercado.

Los escudos salen de TheSportsDB, una base colaborativa cuyo propósito declarado es
distribuir estos assets para uso en aplicaciones. Trazabilidad completa (origen, licencia
y fecha de descarga de los 30) en `reference/escudos.csv`.

**La paleta de colores por club sigue en pie, pero ya no como alternativa a los escudos:
ahora conviven.** Los colores identitarios (`reference/colores.csv`) se leen rápido, no se
protegen como marca figurativa y son la base de los SVG generados que quedaron de fallback.
Los **nombres** de los clubes se usan como uso nominativo legítimo, y desde el 27/07/2026
los **escudos** también. Revisable con asesoramiento legal real.

## Cómo quiero trabajar

- Preguntá antes de asumir cosas sobre el dominio o los datos
- Nunca inventes datos ni rellenes valores faltantes sin avisarme
- Pipeline separado en etapas: raw → clean → features → modelo → outputs
- Cada etapa tiene que poder correrse sola y ser reproducible
- Prefiero pasos chicos y verificables antes que un commit gigante
