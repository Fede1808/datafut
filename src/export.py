"""
Etapa 7 del pipeline: EXPORTAR para el sitio.

=============================================================================
QUE HACE Y POR QUE EXISTE
=============================================================================

Todo lo anterior deja archivos pensados para leer en la terminal. Este script
los junta y escribe JSON, que es lo que el sitio web puede consumir.

La regla que ordena todo el proyecto: **una fuente, dos consumidores**. Estos
mismos JSON van a alimentar despues el generador de placas para redes. Si
cada uno calculara sus propios numeros, tarde o temprano se contradirian y
publicarias dos verdades distintas el mismo dia.

Escribe seis archivos en web/data/:

  fecha.json       los partidos que se vienen, con probabilidades
  titulo.json      los 30 equipos con su chance de salir campeon
  tabla.json       la tabla de posiciones de las dos zonas
  equipos.json     ataque y defensa de cada equipo
  escenarios.json  cuanto cambia el futuro de cada equipo segun como le vaya
  meta.json        cuando se actualizo y que tan bien viene acertando el modelo

Uso:
    python src/export.py
"""

from pathlib import Path
from datetime import datetime, timezone
import json
import sys
import unicodedata

import numpy as np
import pandas as pd

from model import cargar_partidos, matriz_marcadores, probabilidades_1x2, MAX_GOLES
# La tabla se calcula en simulate.py y se importa: es la misma cuenta con la que
# arranca la simulacion. Duplicarla aca seria garantizar que en tres meses el
# sitio y el modelo muestren dos tablas distintas.
from simulate import (cargar_zonas, jugados_del_clausura, tabla_posiciones,
                      CLASIFICAN_POR_ZONA, TEMPORADA)

RAIZ = Path(__file__).resolve().parent.parent
MODELO = RAIZ / "data" / "outputs" / "modelo.json"
SIMULACION = RAIZ / "data" / "outputs" / "simulacion.json"
FIXTURES = RAIZ / "data" / "raw" / "fixtures.csv"
TABLA_EQUIPOS = RAIZ / "reference" / "team_names.csv"
COLORES = RAIZ / "reference" / "colores.csv"
SALIDA = RAIZ / "web" / "data"

# Medido con validacion temporal sobre 1.236 partidos (2024-2026).
# Se recalcula con `python src/evaluate.py`; si cambia, actualizar aca.
ACIERTO = 41.7


def slug(nombre):
    """Convierte 'Vélez Sarsfield' en 'velez-sarsfield' para usarlo en la URL."""
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFD", nombre)
        if unicodedata.category(c) != "Mn"
    )
    limpio = "".join(c if c.isalnum() else "-" for c in sin_tildes.lower())
    return "-".join(p for p in limpio.split("-") if p)


def leer_json(ruta, comando):
    if not ruta.exists():
        sys.exit(f"ERROR: no existe {ruta}\n       Primero corre:  {comando}")
    return json.loads(ruta.read_text(encoding="utf-8"))


def resumen_partido(modelo, local, visita):
    """Todo lo que el sitio necesita saber de un partido, en un solo lugar."""
    pl, pe, pv = probabilidades_1x2(modelo, local, visita)
    m = matriz_marcadores(modelo, local, visita)
    goles = np.arange(MAX_GOLES + 1)

    marcadores = sorted(
        ((m[i, j], i, j) for i in range(6) for j in range(6)), reverse=True
    )[:5]

    # Estos derivados salen todos de la misma matriz. Es la ventaja de que el
    # modelo devuelva la probabilidad de CADA marcador y no solo quien gana.
    menos_25 = float(sum(m[i, j] for i in range(11) for j in range(11) if i + j <= 2))
    ambos = float(m[1:, 1:].sum())

    return {
        "local": local,
        "visita": visita,
        "local_slug": slug(local),
        "visita_slug": slug(visita),
        "prob": {
            "local": round(100 * float(pl), 1),
            "empate": round(100 * float(pe), 1),
            "visita": round(100 * float(pv), 1),
        },
        "goles_esperados": {
            "local": round(float((goles * m.sum(axis=1)).sum()), 2),
            "visita": round(float((goles * m.sum(axis=0)).sum()), 2),
        },
        "marcadores": [
            {"marcador": f"{i}-{j}", "prob": round(100 * float(p), 1)}
            for p, i, j in marcadores
        ],
        "menos_de_2_5": round(100 * menos_25, 1),
        "ambos_convierten": round(100 * ambos, 1),
    }


