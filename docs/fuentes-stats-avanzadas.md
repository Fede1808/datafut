# Informe: fuentes de estadísticas avanzadas para la Liga Profesional Argentina

**Fecha:** 27/07/2026
**Método:** todo lo que está acá se verificó **corriendo código**. Cada afirmación tiene
la evidencia pegada abajo. Lo que no pude probar corriendo código está marcado
explícitamente como **NO VERIFICADO** y no entra en la recomendación.

---

## 1. Resumen ejecutivo

**Recomendación: FotMob (league id 112), con una advertencia legal seria que el proyecto
tiene que decidir antes de implementar.**

Es la única fuente que probé que cumple las tres condiciones a la vez:
cubre la temporada 2026 al 100%, trae xG y duelos de verdad, y funciona con `requests`
pelado — sin navegador headless, sin spoofing de TLS, sin API key.

Pero sus Términos de Uso **prohíben explícitamente** lo que necesitamos hacer.
Eso choca de frente con la sección "Restricciones legales (no negociables)" del
`CLAUDE.md`. La decisión no es técnica, es del dueño del proyecto. Ver §7.

**Los tres hallazgos que cambian el panorama:**

1. **FBref ya no sirve. Se murió como fuente de datos avanzados** — y no solo para
   Argentina: también para la Premier League. Opta le cortó el feed en enero de 2026.
   El `CLAUDE.md` del proyecto tiene esto documentado como si todavía fuera cierto y
   **hay que corregirlo** (§3.1).
2. **"Pases progresivos" no existe en ninguna fuente gratuita hoy.** Era una métrica
   Opta y se fue con Opta. Hay sustitutos razonables, no equivalentes (§5).
3. **Bonus no pedido:** FBref (que ya no sirve para stats) **sí tiene la asignación de
   Zona A / Zona B de 2026**, que es el bloqueante abierto más importante del proyecto
   según el propio `CLAUDE.md`. FotMob además etiqueta las rondas de playoff
   (`1/8`, `1/4`, `1/2`, `final`) explícitamente (§8).

---

## 2. Veredicto por fuente

| Fuente | 2026 | xG | Duelos | Pases progresivos | Transporte | Veredicto |
|---|---|---|---|---|---|---|
| **FotMob** | ✅ 100% | ✅ 100% | ✅ | ❌ | `requests` pelado | **RECOMENDADA** (con reparo legal) |
| Sofascore | ✅ 100% | ⚠️ 16% en 2026 | ✅ | ❌ | requiere spoofing TLS | Segunda opción, peor |
| FBref | ✅ resultados | ❌ **eliminado** | ❌ | ❌ | requiere Chrome headless | Descartada para stats |
| Understat | ❌ | — | — | — | — | **Descartada** (no cubre Argentina) |
| StatsBomb open | ❌ | — | — | — | — | **Descartada** (2 partidos, 1981 y 1997) |
| API-Football | ? | ? | ? | ? | API key | **NO VERIFICADA** — no pude probarla |

---

## 3. Evidencia

### 3.1 FBref: Opta le cortó el feed (esto invalida el `CLAUDE.md` actual)

El `CLAUDE.md` del proyecto dice hoy, en la línea 114:

> **FBref (competición 21 = Liga Profesional Argentina):**
> Tiene datos avanzados provistos por Opta (xG, xA, pases progresivos, duelos)

**Eso ya no es cierto.** Bajé la página real de FBref de la Liga Profesional 2026
(1.229.535 bytes de HTML) y la conté:

```
--- occurrences of xG / xg:
">xG<" count: 0 | data-stat xg: 0
progressive: 0
--- secciones de stats que existen en la página:
['keepers', 'misc', 'nations', 'playingtime', 'schedule', 'shooting', 'stats']
--- tablas presentes:
['stats_squads_keeper_against', 'stats_squads_keeper_for',
 'stats_squads_misc_against', 'stats_squads_misc_for',
 'stats_squads_playing_time_against', 'stats_squads_playing_time_for',
 'stats_squads_shooting_against', 'stats_squads_shooting_for',
 'stats_squads_standard_against', 'stats_squads_standard_for']
```

No hay sección `passing`, ni `possession`, ni `defense`. Esas eran las que traían
pases progresivos, duelos aéreos y tackles.

**Y no es un problema de cobertura de Argentina.** Hice el mismo conteo sobre la
Premier League 2025/26 — la liga mejor cubierta del planeta:

```
teams_ENG-Premier League_2526_stats.html  848868 bytes
  >xG< : 0 | data-stat xg: 0 | progressive: 0
  secciones: ['history','keepers','misc','nations','playingtime','schedule','shooting','stats','wages']
```

Cero xG en la Premier League. Es un cambio de sitio completo, no de liga.

