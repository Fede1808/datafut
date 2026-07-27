"""
Etapa 4 del pipeline: EL MODELO (Dixon-Coles).

=============================================================================
QUE HACE ESTE ARCHIVO, EN CRIOLLO
=============================================================================

A cada equipo le ponemos dos numeros:

  ATAQUE  -> que tan bien hace goles, comparado con el promedio de la liga
  DEFENSA -> que tan bien evita recibirlos

Mas un numero global: la VENTAJA DE JUGAR DE LOCAL.

Con eso, para cualquier partido calculamos cuantos goles ESPERAMOS de cada
lado. Si el local ataca bien y el visitante defiende mal, esperamos muchos
goles del local. Esos "goles esperados" se llaman lambda y mu.

Despues convertimos esos promedios en probabilidades de cada marcador exacto
(1-0, 2-1, 0-0...) usando la distribucion de Poisson, que es la que describe
"cuantas veces pasa algo poco frecuente en un rato dado". Un gol es
exactamente eso.

Y de donde salen los numeros de ataque y defensa? NO los elegimos nosotros.
El optimizador prueba miles de combinaciones y se queda con la que mejor
explica los partidos que YA pasaron. Eso es "entrenar".

Le agregamos dos cosas que hacen la diferencia:

1) DECAIMIENTO TEMPORAL
   Los partidos viejos pesan menos que los recientes. Lo controlamos con la
   "vida media": si vale 365 dias, un partido de hace un anio pesa la mitad
   que uno de ayer, uno de hace dos anios pesa la cuarta parte, etc.
   Gracias a esto el modelo SE CORRIGE SOLO cuando lo reentrenas.

   OJO, HALLAZGO CONTRAINTUITIVO (medido, no supuesto):
   probamos vidas medias de 90 a 3000 dias y CUANTO MAS LARGA, MEJOR anduvo.

       90 d -> 1.0863     365 d -> 1.0680     1800 d -> 1.0636
      180 d -> 1.0743     800 d -> 1.0652     3000 d -> 1.0632

   O sea: olvidar rapido hace PEOR al modelo en este dataset. La explicacion
   mas probable es que cada equipo argentino juega pocos partidos por anio,
   asi que tirar el pasado deja al modelo sin datos suficientes, y la fuerza
   relativa de los equipos es bastante estable en el tiempo.

   Por eso el default es 1800 dias (unos 5 anios) y no el anio que suele
   recomendarse en la literatura. Cuando los datos y el manual no coinciden,
   gana el dato.

   IMPORTANTE: esto se midio reentrenando UNA vez por temporada. En
   produccion vamos a reentrenar despues de CADA FECHA, y ahi el decaimiento
   podria pesar mas. Hay que volver a medirlo con ese esquema.

2) LA CORRECCION DE DIXON-COLES (el parametro rho)
   Poisson por si solo asume que los goles del local y del visitante son
   independientes. En la realidad no lo son: hay menos 0-0 y mas 1-1 de los
   que Poisson predice, porque cuando un partido esta empatado y cerrado los
   equipos juegan distinto. Rho ajusta justamente los cuatro marcadores mas
   frecuentes (0-0, 1-0, 0-1, 1-1).
   Con 30% de empates en el futbol argentino, esto importa mucho.

3) SHRINKAGE (regularizacion hacia la media de la liga)
   Sin esto, el optimizador le cree DEMASIADO a los equipos con pocos
   partidos. Caso testigo real: Estudiantes (RC), con 16 partidos jugados,
   sacaba un ataque de -1.16 cuando el segundo peor de los 44 clubes estaba
   en -0.40. Traducido: el modelo afirmaba que hacen un TERCIO de los goles
   del promedio de la liga. Eso no es una medicion, es ruido de 16 partidos
   tomado como certeza.

   La solucion es agregarle al costo una multa por alejarse de 0 (que, como
   los parametros estan centrados, es exactamente el promedio de la liga):

       costo = -verosimilitud + shrinkage * suma(ataque^2 + defensa^2)

   Como la multa crece con el CUADRADO, alejarse mucho sale carisimo y
   alejarse poco sale casi gratis. Un equipo con 200 partidos tiene tanta
   evidencia que se banca la multa y se queda donde estaba; uno con 16 no,
   y lo empuja hacia el promedio. Es el comportamiento que queremos: la
   duda se refleja en el numero.

   En estadistica bayesiana esto es lo mismo que decir de entrada "creo que
   los equipos se parecen entre si" (un prior gaussiano centrado en 0).

Uso:
    python src/model.py                 entrena con todo el historico
    python src/model.py --vida-media 200
    python src/model.py --shrinkage 0   entrena sin regularizacion
"""

