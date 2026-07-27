# Informe v2: barrido ampliado de fuentes de estadísticas avanzadas

**Fecha:** 27/07/2026
**Encargo:** buscar "de cualquier lado" xG, duelos, pases progresivos y estadística
avanzada de equipos para la Liga Profesional Argentina, **incluyendo opciones de pago**.
**Relación con el informe anterior:** este archivo NO reemplaza a
`docs/fuentes-stats-avanzadas.md`. Aquel cerró FotMob, FBref, Sofascore, Understat y
StatsBomb open data. Este cubre todo lo que aquel no miró.

**Método:** la regla del proyecto es *"una fuente que no probaste corriendo código, no
existe"*. Todo lo verificado tiene la evidencia pegada. Lo que no pude probar está
marcado **NO VERIFICADO** y no entra en la recomendación como si fuera un hecho.
No creé ninguna cuenta ni API key a nombre del dueño.

---

## 1. Resumen ejecutivo — leé esto aunque no leas nada más

Encontré **una fuente nueva que técnicamente es mejor que FotMob**: la API interna de
**ESPN**. Devuelve **172 estadísticas por equipo y por partido** para la Liga Profesional,
con la familia completa de xG, la familia completa de duelos, PPDA, entradas al último
tercio y entradas al área. Sin API key, con `requests` pelado. Y de yapa resuelve el
bloqueante de las zonas A/B.

**Y sus términos legales son peores que los de FotMob.** ESPN es un producto de Disney,
y los Términos de Uso de Disney prohíben la extracción automatizada con una frase que
mata el único argumento que el proyecto tenía a favor: *"whether or not for profit"*.
El razonamiento de "somos sin fines de lucro" deja de aplicar.

**La conclusión honesta, con todas las letras: NO existe hoy una fuente que sea a la vez
legal, gratuita, automatizable y con cobertura de xG para la Liga Profesional Argentina.**
Las cuatro condiciones no se dan juntas en ninguna de las 20 fuentes que revisé. El dueño
tiene que elegir entre tres caminos, y los tres tienen un costo real. Están en §7.

**Recomendación única:** probar **API-Football (api-sports.io)** con su key gratuita.
Es la **única** fuente de todo el barrido cuya postura publicada habilita explícitamente
el consumo programático. Son 20 minutos de verificación (§8). **Plan B: FootyStats API**
(~£29,99/mes). **Plan C, el mejor técnicamente y el que NO recomiendo: ESPN.**

### Los cuatro hallazgos que importan

1. **ESPN levantó un feed nuevo y rico en julio de 2026, en TODAS las ligas a la vez.**
   Hasta mayo devolvía 93 estadísticas por partido sin xG; desde el 23/07 devuelve 172
   con xG y duelos. Verificado en ARG.1, BRA.1, USA.1 y MEX.1. Es un cambio de plataforma,
   no una excepción argentina. **Implicación fuerte: no hay histórico, pero de acá en
   adelante hay cobertura 100%** — que es exactamente lo que un sitio que se actualiza
   fecha a fecha necesita.
2. **Los números de ESPN y los de FotMob son idénticos hasta el tercer decimal.** Son el
   mismo feed de Opta. Elegir entre uno y otro es una decisión de riesgo legal y de
   riqueza de campos, no de calidad del dato.
3. **Sportmonks queda descartada con evidencia dura**: su lista oficial de cobertura de xG
   tiene 53 ligas y **la Liga Profesional Argentina no está**. Pagar no garantiza cobertura.
   Esto vale para todo el rubro: en xG, Argentina es periferia.
4. **Pases progresivos siguen sin existir.** Se confirma el informe v1. Ninguna de las
   fuentes nuevas los tiene. ESPN ofrece los mejores sustitutos que vi
   (`finalThirdEntries`, `penAreaEntries`, `successfulFinalThirdPasses`), pero **no son
   lo mismo y no hay que llamarlos así**.

---

## 2. Tabla comparativa — todas las fuentes nuevas evaluadas

Leyenda: ✅ verificado corriendo código · ❌ verificado que NO · ❓ NO VERIFICADO

| Fuente | ¿ARG 2026? | Histórico | xG | Duelos | Pases progr. | Costo | Legalidad | Veredicto |
|---|---|---|---|---|---|---|---|---|
| **ESPN API interna** | ✅ | resultados desde **2000**; avanzado **solo desde jul-2026** | ✅ 11 campos | ✅ 8 campos | ❌ (buenos sustitutos) | **gratis**, sin key | 🔴 ToU de Disney prohíben explícitamente | Mejor técnicamente · **NO recomendada** |
| **API-Football** (api-sports.io) | ❓ | ❓ | ✅ existe el campo (probado en otra liga) | ❌ | ❌ | free 100 req/día ❓ · pago ❓ | 🟢 robots.txt `Allow: /` + `ai-input=yes` | **RECOMENDADA (a verificar)** |
| **FootyStats** (football-data-api.com) | ✅ liga y temporada existen | 2015→2026 | ✅ campo real ❓ p/ARG | ❌ | ❌ | ~£29,99/mes ❓ | 🟡 ToS propios de API, no leídos ❓ | **Plan B** |
| **TheStatsAPI** | ❓ | 10 años (marketing) | ✅ por equipo y por tiro | ❌ | ❌ | **US$50/mes**, trial 7 días | 🟡 API comercial | Alternativa de pago |
| **Sportmonks** | ❌ **no en la lista de xG** | xG desde 2024/25 | ✅ 13 métricas (otras ligas) | ❌ | ❌ | base + add-on €19–99/mes | 🟢 API comercial | **DESCARTADA** |
| **football-data.org** | ✅ liga id 2024 | — | ❌ no tiene xG | ❌ | ❌ | free = solo TIER_ONE; ARG es TIER_TWO | 🟢 | **DESCARTADA** |
| **Promiedos** (api.promiedos.com.ar) | ✅ API real | — | ❌ (0 menciones de xG) | ❌ | ❌ | gratis | 🟡 sin robots.txt (404) | Sirve para fixtures, no para stats |
| **Doble Amarilla** | — | — | ❓ | ❓ | ❓ | gratis | 🔴 robots: `Disallow: /api` + `ClaudeBot Disallow: /` | **DESCARTADA por robots** |
| **TyC Sports** | — | — | ❓ | ❓ | ❓ | gratis | 🟡 robots bloquea `/nota/` `/noticias/` | Sin API de stats detectada |
| **AFA** | ❌ | — | ❌ | ❌ | ❌ | gratis | 🟢 robots casi abierto | Sin API. Nada de stats |
| **Liga Profesional oficial** | sitio vivo | — | ❌ | ❌ | ❌ | gratis | 🟢 | Sin API |
| **DataFactory** (datafactory.la) | ❓ | ❓ | ❓ | ❓ | ❓ | ❓ solo contacto comercial | ❓ | **NO VERIFICADA** — sin nada público |
| **Sportradar** | ❓ | ❓ | ❓ | ❓ | ❓ | ❓ presupuesto a medida | comercial | Fuera de escala para el proyecto |
| **Stats Perform / Opta directo** | ❓ | ❓ | ✅ (es el origen) | ✅ | ✅ | ❓ contrato empresarial | comercial | Fuera de escala |
| **StatsBomb API comercial** | ❓ | ❓ | ✅ | ✅ | ✅ | ❓ sin precio público | comercial | Fuera de escala |
| **Wyscout / Hudl** | ❓ | ❓ | ✅ | ✅ | ✅ | ❓ sin precio público | comercial | Fuera de escala |
| **SoccersAPI** | ❓ | ❓ | ❌ 0 menciones de xG en pricing | ❓ | ❓ | trial 7 días | comercial | Baja prioridad |
| **Goalserve** | ❓ | ❓ | ❓ | ❓ | ❓ | ❓ | ❓ | **NO VERIFICADA** (timeout de conexión) |
| **LiveScore API** | ❓ | ❓ | ❓ | ❓ | ❓ | ❓ (pricing da 401) | ❓ | **NO VERIFICADA** |
| **xGscore.io** | ✅ tiene xG de ARG | ❓ | ✅ modelo propio | ❌ | ❌ | gratis (web) | sin API | No consumible |
| **HuggingFace / Kaggle / Zenodo** | ❌ | — | ❌ | ❌ | ❌ | gratis | abierta | **Nada útil para Argentina** |

