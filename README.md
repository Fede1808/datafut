# datafut

Sitio publico con probabilidades propias sobre el futbol argentino. Un modelo
estadistico (Dixon-Coles + simulacion Monte Carlo) calcula que chances tiene cada
equipo, y se reentrena solo despues de cada fecha.

> El nombre `datafut` es provisorio.

**No es** una app de resultados en vivo, **no es** una herramienta de apuestas, y
**no es** una cuenta que regrafica datos ajenos: el modelo es propio y es el
diferencial del proyecto.

## Que necesitas

Python 3.10 o mas nuevo y Node 20 o mas nuevo.

```bash
pip install -r requirements.txt      # pandas, scipy y requests
cd web && npm install                # el sitio
```

La descarga de resultados usa `urllib`, que ya viene con Python. La de
estadisticas avanzadas usa `requests`, porque son cientos de pedidos.

## Como correrlo

Once pasos, en orden. Cada uno se puede correr solo y siempre da el mismo
resultado con los mismos datos de entrada.

```bash
python src/ingest.py          # 1. baja el CSV original y las cuotas -> data/raw/
python src/ingest_stats.py    # 1b. baja las stats de FotMob -> data/raw/fotmob/
python src/ingest_fixture.py  # 1c. baja el calendario que falta jugar (sin cache)
python src/ingest_fotos.py    # 1d. baja retratos y portada -> web/public/
python src/clean.py         # 2. lo normaliza -> data/clean/matches.csv
python src/clean_stats.py   # 2b. -> data/clean/team_match_stats.csv
python src/clean_fixture.py # 2c. -> data/clean/fixture.csv
python src/clean_players.py # 2d. -> data/clean/player_match_stats.csv + shots.csv
python src/report.py    # 3. diagnostica -> data/clean/report.md
python src/model.py     # 4. entrena el modelo -> data/outputs/modelo.json
python src/evaluate.py  # 5. mide si sirve -> data/outputs/evaluacion.md
python src/backtest.py  # 5b. backtest walk-forward, reentrena por fecha (~31 min)
python src/simulate.py  # 6. simula el torneo -> data/outputs/simulacion.*
python src/export.py      # 7. arma los JSON de la liga -> web/data/
python src/export_boca.py # 7b. arma el JSON del club -> web/data/club.json
python src/export_modelo.py # 7c. auditoria del modelo -> web/data/modelo.json
```

`export_boca.py` va **despues** de `export.py`: lee `web/data/equipos.json` para
sacar de ahi las probabilidades y la racha del club.

`ingest_fotos.py` va **despues** de `export_boca.py`: saca del `club.json` la
lista de jugadores a los que hay que bajarles el retrato.

`export_modelo.py` necesita `data/outputs/backtest-walkforward.csv`, o sea que
hay que haber corrido `backtest.py` alguna vez (tarda ~31 min). No hace falta
correrlo en cada fecha: el backtest mide el modelo, no el partido que viene.

Todo lo que se descarga como imagen queda registrado con origen, licencia y
autor en `reference/fotos.csv`. **La portada es CC BY-SA 4.0: exige atribuir al
autor en la pagina.**

Y despues el sitio:

```bash
cd web
npm run dev     # http://localhost:3000
npm run build   # genera las 48 paginas estaticas
```

Tiempos: el paso 5 tarda un minuto y el 6 unos 30 segundos; el resto es
casi instantaneo.

### Auditoria visual

Con el `npm run dev` levantado, en otra terminal:

```bash
cd web
npm run auditoria             # recorre todo el sitio y revisa
npm run auditoria -- --shots  # ademas guarda capturas
```

Recorre las pantallas en escritorio (1440px) y en celular (390px) y busca dos
cosas que NO se ven leyendo el codigo: **textos encimados o desbordados** —con
scroll horizontal del documento incluido— y **contraste por debajo de WCAG AA**,
midiendo cada texto contra el fondo que realmente tiene detras.

