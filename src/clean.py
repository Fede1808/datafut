"""
Etapa 2 del pipeline: NORMALIZAR.

Toma el CSV crudo y lo deja parejo: mismos nombres de equipo siempre, una sola
forma de escribir cada temporada, y una columna que dice si el partido fue de
liga o de copa.

Regla central de este script: NUNCA ADIVINA.
Si aparece un equipo o una temporada que no esta en las tablas de abajo, el
script se detiene y avisa. No completa por su cuenta, no busca "el nombre mas
parecido". Un error ruidoso hoy vale mas que un dato sucio que no ves durante
seis meses.

Uso:  python src/clean.py
"""

from pathlib import Path
import sys

import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "data" / "raw" / "ARG.csv"
TABLA_EQUIPOS = RAIZ / "reference" / "team_names.csv"
DESTINO = RAIZ / "data" / "clean" / "matches.csv"


# ---------------------------------------------------------------------------
# Temporadas
# ---------------------------------------------------------------------------
# El CSV escribe las temporadas de dos formas y VA Y VUELVE entre ellas:
#   2012/2013 -> 2013/2014 -> 2014 -> 2015 -> 2016 -> 2016/2017 -> ...
# Eso pasa porque el futbol argentino cambio el calendario varias veces
# (torneos que cruzaban dos anios y torneos que empezaban y terminaban en el mismo).
#
# Por eso NO alcanza una regla del tipo "si tiene barra, partila": hay que
# escribir la tabla a mano, temporada por temporada. Es aburrido y es correcto.
#
# Ojo con un detalle facil de pasar por alto: "2016" y "2016/2017" son DOS
# temporadas distintas que arrancan el mismo anio. Por eso guardamos ademas un
# numero de orden, para poder ordenarlas cronologicamente sin ambiguedad.
#
# Formato:  original -> (etiqueta corta, anio de inicio, orden cronologico)
TEMPORADAS = {
    "2012/2013": ("2012-13", 2012, 1),
    "2013/2014": ("2013-14", 2013, 2),
    "2014":      ("2014",    2014, 3),
    "2015":      ("2015",    2015, 4),
    "2016":      ("2016",    2016, 5),
    "2016/2017": ("2016-17", 2016, 6),
    "2017/2018": ("2017-18", 2017, 7),
    "2018/2019": ("2018-19", 2018, 8),
    "2019/2020": ("2019-20", 2019, 9),
    "2020":      ("2020",    2020, 10),
    "2021":      ("2021",    2021, 11),
    "2022":      ("2022",    2022, 12),
    "2023":      ("2023",    2023, 13),
    "2024":      ("2024",    2024, 14),
    "2025":      ("2025",    2025, 15),
    "2026":      ("2026",    2026, 16),
}


# ---------------------------------------------------------------------------
# Competencias
# ---------------------------------------------------------------------------
# El campo League del CSV trae tres valores, y uno de ellos difiere del otro
# SOLO en un espacio al final ("Liga Profesional " vs "Liga Profesional").
# Para la computadora son dos cosas distintas; para nosotros son la misma.
#
# Y ojo, esto contradice lo que decia el CLAUDE.md original: la Copa de la Liga
# SI esta en el archivo, son 920 partidos mezclados con los de la liga.
COMPETENCIAS = {
    "Liga Profesional": "liga",
    "Copa De La Liga Profesional": "copa_liga",
}

# Bet365 esta vacia en el 93% de las filas (5.786 de 6.238): no sirve para nada.
# Nos quedamos con AvgC* (promedio del mercado, cobertura 100%) y PSC* (Pinnacle,
# 310 huecos). El baseline contra el que vamos a medir el modelo es AvgC*.
COLUMNAS_CUOTAS = ["PSCH", "PSCD", "PSCA", "AvgCH", "AvgCD", "AvgCA"]