---

## 3. Evidencia — Prioridad 1: API-Football (api-sports.io)

### 3.1 La API responde; lo que está bloqueado es el sitio de marketing

El informe v1 dijo *"sus docs me bloquearon (403), no puedo decir si devuelve xG"*.
Eso es cierto para la web, **pero no para la API**. Son dos cosas distintas y la
diferencia importa:

```
apifootball_status         403 application/json   len=219
apifootball_leagues_AR     403 application/json   len=219
apifootball_docs           403 text/html          len=5736
apisports_docs             403 text/html          len=5734
apifootball_pricing        403 text/html          len=5709
apifootball_robots         200 text/plain         len=246
```

El 403 de la API **no es un bloqueo**: es la respuesta normal de la API cuando falta la
key, y viene en JSON bien formado:

```json
{"get": "","parameters": [],"errors": {"token": "Missing application key, Check our
documentation on how to add your API key in headers.","error": "4xHe"},"results": 0,
"paging": {"current": 1,"total": 1},"response": []}
```

El 403 de `documentation-v3` / `pricing` sí es un bloqueo, y es de Cloudflare:

```html
<title>Just a moment...</title> ... connect-src 'self' https://challenges.cloudflare.com
```

Probé también un proxy de texto (`r.jina.ai`) sobre las tres páginas: las tres devolvieron
la pantalla de "Performing security verification". **Precios y lista de cobertura oficial
quedan NO VERIFICADOS.**

### 3.2 El robots.txt de API-Football es el opuesto exacto al de FotMob

Este es el dato legal más importante de todo el informe:

```
User-agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=yes
Allow: /

Disallow: /news/config/
Disallow: /news/system/
...
```

`Allow: /` para todos los agentes. Y el header `Content-Signal` **habilita explícitamente
`ai-input` y `ai-train`**. Compará con lo que el informe v1 encontró en FotMob
(*"systematic, regular, or bulk retrieval of data is expressly forbidden"*) y con lo que
encontré en ESPN (§4.4). Es otra categoría de fuente: **API-Football vende acceso
programático, no lo tolera a regañadientes.**

### 3.3 Qué devuelve `fixtures/statistics` — respuesta REAL, no marketing

No pude llamarla sin key, pero conseguí una **respuesta cruda real** publicada en GitHub
(`KonradHD/LaLigaApp`, `LaLiga/APIs/Data/statsData1208548.txt`). Es un partido de La Liga,
no argentino, pero fija el **esquema exacto** del endpoint:

```json
{"get":"fixtures/statistics","parameters":{"fixture":"1208548"},"errors":[],"results":2,
"response":[{"team":{"id":529,"name":"Barcelona"},"statistics":[
 {"type":"Shots on Goal","value":4},{"type":"Shots off Goal","value":6},
 {"type":"Total Shots","value":15},{"type":"Blocked Shots","value":5},
 {"type":"Shots insidebox","value":6},{"type":"Shots outsidebox","value":9},
 {"type":"Fouls","value":4},{"type":"Corner Kicks","value":7},{"type":"Offsides","value":5},
 {"type":"Ball Possession","value":"78%"},{"type":"Yellow Cards","value":1},
 {"type":"Red Cards","value":null},{"type":"Goalkeeper Saves","value":1},
 {"type":"Total passes","value":625},{"type":"Passes accurate","value":555},
 {"type":"Passes %","value":"89%"},
 {"type":"expected_goals","value":"1.92"},
 {"type":"goals_prevented","value":0}]},
 {"team":{"id":546,"name":"Getafe"}, ... {"type":"expected_goals","value":"0.67"} ...}]}
```

**Lo que esto prueba y lo que no:**

- ✅ **`expected_goals` EXISTE** como tipo de estadística en `fixtures/statistics`.
  Es la respuesta a la pregunta que quedó abierta en el informe v1. También hay
  `goals_prevented`.
- ✅ Son **18 tipos en total**. Nivel equipo-partido, dos objetos por partido. El formato
  de parseo es limpio: lista de `{type, value}`, con `%` como sufijo en tres campos.
- ❌ **NO hay duelos.** Ni aéreos, ni de suelo, ni totales.
- ❌ **NO hay pases progresivos** (era esperable) ni toques en el área ni entradas al
  último tercio. En riqueza de campos es **la fuente más pobre de las tres con xG**
  (18 tipos contra 37 de FotMob y 172 de ESPN).
- ❓ **NO PRUEBA que haya xG para Argentina.** Es un partido de La Liga. API-Football
  marca la cobertura liga por liga con un objeto `coverage` en `/leagues`, que incluye
  la bandera `statistics_fixtures`. **Eso hay que consultarlo con key.**

### 3.4 Lo que quedó NO VERIFICADO de API-Football

| Pregunta | Estado |
|---|---|
| ¿Cubre la Liga Profesional 2026? | ❓ (`/leagues?country=Argentina` requiere key) |
| ¿`expected_goals` viene poblado en Argentina? | ❓ **la pregunta decisiva** |
| ¿Desde qué temporada hay histórico con xG? | ❓ |
| Free tier de 100 req/día | ❓ solo fuente secundaria, igual que en el informe v1 |
| Precios de los tiers pagos | ❓ página bloqueada por Cloudflare |
| ¿Corre desde GitHub Actions? | ❓ no probado |

---

## 4. Evidencia — ESPN: la mejor fuente técnica que existe hoy

### 4.1 Cómo se llega

Son dos hosts distintos, ninguno pide key:

- `site.api.espn.com/apis/site/v2/sports/soccer/ARG.1/...` → scoreboard, teams, summary
- `sports.core.api.espn.com/v2/sports/soccer/leagues/arg.1/...` → **el bueno**: las
  estadísticas completas por equipo y partido

```
espn_scoreboard  200 application/json;charset=UTF-8  len=52236
leagues: [('745', 'Argentine Liga Profesional de Fútbol', 2026)]
seasons disponibles (27): ['2026','2025','2024','2023',...,'2002','2001','2000']
```

