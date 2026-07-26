# datafut

Modelo estadistico propio sobre el futbol argentino. Este repo contiene, por ahora,
el pipeline de datos: bajar el historico de resultados, dejarlo prolijo y entender
que hay adentro.

> El nombre `datafut` es provisorio.

## Que necesitas

Python 3.10 o mas nuevo, y una sola libreria:

```bash
pip install -r requirements.txt
```

La descarga usa `urllib`, que ya viene con Python. No hace falta instalar nada mas.

## Como correrlo

Tres pasos, en orden. Cada uno se puede correr solo y siempre da el mismo
resultado con los mismos datos de entrada.

```bash
python src/ingest.py    # 1. baja el CSV original a data/raw/
python src/clean.py     # 2. lo normaliza y lo deja en data/clean/matches.csv
python src/report.py    # 3. genera el diagnostico en data/clean/report.md
python src/model.py     # 4. entrena el modelo -> data/outputs/modelo.json
python src/evaluate.py  # 5. mide si sirve -> data/outputs/evaluacion.md
```

Para actualizar todo despues de una fecha nueva, se corren de nuevo.
El paso 5 tarda alrededor de un minuto; los demas son casi instantaneos.

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
├── data/
│   ├── raw/            CSV original descargado    (no se versiona)
│   └── clean/          matches.csv + report.md    (no se versiona)
├── reference/
│   ├── team_names.csv        tabla de nombres     (SI se versiona)
│   └── formato-torneos.md    como se juega        (SI se versiona)
└── src/
    ├── ingest.py
    ├── clean.py
    └── report.py
```

`data/` no se versiona porque se regenera con un comando. `reference/` si, porque
es trabajo manual que no se puede reconstruir solo.

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

Hecho: ingesta, limpieza y reporte.
Siguiente: modelo Dixon-Coles. Nada de eso empieza hasta entender el reporte.
