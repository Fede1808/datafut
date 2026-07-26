# Formato del futbol argentino 2019-2026

Investigado el 26/07/2026. Este documento existe porque **el formato del torneo cambio
casi todos los anios**, y eso define como hay que simular quien sale campeon.

Cada afirmacion esta marcada segun de donde salio:

- **[DATOS]** = verificado contra `data/clean/matches.csv`. Es lo mas confiable.
- **[WEB]** = obtenido de fuentes publicas (ver el final).
- **[DUDA]** = no se pudo confirmar. No usar sin verificar.

---

## Lo unico que hay que entender

En Argentina **el campeon NO es el que mas puntos hace**. Desde 2025 se juegan dos torneos
por anio (Apertura y Clausura) y cada uno se define por **eliminacion directa**.

Simular la tabla final y ver quien queda primero **responde la pregunta equivocada**.

---

## Formato vigente: 2025 y 2026 **[WEB + DATOS]**

Dos torneos por anio, identicos en estructura:

| | |
|---|---|
| Equipos | 30 |
| Zonas | 2 de 15 |
| Fase regular | 16 partidos por equipo (14 de zona + 2 interzonales) |
| Clasifican | los 8 mejores de cada zona = 16 |
| Playoffs | octavos, cuartos, semis y final |
| Definicion | **partido unico**, sin ida y vuelta |
| Sede | las 3 primeras rondas en cancha del mejor ubicado; la final, neutral |

Total teorico por torneo: 240 (fase regular) + 15 (playoffs) = **255 partidos**.

### Comprobado contra los datos **[DATOS]**

Apertura 2025 = 255 partidos. Clausura 2025 = 255. Total = 510. **Coincide exacto.**

Y el cuadro de playoffs se puede leer contando cuantos partidos jugo cada equipo:

| Partidos | Equipos | Significa |
|---:|---:|---|
| 16 | 14 | no clasificaron |
| 17 | 8 | perdieron en octavos |
| 18 | 4 | perdieron en cuartos |
| 19 | 2 | perdieron en semifinales |
| 20 | 2 | jugaron la final |

Suma 30 equipos, y los 16 que pasaron de 16 partidos son exactamente los clasificados.

### Como separar Apertura de Clausura sin fuente externa **[DATOS]**

El CSV no dice a que torneo pertenece cada partido, pero **hay un parate largo entre los
dos**, y ese hueco alcanza para partirlos:

- 2025: **40 dias** sin jugar. Apertura 23/01 a 01/06 · Clausura 11/07 a 14/12
- 2026: **60 dias** sin jugar. Apertura 22/01 a 24/05 · Clausura arranca 23/07

Regla practica: dentro de una temporada, un hueco de mas de 30 dias separa los torneos.
Verificar cada anio; no es una ley, es una regularidad observada.

### Titulos en juego **[WEB]**

Tres campeones por anio: Apertura, Clausura y **"Campeon de Liga"** (el que mas puntos
sumo en la tabla anual, sumando los dos torneos).

### Zonas 2026 **[WEB]**

- **Zona A**: Estudiantes (LP), Boca, Velez, Talleres, Independiente, Lanus, San Lorenzo,
  Union, Instituto, Defensa y Justicia, Gimnasia (M), Platense, Central Cordoba,
  Newell's, Deportivo Riestra
- **Zona B**: Independiente Rivadavia, River, Argentinos, Rosario Central, Belgrano,
  Gimnasia (LP), Huracan, Racing, Barracas Central, Tigre, Sarmiento, Atletico Tucuman,
  Banfield, Aldosivi, Estudiantes (RC)

---

## Historia ano por ano