Temporada 2026 completa, barrida quincena por quincena:

```
TOTAL 2026: 282 eventos | FINISHED: 265
Counter({'2026-02': 72, '2026-03': 61, '2026-04': 60, '2026-01': 32, '2026-05': 30, '2026-07': 27})
```

265 partidos terminados. Coincide exactamente con lo que el informe v1 midió en Sofascore.

### 4.2 172 estadísticas por equipo y por partido

Endpoint: `.../events/{id}/competitions/{id}/competitors/{teamId}/statistics`.
Cuatro categorías: `defensive`, `general`, `goalKeeping`, `offensive`. **Nombres de campo
reales**, copiados de la respuesta:

**xG — 11 campos, la familia más completa que vi en cualquier fuente**

| campo ESPN | qué es |
|---|---|
| `expectedGoals` | xG |
| `expectedGoalsNonPenalty` | xG sin penales |
| `expectedGoalsOpenPlay` | xG de jugada |
| `expectedGoalsSetPlay` | xG de pelota parada |
| `expectedGoalsFreeKick` | xG de tiro libre |
| `expectedGoalsOnTarget` | xGOT |
| `expectedGoalsOnTargetNonPenalty` | xGOT sin penales |
| `expectedGoalsOnTargetFreeKick` | xGOT de tiro libre |
| `expectedAssists` / `expectedAssistsOpenPlay` / `expectedAssistsSetPlay` | xA |
| `expectedGoalsConceded` · `expectedGoalsNonPenaltyConceded` · `expectedGoalsOnTargetConceded` · `expectedGoalsOnTargetNonPenaltyConceded` | xG en contra (categoría `goalKeeping`) |
| `goalsPrevented` | goles evitados por el arquero |

**Duelos — 8 campos, completo**

`duels`, `duelsWon`, `duelsLost`, `duelWinPct`, `groundDuels`, `groundDuelsWon`,
`aerialsWon`, `aerialsLost`, `aerialDuelPct`

**Progresión — los mejores sustitutos disponibles (siguen sin ser pases progresivos)**

`finalThirdEntries`, `penAreaEntries`, `successfulFinalThirdPasses`,
`totalFinalThirdPasses`, `touchesInOppBox`, `totalFwdZonePass`, `totalBackZonePass`,
`possWonAtt3rd`, `possWonMid3rd`, `possWonDef3rd`

**Presión — algo que ninguna otra fuente gratuita da**

`ppda` (Passes Per Defensive Action, "Passes Per Defensive Action" en el `displayName`),
`defensiveActions`, `ballRecovery`, `challengeLost`

**Resto:** `bigChanceCreated`, `bigChanceMissed`, `bigChanceSaves`, `attemptsIbox`,
`attemptsObox`, `attemptsConcededIbox`, `attemptsConcededObox`, `dispossessed`,
`unsuccessfulTouch`, `touches`, `shotAssists`, `hitWoodwork`, `totalThroughBalls`,
`accurateThroughBalls`, `totalFastbreak`, `fouledFinalThird`, `offsideProvoked`,
`accurateKeeperSweeper`, `goodHighClaim` … hasta 172.

### 4.3 El agujero grande: el feed avanzado arrancó en julio de 2026

Escaneé los **265 partidos terminados de 2026**, uno por uno, 0 errores:

```
TOTAL=265 errors=0 WITH_XG=24 (9%) WITH_DUELS=24 elapsed=109s

  2026-01  n= 32  con_xG=  2    6%
  2026-02  n= 72  con_xG=  0    0%
  2026-03  n= 61  con_xG=  2    3%
  2026-04  n= 60  con_xG=  5    8%
  2026-05  n= 25  con_xG=  0    0%
  2026-07  n= 15  con_xG= 15  100%
```

**Y ese 9% es todavía peor de lo que parece.** Mirá la distribución de cuántas
estadísticas trae cada partido:

```
Counter({'93': 229, '172': 15, '163': 9, '98': 7, '95': 5})
```

Los 9 partidos de 163 campos **traen el campo `expectedGoals` con valor 0.0**, junto con
`duelsWon = 0.0` y `ppda = 0.0`. Son cáscaras, exactamente el mismo patrón que el informe
v1 encontró en las tablas vacías de FBref. Restándolos:

**La cobertura real de xG en 2026 es de 15 partidos sobre 265 = 5,7%.** Los 15 son
justamente los 15 del arranque del Clausura (23 al 26 de julio), y ahí es 100%.

Histórico hacia atrás: **no hay nada.**

```
ARG.1 histórico (muestras de 8 partidos por temporada):
  2025: fin=395 con_xG_real=0  n_stats=[93,93,93,93,93,93,93,93]
  2024: fin=343 con_xG_real=0  n_stats=[93,93,93,93,93,93,93,93]
  2023: fin=308 con_xG_real=0  n_stats=[93,93,93,93,93,93,93,93]
  2022: fin=378 con_xG_real=0  n_stats=[93,93,93,93,93,93,93,93]
  2021: fin=300 con_xG_real=0  n_stats=[93,93,93,93,93,93,93,93]
  jul-2026 (control): fin=15 con_xG_real=8/8  n_stats=[172,...,172]
```

**Pero no es un problema de Argentina — es un cambio de plataforma de ESPN.** Lo verifiqué
en otras ligas:

```
=== JULIO 2026, ligas en actividad ===
  BRA.1  fin= 22  conXG=4/4  n=[172,172,172,172]
  USA.1  fin= 35  conXG=4/4  n=[171,172,172,172]
  MEX.1  fin= 18  conXG=4/4  n=[172,172,172,172]
  ARG.1  fin= 15  conXG=4/4  n=[172,172,172,172]
=== MAYO 2026, las mismas ligas ===
  BRA.1  fin= 30  conXG=0/4  n=[98,93,98,93]
  USA.1  fin= 59  conXG=0/4  n=[98,93,98,93]
=== TEMPORADAS VIEJAS DE LIGAS TOP ===
  ENG.1 2025: conXG=0/5  n=[93,93,93,93,93]
  ESP.1 2025: conXG=0/5  n=[93,93,93,93,93]
```

Ni la Premier ni La Liga tenían xG en ESPN antes de julio de 2026. **En julio de 2026
ESPN cambió el feed en todas las ligas a la vez.**

**Cómo leerlo, honestamente.** A favor: si el cambio es permanente, un sitio que se
actualiza fecha a fecha tiene cobertura del 100% de acá en adelante, que es literalmente
el criterio de terminado de la v1. En contra: **tengo 15 partidos y 4 días de evidencia.**
No puedo descartar que sea una prueba y lo den de baja. Y no hay histórico: cero partidos
de 2025 hacia atrás.

### 4.4 Validación cruzada con FotMob: es el mismo feed de Opta

Riestra 3-0 Boca del 26/07/2026, el partido que el informe v1 usa como ejemplo:

```
ESPN, evento 401841447:
 team 17702 (Riestra): xG=1.963 xGOT=2.026 pos=18.2 tiros=6  duelos=55/105 aereos=22 ppda=17.8 f3ent=60  penArea=16 toqArea=6
 team 5     (Boca):    xG=0.604 xGOT=0.623 pos=81.8 tiros=13 duelos=50/105 aereos=9  ppda=4.8  f3ent=101 penArea=53 toqArea=18
```