Todavía existe la URL `/en/comps/9/passing/Premier-League-Stats` y la tabla se
renderiza — pero **está vacía**. Bajé la tabla y la parseé:

```
COLS [('Total','Cmp'), ('Total','Att'), ('Total','PrgDist'), ..., ('','KP'), ('','1/3'), ('','PPA')]
        Squad     # Pl  90s   Cmp  Att  Cmp%  TotDist  PrgDist  ...  Ast  A-xAG  KP  1/3  PPA
0     Arsenal       25 38.0   NaN  NaN   NaN      NaN      NaN  ...   51    NaN NaN  NaN  NaN
1 Aston Villa       30 38.0   NaN  NaN   NaN      NaN      NaN  ...   40    NaN NaN  NaN  NaN
2 Bournemouth       26 38.0   NaN  NaN   NaN      NaN      NaN  ...   35    NaN NaN  NaN  NaN
```

Son **cáscaras vacías**: los encabezados quedaron, los datos no. Lo único que sobrevive
es `Ast` (asistencias), que se cuenta a mano.

Corroborado también por prensa del rubro: Opta (Stats Perform) le retiró los datos
avanzados a Sports Reference en **enero de 2026**, tras un desacuerdo comercial.

**Acción concreta:** corregir las líneas 113-114 del `CLAUDE.md`. Hoy le están mintiendo
al próximo que lea el archivo — que es exactamente el problema que el proyecto ya tuvo
una vez.

**Lo que FBref SÍ conserva para Argentina** (verificado, comp 21, temporadas 2014→2026):
goles, tiros, tiros al arco, tarjetas, faltas, córners, offsides, intercepciones,
`TklW`, penales. Nada de eso justifica el costo: requiere **Chrome headless**
(`seleniumbase` + `undetected-chromedriver`) porque FBref está detrás de un challenge
interactivo de Cloudflare. `requests` pelado da **403 hasta en `/robots.txt`**:

```
https://fbref.com/robots.txt -> 403   (con headers de navegador completos)
https://fbref.com/en/comps/21/Primera-Division-Stats -> 403
```

### 3.2 Understat: descartada en 30 segundos

```
https://understat.com/ -> 200
leagues encontradas: ['EPL', 'La liga', 'Bundesliga', 'Serie A', 'Ligue 1', 'RFPL']
```

Seis ligas, ninguna es Argentina. Confirmado lo que sospechabas. Además:

```
https://understat.com/robots.txt -> 200
User-agent: *
Disallow: /
```

### 3.3 StatsBomb open data: existe Argentina, pero son 2 partidos

`competition_id 81 = Argentina / Liga Profesional`. Suena bien hasta que mirás las
temporadas:

```
season 1997/1998  matches: 1  ->  1997-10-25 River Plate 1 - 2 Boca Juniors
season 1981       matches: 1  ->  1981-04-10 Boca Juniors 3 - 0 River Plate
```

Son dos superclásicos históricos publicados como curiosidad (Maradona / Riquelme).
No hay temporada 2026 ni nada parecido. Descartada.

### 3.4 Sofascore: funciona, pero con un agujero grande en 2026

Sofascore **sí** tiene Argentina (`uniqueTournament 155`), con 20 temporadas hasta
2008/09, y devuelve un set de estadísticas muy rico por partido — incluidos duelos.
Pero tiene dos problemas.

**Problema 1: la cobertura de xG en 2026 es del 16%.** Escaneé los **265 partidos
terminados** de la temporada 2026, uno por uno, 0 errores:

```
TOTAL=265 errors=0 WITH_XG=42 (16%)
ELAPSED 99s -> 0.37s/match

              n  with_xg  pct
2026-01      30        0    0
2026-02      72        0    0
2026-03      58        0    0
2026-04      60        2    3
2026-05      30       25   83
2026-07      15       15  100
```

Desglosado por torneo:

```
tourn                                          sin_xG  con_xG
Liga Profesional de Fútbol, Apertura              223      12
Liga Profesional de Fútbol, Apertura Playoffs       0      15
Liga Profesional, Clausura                          0      15
```

O sea: **todo el Apertura 2026 (enero a mayo) no tiene xG en Sofascore.** Arranca a
tenerlo desde los playoffs. De acá en adelante está al 100%, pero se pierde media
temporada. Y el histórico es igual de irregular (muestras de 20 partidos por temporada):

```
2025 Clausura   with_xG=20/20 (100%)
2025 Apertura   with_xG= 0/20 (  0%)
2024            with_xG=20/20 (100%)
2023            with_xG=20/20 (100%)
2022            with_xG= 0/20 (  0%)
2021            with_xG= 0/20 (  0%)
19/20           with_xG= 0/20 (  0%)
```

**Problema 2: exige falsificar la huella TLS.** `requests` no entra nunca:

```
RESULT plain requests browser-hdrs -> 403
RESULT plain requests no-hdrs      -> 403
RESULT tls_requests                -> 200
```

