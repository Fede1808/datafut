"use client";

import { useEffect, useRef, useState } from "react";
import type { Remate } from "@/lib/club";

/**
 * Los remates sobre la mitad de cancha rival.
 *
 * Es canvas y no SVG por una razón concreta: son 236 remates y cada uno es un
 * círculo con radio propio. En SVG eso son 236 nodos en el DOM que el
 * navegador tiene que layoutear; en canvas es un loop de dibujo. Además el
 * mapa se redibuja entero cada vez que cambia el filtro.
 *
 * SISTEMA DE COORDENADAS. Viene de FotMob tal cual, sin reproyectar: cancha de
 * 105x68 con el arco atacado a la DERECHA. Medido sobre los datos reales de
 * 2026: x va de 69,4 a 102,4 y los goles caen en x≈94,7. Si algún día los
 * puntos aparecen espejados, es que la fuente cambió de convención — no que
 * este archivo esté mal.
 */

const SITUACIONES = [
  { clave: "todos", label: "Todos" },
  { clave: "RegularPlay", label: "Jugada" },
  { clave: "FromCorner", label: "Córner" },
  { clave: "SetPiece", label: "Pelota parada" },
  { clave: "FastBreak", label: "Contraataque" },
  { clave: "goles", label: "Sólo goles" },
];

export function MapaRemates({
  remates,
  conFiltros = false,
  alto = 700,
}: {
  remates: Remate[];
  conFiltros?: boolean;
  alto?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [filtro, setFiltro] = useState("todos");

  const visibles = remates.filter((r) =>
    filtro === "todos" ? true : filtro === "goles" ? r.gol : r.situacion === filtro,
  );
  const goles = visibles.filter((r) => r.gol).length;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const cx = cv.getContext("2d");
    if (!cx) return;

    const W = cv.width;
    const H = cv.height;
    // El recorte arranca en 69 porque ningún remate registrado cae antes: si
    // se dibujara la cancha entera, la mitad del gráfico quedaría vacía.
    const X0 = 69;
    const X1 = 105.6;
    const px = (x: number) => ((x - X0) / (X1 - X0)) * (W - 70) + 35;
    const py = (y: number) => (y / 68) * (H - 70) + 35;

    cx.clearRect(0, 0, W, H);
    cx.fillStyle = "oklch(0.22 0.02 262)";
    cx.fillRect(0, 0, W, H);

    cx.strokeStyle = "oklch(0.44 0.02 262)";
    cx.lineWidth = 3;
    cx.lineJoin = "round";
    cx.strokeRect(px(X0), py(0.6), px(105) - px(X0), py(67.4) - py(0.6));
    cx.strokeRect(px(88.5), py(13.84), px(105) - px(88.5), py(54.16) - py(13.84));
    cx.strokeRect(px(99.5), py(24.84), px(105) - px(99.5), py(43.16) - py(24.84));
    cx.beginPath();
    cx.arc(px(94), py(34), 4, 0, Math.PI * 2);
    cx.fillStyle = "oklch(0.44 0.02 262)";
    cx.fill();
    cx.beginPath();
    cx.arc(px(94), py(34), px(103.15) - px(94), 2.42, 3.86);
    cx.stroke();
    cx.lineWidth = 6;
    cx.beginPath();
    cx.moveTo(px(105), py(30.34));
    cx.lineTo(px(105), py(37.66));
    cx.stroke();

    // Los goles se dibujan en la segunda pasada para que queden por encima:
    // son 24 sobre 236 y si los tapa un remate errado se pierde justo lo que
    // el gráfico tiene para contar.
    const grande = H > 420;
    for (const gol of [false, true]) {
      for (const r of visibles) {
        if (r.gol !== gol) continue;
        const radio =
          (grande ? 5 : 3) + Math.sqrt(Math.max(r.xg, 0.005)) * (grande ? 36 : 22);
        cx.beginPath();
        cx.arc(px(r.x), py(r.y), radio, 0, Math.PI * 2);
        if (r.gol) {
          cx.fillStyle = "#e4b750";
          cx.fill();
          cx.lineWidth = 3;
          cx.strokeStyle = "oklch(0.94 0.012 262)";
          cx.stroke();
        } else if (r.al_arco) {
          cx.fillStyle = "oklch(0.66 0.015 262 / 0.85)";
          cx.fill();
        } else {
          cx.fillStyle = "oklch(0.32 0.02 262 / 0.8)";
          cx.fill();
          cx.lineWidth = 1.6;
          cx.strokeStyle = "oklch(0.42 0.02 262)";
          cx.stroke();
        }
      }
    }

    cx.fillStyle = "oklch(0.62 0.015 262)";
    cx.font = "600 20px 'IBM Plex Mono', monospace";
    cx.textAlign = "left";
    cx.fillText(
      `${visibles.length} ${visibles.length === 1 ? "remate" : "remates"} · ${goles} ${
        goles === 1 ? "gol" : "goles"
      }`,
      35,
      24,
    );
  }, [visibles, goles]);

  return (
    <div>
      {conFiltros && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {SITUACIONES.map((s) => (
            <button
              key={s.clave}
              type="button"
              onClick={() => setFiltro(s.clave)}
              aria-pressed={filtro === s.clave}
              className="pestania-chica"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="tarjeta">
        <canvas
          ref={ref}
          width={1100}
          height={alto}
          className="block h-auto w-full rounded-[3px]"
          role="img"
          aria-label={`Mapa de ${visibles.length} remates, ${goles} goles`}
        />
        <div className="mt-2.5 flex flex-wrap gap-4 text-[12.5px] text-tinta2">
          <span className="flex items-center gap-2">
            <i
              className="h-3 w-3 shrink-0 rounded-full bg-acento"
              style={{ boxShadow: "0 0 0 2px oklch(0.94 0.012 262)" }}
            />
            Gol
          </span>
          <span className="flex items-center gap-2">
            <i className="h-3 w-3 shrink-0 rounded-full bg-tinta4" />
            Al arco
          </span>
          <span className="flex items-center gap-2">
            <i className="h-3 w-3 shrink-0 rounded-full border-[1.5px] border-borde" />
            Afuera o bloqueado
          </span>
          <span className="text-tinta4">El tamaño es el xG del remate</span>
        </div>
      </div>
    </div>
  );
}