def main():
    modelo = leer_json(MODELO, "python src/model.py")
    simulacion = leer_json(SIMULACION, "python src/simulate.py")

    colores = pd.read_csv(COLORES, encoding="utf-8")
    mapa_color = {r.equipo: [r.primario, r.secundario] for r in colores.itertuples()}

    nombres = pd.read_csv(TABLA_EQUIPOS, encoding="utf-8")
    canonico = dict(zip(nombres.raw, nombres.canonical))

    SALIDA.mkdir(parents=True, exist_ok=True)

    # --- 1. Los partidos que se vienen ---
    if not FIXTURES.exists():
        sys.exit(f"ERROR: no existe {FIXTURES}\n       Primero corre:  python src/ingest.py")

    fx = pd.read_csv(FIXTURES, encoding="utf-8-sig")
    fx = fx[fx.Country == "Argentina"]

    partidos, sin_datos = [], []
    for f in fx.itertuples():
        local = canonico.get(f.Home, f.Home)
        visita = canonico.get(f.Away, f.Away)
        if local not in modelo["ataque"] or visita not in modelo["ataque"]:
            sin_datos.append(f"{local} vs {visita}")
            continue
        p = resumen_partido(modelo, local, visita)
        p["fecha"] = f.Date
        p["hora"] = f.Time
        partidos.append(p)

    if sin_datos:
        print("AVISO: estos partidos se omiten porque el modelo no conoce a algun equipo:")
        for p in sin_datos:
            print(f"   - {p}")

    (SALIDA / "fecha.json").write_text(json.dumps({
        "partidos": partidos,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    # --- 2. Candidatos al titulo ---
    equipos_sim = []
    for e in simulacion["equipos"]:
        equipos_sim.append({
            **e,
            "slug": slug(e["equipo"]),
            "colores": mapa_color.get(e["equipo"], ["#7c8089", "#f2f1ec"]),
        })
    (SALIDA / "titulo.json").write_text(json.dumps({
        "torneo": simulacion["torneo"],
        "temporada": simulacion["temporada"],
        "simulaciones": simulacion["simulaciones"],
        "equipos": equipos_sim,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    zona = cargar_zonas(TEMPORADA)
    partidos_hist = cargar_partidos()

    # --- 3. La tabla de posiciones ---
    # Sin esto el sitio muestra probabilidades flotando en el aire: no se puede
    # saber si un 40% de playoffs es de un puntero o de un equipo que viene ultimo.
    jugados = jugados_del_clausura(partidos_hist)
    filas_tabla = [
        {**f,
         "slug": slug(f["equipo"]),
         "colores": mapa_color.get(f["equipo"], ["#7c8089", "#f2f1ec"])}
        for f in tabla_posiciones(jugados, zona)
    ]
    (SALIDA / "tabla.json").write_text(json.dumps({
        "torneo": simulacion["torneo"],
        "temporada": simulacion["temporada"],
        "partidos_jugados": len(jugados),
        "clasifican_por_zona": CLASIFICAN_POR_ZONA,
        "equipos": filas_tabla,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    # --- 4. Fuerza de cada equipo ---
    sim_por_equipo = {e["equipo"]: e for e in simulacion["equipos"]}

    fichas = []
    for equipo in sorted(zona):
        s = sim_por_equipo.get(equipo, {})
        fichas.append({
            "equipo": equipo,
            "slug": slug(equipo),
            "zona": zona[equipo],
            "colores": mapa_color.get(equipo, ["#7c8089", "#f2f1ec"]),
            "ataque": modelo["ataque"].get(equipo),
            "defensa": modelo["defensa"].get(equipo),
            "campeon": s.get("campeon"),
            "playoffs": s.get("playoffs"),
        })
    (SALIDA / "equipos.json").write_text(json.dumps({
        "equipos": fichas,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    # --- 5. Que se juega cada equipo en su proximo partido ---
    # El sitio ya dice "llega a playoffs: 41%", que es un numero quieto. Esto
    # contesta la pregunta que se hace el hincha de verdad: y si ganamos el
    # domingo? Sale de las MISMAS simulaciones, agrupadas segun como salio ese
    # partido; no se vuelve a simular nada.
    escenarios = [
        {**e, "slug": slug(e["equipo"]), "rival_slug": slug(e["rival"])}
        for e in simulacion.get("escenarios", [])
    ]
    (SALIDA / "escenarios.json").write_text(json.dumps({
        "simulaciones": simulacion["simulaciones"],
        "min_simulaciones_rama": simulacion.get("min_simulaciones_rama"),
        "equipos": escenarios,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    # --- 6. Metadatos: de donde salen los numeros ---
    meta = {
        "actualizado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "partidos_historicos": len(partidos_hist),
        "ultimo_partido": str(partidos_hist.date.max().date()),
        "simulaciones": simulacion["simulaciones"],
        "vida_media_dias": modelo["vida_media_dias"],
        "ventaja_local": modelo["ventaja_local"],
        # Honestidad estadistica: este numero va SIEMPRE visible en el sitio.
        # No se redondea para arriba.
        "acierto_pct": ACIERTO,
        "modelo": "Dixon-Coles + Monte Carlo",
    }

    # "actualizado" es la hora en que corrio el script, asi que cambia siempre.
    # Por si solo alcanza para que git vea un cambio y la Action commitee todos
    # los lunes aunque no se haya jugado un solo partido. Si todo el resto del
    # meta quedo igual, conservamos la marca de tiempo anterior: entonces no hay
    # diff, no hay commit, y el historial de git guarda cuando cambiaron los
    # numeros DE VERDAD. Eso es lo que despues permite medir que tan bien
    # predijo el modelo en cada momento.
    destino_meta = SALIDA / "meta.json"
    if destino_meta.exists():
        previo = json.loads(destino_meta.read_text(encoding="utf-8"))
        sin_hora = lambda m: {k: v for k, v in m.items() if k != "actualizado"}
        if sin_hora(previo) == sin_hora(meta):
            meta["actualizado"] = previo["actualizado"]

    destino_meta.write_text(json.dumps(meta, ensure_ascii=False, indent=2),
                            encoding="utf-8")

    print(f"OK  -> {SALIDA}")
    print(f"    fecha.json    {len(partidos)} partidos")
    print(f"    titulo.json   {len(equipos_sim)} equipos")
    print(f"    tabla.json    {len(filas_tabla)} equipos | {len(jugados)} partidos jugados")
    print(f"    equipos.json  {len(fichas)} equipos")
    print(f"    escenarios.json  {len(escenarios)} de {len(fichas)} equipos")
    print(f"    meta.json     acierto {ACIERTO}% | {len(partidos_hist):,} partidos historicos")


if __name__ == "__main__":
    main()
