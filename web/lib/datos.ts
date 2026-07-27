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
import meta from "@/data/meta.json";

export type Partido = {
  local: string;
  visita: string;
  local_slug: string;
  visita_slug: string;
  prob: { local: number; empate: number; visita: number };
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

export type Equipo = {
  equipo: string;
  slug: string;
  zona: string;
  colores: [string, string];
  ataque: number;
  defensa: number;
  campeon: number;
  playoffs: number;
};

export const partidos = fecha.partidos as Partido[];
export const candidatos = titulo.equipos as EquipoTitulo[];
export const fichas = equipos.equipos as Equipo[];
export const posiciones = tabla.equipos as FilaTabla[];
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

/** Partidos que le tocan a un equipo en la fecha que viene. */
export function partidosDe(nombre: string): Partido[] {
  return partidos.filter((p) => p.local === nombre || p.visita === nombre);
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