from pathlib import Path
import argparse
import json
import sys

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.stats import poisson

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "data" / "clean" / "matches.csv"
DESTINO = RAIZ / "data" / "outputs" / "modelo.json"

# Cuantos goles como maximo consideramos al armar la matriz de marcadores.
# La probabilidad de que un equipo haga mas de 10 goles es despreciable.
MAX_GOLES = 10

VIDA_MEDIA_DEFAULT = 1800  # dias (elegido midiendo, ver nota arriba)

# Cuanto empuja el shrinkage a los parametros hacia el promedio de la liga.
#
# DE DONDE SALE ESTE 25: no es un numero elegido a ojo. Se probo una grilla de
# 14 valores (de 0 a 500) con validacion temporal desde 2022 -entrenar solo con
# el pasado, predecir la temporada siguiente- y se midio el log loss FUERA DE
# MUESTRA. La tabla completa esta en data/outputs/tuning-shrinkage.md y se
# regenera con:  python src/evaluate.py --tunear-shrinkage
#
# La curva da en forma de U, como tiene que dar: sin shrinkage el modelo
# sobreajusta, con demasiado se vuelve ciego y todos los equipos le parecen
# iguales. El piso es una meseta plana entre 20 y 40 (las diferencias ahi son
# de 0.0001, o sea ruido). Se eligio 25 por estar en el medio de esa meseta.
#
#     0 -> 1.0664        20 -> 1.0645        100 -> 1.0666
#    10 -> 1.0650        25 -> 1.0644        500 -> 1.0741
#
# La mejora es chica en la metrica global (-0.0020 de log loss) pero real, y va
# en la misma direccion que el arreglo del parametro absurdo. No hay trade-off
# que declarar: el shrinkage predice mejor Y dice cosas menos ridiculas.
SHRINKAGE_DEFAULT = 25.0


# ---------------------------------------------------------------------------
# La correccion de Dixon-Coles
# ---------------------------------------------------------------------------
def tau(goles_local, goles_visita, lam, mu, rho):
    """
    Ajusta la probabilidad de los cuatro marcadores mas frecuentes.

    Devuelve un multiplicador: 1 significa "no toques nada", y para 0-0, 1-0,
    0-1 y 1-1 devuelve algo distinto de 1 para corregir lo que Poisson
    calcula mal.
    """
    t = np.ones_like(lam, dtype=float)

    ceros = (goles_local == 0) & (goles_visita == 0)
    uno_cero = (goles_local == 1) & (goles_visita == 0)
    cero_uno = (goles_local == 0) & (goles_visita == 1)
    unos = (goles_local == 1) & (goles_visita == 1)

    t[ceros] = 1 - lam[ceros] * mu[ceros] * rho
    t[cero_uno] = 1 + lam[cero_uno] * rho
    t[uno_cero] = 1 + mu[uno_cero] * rho
    t[unos] = 1 - rho

    # Si rho se va de rango, tau puede dar negativo y log() explota.
    # Lo cortamos en un valor chiquito pero positivo.
    return np.clip(t, 1e-10, None)


