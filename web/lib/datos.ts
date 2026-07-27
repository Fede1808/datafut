/**
 * Lectura de los datos que genera el pipeline de Python.
 *
 * Los JSON se importan directo: Next los resuelve en tiempo de build, así que
 * el sitio sale como HTML estático, sin servidor ni base de datos. Cuando el
 * pipeline los regenera y se hace push, Vercel reconstruye y listo.
 *
 * REGLA: ningún número se escribe a mano en el código. Todo sale de acá.
 */

import fecha from "@/data/fecha.json";
import titulo from "@/data/titulo.json";
import tabla from "@/data/tabla.json";
import equipos from "@/data/equipos.json";
import escenarios from "@/data/escenarios.json";
import meta from "@/data/meta.json";

export type Tercia = { local: number; empate: number; visita: number };

export type Partido = {
  local: string;
  visita: string;
  local_slug: string;
  visita_slug: string;
  prob: Tercia;
  /**
   * Lo que dice el mercado del mismo partido: las cuotas de cierre promedio,
   * ya sin el margen de la casa. Suma 100 exacto.
   *
   * Es `null` cuando el partido todavía no abrió mercado. Pasa y no es un
   * error: la ficha muestra el número del modelo igual y omite la comparación.
   */
  implicita: Tercia | null;
  /** Modelo menos mercado, en puntos porcentuales. `null` si no hay cuotas. */
  diferencial: Tercia | null;
  goles_esperados: { local: number; visita: number };
  marcadores: { marcador: string; prob: number }[];
  menos_de_2_5: number;
  ambos_convierten: number;
  fecha: string;
  hora: string;
};

export type EquipoTitulo = {
  equipo: string;
  slug: string;
  zona: string;
  campeon: number;
  playoffs: number;
  descenso: number;
  colores: [string, string];
};

/** Una fila de la tabla de posiciones. `puesto` es dentro de la zona, no general. */
export type FilaTabla = {
  equipo: string;
  slug: string;
  zona: string;
  puesto: number;
  colores: [string, string];
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
  dif: number;
  pts: number;
};

/** Un partido de la racha, del más viejo al más nuevo. */
export type PartidoRacha = {
  r: "G" | "E" | "P";
  rival: string;
  rival_slug: string;
  gf: number;
  gc: number;
  condicion: "local" | "visita";
  fecha: string;
};

/**
 * Puntos reales contra los que esperaba el mercado, en la temporada.
 * `dif` positivo = el equipo está rindiendo por encima de lo que se esperaba.
 */
export type Rendimiento = {
  pj: number;
  pts: number;
  pts_esperados: number;
  dif: number;
};

/**
 * Histograma de puntos finales del Monte Carlo.
 * `probs[i]` es el porcentaje de simulaciones que terminaron con `desde + i`
 * puntos. Las colas de probabilidad cero vienen recortadas.
 */
export type PuntosDist = { desde: number; probs: number[] };

export type Equipo = {
  equipo: string;
  slug: string;
  zona: string;
  colores: [string, string];
  ataque: number;
  defensa: number;
  campeon: number;
  playoffs: number;
  /** Probabilidad de descender por alguna de las dos vías. Bajan dos. */
  descenso: number;
  /** Por la tabla de promedios (tres temporadas). */
  descenso_promedio: number;
  /** Por la tabla anual (Apertura + Clausura de este año). */
  descenso_anual: number;
  puntos: { promedio: number; p10: number; p50: number; p90: number };
  puntos_dist: PuntosDist;
  ultimos: PartidoRacha[];
  rendimiento: Rendimiento | null;
};

/**
 * Cómo queda el equipo según cómo le vaya en su próximo partido.
 *
 * Sale de agrupar las mismas simulaciones del Monte Carlo por el resultado de
 * ese partido, así que `campeon` y `playoffs` son probabilidades condicionales.
 * `confiable` es false cuando la rama se quedó con muy pocas simulaciones: en
 * ese caso el número es ruido de muestreo y NO se muestra.
 */
export type Rama = {
  resultado: "gana" | "empata" | "pierde";
  simulaciones: number;
  prob_resultado: number;
  campeon: number | null;
  playoffs: number | null;
  confiable: boolean;
};

export type Escenario = {
  equipo: string;
  slug: string;
  rival: string;
  rival_slug: string;
  condicion: "local" | "visita";
  fecha: string;
  hora: string;
  ramas: Rama[];
};

export const partidos = fecha.partidos as Partido[];
export const candidatos = titulo.equipos as EquipoTitulo[];
export const fichas = equipos.equipos as Equipo[];
export const posiciones = tabla.equipos as FilaTabla[];
export const listaEscenarios = escenarios.equipos as Escenario[];
export const torneo = titulo.torneo;
export const temporada = titulo.temporada;
export const metadatos = meta;

/** Cuántos entran a playoffs por zona. Define dónde va la línea de corte. */
export const clasificanPorZona = tabla.clasifican_por_zona;
export const partidosJugados = tabla.partidos_jugados;

/** Los colores de un equipo, con gris de reserva si todavía no está cargado. */
export function coloresDe(nombre: string): [string, string] {
  const f = fichas.find((e) => e.equipo === nombre);
  return f ? f.colores : ["#7c8089", "#f2f1ec"];
}

export function equipoPorSlug(slug: string): Equipo | undefined {
  return fichas.find((e) => e.slug === slug);
}

