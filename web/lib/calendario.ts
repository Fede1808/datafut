/**
 * El torneo fecha por fecha.
 *
 * POR QUÉ ESTE ARCHIVO EXISTE APARTE DE `datos.ts`. Es el mismo criterio que
 * separó `estadisticas.ts`: `calendario.json` pesa ~135 KB y lo lee UNA sola
 * página, `/calendario`. `datos.ts` lo importa toda la navegación del sitio —
 * la portada, la tabla, el título y las 30 fichas — así que meterlo ahí sería
 * cobrarle esos kilobytes a cinco pantallas que no lo muestran.
 *
 * LO QUE ORDENA LA VISTA: se navega POR FECHA, nunca por día. La fecha es la
 * unidad del torneo (16 escalones, cada uno con los 15 partidos y los 30
 * equipos); el día es un detalle de programación de la AFA. Adentro de cada
 * fecha los partidos sí van agrupados por día, porque una fecha argentina se
 * juega en hasta cinco y verla como una lista plana pierde esa estructura.
 *
 * LOS TEXTOS DE FECHA SE ARMAN A MANO, sin `toLocaleDateString`. No es
 * capricho: esto lo consume un componente cliente, que Next además prerenderiza
 * en el servidor. Si el ICU del servidor y el del navegador escriben el mes
 * distinto, React tira un error de hidratación por una diferencia de texto que
 * nadie pidió. Con dos arrays fijos el resultado es el mismo siempre.
 */

import datos from "@/data/calendario.json";

export type Tercia = { local: number; empate: number; visita: number };

export type PartidoFecha = {
  /** Qué fecha del torneo, de 1 a 16. */
  ronda: number;
  /** El día, en ISO. Es el que agrupa y el que ordena. */
  dia: string;
  /** `null` en los ya jugados y en los postergados sin día confirmado. */
  hora: string | null;
  /** Postergado: se juega igual, pero el día de arriba es provisorio. */
  aplazado: boolean;
  local: string;
  visita: string;
  local_slug: string;
  visita_slug: string;
  colores_local: [string, string];
  colores_visita: [string, string];
  /** `null` en los ya jugados: ahí lo que se muestra es el marcador. */
  prob: Tercia | null;
  /**
   * El 1X2 es de una fecha lejana, no de la que se juega ahora. El modelo mide
   * fuerza por goles: no ve lesiones ni refuerzos hasta varias fechas después.
   */
  estimado: boolean;
  goles_local: number | null;
  goles_visita: number | null;
};

const partidos = datos.partidos as unknown as PartidoFecha[];

export const proximaRonda: number = datos.proxima_ronda;
export const torneoCalendario: string = datos.torneo;
export const temporadaCalendario: string = String(datos.temporada);

/** Un día adentro de una fecha. `dia === null` son los postergados. */
export type GrupoDia = { dia: string | null; partidos: PartidoFecha[] };

export type Fecha = {
  ronda: number;
  partidos: PartidoFecha[];
  /** Los partidos partidos por día, en orden cronológico. */
  grupos: GrupoDia[];
  /** Todos sus partidos ya se jugaron. */
  jugada: boolean;
  /** Cuántos están postergados sin día confirmado. */
  postergados: number;
  /** Es la fecha que se juega ahora. */
  proxima: boolean;
  /** Los días con fecha confirmada, en ISO y ordenados. */
  dias: string[];
};

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const MESES_CORTOS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const DIAS_SEMANA = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

/** Parte un ISO `2026-07-28` sin pasar por la zona horaria del que mire. */
function partes(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  return { a, m: m - 1, d, semana: new Date(Date.UTC(a, m - 1, d)).getUTCDay() };
}

/** `2026-07-28` → `martes 28 de julio`. Es el separador de día. */
export function diaLargo(iso: string): string {
  const p = partes(iso);
  return `${DIAS_SEMANA[p.semana]} ${p.d} de ${MESES[p.m]}`;
}

/**
 * El rango de días de una fecha, escrito como se diría en voz alta:
 * un día → «8 de noviembre», dos → «5 y 6 de septiembre», más → «23 al 26 de
 * julio». Si cruza de mes, cada punta lleva su mes.
 */
export function rangoDeDias(dias: string[]): string {
  if (dias.length === 0) return "sin día confirmado";
  const a = partes(dias[0]);
  const b = partes(dias[dias.length - 1]);
  if (dias.length === 1) return `${a.d} de ${MESES[a.m]}`;
  const nexo = dias.length === 2 ? "y" : "al";
  return a.m === b.m
    ? `${a.d} ${nexo} ${b.d} de ${MESES[a.m]}`
    : `${a.d} de ${MESES[a.m]} ${nexo} ${b.d} de ${MESES[b.m]}`;
}

/**
 * Las tres letras de abajo del número en el almanaque: en qué mes cae, o el
 * estado si tiene uno que importa más que el mes.
 */
export function etiquetaCorta(f: Fecha): string {
  if (f.jugada) return "jug";
  if (f.proxima) return "hoy";
  if (f.postergados > 0) return "s/f";
  return f.dias.length ? MESES_CORTOS[partes(f.dias[0]).m] : "s/f";
}

/** Verde = jugada, ámbar = tiene postergados. `undefined` = ninguna de las dos. */
export function estadoDeFecha(f: Fecha): "jugada" | "aplazada" | undefined {
  if (f.jugada) return "jugada";
  if (f.postergados > 0) return "aplazada";
  return undefined;
}

function agrupar(ps: PartidoFecha[]): GrupoDia[] {
  const grupos: GrupoDia[] = [];
  for (const p of ps) {
    if (p.aplazado) continue;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === p.dia) ultimo.partidos.push(p);
    else grupos.push({ dia: p.dia, partidos: [p] });
  }
  // Los postergados van al final y SIN separador de día: el día que traen es
  // provisorio y ponerlo bajo un título con nombre de día sería afirmarlo.
  const postergados = ps.filter((p) => p.aplazado);
  if (postergados.length) grupos.push({ dia: null, partidos: postergados });
  return grupos;
}

/** Las 16 fechas del torneo, en orden. */
export const FECHAS: Fecha[] = [...new Set(partidos.map((p) => p.ronda))]
  .sort((a, b) => a - b)
  .map((ronda) => {
    const ps = partidos.filter((p) => p.ronda === ronda);
    const grupos = agrupar(ps);
    return {
      ronda,
      partidos: ps,
      grupos,
      jugada: ps.every((p) => p.goles_local !== null),
      postergados: ps.filter((p) => p.aplazado).length,
      proxima: ronda === proximaRonda,
      dias: grupos.filter((g) => g.dia !== null).map((g) => g.dia as string),
    };
  });

/** El total de partidos del torneo. Se muestra en la bajada. */
export const totalPartidos = partidos.length;