def completar_con_fotmob(salida):
    """
    Agrega los partidos que ya se jugaron pero football-data todavia no publico.

    POR QUE EXISTE: football-data.co.uk publica en tandas y se atrasa. El
    27/07/2026 la primera fecha del Clausura estaba jugada entera (15 partidos)
    y el CSV tenia 3. El sitio mostraba "3 partidos jugados" y la tabla de
    posiciones quedaba mintiendo por cuatro dias hasta que la fuente se pusiera
    al dia.

    Como FotMob ya se baja para las estadisticas avanzadas, los resultados
    estan en casa. Esto los usa SOLO para tapar el hueco: football-data sigue
    siendo la fuente de verdad, y en cuanto publica un partido, el suyo manda.

    LO QUE NO TRAE: cuotas. FotMob no las tiene, asi que estas filas quedan con
    las columnas de cuotas vacias. Eso esta bien y hay que respetarlo: el
    baseline de mercado y el "modelo vs mercado" simplemente no consideran
    estos partidos hasta que football-data los publique con sus cuotas.

    EL DUPLICADO ES EL RIESGO REAL: si football-data publica manana esos mismos
    partidos, no puede quedar el partido dos veces. Se comparan por
    (local, visitante) con una tolerancia de +/-1 dia en la fecha, porque las
    dos fuentes usan husos distintos (FotMob es UTC, football-data publica en
    horario britanico) y el mismo partido puede figurar con un dia de
    diferencia.
    """
    stats = RAIZ / "data" / "clean" / "team_match_stats.csv"
    if not stats.exists():
        return salida, 0

    d = pd.read_csv(stats)
    # Una fila por partido, no dos: alcanza con la del equipo local.
    d = d[d["condicion"] == "local"].copy()
    if d.empty:
        return salida, 0
    d["date"] = pd.to_datetime(d["fecha"])

    # Los partidos que ya estan, indexados por los dos equipos. La fecha se
    # compara aparte porque necesita tolerancia.
    ya_estan = {}
    for f in salida.itertuples():
        ya_estan.setdefault((f.home_team, f.away_team), []).append(f.date)

    nuevas = []
    for f in d.itertuples():
        fechas = ya_estan.get((f.equipo, f.rival), [])
        if any(abs((fecha - f.date).days) <= 1 for fecha in fechas):
            continue  # football-data ya lo tiene: el suyo manda

        gf, gc = int(f.goles), int(f.goles_rival)
        nuevas.append({
            "date": f.date,
            "season_id": str(f.temporada),
            "season_start_year": int(f.temporada),
            # El orden cronologico lo hereda de la temporada que ya existe en la
            # tabla; si aparece una temporada nueva, que falle ruidoso.
            "season_order": TEMPORADAS[str(f.temporada)][2],
            "competition": "liga",
            "home_team": f.equipo,
            "away_team": f.rival,
            "home_goals": gf,
            "away_goals": gc,
            "result": "H" if gf > gc else ("D" if gf == gc else "A"),
        })

    if not nuevas:
        return salida, 0

    completo = pd.concat([salida, pd.DataFrame(nuevas)], ignore_index=True)
    completo = completo.sort_values(["date", "home_team"]).reset_index(drop=True)
    return completo, len(nuevas)


def cargar_tabla_equipos():
    if not TABLA_EQUIPOS.exists():
        sys.exit(f"ERROR: falta la tabla de equipos en {TABLA_EQUIPOS}")

    tabla = pd.read_csv(TABLA_EQUIPOS, encoding="utf-8")
    return dict(zip(tabla["raw"], tabla["canonical"]))