Y el informe v1, sobre FotMob:

```
2026-07-26 Deportivo Riestra  local     3  xg 1.96  xgot 2.03  posesion 18  remates 6   duel_aer 22
2026-07-26 Boca Juniors   visitante     0  xg 0.60  xgot 0.62  posesion 82  remates 13  duel_aer 9
```

**Idénticos.** xG, xGOT, posesión, remates y duelos aéreos coinciden campo por campo.
Los dos consumen el mismo feed de Opta/Stats Perform. Conclusión práctica: **elegir entre
ESPN y FotMob no es una decisión de calidad de dato.** Es riqueza de campos (172 vs 37,
gana ESPN) contra histórico (2023→ vs solo julio 2026, gana FotMob por lejos) y contra
riesgo legal (los dos mal, ESPN peor).

Como contraste, xGscore.io también publica xG de la Liga Profesional pero con **modelo
propio**, y no coincide: Riestra 1.75 / Boca 0.80 contra 1.963 / 0.604 de Opta. Sirve
para recordar que "xG" no es una magnitud única.

### 4.5 Legalidad: peor que FotMob, y por un motivo específico

ESPN es un producto de Disney. Bajé los Términos de Uso
(`https://disneytermsofuse.com/english/`, 200, 112.811 bytes). Cita textual, cláusula (x)
de la lista de conductas prohibidas:

> **access, monitor, copy or extract the Disney Products using a robot, spider, script, or
> other automated means**, including, for the avoidance of doubt, for the purposes of
> creating or developing any AI Tool, **data mining or web scraping or otherwise
> compiling, building, creating or contributing to any collection of data, data set or
> database** (other than for a public search engine's use of spiders for creating search
> indices to the extent not disallowed by Disney, including through the applicable
> robots.txt files or NOINDEX or NOFOLLOW meta-tags)

Y la cláusula inmediatamente anterior, (ix), cierra la puerta al argumento del proyecto:

> …use the Disney Products for any business-related use or build a business utilizing the
> Disney Products, or engage in any activity to enable third parties to engage in any of
> the foregoing activities, **in each case whether or not for profit**

**Esto es más grave que el caso FotMob.** Con FotMob, el proyecto podía al menos alegar
que es sin fines de lucro y que publica análisis derivado. Acá los ToS dicen
explícitamente *"whether or not for profit"* y nombran *"contributing to any collection
of data, data set or database"*, que describe con precisión quirúrgica un
`data/clean/team_match_stats.csv` versionado en git.

El `robots.txt` apunta en la misma dirección. `www.espn.com` bloquea a los agentes de IA
por nombre — **incluido `anthropic-ai`** — y, para `User-agent: *`, prohíbe exactamente
las rutas de estadísticas de fútbol:

```
User-agent: anthropic-ai
Disallow: /
...
User-agent: *
...
Disallow: /soccer/matchstats
Disallow: /soccer/lineups
Disallow: /soccer/commentary
```

**Matiz técnico, y lo digo porque es real y porque no quiero que suene a un caso más
cerrado de lo que es:** `robots.txt` rige por host, y los hosts de la API
(`site.api.espn.com`, `sports.core.api.espn.com`) son distintos de `www.espn.com`. Los dos
devuelven **403 al pedir `/robots.txt`**, o sea que no publican reglas propias. Un abogado
podría discutir que las reglas de `www.espn.com` no los alcanzan. Pero el espíritu de
`Disallow: /soccer/matchstats` es transparente, y **los Términos de Uso no dependen del
robots.txt**: aplican a "los Productos de Disney", sin distinguir hosts.

### 4.6 ¿Corre desde una GitHub Action? — evidencia parcial, NO concluyente

No pude correr una GitHub Action (soy read-only sobre el repo). Hice lo más parecido que
tenía a mano: pedir el mismo endpoint a través de `r.jina.ai`, un servicio que corre en
infraestructura de datacenter, no en una IP residencial argentina:

```
jina(datacenter) -> 200  len=68520
expectedGoals in body: True | Expected Goals: True
{"$ref":"http://sports.core.api.espn.com/v2/sports/soccer/leagues/arg.1/events/401841447/...
..."name":"expectedGoalsConceded","displayName":"Expected Goals Conceded","value":0.604...
```

**Qué prueba:** que ESPN no bloquea de plano todo el tráfico de datacenter, y que devuelve
el JSON completo con xG a un cliente que no es un navegador.
**Qué NO prueba:** que funcione desde los runners de GitHub, que salen por rangos de Azure
concretos. El experimento del §8 sigue siendo obligatorio.

### 4.7 Yapa: ESPN resuelve el bloqueante abierto del `CLAUDE.md`

El `CLAUDE.md` dice, en su lista de pendientes: *"La zona (A o B) de cada equipo no está
en los datos y no se puede inferir. Hay que cargarla a mano por temporada."* El informe v1
propuso copiarla de FBref. ESPN la da estructurada, en un endpoint gratis y sin key:

```
GET https://site.api.espn.com/apis/v2/sports/soccer/ARG.1/standings?season=2026
  GRUPO: Group A | equipos: 15
     ['Boca Juniors', 'Estudiantes de La Plata', 'Independiente', 'Lanús', "Newell's Old Boys", ...]
  GRUPO: Group B | equipos: 15
     ['Argentinos Juniors', 'Belgrano (Córdoba)', 'Gimnasia La Plata', 'Huracán', 'Racing Club', ...]
```

Y coincide con lo que el informe v1 leyó en FBref (Estudiantes LP y Boca en la A;
Independiente Rivadavia y River en la B). **Dos fuentes independientes que dan lo mismo:
eso es suficiente para cargar `reference/zonas.csv` a mano con confianza.** Sigue
conviniendo cargarlo a mano y versionarlo, por el mismo motivo que ya está escrito en el
`CLAUDE.md`: el formato cambia todos los años.

Nota: esto vale **aunque se descarte ESPN como fuente de estadísticas**. Consultar dos
veces por temporada una tabla de posiciones para copiarla a mano no es "systematic,
regular, or bulk retrieval". Es leer.

### 4.8 Mapeo de equipos: 30 de 30, con id entero

Mismo criterio que el informe v1: **unir por id, nunca por nombre.**

```
GET https://site.api.espn.com/apis/site/v2/sports/soccer/ARG.1/teams  -> 200, N = 30
```

| id ESPN | nombre en ESPN | ¿ojo? |
|---|---|---|
| 9739 | Aldosivi | |
| 3 | Argentinos Juniors | |
| 9785 | Atlético Tucumán | |
| 235 | Banfield | |
| 10060 | Barracas Central | |
| 4 | Belgrano (Córdoba) | |
| 5 | Boca Juniors | |
| 11989 | Central Córdoba (Santiago del Estero) | |
| 8950 | Defensa y Justicia | |
| 17702 | Deportivo Riestra | |
| **8** | **Estudiantes de La Plata** | ⚠️ trampa |
| **19685** | **Estudiantes de Río Cuarto** | ⚠️ trampa |
| **11972** | **Gimnasia (Mendoza)** | ⚠️ trampa |
| **9** | **Gimnasia La Plata** | ⚠️ trampa |
| 10 | Huracán | |
| 11 | Independiente | |
| 9744 | Independiente Rivadavia | |
| 2975 | Instituto (Córdoba) | |
| 12 | Lanús | |
| 14 | Newell's Old Boys | |
| 7764 | Platense | |
| 15 | Racing Club | |
| 16 | River Plate | |
| 17 | Rosario Central | |
| 18 | San Lorenzo | |
| 10158 | Sarmiento (Junín) | |
| 19 | Talleres (Córdoba) | |
| 7767 | Tigre | |
| 20 | Unión (Santa Fe) | |
| 21 | Vélez Sarsfield | |

