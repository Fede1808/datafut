"use client";

import { useState } from "react";
import { Retrato } from "@/components/Retrato";
import type { FichaJugador, JugadorPlantel } from "@/lib/club";

/**
 * Dos jugadores, las mismas métricas, POR 90 MINUTOS.
 *
 * Por 90 y no en totales, y esto es lo único que hace al componente honesto: un
 * titular le gana en todas las columnas a un suplente por haber jugado más, que
 * es exactamente lo que nadie está preguntando. Dividir por minutos convierte
 * "cuánto hizo" en "cómo juega", que es lo comparable.
 *
 * La barra de cada fila se normaliza contra el MAYOR de los dos, no contra la
 * liga: acá la pregunta es quién de estos dos hace más de esto, y una escala de
 * liga aplastaría las dos barras cuando los dos están por debajo del promedio.
 *
 * El piso de minutos está afuera, en quién entra a la lista: comparar contra
 * alguien que jugó veinte minutos da números enormes por división chica.
 */

const METRICAS: { clave: string; label: string }[] = [
  { clave: "toques", label: "Toques" },
  { clave: "pases_completados", label: "Pases completados" },
  { clave: "pases_ultimo_tercio", label: "Pases al último tercio" },
  { clave: "remates", label: "Remates" },
  { clave: "chances_creadas", label: "Chances creadas" },
  { clave: "duelos_ganados", label: "Duelos ganados" },
  { clave: "recuperaciones", label: "Recuperaciones" },
  { clave: "gambetas_exitosas", label: "Gambetas" },
];

const dosDecimales = (v: number | null | undefined) =>
  v === null || v === undefined
    ? "—"
    : v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Comparador({
  plantel,
  fichas,
}: {
  plantel: JugadorPlantel[];
  fichas: Record<string, FichaJugador>;
}) {
  // Sólo los que tienen minutos suficientes para que un "por 90" signifique
  // algo. 270 minutos son tres partidos completos.
  const elegibles = plantel
    .filter((p) => p.minutos >= 270 && fichas[String(p.id)])
    .sort((a, b) => b.minutos - a.minutos);

  const [izq, setIzq] = useState(elegibles[0]?.id);
  const [der, setDer] = useState(elegibles[1]?.id ?? elegibles[0]?.id);

  if (elegibles.length < 2) {
    return (
      <div className="tarjeta p-4">
        <p className="text-[13px] text-tinta2">
          Todavía no hay dos jugadores con 270 minutos o más en la temporada. El
          comparador aparece cuando los haya.
        </p>
      </div>
    );
  }

  const a = elegibles.find((p) => p.id === izq) ?? elegibles[0];
  const b = elegibles.find((p) => p.id === der) ?? elegibles[1];
  const fa = fichas[String(a.id)];
  const fb = fichas[String(b.id)];

  const selector = (
    valor: number,
    set: (v: number) => void,
    etiqueta: string,
  ) => (
    <label className="flex flex-col gap-1">
      <span className="etiqueta">{etiqueta}</span>
      <select
        value={valor}
        onChange={(e) => set(Number(e.target.value))}
        className="dato rounded-[4px] border border-borde bg-tarjeta2 px-2.5 py-2 text-[12px] text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-acento"
      >
        {elegibles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.jugador}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="tarjeta p-4 sm:p-5">
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        {selector(a.id, setIzq, "Jugador A")}
        {selector(b.id, setDer, "Jugador B")}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4">
        {[a, b].map((p, i) => (
          <div key={p.id} className="flex flex-col items-center gap-2 text-center">
            <Retrato id={p.id} nombre={p.jugador} tamano={120} radio={10} />
            <span className="titular-2 !text-[18px]">{p.jugador}</span>
            <span className="dato text-[11px] uppercase tracking-[0.14em] text-tinta4">
              {p.pj} PJ · {p.minutos} min
            </span>
            <span
              className={`cifra text-[26px] ${i === 0 ? "text-acento" : "text-tinta"}`}
            >
              {dosDecimales(p.rating)}
            </span>
            <span className="dato text-[10px] uppercase tracking-[0.14em] text-tinta4">
              Rating
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col">
        {METRICAS.map(({ clave, label }) => {
          const va = fa.por90[clave] ?? 0;
          const vb = fb.por90[clave] ?? 0;
          const tope = Math.max(va, vb, 0.001);
          return (
            <div
              key={clave}
              className="grid grid-cols-[52px_1fr_52px] items-center gap-2 border-b border-borde2 py-2 last:border-b-0"
            >
              <span className="dato text-[12px] text-acento">{dosDecimales(va)}</span>
              <span className="flex flex-col items-center gap-1">
                <span className="etiqueta !text-[9.5px]">{label}</span>
                <span className="flex w-full items-center gap-1">
                  {/* La barra de A crece hacia la izquierda para que las dos
                      salgan del centro: así se compara el largo, no la posición. */}
                  <span className="flex h-2 flex-1 justify-end rounded-[1px] bg-tarjeta2">
                    <span
                      className="h-full rounded-[1px] bg-acento"
                      style={{ width: `${(va / tope) * 100}%` }}
                    />
                  </span>
                  <span className="flex h-2 flex-1 rounded-[1px] bg-tarjeta2">
                    <span
                      className="h-full rounded-[1px] bg-tinta3"
                      style={{ width: `${(vb / tope) * 100}%` }}
                    />
                  </span>
                </span>
              </span>
              <span className="dato text-right text-[12px] text-tinta2">
                {dosDecimales(vb)}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-4 border-t border-borde2 pt-3 text-[12px] text-tinta4">
        Todas las métricas por 90 minutos. Sólo entran jugadores con 270 minutos o
        más: por debajo de eso, dividir por minutos infla cualquier número.
      </p>
    </div>
  );
}