Sale con codigo 1 si encuentra algo nuevo. Lo que se sabe que aparece y no es un
defecto esta en la lista `CONOCIDOS` de `web/scripts/auditoria.mjs`, cada entrada
con su motivo escrito. Si una deja de tener sentido, se borra y se arregla el
problema — la lista no esta para tapar, esta para que el script sirva.

Vale la pena correrlo despues de tocar CSS, tokens de color o cualquier grilla:
lo que encontro la primera vez fue una tabla de posiciones con la columna de
puntos invisible y scroll horizontal en las dieciseis pantallas.

## Se actualiza solo

Esa es la definicion de terminado de la v1: *termina una fecha y, sin que nadie
toque nada, el sitio muestra las probabilidades nuevas*.

```
GitHub Actions (lunes 9:00 ART)
   -> corre los siete pasos del pipeline
   -> escribe los JSON en web/data/
   -> commitea y pushea si algo cambio
   -> Vercel ve el push y reconstruye el sitio
```

Ver `.github/workflows/actualizar.yml`. Si cualquier paso falla, el workflow se
corta y no commitea: **mejor dejar el sitio con datos viejos que publicar datos
rotos**.

Como cada actualizacion queda en el historial de git, con el tiempo se acumula el
registro de lo que el modelo predijo en cada momento — que es lo que despues
permite mostrar que tan bien viene acertando.

## Que hace cada etapa

**`ingest.py` — bajar.** Descarga `ARG.csv` de football-data.co.uk y lo guarda tal
cual, sin tocarlo. El dato crudo queda intacto: si manana descubrimos que limpiamos
algo mal, se corrige `clean.py` y se vuelve a correr, sin bajar nada de nuevo.

**`ingest_stats.py` — bajar las stats avanzadas.** Descarga de FotMob un JSON por
partido con xG, duelos, posesion y pases, y lo guarda crudo en `data/raw/fotmob/`.
Es incremental: un partido jugado no cambia nunca, asi que se baja una sola vez.
La corrida post-fecha son ~15 pedidos. Acepta `--temporada 2023` para el historico.

**`clean.py` — normalizar.** Deja todo parejo: un solo nombre por club, una sola
forma de escribir cada temporada, y una columna que distingue liga de copa.

**`clean_stats.py` — normalizar las stats avanzadas.** Convierte esos JSON en
`data/clean/team_match_stats.csv`, dos filas por partido (una por equipo). Traduce
los equipos por **id de FotMob**, nunca por nombre: hay cuatro homonimos
(Estudiantes LP/RC, Gimnasia LP/M) que cualquier match por parecido confunde.

Esta rama es una **capa adicional**: el modelo se sigue entrenando con los 6.238
partidos de football-data.co.uk, que tienen 14 anios de historico contra los 3 de
FotMob. Las dos ramas se juntan recien en `export.py`, por `(fecha, equipo)`.

**`report.py` — diagnosticar.** No modifica nada, solo cuenta y muestra. Contesta
"que tenemos realmente?" antes de escribir una linea de modelo.

**`model.py` — modelar.** Le pone dos numeros a cada equipo (ataque y defensa) mas
la ventaja de local, y con eso calcula la probabilidad de cada marcador posible.
Es un Poisson bivariado con correccion de Dixon-Coles y decaimiento temporal.

**`evaluate.py` — medir.** Entrena con el pasado y predice el futuro, temporada por
temporada, y compara contra cuatro referencias. **Un modelo sin evaluacion no es un
modelo: es una opinion con decimales.**

**`backtest.py` — medir en serio.** Lo mismo que `evaluate.py` pero reentrenando de
cero en CADA fecha, con corte estricto (`date < fecha`), que es como el modelo va a
vivir en produccion. Tarda 31 minutos y ese es el precio de un numero honesto.

**`simulate.py` — simular.** Juega diez mil veces el torneo que falta, con las
probabilidades del modelo, y cuenta quien salio campeon. Hace falta porque en
Argentina el campeon no es el que mas puntos hace: hay que llegar a los playoffs y
despues ganar cuatro partidos unicos.

**`export.py` — exportar.** Junta todo y escribe los JSON que consume el sitio.
La regla que ordena esto: **una fuente, dos consumidores**. Los mismos archivos van
a alimentar despues el generador de placas para redes. Si cada uno calculara sus
propios numeros, tarde o temprano publicarian dos verdades distintas el mismo dia.