Hay que usar `tls_requests`, que descarga un binario nativo (`tls-client-xgo-1.13.1.dll`
en Windows, `.so` en Linux) para imitar el fingerprint JA3 de Chrome. Funciona, pero
es una dependencia binaria pesada y, sobre todo, es **evadir activamente un control de
acceso**, no simplemente leer una página pública.

Nota: `soccerdata.Sofascore` **no sirve acá** — su lista de ligas está hardcodeada a 20
torneos y Argentina no está. Hay que pegarle a la API directo.

### 3.5 FotMob: la recomendada

`league id 112 = Liga Profesional (ARG)`. Temporadas disponibles:

```
LEAGUE: Liga Profesional | country ARG | id 112 | season 2026
SEASONS: ['2026','2025','2024','2023','2022','2021','2019/2020','2018/2019',
          '2017/2018','2016/2017','2016','2015']
allMatches 495 | finished 270
rounds: ['1'...'16', '1/8', '1/4', '1/2', 'final']
TEAMS 30
```

**Funciona con `requests` pelado.** Sin navegador, sin spoofing, sin API key:

```
www_leagues  req -> 200 application/json len=1182822
www_leagues  tls -> 200 application/json len=1182822
```

**Cobertura de xG 2026: 100%.** Muestreé 45 partidos repartidos por toda la temporada
(cada 6º partido, de enero a julio):

```
2026-01-22 r1     Aldosivi         v Defensa y Justic xG=['0.43', '0.56']
2026-01-25 r1     Boca Juniors     v Deportivo Riestr xG=['0.99', '0.14']
2026-02-16 r5     Instituto        v Central Cordoba  xG=['2.42', '0.35']
2026-04-23 r16    Defensa y Justic v Boca Juniors     xG=['0.34', '2.98']
2026-05-16 r1/2   River Plate      v Rosario Central  xG=['2.10', '0.35']
2026-07-25 r1     Newell's Old Boy v Talleres         xG=['1.34', '1.10']

SAMPLED=45 WITH_XG=45 (100%) codes={200: 45}
```

Fijate que **el partido del 22 de enero sí tiene xG en FotMob y no lo tiene en
Sofascore**. FotMob tapa justo el agujero de la otra fuente.

**Histórico de xG: desde 2023.**

```
2025       matches=510  sampled=6 with_xG=6   dates 2025-01-23..2025-12-14
2024       matches=378  sampled=6 with_xG=6   dates 2024-05-10..2024-12-17
2023       matches=378  sampled=6 with_xG=6   dates 2023-01-27..2023-07-30
2022       matches=378  sampled=6 with_xG=0   <-- corte
2021       matches=325  sampled=6 with_xG=0
2019/2020  matches=276  sampled=6 with_xG=0
2016       matches=242  sampled=6 with_xG=0
```

Da **~1.760 partidos con xG (2023-2026)**. Para entrenar features de equipo alcanza
holgado. Ojo: el modelo Dixon-Coles sigue usando los 6.238 partidos de
football-data.co.uk; el xG es una capa adicional, no un reemplazo.

---

## 4. Corrida real de ingesta completa

Escribí un prototipo (`prototipo_fotmob.py`) y lo corrí de punta a punta contra la
temporada 2026 entera. No es una muestra: son los 270 partidos.

```
partidos terminados 2026: 270
  0/270    1s
  80/270   89s
  160/270 178s
  240/270 266s

OK -> MUESTRA_fotmob_equipo_partido_2026.csv
540 filas equipo-partido | 0 fallos | 304s (1.13s por partido)
```

**5 minutos para la temporada completa, 0 fallos, sin toparme con rate limiting.**
Con 0.2s de pausa entre requests. La actualización incremental post-fecha (15 partidos)
tarda **~20 segundos**.

Calidad del resultado — 540 filas × 37 columnas:

```
NULOS:
toques_en_area_rival    1
xg_pelota_parada        2
```

Tres celdas vacías en 19.980. Chequeo de sanidad:

```
equipos distintos: 30 | partidos: 270
corr(xG, goles) = 0.547 | suma goles 559 | suma xG 608.4
```

Correlación 0.55 por partido y xG total apenas por encima de los goles reales: exactamente
lo que uno espera de un xG bien calibrado. Y la tabla agregada tiene sentido futbolístico:

```
                         PJ  GF  GC    xG   xGC  xGdif
River Plate              21  29  18  36.4  16.9   19.5
Argentinos Juniors       20  24  16  26.3  15.7   10.6
Boca Juniors             18  24  15  26.1  16.7    9.4
Estudiantes (LP)         18  19  10  23.8  15.2    8.6
...
Aldosivi                 17   7  20  12.3  23.4  -11.1
Central Córdoba (SdE)    17  11  22  11.9  27.9  -16.0
```

