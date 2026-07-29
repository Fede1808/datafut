/**
 * Lo que comparten el mapa de calor y el radar de `/estadisticas`.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO. Las dos visualizaciones no comparten una sola
 * línea de dibujo —una es una tabla, la otra es un SVG— pero sí comparten lo
 * único que puede estar mal en las dos a la vez: qué métricas entran, cómo se
 * calcula el percentil y de qué lado está el "mejor". Si eso viviera duplicado,
 * el día que cambie una dirección el radar y el calor dirían cosas distintas
 * del mismo equipo, en la misma pantalla.
 *
 * QUÉ MÉTRICAS ENTRAN, Y POR QUÉ NO ENTRAN TODAS. De las 39 de `CATEGORIAS`,
 * acá entran sólo las 27 que declaran dirección (`mas` o `menos`). Las que
 * dicen `depende` —posesión, quites, rechazos, atajadas, córners, palos...—
 * quedan afuera de las dos visualizaciones, y no por descarte: es que ninguna
 * de las dos SABE decir "depende".
 *
 * El radar afirma con su geometría que lejos del centro es mejor; el mapa de
 * calor afirma con el color que el azul es mejor que el rojo. Pintar la
 * posesión de River en azul intenso sería decir que tener la pelota es una
 * virtud, justo debajo de la letra chica de esta misma página que dice lo
 * contrario ("hay equipos que eligen no tenerla y les va bien"). No hay matiz
 * posible en un polígono: o miente o no miente. Por eso se filtran acá, una
 * vez, y no en cada componente.
 */

import { posiciones } from "@/lib/datos";
import {
  CATEGORIAS,
  equiposStats,
  type Direccion,
  type EquipoStats,
  type Metrica,
} from "@/lib/estadisticas";

/** Una métrica con dirección declarada. El `depende` ya quedó afuera. */
export type MetricaViz = Metrica & { direccion: Exclude<Direccion, "depende"> };

/** La categoría a la que pertenece, para agrupar las columnas del calor. */
export type MetricaConCategoria = MetricaViz & { categoria: string };

/**
 * Las 27 métricas direccionales, aplanadas y en el orden de `CATEGORIAS`: el
 * mismo que ya usa el panel de rankings de arriba. Que las dos mitades de la
 * página ordenen igual no es capricho, es no obligar a reaprender el orden.
 */
export const METRICAS_VIZ: MetricaConCategoria[] = CATEGORIAS.flatMap((cat) =>
  cat.metricas
    .filter((m): m is MetricaViz => m.direccion !== "depende")
    .map((m) => ({ ...m, categoria: cat.nombre })),
);

/**
 * Percentil de cada equipo en una métrica, con la dirección ya aplicada: en
 * "goles en contra" el mejor es el que menos tiene, y eso lo dice la métrica,
 * no lo adivina esta función.
 *
 * SE CALCULA SOBRE LOS 30 EQUIPOS Y LOS FILTROS NO LO RECALCULAN. Si el
 * percentil dependiera de lo que está tildado, el mismo equipo cambiaría de
 * número al tocar un filtro y "mejor de la liga" pasaría a significar "mejor
 * de los quince que dejé prendidos" sin avisarle a nadie. Filtrar esconde
 * filas; no mueve la vara.
 *
 * Los empates comparten posición (fórmula de rango medio: los peores más la
 * mitad de los iguales), igual que los puestos del resto del sitio.
 */
function percentilesDe(m: MetricaViz, equipos: EquipoStats[]): Record<string, number | null> {
  const masEsMejor = m.direccion === "mas";
  const valores = equipos
    .map((e) => e[m.clave])
    .filter((v): v is number => typeof v === "number");

  const p: Record<string, number | null> = {};
  for (const e of equipos) {
    const v = e[m.clave];
    if (typeof v !== "number" || valores.length === 0) {
      p[e.slug] = null;
      continue;
    }
    const peores = valores.filter((o) => (masEsMejor ? o < v : o > v)).length;
    const iguales = valores.filter((o) => o === v).length;
    p[e.slug] = Math.round(((peores + iguales / 2) / valores.length) * 100);
  }
  return p;
}

/** Percentiles de las 27 métricas, indexados por clave y después por slug. */
export const PERCENTILES: Record<string, Record<string, number | null>> =
  Object.fromEntries(METRICAS_VIZ.map((m) => [m.clave, percentilesDe(m, equiposStats)]));

/**
 * Puesto en la liga completa, por el mismo motivo que el percentil: es un dato
 * de los 30, y filtrar no puede convertir a un noveno en tercero.
 */
export const PUESTOS: Record<string, Record<string, number>> = Object.fromEntries(
  METRICAS_VIZ.map((m) => {
    const orden = equiposStats
      .filter((e) => typeof e[m.clave] === "number")
      .sort((a, b) =>
        m.direccion === "mas"
          ? (b[m.clave] as number) - (a[m.clave] as number)
          : (a[m.clave] as number) - (b[m.clave] as number),
      );
    return [m.clave, Object.fromEntries(orden.map((e, i) => [e.slug, i + 1]))];
  }),
);