# ---------------------------------------------------------------------------
# Entrenamiento
# ---------------------------------------------------------------------------
def entrenar(partidos, vida_media=VIDA_MEDIA_DEFAULT, fecha_ref=None, verbose=True,
             shrinkage=None):
    """
    Estima ataque y defensa de cada equipo a partir de los partidos dados.

    partidos: DataFrame con home_team, away_team, home_goals, away_goals, date
    vida_media: en dias. Cuanto mas chica, mas peso a lo reciente.
    fecha_ref: desde que fecha se mide la antiguedad (por defecto, el ultimo
               partido). Importa al evaluar: hay que medir desde el momento en
               que uno "estaria parado", no desde hoy.
    shrinkage: cuanto se penaliza alejarse del promedio de la liga. 0 = sin
               regularizacion (el comportamiento viejo, que sobreajustaba a
               los equipos con pocos partidos).
    """
    if shrinkage is None:
        shrinkage = SHRINKAGE_DEFAULT
    equipos = sorted(set(partidos.home_team) | set(partidos.away_team))
    indice = {e: i for i, e in enumerate(equipos)}
    n = len(equipos)

    local = partidos.home_team.map(indice).to_numpy()
    visita = partidos.away_team.map(indice).to_numpy()
    gl = partidos.home_goals.to_numpy()
    gv = partidos.away_goals.to_numpy()

    # --- Peso de cada partido segun su antiguedad ---
    if fecha_ref is None:
        fecha_ref = partidos.date.max()
    antiguedad = (fecha_ref - partidos.date).dt.days.to_numpy()
    # 0.5 ** (dias / vida_media): a los `vida_media` dias pesa la mitad.
    pesos = 0.5 ** (antiguedad / vida_media)

    # --- Que vamos a optimizar ---
    # [ataque de cada equipo] + [defensa de cada equipo] + base + ventaja_local + rho
    def desarmar(v):
        ataque = v[:n]
        defensa = v[n:2 * n]
        base, ventaja_local, rho = v[2 * n], v[2 * n + 1], v[2 * n + 2]
        # Centrar: sin esto el modelo tiene infinitas soluciones equivalentes
        # (subir todos los ataques y bajar la base da lo mismo). Al forzar que
        # el promedio sea 0, la solucion pasa a ser unica e interpretable:
        # ataque > 0 significa "mejor que el promedio de la liga".
        return ataque - ataque.mean(), defensa - defensa.mean(), base, ventaja_local, rho

    def costo(v):
        """Lo que el optimizador trata de minimizar: el error del modelo."""
        ataque, defensa, base, ventaja_local, rho = desarmar(v)

        # Goles esperados. Se usa exp() para que nunca den negativo.
        lam = np.exp(base + ataque[local] - defensa[visita] + ventaja_local)
        mu = np.exp(base + ataque[visita] - defensa[local])

        # Que tan probable era el resultado que efectivamente paso.
        log_prob = (
            np.log(tau(gl, gv, lam, mu, rho))
            + poisson.logpmf(gl, lam)
            + poisson.logpmf(gv, mu)
        )
        # Negativo porque el optimizador MINIMIZA, y nosotros queremos
        # MAXIMIZAR la probabilidad de lo que ya paso.
        error = -np.sum(pesos * log_prob)

        # La multa por alejarse del promedio de la liga (shrinkage). Se aplica
        # sobre los parametros YA CENTRADOS, asi que "0" es literalmente el
        # promedio. Solo ataque y defensa: la base, la ventaja de local y rho
        # son parametros globales estimados con los 6.238 partidos, no tienen
        # el problema de muestra chica.
        return error + shrinkage * np.sum(ataque ** 2 + defensa ** 2)

    inicial = np.concatenate([
        np.zeros(n),        # ataques
        np.zeros(n),        # defensas
        [np.log(1.1)],      # base (~1.1 goles por equipo por partido)
        [0.25],             # ventaja de local
        [-0.05],            # rho
    ])
    limites = [(-3, 3)] * (2 * n) + [(-2, 2), (-1, 1), (-0.2, 0.2)]

    resultado = minimize(costo, inicial, method="L-BFGS-B", bounds=limites)
    ataque, defensa, base, ventaja_local, rho = desarmar(resultado.x)

    if verbose and not resultado.success:
        print(f"AVISO: el optimizador no convergio del todo -> {resultado.message}")

    return {
        "equipos": equipos,
        "ataque": dict(zip(equipos, ataque.round(4))),
        "defensa": dict(zip(equipos, defensa.round(4))),
        "base": round(float(base), 4),
        "ventaja_local": round(float(ventaja_local), 4),
        "rho": round(float(rho), 4),
        "vida_media_dias": vida_media,
        "shrinkage": shrinkage,
        "partidos_usados": len(partidos),
        "hasta": str(partidos.date.max().date()),
        "convergio": bool(resultado.success),
    }