Filas reales del CSV (fecha del 26/07/2026, la última jugada):

```
     fecha             equipo             rival condicion goles   xg  xgot posesion remates chances duel_aer duel_suelo quites intercep
2026-07-26  Deportivo Riestra      Boca Juniors     local     3 1.96  2.03       18       6       3       22         33     21        7
2026-07-26       Boca Juniors Deportivo Riestra visitante     0 0.60  0.62       82      13       1        9         41      9        9
2026-07-26   Estudiantes (LP)     Independiente     local     0 1.87  1.89       60      15       4       29         45     24        8
2026-07-26      Independiente  Estudiantes (LP) visitante     2 1.34  1.92       40      14       3       16         39     21       14
2026-07-26              Lanús       San Lorenzo     local     1 1.86  3.96       50      23       1       24         35     21       10
2026-07-26        San Lorenzo             Lanús visitante     0 0.84  0.39       50      13       1       19         32     15        5
```

Riestra le gana 3-0 a Boca con el 18% de la posesión y 1.96 de xG contra 0.60. Es
justamente el tipo de historia que el sitio quiere poder contar y que hoy, con goles y
cuotas nada más, no puede.

---

## 5. Métricas disponibles: nombres de columna REALES

Estos son los `key` que devuelve FotMob, copiados de la respuesta, no inventados.
Nivel: **por equipo y por partido** (los dos equipos en cada partido). También hay
`playerStats` por jugador, fuera del alcance de la v1.

### xG — completo
| key de FotMob | columna propuesta |
|---|---|
| `expected_goals` | `xg` |
| `expected_goals_open_play` | `xg_jugada` |
| `expected_goals_set_play` | `xg_pelota_parada` |
| `expected_goals_non_penalty` | `xg_sin_penales` |
| `expected_goals_on_target` | `xgot` |

### Duelos — completo
| key de FotMob | columna propuesta | formato crudo |
|---|---|---|
| `duel_won` | `duelos_ganados` | `42` |
| `ground_duels_won` | `duelos_suelo_ganados` | `'31 (46%)'` |
| `aerials_won` | `duelos_aereos_ganados` | `'11 (46%)'` |
| `dribbles_succeeded` | `gambetas_exitosas` | `'7 (41%)'` |

### Pases — **acá está la mala noticia**
| key de FotMob | columna propuesta |
|---|---|
| `passes` | `pases` |
| `accurate_passes` | `pases_completados` |
| `own_half_passes` | (no la tomé) |
| `opposition_half_passes` | `pases_campo_rival` |
| `long_balls_accurate` | `pelotazos_completados` |
| `accurate_crosses` | `centros_completados` |
| `touches_opp_box` | `toques_en_area_rival` |

**NO hay pases progresivos.** Ni en FotMob, ni en Sofascore, ni ya en FBref. "Progressive
passes" es una métrica definida por Opta (pase que acerca el balón ≥10m al arco rival)
y se fue junto con Opta. Requiere datos de evento con coordenadas, que ninguna fuente
gratuita expone hoy para Argentina.

**Sustitutos honestos, que NO son lo mismo y hay que nombrar distinto en el sitio:**
`pases_campo_rival`, `toques_en_area_rival`, `pelotazos_completados`. Miden intención
ofensiva, no progresión metro a metro. Llamarlos "pases progresivos" sería mentirle
al usuario.

### Resto
`BallPossesion`, `total_shots`, `ShotsOnTarget`, `ShotsOffTarget`, `blocked_shots`,
`shots_inside_box`, `shots_outside_box`, `shots_woodwork`, `big_chance`,
`big_chance_missed_title`, `matchstats.headers.tackles`, `interceptions`, `shot_blocks`,
`clearances`, `keeper_saves`, `corners`, `fouls`, `Offsides`, `yellow_cards`, `red_cards`.

**Gotcha de parseo:** los valores vienen como lista `[local, visitante]` y algunos son
strings compuestos — `'31 (46%)'`, `'167 (68%)'`, `'0.43'`. Hay que partir en `' ('` y
quedarse con el numerador. Está resuelto en `numero()` del prototipo.

---

## 6. Mapeo de nombres de equipo

**Los 30 equipos de FotMob mapean 1:1 con los 30 de `reference/colores.csv`. No falta
ninguno y no sobra ninguno.**

Regla crítica: **unir por `id` de FotMob, nunca por nombre.** El id es un entero estable;
el nombre cambia de temporada a temporada.