/** La tabla de una zona, ya ordenada por puesto desde el pipeline. */
export function tablaDeZona(zona: string): FilaTabla[] {
  return posiciones.filter((f) => f.zona === zona);
}

export function posicionPorSlug(slug: string): FilaTabla | undefined {
  return posiciones.find((f) => f.slug === slug);
}

/**
 * Los escenarios de un equipo, o undefined si no tiene.
 * No los tiene si no juega en la próxima fecha, o si su partido no está entre
 * los que la simulación juega (los cruces interzonales del Clausura no se
 * conocen y se suponen a partir del Apertura).
 */
export function escenariosPorSlug(slug: string): Escenario | undefined {
  return listaEscenarios.find((e) => e.slug === slug);
}

/** Partidos que le tocan a un equipo en la fecha que viene. */
export function partidosDe(nombre: string): Partido[] {
  return partidos.filter((p) => p.local === nombre || p.visita === nombre);
}

/* ------------------------------------------------------------------ *
 * Derivados
 *
 * Nada de esto agrega información nueva: son cruces de los mismos JSON.
 * El pipeline emite cada archivo por separado y el sitio los junta acá, así
 * la tabla puede mostrar probabilidades y la página de partido puede mostrar
 * qué se juega cada uno de los dos equipos.
 * ------------------------------------------------------------------ */

/**
 * El ranking de candidatos que usa el sitio.
 *
 * Sale de `equipos.json`, NO de `titulo.json`, aunque los dos traigan campeón
 * y playoffs. Motivo: `equipos.json` es el archivo con el que están calculados
 * los escenarios condicionales, así que las diferencias en puntos porcentuales
 * cierran. Si el pipeline regenera un archivo y el otro no, el sitio queda
 * consistente consigo mismo en vez de mostrar dos techos distintos en la misma
 * página. (`titulo.json` lo sigue usando la placa de OpenGraph.)
 */
export const ranking: Equipo[] = [...fichas].sort((a, b) => b.campeon - a.campeon);

/** Ataque y defensa vienen en escala logarítmica: se pasan a % sobre el promedio. */
export function ataquePct(e: Equipo): number {
  return (Math.exp(e.ataque) - 1) * 100;
}
export function defensaPct(e: Equipo): number {
  return (Math.exp(e.defensa) - 1) * 100;
}

const porAtaque = [...fichas].sort((a, b) => b.ataque - a.ataque).map((e) => e.slug);
const porDefensa = [...fichas].sort((a, b) => b.defensa - a.defensa).map((e) => e.slug);

/** Puesto del equipo en ataque entre los {@link totalEquipos}. 1 = el mejor. */
export function puestoAtaque(slug: string): number {
  return porAtaque.indexOf(slug) + 1;
}
export function puestoDefensa(slug: string): number {
  return porDefensa.indexOf(slug) + 1;
}

export const totalEquipos = fichas.length;

/**
 * Cuántos puntos sacó el equipo en su racha, sobre cuántos había en juego.
 * "10 de 18" dice más que cinco letritas: pone la racha en escala.
 */
export function puntosDeRacha(ultimos: PartidoRacha[]): {
  pts: number;
  max: number;
} {
  const pts = ultimos.reduce(
    (a, u) => a + (u.r === "G" ? 3 : u.r === "E" ? 1 : 0),
    0,
  );
  return { pts, max: ultimos.length * 3 };
}

/** Una fila de tabla con las probabilidades pegadas al lado. */
export type FilaCompleta = FilaTabla & {
  campeon: number;
  playoffs: number;
  descenso: number;
  ataque: number;
  defensa: number;
  ultimos: PartidoRacha[];
};

const indiceFichas = new Map(fichas.map((e) => [e.slug, e]));

export const posicionesCompletas: FilaCompleta[] = posiciones.map((f) => {
  const e = indiceFichas.get(f.slug);
  return {
    ...f,
    campeon: e?.campeon ?? 0,
    playoffs: e?.playoffs ?? 0,
    descenso: e?.descenso ?? 0,
    ataque: e?.ataque ?? 0,
    defensa: e?.defensa ?? 0,
    ultimos: e?.ultimos ?? [],
  };
});

export function zonas(): string[] {
  return [...new Set(posiciones.map((f) => f.zona))].sort();
}

/** Cuánto se mueve la chance de playoffs del equipo según cómo salga su partido. */
export function amplitud(e: Escenario): number {
  const v = e.ramas.map((r) => r.playoffs).filter((x): x is number => x !== null);
  return v.length ? Math.max(...v) - Math.min(...v) : 0;
}

/** Los escenarios ordenados por cuánto está en juego. Es el ranking de la fecha. */
export function escenariosPorAmplitud(): Escenario[] {
  return [...listaEscenarios].sort((a, b) => amplitud(b) - amplitud(a));
}

/** Los dos escenarios de un partido, si los hay. */
export function escenariosDelPartido(p: Partido): {
  local?: Escenario;
  visita?: Escenario;
} {
  return {
    local: escenariosPorSlug(p.local_slug),
    visita: escenariosPorSlug(p.visita_slug),
  };
}

/**
 * Formatea la fecha de actualización en horario argentino.
 * El pipeline la guarda en UTC, que es lo correcto para almacenar; la
 * conversión a horario local se hace acá, al mostrarla.
 */
export function actualizadoTexto(): string {
  return new Date(metadatos.actualizado).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