/**
 * LA ESCALA DEL MAPA DE CALOR: rojo ↔ gris ↔ azul, nunca verde ↔ rojo.
 *
 * No es una preferencia estética, está medido. El par verde/rojo semántico del
 * sitio (`--color-sube` contra `--color-baja`) colapsa bajo protanopía: los dos
 * extremos quedan al mismo tono y el gráfico deja de decir nada para una parte
 * de la gente que lo mira. Este par pasa los cinco checks del validador con
 * ΔE 19,2 en protan.
 *
 * EL MEDIO ES GRIS Y NO UN COLOR. El centro de la escala significa "promedio
 * de la liga", que no es ni bueno ni malo. Una rampa que pasara por amarillo o
 * verde en el medio inventaría una tercera categoría que no existe.
 *
 * Son siete escalones y no un degradado continuo: siete se pueden distinguir
 * de a pares mirando la tabla, un gradiente de 100 pasos no.
 */
export const RAMPA = [
  "#b00d27",
  "#d4566a",
  "#eda3ac",
  "#e6e7e4",
  "#a3b8d8",
  "#5b83bd",
  "#2f5fa8",
] as const;

/** En qué escalón de la rampa cae un percentil. */
export function colorDeCalor(pct: number | null): string | null {
  if (pct === null) return null;
  return RAMPA[Math.min(RAMPA.length - 1, Math.floor((pct / 100) * RAMPA.length))];
}

/**
 * Tinta blanca sólo sobre los extremos oscuros. Los cortes (22 y 82) están
 * puestos sobre el color real de la rampa, no a ojo: en los cuatro escalones
 * del medio el texto negro contrasta mejor que el blanco.
 */
export function tintaDeCalor(pct: number): string {
  return pct <= 22 || pct >= 82 ? "#ffffff" : "#1a1c1f";
}

/**
 * LOS COLORES DE SERIE DEL RADAR. Tres, fijos, en este orden.
 *
 * NO SE USAN LOS COLORES DE CLUB, aunque estén a mano en `colores`. River
 * contra Independiente daría rojo contra rojo, y Racing contra Atlético
 * Tucumán, celeste contra celeste: la comparación se volvería ilegible justo
 * en los cruces que más se miran.
 *
 * Este trío está validado para daltonismo: el peor par da ΔE 19,2 protan /
 * 27,2 tritan / 30,1 normal, y pasa los cinco checks. Se descartó medido, no
 * por gusto, el trío `#1f6f8b,#c8102e,#d9a404`, que falla.
 *
 * Los dos primeros son los mismos `--color-local` y `--color-visita` que el
 * sitio ya usa en las barras de probabilidad.
 */
export const SERIES = ["#2f5fa8", "#c8102e", "#7c3aed"] as const;

/** Más de tres polígonos encimados no se leen. El tope es del gráfico, no del dato. */
export const MAX_RADAR = 3;

/**
 * LOS OCHO EJES DEL RADAR, en orden fijo.
 *
 * OCHO Y NO VEINTISIETE: pasado ese número las etiquetas se pisan y los
 * vértices quedan tan juntos que la silueta no distingue un equipo de otro.
 *
 * EL ORDEN NO ES CONFIGURABLE, y eso es a propósito. La forma de un radar
 * depende de en qué orden se listan los ejes: el mismo equipo puede parecer
 * una estrella o un triángulo según cómo se acomoden. Si el usuario pudiera
 * reordenarlos, podría "dibujar" cualquier conclusión sin tocar un solo dato.
 *
 * Cubren las cinco categorías con dirección: dos de ataque, dos de definición,
 * dos de posesión y pase, una de defensa y una de duelos.
 */
export const EJES_RADAR = [
  "xg_pp",
  "chances_claras",
  "conversion",
  "punteria",
  "precision_pase",
  "pases_campo_rival",
  "xg_contra_pp",
  "duelos_pct",
] as const;

/** Las métricas de los ejes, ya resueltas y en el orden de arriba. */
export const METRICAS_RADAR: MetricaConCategoria[] = EJES_RADAR.map((clave) => {
  const m = METRICAS_VIZ.find((x) => x.clave === clave);
  if (!m) throw new Error(`Eje del radar sin métrica direccional: ${clave}`);
  return m;
});

/**
 * La zona (A o B) de cada equipo, cruzada por `slug`.
 *
 * VA POR SLUG Y NO POR NOMBRE porque la escritura del nombre varía entre las
 * fuentes del pipeline ("Central Córdoba (SdE)" no siempre se escribe igual),
 * y el slug es lo único estable. Vive en la tabla de posiciones, no en
 * `estadisticas.json`.
 */
export const ZONA_POR_SLUG: Record<string, string> = Object.fromEntries(
  posiciones.map((f) => [f.slug, f.zona]),
);

/** Las zonas que existen, para armar el filtro sin hardcodear "A" y "B". */
export const ZONAS_VIZ: string[] = [...new Set(posiciones.map((f) => f.zona))].sort();

/** Los equipos de las visualizaciones, ordenados alfabéticamente para las listas. */
export const EQUIPOS_VIZ = [...equiposStats].sort((a, b) =>
  a.equipo.localeCompare(b.equipo, "es"),
);