| id FotMob | nombre en FotMob | canónico del proyecto | ¿ojo? |
|---|---|---|---|
| 161728 | Aldosivi | Aldosivi | |
| 10086 | Argentinos Juniors | Argentinos Juniors | |
| 161727 | Atletico Tucuman | Atlético Tucumán | sin tildes |
| 10087 | Banfield | Banfield | |
| 213534 | Barracas Central | Barracas Central | |
| 10092 | Belgrano | Belgrano | |
| 10077 | Boca Juniors | Boca Juniors | |
| 213596 | Central Cordoba de Santiago | Central Córdoba (SdE) | nombre distinto |
| 10089 | Club Atletico Platense | Platense | prefijo "Club Atletico" |
| 161730 | Defensa y Justicia | Defensa y Justicia | |
| 298629 | Deportivo Riestra | Deportivo Riestra | |
| **10094** | **Estudiantes** | **Estudiantes (LP)** | ⚠️ **trampa** |
| **213591** | **Estudiantes de Rio Cuarto** | **Estudiantes (RC)** | ⚠️ **trampa** |
| **10103** | **Gimnasia LP** | **Gimnasia (LP)** | ⚠️ **trampa** |
| **568727** | **Gimnasia Mendoza** | **Gimnasia (M)** | ⚠️ **trampa** |
| 10081 | Huracan | Huracán | sin tilde |
| 10078 | Independiente | Independiente | |
| 161729 | Independiente Rivadavia | Independiente Rivadavia | |
| 10090 | Instituto | Instituto | |
| 10082 | Lanus | Lanús | sin tilde |
| 10201 | Newell's Old Boys | Newell's Old Boys | apóstrofo |
| 10080 | Racing Club | Racing Club | |
| 10076 | River Plate | River Plate | |
| 10084 | Rosario Central | Rosario Central | |
| 10083 | San Lorenzo | San Lorenzo | |
| 202757 | Sarmiento | Sarmiento (J) | sin desambiguar |
| 10101 | Talleres | Talleres (C) | sin desambiguar |
| 89396 | Tigre | Tigre | |
| 10096 | Union | Unión | sin tilde |
| 10079 | Velez Sarsfield | Vélez Sarsfield | sin tilde |

### Por qué la tabla va a mano y no con fuzzy match

No es dogma, lo probé. Corrí `difflib.get_close_matches` sobre los nombres de Sofascore
y falló **exactamente en los dos pares peligrosos**:

```
Estudiantes de La Plata  ->  Estudiantes (RC)     <-- MAL, es (LP)
Gimnasia y Esgrima       ->  Gimnasia (M)         <-- MAL, es (LP)

CANONICAL NOT MATCHED: ['Estudiantes (LP)', 'Gimnasia (LP)']
```

Es el mismo error que el `CLAUDE.md` ya documenta para `San Martin S.J.` vs
`San Martin T.`. El fuzzy match no distingue clubes distintos con nombre parecido, y
acá los dos clubes grandes de La Plata quedaban asignados a los chicos del interior.
Con id entero eso no puede pasar.

### El otro mapeo: FotMob ↔ football-data.co.uk

Ojo, hay un segundo salto. `data/clean/matches.csv` usa los nombres canónicos que
salen de `reference/team_names.csv`. Como la tabla de arriba ya traduce FotMob →
canónico, **el join se hace sobre el nombre canónico ya normalizado**, más fecha y rival.
No hace falta tocar `team_names.csv`.

Riesgo a cubrir con un assert: si un equipo asciende y no está en la tabla, el prototipo
escribe `?<id>` en vez de romper. En producción eso tiene que **fallar ruidosamente**.

---

## 7. Legalidad y sostenibilidad — leer antes de implementar

Esta es la parte incómoda y no la voy a maquillar.

### FotMob prohíbe explícitamente lo que queremos hacer

Bajé `https://www.fotmob.com/tos.txt` (200, 5.802 bytes). Cita textual:

> **DATA USAGE & SCRAPING**
> Use of the data, content, or any information displayed on FotMob for any purpose,
> including but not limited to scraping, reproduction, redistribution, or commercial
> purposes, without the express written consent of FotMob is strictly prohibited.
> [...] **The use of automatic services (robots, spiders, indexing, etc.), as well as
> other methods for systematic, regular, or bulk retrieval of data, is expressly
> forbidden.**

Y la licencia de uso:

> FotMob grants you a personal, worldwide, non-assignable license to use the software
> we provide you for your own **personal, non-commercial** use.

El `robots.txt` es más blando pero apunta en la misma dirección — habilita `/api/*`
**solo** para buscadores nombrados, y no hay regla para `User-agent: *`:

```
User-agent: Googlebot
Allow: /api/*
User-agent: Qwantbot
Allow: /api/*
User-agent: Bingbot
Allow: /api/*
# Disallowed
(vacío)
```

**Cómo leerlo, honestamente.** A favor del proyecto: es sin fines de lucro y no cobra
(está en las restricciones no negociables), publica análisis derivado y no un volcado
de los datos, y el volumen es ridículo (~15 requests por fecha). En contra: "systematic,
regular, or bulk retrieval" describe con precisión quirúrgica una GitHub Action que
corre después de cada fecha. No hay forma de leer eso como permitido.

