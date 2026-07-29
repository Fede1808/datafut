/**
 * Lectura de los datos del club.
 *
 * Espejo de `datos.ts`, pero para lo que produce `src/export_boca.py`. Misma
 * regla que allá: ningún número se escribe a mano, todo sale de acá.
 *
 * POR QUÉ ESTÁ SEPARADO DE `datos.ts`. Aquel lee la liga entera y lo sigue
 * haciendo: el modelo estima los 30 equipos porque la fuerza de Boca sólo
 * significa algo en relación al resto. Este archivo lee la capa de arriba —
 * plantel, remates, fichas — que sólo existe para el club. Mezclarlos haría
 * que cada página de liga cargue 141 KB de jugadores que no usa.
 */

import club from "@/data/club.json";
import { fichas, promedioLiga, type ClaveStat, type Equipo } from "@/lib/datos";

export type JugadorPlantel = {
  id: number;
  jugador: string;
  arquero: boolean;
  pj: number;
  titular: number;
  minutos: number;
  rating: number | null;
  goles: number;
  asistencias: number;
  xg: number | null;
  xa: number | null;
  remates: number;
  chances_creadas: number;
  duelos_ganados: number;
  recuperaciones: number;
};

export type PartidoDeJugador = {
  fecha: string;
  rival: string;
  condicion: string;
  minutos: number;
  rating: number | null;
  goles: number;
  asistencias: number;
};

export type FichaJugador = {
  totales: Record<string, number | null>;
  por90: Record<string, number | null>;
  serie: PartidoDeJugador[];
};

export type Remate = {
  x: number;
  y: number;
  xg: number;
  gol: boolean;
  al_arco: boolean;
  situacion: string;
  jugador_id: number | null;
  jugador: string;
  minuto: number | null;
  rival: string;
  fecha: string;
};

export const CLUB = club.club;
export const temporadaClub = club.temporada;
export const slugClub = club.slug;
export const coloresClub = (club.colores ?? ["#0A2472", "#F7D117"]) as [string, string];
export const minPartidos = club.min_partidos;
export const gruposPor90 = club.grupos_por90 as { titulo: string; metricas: string[] }[];

export const plantel = club.plantel as JugadorPlantel[];
export const fichasJugador = club.fichas as Record<string, FichaJugador>;
export const remates = club.remates as Remate[];
export const resumenRemates = club.resumen;

/** La ficha del club dentro de la salida de la liga: probabilidades, racha, stats. */
export const equipoClub = fichas.find((e) => e.equipo === CLUB) as Equipo;

/**
 * El plantel que se muestra en la tabla.
 *
 * Se corta por partidos jugados, no por minutos: un suplente que entró diez
 * minutos y metió un gol tiene números de crack y ensucia cualquier orden.
 * No se lo esconde — su ficha sigue existiendo y se llega por URL.
 */
export const planteles = plantel.filter((p) => p.pj >= minPartidos);

export function jugadorPorId(id: string | number): JugadorPlantel | undefined {
  return plantel.find((p) => String(p.id) === String(id));
}

export function fichaPorId(id: string | number): FichaJugador | undefined {
  return fichasJugador[String(id)];
}

/** Los remates de un jugador. Se cruza por id, nunca por nombre. */
export function rematesDe(id: string | number): Remate[] {
  return remates.filter((r) => String(r.jugador_id) === String(id));
}

/**
 * Dónde está el club respecto de la liga en una métrica.
 *
 * Devuelve el valor, el mínimo y el máximo de la liga, el promedio y el
 * puesto. `mejorAlto` invierte el orden para las métricas donde menos es
 * mejor (goles esperados en contra, por ejemplo): sin eso, ser el mejor
 * defensivo de la liga se mostraría como último puesto.
 */
export type Comparacion = {
  clave: ClaveStat;
  valor: number;
  min: number;
  max: number;
  promedio: number;
  puesto: number;
  total: number;
};

export function compararConLaLiga(
  clave: ClaveStat,
  mejorAlto = true,
): Comparacion | null {
  const valores = fichas
    .map((e) => e.stats?.[clave])
    .filter((v): v is number => typeof v === "number");
  const valor = equipoClub.stats?.[clave];
  if (!valores.length || typeof valor !== "number") return null;

  const orden = [...valores].sort((a, b) => (mejorAlto ? b - a : a - b));
  return {
    clave,
    valor,
    min: Math.min(...valores),
    max: Math.max(...valores),
    promedio: promedioLiga[clave],
    puesto: orden.indexOf(valor) + 1,
    total: valores.length,
  };
}