## El sitio

Cinco pantallas, en `web/`:

| Ruta | Que muestra |
|---|---|
| `/` | los partidos de la fecha y, sin scrollear, quien puede salir campeon |
| `/titulo` | los 30 equipos con su chance de campeon y de playoffs |
| `/tabla` | la tabla de posiciones de las dos zonas, con la linea de corte |
| `/equipo/[slug]` | ataque, defensa y recorrido posible de un equipo |
| `/partido/[slug]` | 1X2, marcadores mas probables y goles esperados |

Next.js con generacion estatica: el build produce 48 paginas de HTML puro. Sin
servidor, sin base de datos, sin libreria de graficos — los tres componentes
visuales (barra de tres tramos, chip de color, celdas de marcadores) son CSS.

Tres decisiones que estan en el codigo y conviene no deshacer sin pensarlo:

- **La barra de probabilidad usa colores fijos, no los del club.** River vs
  Independiente son los dos rojos: con colores de equipo quedaria rojo-gris-rojo.
- **Los chips llevan borde.** Riestra y Central Cordoba son de negro y sobre el
  fondo oscuro serian invisibles; a los de blanco puro les pasa al reves.
- **Los partidos parejos se marcan.** Cinco de cada doce lo son, y de reojo un
  34/33/34 se lee igual que un 68/21/11 si nadie lo aclara.

### Escudos

Cada club se muestra con su **escudo real**, en `web/public/escudos/reales/<slug>.png`.
Los baja `python src/escudos_reales.py` desde **TheSportsDB**, que publica una API
gratuita con key de test publica (sin cuenta ni registro). Se normalizan a 128x128
y se guardan con paleta de 128 colores: los 30 juntos pesan **100 KB**, ninguno pasa
de 6 KB, y a los tamanios de uso (16px en las filas, 44px en la cabecera de equipo)
no se distingue del original.

`reference/escudos.csv` lleva una fila por club con fuente, URL de origen, licencia
y fecha de descarga. Si un escudo se reemplaza o se discute, ahi esta de donde salio.

`src/escudos.py` **sigue existiendo** y genera monogramas propios con los colores de
`reference/colores.csv` en `web/public/escudos/<slug>.svg`. No es lo que se ve: es el
fallback para cuando ascienda un club que todavia no tiene el escudo real bajado.
`Escudo.tsx` intenta real → generado → cuadradito de colores, bajando de nivel solo
si el archivo no carga.

Dos cosas que costaron y conviene no deshacer:

- **El mapeo club → escudo es una tabla de IDs numericos, no una busqueda por
  nombre.** `Estudiantes (LP)` / `Estudiantes (RC)` y `Gimnasia (LP)` / `Gimnasia (M)`
  se confunden con cualquier match por similitud de texto, y el error es silencioso:
  el sitio se ve perfecto con el escudo equivocado. Los cuatro estan verificados a
  mano contra el nombre completo de la API.
- **No hace falta fondo ni aro detras del escudo.** Se midio la luminancia de los 30
  sobre el fondo del sitio (`#12110f`): los mas oscuros son San Lorenzo, Boca y
  Newell's, y a 16px se leen bien igual gracias al contorno claro que ya traen. Los
  claros no son el problema — blanco sobre fondo oscuro es contraste alto, no bajo.