Los 30 mapean 1:1 con los 30 de `reference/colores.csv`. Las cuatro trampas son las mismas
que el informe v1 documentó para FotMob, y se resuelven igual: tabla a mano, id entero,
nada de fuzzy match. Ventaja menor sobre FotMob: ESPN ya trae los acentos bien.

---

## 5. Evidencia — proveedores comerciales

### 5.1 Sportmonks: descartada con la lista oficial en la mano

Su documentación es pública y legible (`docs.sportmonks.com`, con versiones `.md`).
Bajé la página de cobertura de xG. Son **53 ligas**, y las relevantes para nosotros:

```
| Copa Libertadores    | 1122 |
| Copa de la Superliga | 1658 |
| Liga MX              |  743 |
| Major League Soccer  |  779 |
| Serie A (Brasil)     |  648 |
```

**La Liga Profesional Argentina NO está en la lista.** Lo único argentino es la *Copa de
la Superliga*, un torneo que se jugó en 2019-2020 y ya no existe. Conteo de ocurrencias de
"Argentin" en la página de cobertura: **0**.

Además: *"The xG data is available from the 2024/2025 season to date"*. Aunque cubrieran
Argentina, no habría histórico.

Precios, textual de su doc:

> * **xG Basic Add-on:** €19-€99 depending on your base plan
> * **xG Advanced Add-on:** €199-€399 depending on your base plan
> Starter plan: €19/month · Growth plan: €69/month · Pro plan: €99/month

Y eso es **el add-on encima del plan base**. **DESCARTADA.** Es la lección más útil de
todo el barrido: *pagar no garantiza cobertura de Argentina.*

### 5.2 FootyStats — Plan B, con esquema verificado corriendo código

Su API vive en `api.football-data-api.com`, que **no está detrás de Cloudflare** (el sitio
web `footystats.org` sí: 403 a `requests`, a WebFetch y al proxy de texto). Y publican una
**key de prueba pública, `example`**, que funciona:

```
GET https://api.football-data-api.com/league-list?key=example   -> 200, 627.828 bytes
leagues: 1734
```

**Argentina Primera División está, con temporadas 2015 → 2026:**

```
== Argentina | Primera División
  {'id': 115,   'year': 2016}      {'id': 8595,  'year': 2023}
  {'id': 116,   'year': 2015}      {'id': 11212, 'year': 2024}
  {'id': 1712,  'year': 20182019}  {'id': 15746, 'year': 2025}
  {'id': 2366,  'year': 20192020}  {'id': 16571, 'year': 2026}   <-- la temporada actual
  {'id': 5586,  'year': 2021}      {'id': 17316, 'year': 20162017}
  {'id': 7892,  'year': 2022}
```

Con la key `example` **no pude leer la temporada argentina** — la cuenta de demo no la
tiene habilitada, y lo dice con claridad:

```
GET /league-matches?key=example&season_id=16571
  -> 417  {"success": false, "message": "League is not chosen by the user (this might be
     delayed by cache if you chose the league recently, wait 1 hour). League may not
     exist, or is not available to th..."}
```

**Pero sí pude leer una temporada de demo entera y fijar el esquema real** (season_id 1625,
380 partidos, 215 campos por partido):

```
campos con xG / posesión / ataque:
['attacks_recorded', 'team_a_attacks', 'team_a_dangerous_attacks', 'team_a_possession',
 'team_a_xg', 'team_a_xg_prematch', 'team_b_attacks', 'team_b_dangerous_attacks',
 'team_b_possession', 'team_b_xg', 'team_b_xg_prematch', 'total_xg', 'total_xg_prematch']

fila real:
 "team_a_shots": 7, "team_a_shotsOnTarget": 6, "team_a_shotsOffTarget": 1,
 "team_a_possession": 46, "team_a_corners": 2, "team_a_fouls": 11, "team_a_offsides": 4,
 "team_a_attacks": 111, "team_a_dangerous_attacks": 33, "team_a_throwins": 21,
 "team_a_goalkicks": 5, "team_a_freekicks": 9, "team_a_penalties_won": 1,
 "team_a_xg": 1.12, "team_a_xg_prematch": 0,
 "team_b_xg": 1.33, "total_xg": 2.45
```

- ✅ `team_a_xg` / `team_b_xg` / `total_xg` son campos reales, a nivel equipo-partido.
  Además hay `xg_prematch` (xG esperado antes del partido), que es una métrica que
  ninguna otra fuente da y que se parece bastante al "goles esperados por el mercado"
  del Plan B del informe v1.
- ❌ **NO hay duelos.** ❌ **NO hay pases progresivos.**
- ❓ **NO VERIFICADO: si las temporadas argentinas traen `xg` poblado.** El esquema es el
  mismo para todas las ligas, pero eso no garantiza el dato. FootyStats publica una página
  pública `/argentina/primera-division/xg`, lo cual es un indicio fuerte de que sí — pero
  la página está bloqueada por Cloudflare (403 a `requests`, a WebFetch y a `r.jina.ai`),
  así que **es un indicio, no una verificación**.
- ❓ **Precio NO VERIFICADO**: la página de precios está bloqueada. Fuente secundaria
  (tutoriales indexados del propio sitio) dice *"FootyStats API packages start at £29.99
  per month"*, con cantidad de ligas limitada por plan y ligas agregables desde la cuenta.
- ⚠️ Tienen ToS propios de la API, y el propio JSON los referencia en cada respuesta:
  `"Usage of the API is bound to our Terms of Use : https://footystats.org/api/documentations/terms-of-use-and-legal"`.
  **No los pude leer (403). Hay que leerlos antes de pagar.**

### 5.3 TheStatsAPI — alternativa de pago, más cara

Página pública y legible. Textual:

> Plans start at **$50/month** with a 7-day free trial and every endpoint included.
> **Starter $50/month** — 150 competitions by default, up to 1,196 on request ·
> 100,000 requests/month · 120 requests/min · 10 years of historical match data ·
> xG, player season stats & team stats
> **Growth $129/month** · **Scale $379/month**

Esquema de xG (de su doc, `GET /football/matches/{match_id}/stats`):

```json
{"data":{"match_id":"mt_10477",
 "home":{"team":"Liverpool","goals":3,"xg":2.41},
 "away":{"team":"Leicester City","goals":1,"xg":0.88},
 "shots":[{"team":"Liverpool","minute":23,"xg":0.34,"result":"goal"}, ...]}}
```