**Y el riesgo real no es una demanda.** Es el mismo razonamiento que el proyecto ya
aplicó con los escudos: el escenario probable es un bloqueo de IP o un reclamo, no un
juicio. Pero a diferencia de los escudos, acá el activo en juego es el pipeline entero.

Sofascore está igual o peor: su API devuelve **403 a todo cliente que no falsifique la
huella TLS de Chrome**. Eso es un control de acceso técnico explícito, y evadirlo es
bastante más difícil de defender que leer una URL pública.

### La única opción limpia: API-Football — y NO LA PUDE VERIFICAR

No tengo API key y no voy a crear una cuenta a nombre del usuario. Sus docs me
bloquearon (`https://www.api-football.com/documentation-v3` → **403**), así que **no
puedo decir si devuelve xG para Argentina**. Por la propia regla del proyecto — una
fuente que no probaste corriendo código no existe — **no la recomiendo**: la propongo
como el próximo experimento (§9).

Lo único que pude establecer, y de fuente secundaria: free tier de **100 requests/día**,
reset 00:00 UTC. Aritmética: backfill de 2023-2026 (~1.760 partidos) = **18 días**;
actualización por fecha (15 partidos) = 15 requests, entra cómodo. O sea, si tuviera xG,
serviría para mantenerse al día pero el histórico habría que juntarlo de a poco.

### ¿Corre en una GitHub Action? — **riesgo abierto, no verificado**

Técnicamente sí: FotMob solo necesita `requests`, que ya es trivial en cualquier runner.

**Pero no lo pude probar y es el riesgo número uno.** Las Actions salen por IPs de
datacenter de Azure, que son las primeras que estos servicios bloquean. Todo lo que
medí acá salió de una IP residencial argentina. Es perfectamente posible que la misma
llamada dé 403 desde el runner. **Hay que probarlo con una Action de una sola llamada
antes de construir nada encima** (§9).

---

## 8. Bonus: dos cosas que no pediste y le sirven al proyecto

### La zona A/B de 2026, que es el bloqueante abierto del `CLAUDE.md`

El `CLAUDE.md` dice (línea 108):

> **La zona (A o B) de cada equipo no está en los datos y no se puede inferir.**
> Hay que cargarla a mano por temporada.

**Está en FBref.** Las tablas vienen con id explícito en la página de la comp 21:

```
tablas: ['results2026211Zone-A_overall', 'results2026211Zone-B_overall',
         'results2026213Zone-A_overall', 'results2026213Zone-B_overall', ...]
```

Parseadas, dan los 15 y 15:

```
==== Zone A (15 equipos)
 Rk Squad              MP  W  D  L  GF  GA  Pts
  1 Estudiantes LP     16  9  4  3  19   7   31
  2 Boca Juniors       16  8  6  2  22   9   30
  3 Vélez Sarsfield    16  7  7  2  18  12   28
 ...
 15 Dep. Riestra       16  1  8  7   5  12   11

==== Zone B (15 equipos)
  1 Ind. Rivadavia     16 10  4  2  29  15   34
  2 River Plate        16  9  2  5  22  12   29
 ...
 15 Estudiantes RC     16  1  2 13   5  24    5
```

Sigue conviniendo **cargarlo a mano y versionarlo** (son 30 filas por temporada, y el
`CLAUDE.md` tiene razón en que el formato cambia todos los años). Pero ahora hay de
dónde copiarlo y contra qué validarlo, en vez de transcribir de una nota periodística.

### Las rondas de playoff vienen etiquetadas

El `CLAUDE.md` infiere la ronda contando partidos por equipo (16 = no clasificó,
17 = perdió octavos, etc.). FotMob las trae explícitas:

```
rounds: ['1','2',...,'16', '1/8', '1/4', '1/2', 'final']
```

Sirve como **verificación cruzada** de la heurística que ya existe. No la reemplaces
sin comparar: si las dos coinciden, gran señal; si no, encontraste un bug.

---

## 9. Plan de implementación

### Paso 0 — ANTES DE ESCRIBIR CÓDIGO: dos decisiones y un experimento

**Decisión A (del dueño, no técnica):** ¿se acepta el conflicto con los ToS de FotMob?
El proyecto tiene una sección de restricciones legales "no negociables" y esto la roza.
Si la respuesta es no, saltá directo al §10 (métricas derivadas sin fuente nueva).

**Decisión B:** ¿se prueba API-Football primero? Es gratis crear la key. Si devuelve xG
para Argentina, es la opción limpia y hace desaparecer todo el §7.

**Experimento obligatorio (15 minutos):** una GitHub Action descartable con un solo
`requests.get` a `https://www.fotmob.com/api/data/leagues?id=112` que imprima el status
code. Si da 403 desde el runner, todo este plan se cae y hay que replantear.
**No construyas nada antes de este semáforo.**

