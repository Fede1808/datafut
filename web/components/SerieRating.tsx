"use client";

import { useEffect, useRef } from "react";
import type { PartidoDeJugador } from "@/lib/club";

/**
 * El rating de un jugador partido a partido.
 *
 * Dos decisiones que no son estéticas:
 *
 * 1. Los partidos SIN rating se saltean, no se dibujan como cero. FotMob no
 *    publica rating para todos los partidos, y un cero en un eje que va de 5,5
 *    a 8,5 se leería como el peor partido de la historia en vez de como "no
 *    hay dato".
 * 2. La escala arranca en 5,5 y termina en 8,5 aunque los datos entren en un
 *    rango más chico. Si se ajustara a los datos de cada jugador, la línea de
 *    un suplente parejo se vería igual de accidentada que la de un titular
 *    irregular, y dos fichas no se podrían comparar de un vistazo.
 */
export function SerieRating({ serie }: { serie: PartidoDeJugador[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const puntos = serie.filter((s) => s.rating !== null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const cx = cv.getContext("2d");
    if (!cx) return;

    const W = cv.width;
    const H = cv.height;
    cx.clearRect(0, 0, W, H);
    cx.fillStyle = "oklch(0.19 0.03 262)";
    cx.fillRect(0, 0, W, H);

    if (!puntos.length) {
      cx.fillStyle = "oklch(0.62 0.015 262)";
      cx.font = "400 19px 'IBM Plex Mono', monospace";
      cx.textAlign = "center";
      cx.fillText("Sin rating registrado en estos partidos", W / 2, H / 2);
      return;
    }

    const valores = puntos.map((p) => p.rating as number);
    const lo = Math.min(5.5, ...valores);
    const hi = Math.max(8.5, ...valores);
    const L = 44;
    const R = 16;
    const T = 18;
    const B = 34;
    const px = (i: number) =>
      L + (puntos.length === 1 ? (W - L - R) / 2 : (i / (puntos.length - 1)) * (W - L - R));
    const py = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);

    cx.strokeStyle = "oklch(0.26 0.02 262)";
    cx.lineWidth = 1;
    cx.fillStyle = "oklch(0.55 0.015 262)";
    cx.font = "400 15px 'IBM Plex Mono', monospace";
    cx.textAlign = "right";
    for (let v = Math.ceil(lo); v <= hi; v++) {
      cx.beginPath();
      cx.moveTo(L, py(v));
      cx.lineTo(W - R, py(v));
      cx.stroke();
      cx.fillText(String(v), L - 8, py(v) + 5);
    }

    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    cx.strokeStyle = "oklch(0.34 0.02 262)";
    cx.setLineDash([5, 4]);
    cx.beginPath();
    cx.moveTo(L, py(media));
    cx.lineTo(W - R, py(media));
    cx.stroke();
    cx.setLineDash([]);

    cx.strokeStyle = "#e4b750";
    cx.lineWidth = 2.5;
    cx.lineJoin = "round";
    cx.beginPath();
    puntos.forEach((p, i) => {
      const y = py(p.rating as number);
      if (i) cx.lineTo(px(i), y);
      else cx.moveTo(px(i), y);
    });
    cx.stroke();

    // Los partidos con gol se marcan en oro y más grandes: es la información
    // que alguien busca al mirar la curva de un delantero.
    puntos.forEach((p, i) => {
      cx.beginPath();
      cx.arc(px(i), py(p.rating as number), p.goles > 0 ? 6.5 : 4.5, 0, Math.PI * 2);
      cx.fillStyle = p.goles > 0 ? "oklch(0.94 0.012 262)" : "#e4b750";
      cx.fill();
      if (p.goles > 0) {
        cx.lineWidth = 2;
        cx.strokeStyle = "#e4b750";
        cx.stroke();
      }
    });

    cx.fillStyle = "oklch(0.62 0.015 262)";
    cx.font = "400 14px 'IBM Plex Mono', monospace";
    cx.textAlign = "center";
    cx.fillText(`media ${media.toFixed(2)}`, L + 52, py(media) - 8);
    cx.textAlign = "left";
    cx.fillText(puntos[0].rival, L, H - 12);
    if (puntos.length > 1) {
      cx.textAlign = "right";
      cx.fillText(puntos[puntos.length - 1].rival, W - R, H - 12);
    }
  }, [puntos]);

  return (
    <div className="tarjeta">
      <canvas
        ref={ref}
        width={1100}
        height={240}
        className="block h-auto w-full"
        role="img"
        aria-label={
          puntos.length
            ? `Rating en ${puntos.length} partidos`
            : "Sin rating registrado"
        }
      />
    </div>
  );
}