| Anio | Que se jugo | Equipos | Formato | Campeon |
|---|---|---:|---|---|
| 2019-20 | Superliga (ultima edicion) | 24 | liga | Boca **[WEB]** |
| 2020 | Copa de la Liga Profesional | 24 | zonas + playoffs | Boca **[WEB]** |
| 2021 | Copa de la Liga + Torneo LPF | 26 | copa: 2 zonas de 13 · liga: 25 fechas | Colon (copa) · River (liga) **[WEB]** |
| 2022 | Copa de la Liga + Torneo LPF | 28 | copa: 2 zonas de 14 · liga: 27 fechas | Boca (liga) **[WEB]** |
| 2023 | Torneo LPF + Copa de la Liga | 28 | liga: 27 fechas rueda unica | River (liga) · Rosario Central (copa) **[WEB]** |
| 2024 | Copa de la Liga + Torneo LPF | 28 | liga: 27 fechas, gana el que mas puntos suma | Estudiantes LP (copa) · Velez (liga) **[WEB]** |
| 2025 | Apertura + Clausura | 30 | zonas + playoffs | Platense (A) · Estudiantes LP (C) · Rosario Central (anual) **[WEB]** |
| 2026 | Apertura + Clausura | 30 | zonas + playoffs | Belgrano (Apertura) **[WEB + DATOS]** |

La Superliga (2017-2020) fue una liga separada de la AFA. Se disolvio y la reemplazo la
**Liga Profesional de Futbol (LPF)**, que depende de la AFA. La **Copa de la Liga
Profesional** nacio en 2020 como torneo de emergencia por la pandemia, se jugo hasta 2024
y **se elimino en 2025** al pasar al sistema Apertura/Clausura.

Confirmacion linda **[DATOS]**: el ultimo partido del Apertura 2026 en el CSV es
`24/05/2026 River Plate 2-3 Belgrano`. Esa es la final, y coincide con que Belgrano salio
campeon segun la web. Los datos y la realidad cuentan la misma historia.

---

## Descensos: el reglamento cambio TRES veces en tres anios **[WEB]**

| Anio | Cuantos descienden |
|---|---|
| hasta 2022 | 3 (dos por promedio, uno por tabla anual) |
| 2023 | **2** (se quita un descenso por promedio) |
| 2024 | **0** (suspendidos, para llegar a 30 equipos en 2025) |
| 2025 en adelante | **2** |

**Reglamento vigente (2026):** descienden dos equipos.

1. El ultimo de la **tabla de promedios** — puntos divididos partidos jugados, sobre las
   **ultimas tres temporadas** (para 2026: 2024, 2025 y 2026)
2. El ultimo de la **tabla anual** — solo la temporada en curso, sumando Apertura y Clausura

Si el mismo club queda ultimo en las dos tablas, el cupo de la tabla anual pasa al
siguiente de esa tabla.

> **Cuidado con esto.** Que el reglamento haya cambiado tres veces en tres anios significa
> que **hay que reverificarlo cada temporada antes de calcular probabilidad de descenso**.
> No dar por sentado que sigue vigente lo de arriba.

---

## Ascensos 2026 **[WEB]**

Subieron de la Primera Nacional 2025:

- **Gimnasia y Esgrima de Mendoza** — campeon. Vuelve a Primera despues de **41 anios**
- **Estudiantes de Rio Cuarto** — gano el Reducido. Vuelve despues de **40 anios**
  (su ultimo paso fue 1983-1985)

Esto confirma los dos nombres que aparecian en el CSV 2026 y sobre los que habia dudas.
Bajaron **Godoy Cruz** y **San Martin (SJ)** **[DATOS]**.

---

## Copas internacionales **[WEB]**

- Campeones del Apertura y del Clausura → **Copa Libertadores** del anio siguiente
- Los primeros de la tabla anual → Libertadores y **Copa Sudamericana**

Los cupos exactos **[DUDA]**: no se confirmo cuantos van a cada copa. Verificar antes de
calcular probabilidades de clasificacion.

---

## PROBLEMA ABIERTO: faltan partidos en el Apertura 2026 **[DATOS]**

El Apertura 2026 tiene **254 partidos** en el CSV, y por formato deberian ser **255**.