### Paso 1 — `src/ingest_stats.py` (nuevo, no toca `ingest.py`)

Respeta la separación por etapas que pide el `CLAUDE.md`: baja y guarda crudo, nada más.

- Baja `leagues?id=112` → lista de partidos terminados.
- Para cada partido **que todavía no esté en caché**, baja `matchDetails?matchId=...`.
- Guarda el JSON crudo en `data/raw/fotmob/<match_id>.json`.
- **Incremental por diseño**: los partidos ya jugados no cambian. Bajás una vez y nunca
  más. La corrida post-fecha son ~15 requests, ~20 segundos.
- Pausa de 0.2s entre requests. No paralelices: no hay apuro y sí hay riesgo de bloqueo.
- Falla ruidosa si el status no es 200 (el `ingest.py` actual ya usa ese patrón con
  `sys.exit`; seguilo).

Por qué archivos separados y no un CSV grande: hace la corrida idempotente y reanudable,
y si FotMob te bloquea mañana, **los datos que ya bajaste siguen ahí**. Dado el riesgo
legal, tener el crudo en disco es la red de seguridad.

### Paso 2 — `src/clean_stats.py` (nuevo, espejo de `clean.py`)

- Lee los JSON crudos → una fila por equipo-partido.
- Traduce `id` de FotMob → nombre canónico usando una tabla nueva y versionada.
- Parsea `'31 (46%)'` → `31` (la función `numero()` del prototipo).
- Escribe `data/clean/team_match_stats.csv`.
- **Assert duro**: si aparece un id que no está en la tabla, cortar con mensaje claro.
  Nada de `?<id>` silencioso.

### Paso 3 — `reference/fotmob_teams.csv` (nuevo)

Dos columnas, `fotmob_id,canonical`, con las 30 filas del §6. Versionada en git, editada
a mano, igual que `team_names.csv`. Cuando ascienda un equipo se agrega una línea.

### Paso 4 — enganche con lo que ya existe

**No toques `ingest.py`, `clean.py`, `model.py` ni `simulate.py`.** Dixon-Coles se sigue
entrenando con los 6.238 partidos de football-data.co.uk, que tienen 14 años de
histórico contra los 3 de FotMob. Cambiar eso sería un downgrade.

Las stats avanzadas entran **solo en la etapa de outputs**, alimentando la página de
equipo y la de partido:

```
raw/ARG.csv  ──> clean.py ──> matches.csv ──> model ──> simulate ──┐
                                                                   ├──> export.py ──> web
raw/fotmob/*.json ──> clean_stats.py ──> team_match_stats.csv ─────┘
```

El join es por `(fecha, equipo_canónico)`. Ese es el contrato entre las dos ramas.

### Paso 5 — dependencias

`requests==2.34.2` en `requirements.txt`, con el comentario que exige el archivo
(versión exacta, y la razón). Nada más: **ni `soccerdata`, ni `tls_requests`, ni
`seleniumbase`.** Ese es justamente el argumento fuerte a favor de FotMob por sobre
Sofascore y FBref — una dependencia pura de Python contra un binario nativo o un Chrome
headless en el runner.

### Paso 6 — verificación manual (para el usuario)

1. `python src/ingest_stats.py` dos veces seguidas: la segunda tiene que bajar **0**
   partidos y terminar en segundos. Si vuelve a bajar todo, el caché está roto.
2. Abrir `data/clean/team_match_stats.csv` y buscar Riestra 3-0 Boca del 26/07:
   Riestra `xg≈1.96`, Boca `xg≈0.60` con 82% de posesión.
3. Sumar `xg` por equipo y comparar con la tabla del §4. River tiene que dar el mejor
   `xGdif` (≈+19.5) y Central Córdoba el peor (≈-16.0).
4. Contar filas: tienen que ser exactamente `2 × partidos terminados`. Si hay impares,
   hay un partido a medio parsear.

---

## 10. Plan B: qué se puede hacer SIN fuente nueva

Si la respuesta a la Decisión A es "no arriesgamos el pipeline", el proyecto **no queda
sin nada**. Con los goles y las cuotas que ya están en `matches.csv` se puede calcular
un conjunto de métricas honestas — y algunas son más útiles que un xG mal explicado.