Da **xG por tiro**, que ninguna otra opción de este informe ofrece. Pero: sin duelos, sin
pases progresivos, y su propia FAQ admite el problema de siempre —
*"xG is available for the majority of **top-tier competitions**. Check the xG column on
the coverage page for specifics."* **Cobertura de Argentina: NO VERIFICADA.** Y "150
competitions by default" hace probable que Argentina haya que pedirla.

### 5.4 football-data.org — descartada, verificado

Su endpoint `/v4/competitions` responde sin token:

```
GET https://api.football-data.org/v4/competitions -> 200, count 189
2024 ASL  Liga Profesional        | Argentina | plan TIER_TWO
2149 CDLP Copa Liga Profesional   | Argentina | plan TIER_FOUR
2023 PBN  Primera B Nacional      | Argentina | plan TIER_FOUR
```

La liga existe pero es **TIER_TWO**, y el tier gratuito solo habilita TIER_ONE (las 12
competiciones top). Y, más definitivo: **football-data.org no tiene xG en su modelo de
datos, para ninguna liga.** Sirve para fixtures y resultados, cosa que el proyecto ya
resuelve gratis con football-data.co.uk. **DESCARTADA.**

### 5.5 Sportradar, Stats Perform / Opta, StatsBomb comercial, Wyscout / Hudl

Las cuatro son proveedores empresariales. Ninguna publica precio: el flujo es
"contactanos". Son el origen del dato que ESPN y FotMob redistribuyen — Opta es
literalmente quien produce el xG que los dos muestran. Comprar Opta directo resolvería
todo, incluidos los pases progresivos (es su métrica).

**Pero está fuera de escala para este proyecto.** No pude verificar precios (no hay página
pública), y el orden de magnitud típico del rubro son contratos anuales de cuatro o cinco
cifras en dólares, con mínimos. Para un sitio que por restricción explícita del
`CLAUDE.md` **no puede cobrar nada**, no cierra por ningún lado. Las dejo listadas para
que quede constancia de que se miraron, marcadas **NO VERIFICADAS**.

### 5.6 SoccersAPI, Goalserve, LiveScore API — no verificadas

```
soccersapi   200  -> pricing legible, 0 menciones de "xG" o "expected" en toda la página
goalserve    ERR ConnectTimeout (no respondió desde esta IP)
livescoreapi 401  -> la propia página de precios pide autenticación
```

SoccersAPI ofrece trial de 7 días y 50% off el primer mes, pero que su página de precios
no mencione xG ni una vez es mala señal. Las tres quedan **NO VERIFICADAS** y de baja
prioridad frente a FootyStats.

---

## 6. Evidencia — fuentes argentinas y datasets abiertos

### 6.1 Promiedos: la API existe, no tiene lo que buscamos

Encontré el host real leyendo el HTML del sitio: `api.promiedos.com.ar`. Los endpoints
están documentados de hecho en un cliente open source (`manucabral/EasySoccerData`):

```
GET /games/{date}
GET /gamecenter/{id}
GET /league/tables_and_fixtures/{id}
GET /league/games/{id}/{stage_id}        # id de la Liga Profesional = "hc"
```

Responden, y el `id` de la liga es válido:

```
GET /league/games/hc/1     -> 200  {"TTL":300,"games":[]}
GET /games/today           -> 200  {}
GET /games/26-07-2026      -> 200  {}
GET /league/games/hc/2     -> ReadTimeout
```

O sea: **la API es real y el id de la liga es correcto, pero devolvió vacío o timeout
desde esta IP.** No pude leer un `gamecenter` real, así que su contenido queda
**NO VERIFICADO**.

Lo que sí puedo afirmar: **Promiedos no muestra xG en ningún lado.** Conteo sobre el HTML
de la página de la Liga Profesional (154.697 bytes):

```
'xG': 0   'Expected': 0   'esperados': 0   'Duelos': 0   'duelo': 0
```

Es un sitio de resultados y tablas. Su valor para este proyecto sería fixtures y tabla,
no estadística avanzada — y eso el proyecto ya lo tiene gratis. No publica `robots.txt`
(404). **No sirve para el encargo.**

### 6.2 Doble Amarilla: descartada por su propio robots.txt

```
User-agent: ClaudeBot
Disallow: /
...
User-agent: *
Allow: /api/v1/image
Disallow: /_/
Disallow: /search
Disallow: /api
```

`Disallow: /api` para todos los agentes. Es una prohibición explícita, publicada por el
sitio, sobre exactamente la ruta que habría que usar. **DESCARTADA sin necesidad de
mirar qué devuelve.**

### 6.3 TyC Sports y AFA

**TyC Sports** (`robots.txt`, 200): habilita a los bots sociales para previews y, para
`User-agent: *`, bloquea `/nota/` y `/noticias/`. No hay reglas sobre un `/api`, pero
tampoco detecté un endpoint JSON de estadísticas. **No investigado a fondo**: TyC no
publica xG ni duelos en su web, así que aunque existiera un endpoint no traería lo que
buscamos.

**AFA** (`robots.txt`, 200) es casi permisivo:

```
User-agent: *
Disallow: /cache/
```

Pero no hay dato que sacar: `afa.com.ar/es/pages/torneos` devuelve **404** y no encontré
ninguna API. Lo mismo con `ligaprofesional.ar`: el sitio carga (981 KB) pero no expone
endpoints. **Ni la AFA ni la Liga Profesional publican estadística avanzada.** Es
coherente con el mercado: la producen terceros bajo contrato.

### 6.4 DataFactory — NO VERIFICADA, sin nada público

`datafactory.la` responde 200 (345 KB) y su `robots.txt` es un WordPress estándar
(`Disallow: /wp-admin/`). Pero el sitio es puro marketing corporativo. Conteo sobre el
texto extraído:

```
'API': 0   'xG': 0   'Expected': 0   'Liga Profesional': 0   'precio': 0
```

Cero menciones de API, cero de xG, cero de precios. El sitio ofrece "Productos",
"Operadores de Juego", "DF Agency" y un formulario de contacto. **No hay API pública ni
tarifa publicada.** Que sea el proveedor de datos de buena parte del fútbol argentino es
un dato de contexto, no una fuente accesible: su cliente es una casa de apuestas o un
medio, no un proyecto sin fines de lucro. **Averiguar el precio requiere escribirles**
(§8, paso 4). Queda **NO VERIFICADA**.

### 6.5 Datasets abiertos: no hay nada

**HuggingFace** (API de búsqueda, verificado):

```
q='argentina football'   -> []
q='liga profesional'     -> []
q='argentine soccer xg'  -> []
q='football xg'          -> ['xgabora/Club-Football-Match-Data-2000-2025']
```

Un solo resultado. Lo abrí y le miré la cabecera real:

```
downloads 3089 | lastModified 2025-03-01
archivos: ['EloRatings.csv', 'Matches.csv', 'README.md']

HEADER: Division,MatchDate,MatchTime,HomeTeam,AwayTeam,HomeElo,AwayElo,Form3Home,...,
        FTHome,FTAway,FTResult,HomeShots,AwayShots,HomeTarget,AwayTarget,HomeFouls,...,
        OddHome,OddDraw,OddAway,MaxHome,...
has xG: False
```