El reparto lo confirma: solo **14 equipos** superan los 16 partidos, cuando los clasificados
a playoffs son **16**.

```
2026 Apertura: 2x20, 2x19, 4x18, 6x17, 16x16
2025 Apertura: 2x20, 2x19, 4x18, 8x17, 14x16   <- asi deberia verse
                            ^^^^  ^^^^^
```

Falta al menos un partido de octavos. **Conclusion importante: la fuente no es perfecta.**
Hay que tener un chequeo automatico de completitud por temporada, y no asumir que si el
archivo bajo bien entonces esta completo.

---

## Que falta averiguar

1. **A que fase pertenece cada partido.** El CSV no lo trae. El corte Apertura/Clausura se
   puede deducir por el hueco de fechas, y la ronda de playoffs se puede inferir contando
   partidos por equipo, pero **la zona (A o B) de cada equipo no esta en los datos** y hace
   falta cargarla a mano por temporada.
2. **El partido faltante del Apertura 2026** — cual es y por que no esta.
3. **Cupos exactos** a Libertadores y Sudamericana.
4. **Formato del Clausura 2026** — confirmar que sea identico al Apertura antes de simular.

---

## Fuentes

- [Liga Profesional de Futbol - Torneo Apertura 2026](https://www.ligaprofesional.ar/torneo-apertura-2026/)
- [Wikipedia - Campeonato de Primera Division 2026 (Argentina)](https://es.wikipedia.org/wiki/Campeonato_de_Primera_Divisi%C3%B3n_2026_(Argentina))
- [Wikipedia - 2026 AFA Liga Profesional de Futbol](https://en.wikipedia.org/wiki/2026_AFA_Liga_Profesional_de_F%C3%BAtbol)
- [Wikipedia - Campeonato de Primera Division 2025 (Argentina)](https://es.wikipedia.org/wiki/Campeonato_de_Primera_Divisi%C3%B3n_2025_(Argentina))
- [Wikipedia - Copa de la Liga Profesional](https://en.wikipedia.org/wiki/Copa_de_la_Liga_Profesional)
- [Wikipedia - 2020 Copa de la Liga Profesional](https://en.wikipedia.org/wiki/2020_Copa_de_la_Liga_Profesional)
- [Wikipedia - 2025 Primera Nacional](https://en.wikipedia.org/wiki/2025_Primera_Nacional)
- [ESPN - Los grupos para la Liga Profesional 2026](https://www.espn.com.ar/futbol/argentina/nota/_/id/16067782/los-grupos-para-la-liga-profesional-2026-torneo-apertura-y-clausura)
- [ESPN - Los campeones del ano en el futbol argentino 2025](https://www.espn.com.ar/futbol/argentina/nota/_/id/16098530/campeones-del-ano-en-el-futbol-argentino-2025)
- [ESPN - La AFA aprobo la eliminacion de un descenso](https://www.espn.com.ar/futbol/argentina/nota/_/id/12224102/afa-asamblea-eliminaron-descenso-primera-votacion)
- [Infobae - La AFA confirmo la anulacion de los descensos de Primera](https://www.infobae.com/deportes/2024/10/17/la-afa-confirmo-la-anulacion-de-los-descensos-de-primera-asi-sera-la-liga-de-los-campeones-del-mundo-de-30-equipos/)
- [El Economista - Que equipos ascendieron a Primera Division 2026](https://eleconomista.com.ar/deportes/que-equipos-ascendieron-primera-division-futbol-argentino-2026-n89474)
- [El Economista - Formato, cruces y todo lo que tenes que saber](https://eleconomista.com.ar/deportes/torneo-clausura-argentina-2026-formato-cruces-n96906)
- [Diario de Cuyo - Los 30 equipos que jugaran en Primera 2026](https://www.diariodecuyo.com.ar/pasiondeportiva/quedo-definida-la-lista-de-los-30-equipos-que-jugaran-en-primera-division-la-temporada-2026-1805064.html)
