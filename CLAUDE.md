# Contexto del proyecto

## Qué estamos construyendo

Un sitio público en español sobre el fútbol argentino, con un modelo estadístico propio adentro, que se actualiza solo después de cada fecha de la Liga Profesional.

No es un juego. No es una app de resultados en vivo tipo Promiedos. No es una herramienta de apuestas. No es una cuenta que regrafica datos ajenos: el modelo es propio y es lo que distingue al proyecto.

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

- Mapas de tiros y visualizaciones espaciales
- Páginas de jugador
- Datos de evento (xG por disparo, coordenadas)
- Autenticación, pagos, cuentas de usuario
- Resultados en vivo

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
- Sigue siendo cierto: solo primera división, sin ascenso ni Libertadores, y sin jugadores,
  formaciones ni goleadores

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
  cargarla a mano por temporada. Sin eso no se puede simular la fase regular
- **Falta al menos un partido en el Apertura 2026**: hay 254 y deberían ser 255. Solo 14
  equipos superan los 16 partidos cuando los clasificados son 16. La fuente no es perfecta:
  hace falta un chequeo automático de completitud por temporada

**FBref (competición 21 = Liga Profesional Argentina):**
Tiene datos avanzados provistos por Opta (xG, xA, pases progresivos, duelos) y la página de historial de temporadas existe. Útil para agregados por equipo. Verificar qué trae exactamente antes de depender de esto.

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
- Escudos, logos, camisetas oficiales: prohibidos
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

Sobre los escudos: se evaluó levantar la prohibición ("otros sitios los usan y no les pasa
nada") y **se decidió mantenerla**. El escenario de riesgo realista no es una demanda sino
un reclamo de propiedad intelectual en Meta → strikes → **pérdida de la cuenta**, que es
justamente el activo que el proyecto quiere construir. Y por producto: usar escudos hace
que el sitio se vea igual que las cuentas que regrafican datos ajenos.

**Alternativa adoptada: paleta de colores por club, sin escudos.** Los colores identitarios
se leen igual de rápido y no se protegen como marca figurativa. Los **nombres** de los
clubes sí se usan: es uso nominativo legítimo. Revisable con asesoramiento legal real.

## Cómo quiero trabajar

- Preguntá antes de asumir cosas sobre el dominio o los datos
- Nunca inventes datos ni rellenes valores faltantes sin avisarme
- Pipeline separado en etapas: raw → clean → features → modelo → outputs
- Cada etapa tiene que poder correrse sola y ser reproducible
- Prefiero pasos chicos y verificables antes que un commit gigante