def main():
    if not ORIGEN.exists():
        sys.exit(
            f"ERROR: no existe {ORIGEN}\n"
            f"       Primero corre:  python src/ingest.py"
        )

    # utf-8-sig y no utf-8: el archivo arranca con un BOM (tres bytes invisibles
    # que Excel mete adelante). Con utf-8 a secas la primera columna se llamaria
    # '﻿Country' y cualquier acceso a 'Country' explotaria con KeyError.
    df = pd.read_csv(ORIGEN, encoding="utf-8-sig")
    print(f"Leidos {len(df):,} partidos de {ORIGEN.name}")

    # --- Competencia ---
    liga_limpia = df["League"].str.strip()
    desconocidas = sorted(set(liga_limpia) - set(COMPETENCIAS))
    if desconocidas:
        sys.exit(
            "ERROR: aparecieron competencias que no conozco:\n"
            + "\n".join(f"  - {c!r}" for c in desconocidas)
            + "\n       Agregalas al diccionario COMPETENCIAS en src/clean.py"
        )
    df["competition"] = liga_limpia.map(COMPETENCIAS)

    # --- Temporada ---
    faltantes = sorted(set(df["Season"].astype(str)) - set(TEMPORADAS))
    if faltantes:
        sys.exit(
            "ERROR: aparecieron temporadas que no estan en la tabla:\n"
            + "\n".join(f"  - {s!r}" for s in faltantes)
            + "\n       Agregalas al diccionario TEMPORADAS en src/clean.py.\n"
            "       Esto es esperable cuando arranca una temporada nueva."
        )
    temporadas = df["Season"].astype(str)
    df["season_id"] = temporadas.map(lambda s: TEMPORADAS[s][0])
    df["season_start_year"] = temporadas.map(lambda s: TEMPORADAS[s][1])
    df["season_order"] = temporadas.map(lambda s: TEMPORADAS[s][2])

    # --- Equipos ---
    equipos = cargar_tabla_equipos()
    vistos = set(df["Home"]) | set(df["Away"])
    sin_mapear = sorted(vistos - set(equipos))
    if sin_mapear:
        sys.exit(
            "ERROR: hay equipos que no estan en reference/team_names.csv:\n"
            + "\n".join(f"  - {e!r}" for e in sin_mapear)
            + "\n\n       Agregalos a mano al archivo, con su nombre canonico.\n"
            "       NO los completo yo: fusionar mal dos clubes distintos\n"
            "       (por ejemplo los dos San Martin) arruina el modelo en silencio."
        )
    df["home_team"] = df["Home"].map(equipos)
    df["away_team"] = df["Away"].map(equipos)

    # --- Fecha ---
    # dayfirst no alcanza como pista: se lo decimos explicito. Verificado que las
    # 6.238 filas usan DD/MM/YYYY.
    df["date"] = pd.to_datetime(df["Date"], format="%d/%m/%Y")

    # --- Armado final ---
    salida = pd.DataFrame({
        "date": df["date"],
        "season_id": df["season_id"],
        "season_start_year": df["season_start_year"],
        "season_order": df["season_order"],
        "competition": df["competition"],
        "home_team": df["home_team"],
        "away_team": df["away_team"],
        "home_goals": df["HG"].astype(int),
        "away_goals": df["AG"].astype(int),
        "result": df["Res"],
    })
    for col in COLUMNAS_CUOTAS:
        salida[col.lower()] = df[col]

    salida = salida.sort_values(["date", "home_team"]).reset_index(drop=True)

    # Tapa el hueco de los partidos jugados que football-data todavia no publico.
    salida, agregados = completar_con_fotmob(salida)

    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    salida.to_csv(DESTINO, index=False, encoding="utf-8")

    print(f"OK  -> {DESTINO}")
    print(f"    {len(salida):,} partidos | {salida['home_team'].nunique()} clubes "
          f"(de {len(vistos)} nombres crudos)")
    if agregados:
        print(f"    + {agregados} partidos jugados que football-data todavia no "
              f"publico, completados con FotMob (sin cuotas)")
    print(f"    liga: {(salida['competition'] == 'liga').sum():,} | "
          f"copa: {(salida['competition'] == 'copa_liga').sum():,}")


if __name__ == "__main__":
    main()