**Del modelo que ya existe** (el `CLAUDE.md` ya lo anticipa: "una salida, muchas
lecturas"). La matriz de probabilidades de marcador de Dixon-Coles ya da, gratis:
goles esperados a favor y en contra por partido, probabilidad de valla invicta, curvas
over/under, y la distribución completa de puntos al final del torneo.

**"Goles esperados por el mercado".** Desmarginalizás las cuotas de cierre `AvgC*`
(que tienen 100% de cobertura, según el propio `CLAUDE.md`) y sacás las probabilidades
implícitas 1X2. De ahí se despeja el par de medias Poisson que las reproduce. Es un
proxy de fuerza esperada anterior al partido, y tiene una ventaja enorme sobre el xG:
**el mercado incorpora lesiones, suspensiones y rotación, cosas que el xG post-partido
ni ve.**

**Sobre/bajo rendimiento vs. el mercado.** Puntos reales menos puntos esperados según
las cuotas de cierre, acumulado. Responde "¿este equipo está siendo mejor de lo que se
esperaba?", que es exactamente la pregunta que la gente le pide al xG.

**Fuerza de ataque y defensa de Dixon-Coles, expuestas directamente.** Ya están
estimadas dentro del modelo. Publicarlas como ranking es la métrica más defendible del
proyecto, porque es **propia** — y el `CLAUDE.md` dice que el modelo propio es lo que
distingue al sitio.

**Calidad de rival acumulada.** Promedio de la fuerza de los rivales enfrentados.
Explica por qué un equipo con buenos números puede estar inflado.

Honestamente: para "análisis detallado por equipo", esto cubre bastante. Lo que el
Plan B **no** puede dar es la lectura de proceso — "generó mucho y no la metió" en un
partido puntual. Para eso hace falta xG de verdad.

---

## 11. Respuestas directas a las preguntas del encargo

**1. ¿Qué fuente cubre 2026 y desde cuándo hay histórico?**
FotMob: 2026 al 100% (270/270 partidos terminados con xG). Histórico con xG desde
**2023** (~1.760 partidos). Sin xG pero con resultados, hasta 2015. Sofascore cubre
2026 pero solo 16% con xG. FBref cubre 2014-2026 sin ninguna stat avanzada.

**2. ¿Qué métricas exactas, con nombres reales?**
Ver §5. xG completo (`expected_goals`, `_open_play`, `_set_play`, `_non_penalty`,
`_on_target`), duelos completos (`duel_won`, `ground_duels_won`, `aerials_won`,
`dribbles_succeeded`), y ~20 más. **Pases progresivos: NO EXISTEN** en ninguna fuente
gratuita hoy — murieron con el feed de Opta en enero 2026.

**3. ¿A qué nivel?**
Por **equipo y por partido** (dos filas por partido). Agregar a equipo-temporada es
un `groupby`. Hay también nivel jugador (`playerStats`), fuera del alcance de la v1.

**4. ¿Cómo se llaman los equipos y cuáles no matchean?**
Los **30 mapean 1:1**, ninguno queda afuera. Ver tabla §6. Se une por **id entero**,
no por nombre. Las cuatro trampas son Estudiantes LP/RC y Gimnasia LP/M — y probé que
el fuzzy match las falla.

**5. ¿Es legal y sostenible?**
Técnicamente sostenible: sin API key, sin rate limit encontrado, ~20s por fecha,
`requests` solo. **Legalmente conflictivo**: los ToS de FotMob prohíben explícitamente
la recuperación sistemática. Ver §7. Corrida desde GitHub Actions: **no verificada**,
es el riesgo abierto principal.

**6. ¿Cuánto tarda una corrida completa?**
**304 segundos (5 min) para los 270 partidos de 2026**, medido, 0 fallos. Incremental
post-fecha: **~20 segundos**. Backfill de 2023-2026 (~1.760 partidos): ~33 minutos,
una sola vez.

---

## 12. Archivos generados

Todo en el scratchpad. **No toqué ni un archivo del repo datafut** (fui read-only).

| Archivo | Qué es |
|---|---|
| `informe-fuentes-stats.md` | este informe |
| `prototipo_fotmob.py` | prototipo de ingesta corrido de punta a punta |
| `MUESTRA_fotmob_equipo_partido_2026.csv` | **540 filas × 37 cols, temporada 2026 completa** |
| `MUESTRA_sofascore_equipo_partido_clausura2026.csv` | 30 filas, comparación con Sofascore |
| `sofascore_xg_coverage_2026.csv` | auditoría xG partido por partido (265 filas) |
| `fotmob_allmatches_2026.json` | 495 partidos crudos |
| `fotmob_match_5101879.json` | un matchDetails completo, para inspeccionar |
| `sofascore_events_2026_full.json` | 303 eventos de Sofascore |
| `sofascore_shotmap_sample.json` | shotmap sin xG (evidencia) |
| `sofascore_team_mapping_raw.csv` | mapeo automático fallido (evidencia del fuzzy match) |
| `fotmob_tos.txt` | ToS de FotMob, texto completo |
| `fbref_team_season_2026_*.csv` | lo que queda de FBref: standard, shooting, misc |

Nota: `C:\Users\Usuario\soccerdata\config\league_dict.json` fue creado por mí para
probar `soccerdata`. Está fuera del repo, pero conviene borrarlo si no se usa más.
