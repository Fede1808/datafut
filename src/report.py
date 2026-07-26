"""
Etapa 3 del pipeline: DIAGNOSTICAR.

Este script no toca los datos: solo los mira y cuenta. Su unico trabajo es
contestar la pregunta "que tenemos realmente?" antes de escribir una linea de
modelo.

El chequeo mas importante es el 3 (partidos por equipo). Ahi es donde se ve si
una temporada fue una liga normal o si tuvo playoffs, y eso cambia por completo
como hay que simular quien sale campeon.

Uso:  python src/report.py
"""

from pathlib import Path
import sys

import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "data" / "clean" / "matches.csv"
TABLA_EQUIPOS = RAIZ / "reference" / "team_names.csv"
DESTINO = RAIZ / "data" / "clean" / "report.md"

CUOTAS = ["psch", "pscd", "psca", "avgch", "avgcd", "avgca"]


def main():
    if not ORIGEN.exists():
        sys.exit(
            f"ERROR: no existe {ORIGEN}\n"
            f"       Primero corre:  python src/clean.py"
        )

    df = pd.read_csv(ORIGEN, encoding="utf-8", parse_dates=["date"])
    lineas = []

    def escribir(texto=""):
        """Manda cada linea a la consola y al archivo, para no repetir codigo."""
        print(texto)
        lineas.append(texto)

    escribir("# Reporte de datos - datafut")
    escribir()
    escribir(f"Partidos: **{len(df):,}**  ")
    escribir(f"Periodo: {df['date'].min():%d/%m/%Y} a {df['date'].max():%d/%m/%Y}  ")
    escribir(f"Clubes distintos: **{pd.concat([df['home_team'], df['away_team']]).nunique()}**")
    escribir()

    # --- 1. Partidos por temporada y competencia ---
    escribir("## 1. Partidos por temporada")
    escribir()
    escribir("| Temporada | Liga | Copa | Total |")
    escribir("|---|---:|---:|---:|")
    tabla = df.pivot_table(
        index=["season_order", "season_id"],
        columns="competition",
        values="date",
        aggfunc="count",
        fill_value=0,
    ).sort_index()
    for (_, season), fila in tabla.iterrows():
        liga = int(fila.get("liga", 0))
        copa = int(fila.get("copa_liga", 0))
        escribir(f"| {season} | {liga} | {copa} | {liga + copa} |")
    escribir()
    escribir(f"Total liga: **{(df['competition'] == 'liga').sum():,}** | "
             f"Total copa: **{(df['competition'] == 'copa_liga').sum():,}**")
    escribir()

    # --- 2. Altas y bajas de equipos ---
    escribir("## 2. Movimiento de clubes (ascensos y descensos)")
    escribir()
    por_temporada = {}
    for (orden, season), grupo in df.groupby(["season_order", "season_id"]):
        por_temporada[orden] = (
            season,
            set(grupo["home_team"]) | set(grupo["away_team"]),
        )
    anterior = None
    for orden in sorted(por_temporada):
        season, equipos = por_temporada[orden]
        if anterior is None:
            escribir(f"- **{season}**: {len(equipos)} clubes (primera temporada del historico)")
        else:
            entran = sorted(equipos - anterior)
            salen = sorted(anterior - equipos)
            partes = [f"- **{season}**: {len(equipos)} clubes"]
            if entran:
                partes.append(f"entran: {', '.join(entran)}")
            if salen:
                partes.append(f"salen: {', '.join(salen)}")
            escribir(" | ".join(partes))
        anterior = equipos
    escribir()

    # --- 3. Formato del torneo (el chequeo clave) ---
    escribir("## 3. Formato del torneo")
    escribir()
    escribir("En una liga de todos contra todos, **todos los equipos juegan la misma")
    escribir("cantidad de partidos**. Si unos jugaron bastante mas que otros, esos partidos")
    escribir("de mas son fases eliminatorias: los que avanzaron siguieron jugando.")
    escribir()
    escribir("La columna *reparto* muestra cuantos equipos jugaron cuantos partidos, y es")
    escribir("la evidencia real. Una diferencia de 1 o 2 partidos suele ser un desempate o")
    escribir("una reprogramacion, no un playoff. Una diferencia de 4 o mas, con los equipos")
    escribir("separados en grupos, si lo es.")
    escribir()
    escribir("**Esto es un indicio, no una conclusion.** El CSV no trae ninguna columna que")
    escribir("diga a que fase pertenece cada partido, asi que el formato exacto de cada")
    escribir("temporada hay que confirmarlo aparte.")
    escribir()
    escribir("| Temporada | Equipos | Partidos | Reparto (equipos x partidos) | Dif. | Indicio |")
    escribir("|---|---:|---:|---|---:|---|")
    solo_liga = df[df["competition"] == "liga"]
    for (orden, season), grupo in solo_liga.groupby(["season_order", "season_id"]):
        conteo = pd.concat([grupo["home_team"], grupo["away_team"]]).value_counts()
        minimo, maximo = int(conteo.min()), int(conteo.max())
        diferencia = maximo - minimo

        # Cuantos equipos jugaron cada cantidad de partidos, de mayor a menor.
        reparto = conteo.value_counts().sort_index(ascending=False)
        detalle = ", ".join(f"{cant}x{part}" for part, cant in reparto.items())

        if diferencia == 0:
            indicio = "liga simetrica"
        elif diferencia <= 2:
            indicio = "casi simetrica"
        else:
            indicio = "**asimetrica -> probables playoffs**"

        escribir(f"| {season} | {conteo.size} | {len(grupo)} | {detalle} | "
                 f"{diferencia} | {indicio} |")
    escribir()

    # --- 4. Cobertura de cuotas ---
    escribir("## 4. Cobertura de cuotas")
    escribir()
    escribir("Sirve para elegir contra que baseline vamos a medir el modelo: no se puede")
    escribir("comparar contra una columna que esta vacia casi siempre.")
    escribir()
    escribir("| Columna | Con dato | Vacios | Cobertura |")
    escribir("|---|---:|---:|---:|")
    for col in CUOTAS:
        if col not in df.columns:
            continue
        vacios = int(df[col].isna().sum())
        con_dato = len(df) - vacios
        escribir(f"| {col} | {con_dato:,} | {vacios:,} | {100 * con_dato / len(df):.1f}% |")
    escribir()

    # --- 5. Integridad ---
    escribir("## 5. Chequeos de integridad")
    escribir()
    esperado = df.apply(
        lambda f: "H" if f["home_goals"] > f["away_goals"]
        else ("A" if f["away_goals"] > f["home_goals"] else "D"),
        axis=1,
    )
    inconsistentes = int((esperado != df["result"]).sum())
    duplicados = int(df.duplicated(subset=["date", "home_team", "away_team"]).sum())
    sin_goles = int(df[["home_goals", "away_goals"]].isna().sum().sum())
    mismo_equipo = int((df["home_team"] == df["away_team"]).sum())

    def marca(valor):
        return "OK" if valor == 0 else "REVISAR"

    escribir(f"- Resultado que no coincide con los goles: **{inconsistentes}** ({marca(inconsistentes)})")
    escribir(f"- Partidos duplicados (misma fecha, local y visitante): **{duplicados}** ({marca(duplicados)})")
    escribir(f"- Goles faltantes: **{sin_goles}** ({marca(sin_goles)})")
    escribir(f"- Partidos de un equipo contra si mismo: **{mismo_equipo}** ({marca(mismo_equipo)})")
    escribir()

    # --- 6. Nombres fusionados por la tabla de normalizacion ---
    escribir("## 6. Normalizacion de nombres")
    escribir()
    tabla_eq = pd.read_csv(TABLA_EQUIPOS, encoding="utf-8")
    repetidos = tabla_eq[tabla_eq.duplicated("canonical", keep=False)]
    if repetidos.empty:
        escribir("Ningun club aparecia escrito de mas de una forma.")
    else:
        escribir("Clubes que en el CSV original aparecian escritos de varias formas y que")
        escribir("la tabla unifico. Sin esto, el modelo los tomaria como equipos distintos")
        escribir("y estimaria mal la fuerza de los dos.")
        escribir()
        for canonico, grupo in repetidos.groupby("canonical"):
            crudos = " + ".join(f"`{x}`" for x in grupo["raw"])
            escribir(f"- **{canonico}** <- {crudos}")
    escribir()
    escribir(f"Nombres crudos en la tabla: {len(tabla_eq)} | "
             f"clubes reales: {tabla_eq['canonical'].nunique()}")

    DESTINO.write_text("\n".join(lineas) + "\n", encoding="utf-8")
    print()
    print(f"OK  -> reporte guardado en {DESTINO}")


if __name__ == "__main__":
    main()