**Sin xG.** Es un derivado de football-data.co.uk con Elo agregado — o sea, la misma
fuente que el proyecto ya usa, con menos columnas. Y está congelado en marzo de 2025.
Inútil incluso para entrenar.

**Zenodo**: su API devolvió 403 a las dos consultas. **NO VERIFICADO.**

**Kaggle**: el dataset de referencia del rubro
(`slehkyi/extended-football-stats-for-european-leagues-xg`) es, como dice su propio
nombre, de **ligas europeas** — está construido sobre Understat, que el informe v1 ya
descartó por cubrir solo 6 ligas europeas. No encontré ningún dataset de fútbol argentino
con estadística avanzada.

**GitHub**: busqué proyectos de scraping de fútbol argentino con stats avanzadas. No
apareció ninguna vía que no estuviera ya cubierta. El único hallazgo útil fue
instrumental: los volcados crudos de respuestas de API-Football que usé como evidencia
en §3.3, y el cliente de Promiedos de §6.1.

**Conclusión del apartado: no existe un dataset abierto de la Liga Profesional Argentina
con xG.** Ni actualizado, ni congelado, ni para entrenar.

---

## 7. La conclusión honesta y el trade-off real

**No hay ninguna opción que sea legal, gratuita y automatizable a la vez.** Lo digo con
todas las letras porque es un resultado válido y es lo que hace falta para decidir.

Miradas las 20 fuentes, cada una falla en al menos una condición:

| | legal | gratis | automatizable | xG en ARG 2026 |
|---|---|---|---|---|
| ESPN | ❌ | ✅ | ✅ | ✅ (solo desde jul-2026) |
| FotMob (informe v1) | ❌ | ✅ | ✅ | ✅ (desde 2023) |
| Sofascore (informe v1) | ❌ | ✅ | ⚠️ spoofing TLS | ⚠️ 16% |
| API-Football | ✅ | ⚠️ 100 req/día | ✅ | ❓ |
| FootyStats | ⚠️ ToS sin leer | ❌ ~£30/mes | ✅ | ❓ |
| TheStatsAPI | ✅ | ❌ US$50/mes | ✅ | ❓ |
| Sportmonks | ✅ | ❌ €19-99/mes + base | ✅ | ❌ **no cubre** |
| Datasets abiertos | ✅ | ✅ | ✅ | ❌ **no existen** |
| Métricas derivadas (Plan B v1) | ✅ | ✅ | ✅ | ❌ no es xG |

Los tres caminos posibles, sin maquillaje:

**Camino A — pagar.** Entre **£30 y US$50 por mes** (FootyStats o TheStatsAPI). Ninguno de
los dos está verificado que traiga xG de Argentina, así que **hay que probar antes de
pagar**, y los dos ofrecen forma de hacerlo (§8). Ninguno da duelos ni pases progresivos.
Contra: el `CLAUDE.md` prohíbe cobrar por el producto, o sea que es un gasto fijo a fondo
perdido. A favor: elimina el riesgo legal por completo y el pipeline deja de depender de
que a un tercero no se le ocurra bloquearte.

**Camino B — aceptar el riesgo de ToS.** ESPN o FotMob. Dato gratis, de calidad Opta, y
en el caso de ESPN 172 campos incluyendo duelos completos y PPDA. Contra: los ToS lo
prohíben, y en el caso de ESPN con una redacción que anula el argumento de "sin fines de
lucro". El riesgo realista no es un juicio, es un bloqueo de IP o un reclamo — pero,
como ya decía el informe v1, **acá el activo en juego es el pipeline entero**. Es el mismo
razonamiento que el proyecto ya aplicó con los escudos, y ahí decidió no arriesgar.

**Camino C — quedarse con métricas derivadas.** Es el Plan B del informe v1 (§10 de aquel
documento) y **sigue siendo bueno**: goles esperados a favor y en contra desde la matriz
de Dixon-Coles, "goles esperados por el mercado" desmarginalizando las cuotas `AvgC*`,
sobre/bajo rendimiento contra el mercado, fuerzas de ataque y defensa del modelo propio,
calidad de rival acumulada. Contra: no es xG y no hay que llamarlo xG. No permite contar
"generó mucho y no la metió" en un partido puntual. A favor: **es propio**, que es
exactamente lo que el `CLAUDE.md` dice que distingue al proyecto.

### Recomendación única

**Probar API-Football con su key gratuita antes de decidir cualquier otra cosa.**

Los motivos, en orden:

1. **Es la única fuente de todo el barrido cuya postura publicada habilita lo que
   necesitamos hacer.** `Allow: /` para todos los agentes, `Content-Signal: ai-input=yes,
   ai-train=yes`, y un modelo de negocio construido sobre el consumo programático. No hay
   que interpretar nada ni apostar a que no se enteren.
2. **`expected_goals` existe** en `fixtures/statistics`: está probado con una respuesta
   cruda real (§3.3). La única incógnita es la cobertura de Argentina, y esa incógnita
   **se despeja en 20 minutos**.
3. **El tier gratuito alcanza para el criterio de terminado de la v1.** Una fecha son
   ~15 partidos = ~16 requests contra un límite de ~100/día. El backfill sería lento,
   pero el `CLAUDE.md` define la v1 como "termina una fecha y el sitio se actualiza solo",
   no como "hay tres años de histórico de xG".

**Lo que hay que aceptar si se va por acá:** API-Football **no tiene duelos y no tiene
pases progresivos**. Son 18 tipos de estadística contra los 172 de ESPN. El encargo pedía
las tres cosas y esta fuente da una. Prefiero decirlo así antes que recomendar algo más
rico y callar que está prohibido.

**Plan B: FootyStats API (~£29,99/mes).** Si API-Football no tiene xG para Argentina.
Tiene la liga y las temporadas 2015→2026 confirmadas, el esquema de xG verificado
corriendo código, y `xg_prematch` de yapa. Antes de pagar: leer sus ToS y confirmar con
soporte que las temporadas argentinas traen `team_a_xg` poblado.

**Plan C, el mejor técnicamente y el que NO recomiendo: ESPN.** Si el dueño decide asumir
el riesgo de ToS, ESPN es estrictamente mejor que FotMob en riqueza de campos (172 vs 37,
con duelos completos y PPDA) y estrictamente peor en histórico (julio 2026 vs 2023) y en
redacción legal. Si se acepta el riesgo, **lo sensato es combinar las dos**: FotMob para
el histórico 2023-2026 y ESPN de acá en adelante — son el mismo feed de Opta y los números
coinciden, así que se pueden concatenar sin ajustar nada.

**Independientemente de todo lo anterior:** usar ESPN para leer la **zona A/B** dos veces
por temporada y copiarla a mano a `reference/zonas.csv` (§4.7). Eso no es recolección
sistemática, resuelve un bloqueante abierto del `CLAUDE.md`, y ya está validado contra
FBref.

---

## 8. Qué habría que hacer para verificar lo que quedó sin verificar

Concreto y accionable. En orden de valor por minuto invertido.

### Paso 1 — API-Football, la pregunta decisiva (20 minutos, gratis)

1. Crear cuenta gratuita en `dashboard.api-football.com`. **No lo hice yo a propósito:**
   la consigna era no crear cuentas a nombre del dueño.
