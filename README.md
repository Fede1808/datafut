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
pip install -r requirements.txt      # pandas y scipy
cd web && npm install                # el sitio
```

La descarga usa `urllib`, que ya viene con Python.

## Como correrlo

Siete pasos, en orden. Cada uno se puede correr solo y siempre da el mismo
resultado con los mismos datos de entrada.

```bash
python src/ingest.py    # 1. baja el CSV original y el fixture -> data/raw/
python src/clean.py     # 2. lo normaliza -> data/clean/matches.csv
python src/report.py    # 3. diagnostica -> data/clean/report.md
python src/model.py     # 4. entrena el modelo -> data/outputs/modelo.json
python src/evaluate.py  # 5. mide si sirve -> data/outputs/evaluacion.md
python src/simulate.py  # 6. simula el torneo -> data/outputs/simulacion.*
python src/export.py    # 7. arma los JSON del sitio -> web/data/
```

Y despues el sitio:

```bash
cd web
npm run dev     # http://localhost:3000
npm run build   # genera las 48 paginas estaticas
```

Tiempos: el paso 5 tarda un minuto y el 6 unos 30 segundos; el resto es
casi instantaneo.

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

**`clean.py` — normalizar.** Deja todo parejo: un solo nombre por club, una sola
forma de escribir cada temporada, y una columna que distingue liga de copa.

**`report.py` — diagnosticar.** No modifica nada, solo cuenta y muestra. Contesta
"que tenemos realmente?" antes de escribir una linea de modelo.

**`model.py` — modelar.** Le pone dos numeros a cada equipo (ataque y defensa) mas
la ventaja de local, y con eso calcula la probabilidad de cada marcador posible.
Es un Poisson bivariado con correccion de Dixon-Coles y decaimiento temporal.

**`evaluate.py` — medir.** Entrena con el pasado y predice el futuro, temporada por
temporada, y compara contra cuatro referencias. **Un modelo sin evaluacion no es un
modelo: es una opinion con decimales.**

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

## Como anda el modelo hoy

Validacion temporal 2022-2026, log loss (mas bajo es mejor):

| Modelo | Log loss |
|---|---:|
| Mercado (cuotas de las casas) | 1.0531 |
| **Dixon-Coles (este proyecto)** | **1.0664** |
| Elo simple | 1.0694 |
| Frecuencia historica | 1.0790 |
| Azar | 1.0986 |

El mercado sigue adelante por 0.0133, y esta bien que asi sea: es el consenso de
mucha gente con mucha plata en juego. Lo importante es que el modelo le gana a
todas las referencias simples, o sea que **aporta informacion real**.

Dato medido, no supuesto: se probaron vidas medias de 90 a 3000 dias y anduvo
mejor cuanto MAS larga. Olvidar rapido empeora el modelo en este dataset. El
default quedo en 1800 dias.

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
│   ├── raw/               CSV original y fixture
│   ├── clean/             matches.csv + report.md
│   └── outputs/           modelo.json, simulacion.*
├── docs/                  decisiones y handoff de diseno
├── reference/                                        (SI se versiona)
│   ├── team_names.csv     tabla de nombres
│   ├── zonas.csv          que equipo en que zona
│   ├── colores.csv        los dos colores de cada club
│   └── formato-torneos.md como se juega el torneo
├── src/
│   ├── ingest.py · clean.py · report.py
│   ├── model.py · evaluate.py · simulate.py
│   └── export.py
└── web/                   el sitio (Next.js)
    ├── app/               las rutas del sitio
    ├── components/        Chip · BarraProb · FilaPartido
    ├── lib/datos.ts       lee los JSON
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

## Estado

Hecho: pipeline de datos, modelo, evaluacion, simulacion, sitio y actualizacion
automatica. La v1 esta completa salvo el deploy.

Pendiente:

- **Deploy en Vercel.** Conectar el repositorio y apuntar el proyecto a `web/`.
- **Elegir el nombre definitivo** y verificar dominio y handles de redes libres.
- **Generador de placas para redes** (v1.5). Lee los mismos JSON de `web/data/`.

Problemas abiertos, documentados en `CLAUDE.md` y `reference/formato-torneos.md`:

- Los cruces interzonales del Clausura no se conocen de antemano: la simulacion
  usa los 30 de la **fase regular** del Apertura con la localia invertida. Es un
  supuesto, esta marcado. Los playoffs del Apertura se descartan: son cruzados
  por construccion y si entran se hacen pasar por interzonales.
- Falta un partido de **fase regular** en el Apertura 2026 (`Estudiantes (LP)` vs
  `Lanus`, los dos de la Zona A). Los playoffs si estan completos. La fuente no es
  perfecta y conviene un chequeo automatico de completitud.
- El reglamento de descensos cambio tres veces en tres anios: **reverificar cada
  temporada** antes de calcular probabilidad de descenso.
