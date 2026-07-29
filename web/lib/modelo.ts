/**
 * Lectura de la auditoría del modelo.
 *
 * Todo esto sale de `src/export_modelo.py`, que a su vez sale del backtest
 * walk-forward: el modelo se reentrena de cero en cada fecha y nunca ve el
 * partido que tiene que predecir. Por eso estos números son honestos y no una
 * autoevaluación complaciente.
 */

import modelo from "@/data/modelo.json";

export type Metrica = { log_loss: number; brier: number };

export type RangoCalibracion = {
  desde: number;
  hasta: number;
  n: number;
  predicha: number;
  observada: number;
};

export type PartidoFallado = {
  fecha: string;
  local: string;
  visita: string;
  resultado: string;
  prob: { local: number; empate: number; visita: number };
  le_puso: number;
  mercado_le_puso: number;
};

export const auditoria = modelo as {
  club: string;
  partidos_evaluados: number;
  conjunto_comun: number;
  metricas: Record<"modelo" | "mercado" | "frecuencia" | "azar", Metrica>;
  contra_mercado: number;
  contra_frecuencia: number;
  calibracion: RangoCalibracion[];
  calibracion_mercado: RangoCalibracion[];
  por_temporada: { temporada: string; n: number; modelo: number; mercado: number }[];
  club_partidos: number;
  club_aciertos: number;
  club_peor: PartidoFallado | null;
  fechas: { desde: string; hasta: string };
};

/** El porcentaje de veces que el favorito del modelo terminó ganando. */
export const aciertoClub = auditoria.club_partidos
  ? (100 * auditoria.club_aciertos) / auditoria.club_partidos
  : 0;

/**
 * ¿Le gana al mercado? No, y el sitio lo dice.
 *
 * `contra_mercado` es la diferencia de log loss: negativo significa que las
 * cuotas predicen mejor que nosotros. Se expone como booleano para que la
 * página no tenga que interpretar un signo.
 */
export const leGanaAlMercado = auditoria.contra_mercado > 0;

/** ¿Le gana a tirar la frecuencia histórica? Sí. Eso es lo que prueba que el
 *  modelo aporta información y no está adivinando. */
export const aportaInformacion = auditoria.contra_frecuencia > 0;