2. Con la key en `x-apisports-key`, correr estas cuatro llamadas **en este orden**:

```bash
H="x-apisports-key: TU_KEY"
B=https://v3.football.api-sports.io

# 1. ¿Existe la liga y cuál es su id?  (se espera id 128)
curl -s -H "$H" "$B/leagues?country=Argentina&type=league"

# 2. LA PREGUNTA DECISIVA: ¿la cobertura incluye estadísticas de partido?
#    Mirar en la respuesta: seasons[].coverage.fixtures.statistics_fixtures
curl -s -H "$H" "$B/leagues?id=128" | python -m json.tool

# 3. Traer una fecha reciente
curl -s -H "$H" "$B/fixtures?league=128&season=2026&from=2026-07-23&to=2026-07-26"

# 4. Y el que decide todo: ¿viene expected_goals poblado?
curl -s -H "$H" "$B/fixtures/statistics?fixture=<ID_DEL_PASO_3>"
```

3. **Criterio de decisión, sin ambigüedad:** si en el paso 4 aparece
   `{"type":"expected_goals","value":"1.96"}` con un valor real (no `null`, no `"0"`),
   **API-Football es la fuente y el problema legal desaparece.** Si viene `null` o el
   tipo no está, pasar al Paso 2.
4. Contrastar el valor contra la evidencia ya medida: para Riestra 3-0 Boca del 26/07,
   Opta dice **1.963 / 0.604**. Si API-Football da algo parecido, es el mismo feed.
5. Mientras estés adentro del dashboard, anotar **los precios de los tiers pagos**, que
   no pude ver por el Cloudflare, y el límite real del free tier.

### Paso 2 — FootyStats, si el Paso 1 falla (30 minutos, gratis hasta el final)

1. Escribir a soporte **antes de pagar** y preguntar exactamente esto: *"¿Las temporadas
   de Argentina Primera División (season_id 16571 para 2026, 15746 para 2025) traen los
   campos `team_a_xg` / `team_b_xg` poblados? ¿Desde qué temporada?"*
2. Leer `https://footystats.org/api/documentations/terms-of-use-and-legal` **desde un
   navegador de verdad** — está bloqueado a clientes programáticos y es el documento que
   define si el uso que queremos está permitido.
3. Confirmar el precio y cuántas ligas entran en el plan base. El dato de £29,99 es de
   fuente secundaria.
4. Si se contrata: `GET /league-matches?key=TU_KEY&season_id=16571` y contar cuántos de
   los 265 partidos de 2026 tienen `team_a_xg` distinto de 0. **Ese número es el
   veredicto.**

### Paso 3 — El semáforo de GitHub Actions (15 minutos)

Sigue siendo obligatorio, igual que en el informe v1, y **para cualquiera de las fuentes
que se elija**. Una Action descartable, en un repo de prueba, con un solo request:

```yaml
- run: |
    curl -s -o /dev/null -w "%{http_code}\n" \
      "https://sports.core.api.espn.com/v2/sports/soccer/leagues/arg.1/events/401841447/competitions/401841447/competitors/17702/statistics"
    curl -s -H "x-apisports-key: ${{ secrets.APIFOOTBALL_KEY }}" \
      -o /dev/null -w "%{http_code}\n" "https://v3.football.api-sports.io/status"
```

Todo lo que medí salió de una IP residencial argentina. La evidencia del §4.6 (ESPN
respondiendo a través de un proxy de datacenter) es **parcial y no reemplaza esta prueba**:
los runners de GitHub salen por rangos de Azure concretos, que son los primeros que estos
servicios bloquean. **No construyas nada antes de este semáforo.**

### Paso 4 — DataFactory (una semana de espera, gratis preguntar)

Escribir por el formulario de `datafactory.la` explicando qué es el proyecto: sitio
público, sin fines de lucro, sin publicidad, sin apuestas, uso editorial. Preguntar si
tienen alguna modalidad de licencia académica, de medio chico o de proyecto abierto para
la Liga Profesional, y qué métricas incluye. **Probabilidad baja de que salga algo
usable**, pero el costo de preguntar es cero y son el proveedor oficial del mercado local:
la respuesta, sea cual sea, cierra una puerta que hoy está entreabierta.

### Paso 5 — Vigilar el feed nuevo de ESPN (5 minutos por fecha, durante un mes)

Aunque no se adopte ESPN como fuente, el hallazgo del §4.3 vale la pena seguirlo: si el
feed de 172 campos se sostiene en agosto y septiembre, se confirma que fue un cambio de
plataforma permanente y no una prueba. Eso cambia el cálculo del Camino B —
y, si Opta amplió su distribución, **puede que aparezca también en fuentes con ToS
mejores**. Un script de una línea por fecha alcanza:

```python
# cuenta cuántos partidos de la última fecha traen las 172 stats
```

### Cosas que decidí NO hacer y por qué

- **No creé ninguna cuenta ni key** (API-Football, FootyStats, TheStatsAPI, SoccersAPI):
  la consigna lo prohibía explícitamente. Todo lo que dependía de eso está marcado
  NO VERIFICADO, sin excepción.
- **No probé una GitHub Action**: soy read-only sobre el repo y no me correspondía
  empujar workflows.
- **No forcé el Cloudflare** de api-football.com, footystats.org ni fbref.com. Se podía
  con un Chrome headless, pero es exactamente el tipo de evasión de control de acceso que
  el informe v1 usó como argumento para descartar Sofascore. Habría sido incoherente.
- **No toqué ni un archivo del repo** salvo este documento.

---

## 9. Archivos generados

Todo en el scratchpad de la sesión. **El repo datafut no fue modificado salvo por este
mismo archivo.**

| Archivo | Qué es |
|---|---|
| `espn_xg_coverage_2026.csv` | **auditoría partido por partido de los 265 de 2026**, con `n_stats`, `xg`, `duelos_ganados`, `ppda` |
| `espn_events_2026.json` | los 282 eventos de ESPN de la temporada 2026 |
| `raw_espn_core_teamstats.json` | una respuesta completa de 172 estadísticas, para inspeccionar |
| `raw_espn_summary.json` | el `summary` del site API (donde xG aparece a nivel jugador) |
| `raw_fs_api_test.txt` | `league-list` de FootyStats: 1.734 ligas, con las 13 temporadas argentinas |
| `gh_KonradHD_LaLigaApp.txt` | la respuesta cruda real de `fixtures/statistics` de API-Football |
| `raw_sm_xg_cov.txt` | lista oficial de cobertura de xG de Sportmonks (las 53 ligas, sin Argentina) |
| `raw_espn_tos.txt` | Términos de Uso de Disney, texto completo |
| `raw_apifootball_robots.txt` | el `robots.txt` de API-Football (`Allow: /`, `ai-input=yes`) |
| `raw_dobleamarilla_robots.txt`, `raw_tyc_robots.txt`, `raw_afa_robots.txt`, `raw_datafactory_robots.txt` | robots.txt de las fuentes argentinas |
| `espn_scan.py`, `espn_hist.py`, `espn_jul.py`, `espn_core2.py` | los scripts de medición, reproducibles |