# ---------------------------------------------------------------------------
# Predecir
# ---------------------------------------------------------------------------
def matriz_marcadores(modelo, equipo_local, equipo_visita):
    """
    Devuelve la probabilidad de CADA marcador posible.

    Fila = goles del local, columna = goles del visitante.
    Es la salida central del modelo: de aca sale todo lo demas.
    """
    a, d = modelo["ataque"], modelo["defensa"]
    for e in (equipo_local, equipo_visita):
        if e not in a:
            raise KeyError(f"El modelo no conoce a {e!r} (no jugo en el periodo entrenado)")

    lam = np.exp(modelo["base"] + a[equipo_local] - d[equipo_visita] + modelo["ventaja_local"])
    mu = np.exp(modelo["base"] + a[equipo_visita] - d[equipo_local])

    goles = np.arange(MAX_GOLES + 1)
    # Probabilidad de cada cantidad de goles, por separado...
    p_local = poisson.pmf(goles, lam)
    p_visita = poisson.pmf(goles, mu)
    # ...y combinadas en una tabla de todos contra todos.
    matriz = np.outer(p_local, p_visita)

    # Correccion de Dixon-Coles sobre los cuatro marcadores chicos.
    matriz[0, 0] *= 1 - lam * mu * modelo["rho"]
    matriz[0, 1] *= 1 + lam * modelo["rho"]
    matriz[1, 0] *= 1 + mu * modelo["rho"]
    matriz[1, 1] *= 1 - modelo["rho"]

    return matriz / matriz.sum()


def probabilidades_1x2(modelo, equipo_local, equipo_visita):
    """Probabilidad de que gane el local, empaten, o gane el visitante."""
    m = matriz_marcadores(modelo, equipo_local, equipo_visita)
    gana_local = np.tril(m, -1).sum()   # abajo de la diagonal: local hizo mas
    empate = np.trace(m)                # la diagonal: mismo numero de goles
    gana_visita = np.triu(m, 1).sum()   # arriba: visitante hizo mas
    return gana_local, empate, gana_visita


def guardar(modelo, destino=DESTINO):
    destino.parent.mkdir(parents=True, exist_ok=True)
    serializable = dict(modelo)
    serializable["ataque"] = {k: float(v) for k, v in modelo["ataque"].items()}
    serializable["defensa"] = {k: float(v) for k, v in modelo["defensa"].items()}
    destino.write_text(json.dumps(serializable, ensure_ascii=False, indent=2), encoding="utf-8")


def cargar_partidos():
    if not ORIGEN.exists():
        sys.exit(f"ERROR: no existe {ORIGEN}\n       Primero corre:  python src/clean.py")
    return pd.read_csv(ORIGEN, encoding="utf-8", parse_dates=["date"])


def main():
    ap = argparse.ArgumentParser(description="Entrena el modelo Dixon-Coles")
    ap.add_argument("--vida-media", type=int, default=VIDA_MEDIA_DEFAULT,
                    help="dias tras los cuales un partido pesa la mitad")
    ap.add_argument("--shrinkage", type=float, default=SHRINKAGE_DEFAULT,
                    help="cuanto se empuja a los equipos hacia el promedio de la liga")
    args = ap.parse_args()

    partidos = cargar_partidos()
    print(f"Entrenando con {len(partidos):,} partidos "
          f"(vida media: {args.vida_media} dias, shrinkage: {args.shrinkage})...")

    modelo = entrenar(partidos, vida_media=args.vida_media, shrinkage=args.shrinkage)
    guardar(modelo)

    print(f"OK  -> {DESTINO}")
    print(f"    ventaja de local: {modelo['ventaja_local']:+.4f} | rho: {modelo['rho']:+.4f}")
    print()

    ranking = sorted(modelo["ataque"], key=lambda e: modelo["ataque"][e] + modelo["defensa"][e],
                     reverse=True)
    print("Los 10 equipos mas fuertes segun el modelo (ataque + defensa):")
    print(f"    {'equipo':26} {'ataque':>8} {'defensa':>8}")
    for e in ranking[:10]:
        print(f"    {e:26} {modelo['ataque'][e]:+8.3f} {modelo['defensa'][e]:+8.3f}")


if __name__ == "__main__":
    main()