**Atribucion:** los escudos son marca registrada de cada club y se usan de forma
editorial, para identificar al equipo del que se habla. Este es un proyecto no
oficial, sin afiliacion ni aval de ningun club ni de la Liga Profesional. Los
archivos vienen de [TheSportsDB](https://www.thesportsdb.com/), base de datos
deportiva abierta y colaborativa.

## Como anda el modelo hoy

Validacion temporal 2022-2026, log loss (mas bajo es mejor):

| Modelo | Log loss |
|---|---:|
| Mercado (cuotas de las casas) | 1.0531 |
| **Dixon-Coles (este proyecto)** | **1.0644** |
| Elo simple | 1.0694 |
| Frecuencia historica | 1.0790 |
| Azar | 1.0986 |

El mercado sigue adelante por 0.0114, y esta bien que asi sea: es el consenso de
mucha gente con mucha plata en juego. Lo importante es que el modelo le gana a
todas las referencias simples, o sea que **aporta informacion real**.

Dato medido, no supuesto: se probaron vidas medias de 90 a 3000 dias y anduvo
mejor cuanto MAS larga. Olvidar rapido empeora el modelo en este dataset. El
default quedo en 1800 dias.

Tambien medido: la estimacion lleva **shrinkage** (penalizacion L2 hacia el
promedio de la liga, default 25). Sin el, un equipo con 16 partidos como
Estudiantes (RC) sacaba un ataque de -1.163 -- decia que hacia un tercio de los
goles del promedio, cuando el segundo peor de 44 clubes estaba en -0.40. Era
ruido publicado como certeza. Se probo una grilla de 0 a 500 con la misma
validacion temporal: la curva es una U con meseta plana entre 20 y 40, y el
valor quedo en el medio de esa meseta. Mejora el log loss y ademas arregla el
parametro absurdo. Evidencia completa en `docs/tuning-shrinkage.md`; se
regenera con `python src/evaluate.py --tunear-shrinkage`.

## La regla mas importante

**El pipeline nunca adivina.**

Si aparece un equipo o una temporada que no esta en las tablas de referencia,
`clean.py` se detiene y avisa cual falta. No completa por su cuenta ni busca "el
nombre mas parecido".

Y no es paranoia. En el CSV original conviven `Colon Santa FE` y `Colon Santa Fe`
(la unica diferencia es una letra en mayuscula): es el mismo club, y sin la tabla
el modelo lo tomaria como dos equipos distintos, estimando mal la fuerza de los dos.

Pero al mismo tiempo estan `San Martin S.J.` (San Juan) y `San Martin T.` (Tucuman),
que son clubes **diferentes** y hay que dejarlos separados. Los dos casos se ven
parecidos: uno hay que fusionarlo y el otro no. Ningun algoritmo automatico de
"nombres parecidos" resuelve eso bien. Por eso `reference/team_names.csv` se escribe
a mano y se versiona.

Un error ruidoso hoy vale mas que un dato sucio que no ves durante seis meses.

## Estructura

```
datafut/
├── .github/workflows/
│   └── actualizar.yml     corre el pipeline solo, cada lunes
├── data/                  intermedios del pipeline   (NO se versiona)
│   ├── raw/               CSV original, fixture y fotmob/ (un JSON por partido)
│   ├── clean/             matches.csv + report.md + team_match_stats.csv
│   └── outputs/           modelo.json, simulacion.*
├── docs/                  decisiones y handoff de diseno
├── reference/                                        (SI se versiona)
│   ├── team_names.csv     tabla de nombres
│   ├── fotmob_teams.csv   id de FotMob -> nombre canonico
│   ├── zonas.csv          que equipo en que zona
│   ├── colores.csv        los dos colores de cada club
│   ├── escudos.csv        de donde salio el escudo de cada club
│   └── formato-torneos.md como se juega el torneo
├── src/
│   ├── ingest.py · clean.py · report.py
│   ├── ingest_stats.py · clean_stats.py   la rama de stats avanzadas
│   ├── model.py · evaluate.py · simulate.py
│   ├── escudos.py         genera los escudos de fallback
│   ├── escudos_reales.py  baja los escudos reales de TheSportsDB
│   └── export.py
└── web/                   el sitio (Next.js)
    ├── app/               las rutas del sitio
    ├── components/        Escudo · BarraProb · FilaPartido
    ├── lib/datos.ts       lee los JSON
    ├── public/escudos/    generados (.svg) + reales/ (.png)  (SI se versiona)
    └── data/              JSON generados         (SI se versiona)
```

**Que se versiona y que no:** se versiona lo que **no se puede regenerar**
(`reference/`, que es trabajo manual) y lo que **necesita el deploy**
(`web/data/`, porque Vercel construye desde el repositorio). No se versiona
`data/`, que se rehace con un comando.

Ojo con un detalle que ya rompio una vez: la regla del `.gitignore` es `/data/`
con barra al principio. Sin la barra tambien matchea `web/data/`, los JSON del
sitio no llegan al repositorio y el build de Vercel falla.

## Salida

`data/clean/matches.csv`, una fila por partido:

| Columna | Que es |
|---|---|
| `date` | fecha del partido |
| `season_id` | temporada normalizada (`2016-17`, `2024`, ...) |
| `season_start_year` | anio en que arranca la temporada |
| `season_order` | orden cronologico, para ordenar sin ambiguedad |
| `competition` | `liga` o `copa_liga` |
| `home_team` / `away_team` | nombres ya normalizados |
| `home_goals` / `away_goals` | goles |
| `result` | `H` local, `D` empate, `A` visitante |
| `psch/pscd/psca` | cuotas de cierre de Pinnacle (95% de cobertura) |
| `avgch/avgcd/avgca` | promedio del mercado (100% de cobertura) |

Las cuotas de Bet365 se descartan a proposito: vienen vacias en el 93% de las filas.
El baseline contra el que se va a medir el modelo es `avgc*`.

`data/clean/team_match_stats.csv`, **dos filas por partido** (una por equipo):

| Columna | Que es |
|---|---|
| `match_id` | id del partido en FotMob |
| `fecha` | fecha UTC del partido |
| `temporada` · `torneo` · `ronda` | `2026` · `Liga Profesional Clausura` · `1` o `final` |
| `equipo` / `rival` | nombres canonicos, los mismos que `matches.csv` |
| `condicion` | `local` o `visitante` |
| `goles` / `goles_rival` | goles |
| `xg` · `xg_jugada` · `xg_pelota_parada` · `xg_sin_penales` · `xgot` | goles esperados |
| `posesion` · `remates*` · `chances_claras*` | ataque |
| `pases*` · `pelotazos_completados` · `centros_completados` · `toques_en_area_rival` | juego |
| `quites` · `intercepciones` · `bloqueos` · `rechazos` · `atajadas` | defensa |
| `duelos_ganados` · `duelos_suelo_ganados` · `duelos_aereos_ganados` · `gambetas_exitosas` | duelos |
| `faltas` · `corners` · `offsides` · `amarillas` · `rojas` | resto |

El contrato con el resto del pipeline es el join por **`(fecha, equipo)`**.

Dos cosas que hay que decir y no maquillar:

- **No hay pases progresivos.** Era una metrica de Opta y desaparecio de todas las
  fuentes gratuitas en enero de 2026. `pases_campo_rival` y `toques_en_area_rival`
  miden intencion ofensiva, no progresion, y no hay que llamarlos igual.
- **El historico con xG arranca en 2023.** Antes FotMob tiene resultados pero no
  estadisticas avanzadas.

## Estado

Hecho: pipeline de datos, modelo, evaluacion, simulacion, sitio y actualizacion
automatica. La v1 esta completa salvo el deploy.

Pendiente:

- **Deploy en Vercel.** Conectar el repositorio y apuntar el proyecto a `web/`.
- **Elegir el nombre definitivo** y verificar dominio y handles de redes libres.
- **Generador de placas para redes** (v1.5). Lee los mismos JSON de `web/data/`.

Problemas abiertos, documentados en `CLAUDE.md` y `reference/formato-torneos.md`:

- La fuente pierde partidos. Al Apertura 2026 le falto un partido de **fase
  regular** (`Estudiantes (LP)` vs `Lanus`) hasta que `clean.py` empezo a
  completar los resultados con FotMob; hoy cierra en 255. El problema de fondo
  sigue: conviene un chequeo automatico de completitud por temporada y no asumir
  que si el archivo bajo bien entonces esta completo. El fixture ya lo tiene
  (`revisar_fixture` en `src/simulate.py` avisa si algun equipo no llega a 16).
- El reglamento de descensos cambio tres veces en tres anios: **reverificar cada
  temporada** antes de calcular probabilidad de descenso.
