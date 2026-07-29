"use client";

import Link from "next/link";
import { useState } from "react";
import type { JugadorPlantel } from "@/lib/club";

/**
 * El plantel, ordenable por cualquier columna.
 *
 * Es cliente sólo por el orden. Todo lo demás — los números, los enlaces — es
 * estático y sale del build.
 *
 * `difg` (goles menos goles esperados) NO viene del pipeline: se calcula acá
 * porque es una resta de dos columnas que ya están. Guardarla en el JSON sería
 * repetir un dato derivado y arriesgar que los tres números se contradigan.
 */

type Columna = {
  clave: keyof JugadorPlantel | "difg";
  label: string;
  ayuda?: string;
  formato: "texto" | "entero" | "decimal" | "diferencia";
};

const COLUMNAS: Columna[] = [
  { clave: "jugador", label: "Jugador", formato: "texto" },
  { clave: "pj", label: "PJ", ayuda: "Partidos jugados", formato: "entero" },
  { clave: "titular", label: "Tit.", ayuda: "Partidos como titular", formato: "entero" },
  { clave: "minutos", label: "Min", ayuda: "Minutos jugados", formato: "entero" },
  { clave: "rating", label: "Rating", ayuda: "Rating medio de FotMob", formato: "decimal" },
  { clave: "goles", label: "G", ayuda: "Goles", formato: "entero" },
  { clave: "xg", label: "xG", ayuda: "Goles esperados", formato: "decimal" },
  {
    clave: "difg",
    label: "G − xG",
    ayuda: "Goles menos goles esperados: cuánto definió por encima o por debajo",
    formato: "diferencia",
  },
  { clave: "asistencias", label: "A", ayuda: "Asistencias", formato: "entero" },
  { clave: "xa", label: "xA", ayuda: "Asistencias esperadas", formato: "decimal" },
  { clave: "remates", label: "Rem", ayuda: "Remates", formato: "entero" },
  { clave: "chances_creadas", label: "Chances", ayuda: "Chances creadas", formato: "entero" },
  { clave: "duelos_ganados", label: "Duelos", ayuda: "Duelos ganados", formato: "entero" },
  { clave: "recuperaciones", label: "Recup.", ayuda: "Recuperaciones", formato: "entero" },
];

const entero = (v: number | null) =>
  v === null ? "—" : Math.round(v).toLocaleString("es-AR");
const decimal = (v: number | null) =>
  v === null
    ? "—"
    : v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const conSigno = (v: number) =>
  (v > 0 ? "+" : "") +
  v.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function TablaPlantel({ plantel }: { plantel: JugadorPlantel[] }) {
  const [columna, setColumna] = useState<Columna["clave"]>("minutos");
  const [ascendente, setAscendente] = useState(false);

  const con = plantel.map((p) => ({ ...p, difg: (p.goles ?? 0) - (p.xg ?? 0) }));
  const filas = [...con].sort((a, b) => {
    const x = a[columna];
    const y = b[columna];
    if (typeof x === "string" && typeof y === "string") {
      return ascendente ? x.localeCompare(y, "es") : y.localeCompare(x, "es");
    }
    // Los null van siempre al fondo: un jugador sin rating no es el peor del
    // plantel, es uno del que no hay dato.
    const nx = typeof x === "number" ? x : ascendente ? Infinity : -Infinity;
    const ny = typeof y === "number" ? y : ascendente ? Infinity : -Infinity;
    return ascendente ? nx - ny : ny - nx;
  });

  function ordenarPor(clave: Columna["clave"]) {
    if (clave === columna) {
      setAscendente(!ascendente);
    } else {
      setColumna(clave);
      // El nombre se lee de la A a la Z; los números, de mayor a menor.
      setAscendente(clave === "jugador");
    }
  }

  return (
    <div className="tarjeta overflow-x-auto p-2">
      <table className="num w-full min-w-[700px] border-collapse text-[13px]">
        <thead>
          <tr>
            {COLUMNAS.map((c) => (
              <th
                key={c.clave}
                scope="col"
                title={c.ayuda}
                aria-sort={
                  c.clave === columna
                    ? ascendente
                      ? "ascending"
                      : "descending"
                    : undefined
                }
                className={`sticky top-0 cursor-pointer whitespace-nowrap border-b border-[#c3c8c1] bg-white px-2 py-2 text-[11.5px] font-bold uppercase tracking-[0.05em] hover:text-[#0A2472] ${
                  c.clave === "jugador" ? "text-left" : "text-right"
                } ${c.clave === columna ? "text-[#0A2472]" : "text-[#6d7280]"}`}
                style={{ fontFamily: "var(--font-display)" }}
                onClick={() => ordenarPor(c.clave)}
              >
                {c.label}
                {c.clave === columna ? (ascendente ? " ▴" : " ▾") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((p) => (
            <tr key={p.id} className="border-b border-[#e2e4e0] hover:bg-[#f2f5fb]">
              <td className="px-2 py-2 font-semibold">
                <Link
                  href={`/plantel/${p.id}`}
                  className="block hover:text-[#0A2472] hover:underline"
                >
                  {p.jugador}
                  <span className="block text-[11.5px] font-normal text-[#6d7280]">
                    {p.arquero ? "Arquero" : "De campo"}
                  </span>
                </Link>
              </td>
              {COLUMNAS.slice(1).map((c) => {
                const v = p[c.clave as keyof typeof p] as number | null;
                if (c.formato === "diferencia") {
                  const d = v ?? 0;
                  return (
                    <td
                      key={c.clave}
                      className={`whitespace-nowrap px-2 py-2 text-right text-[15px] font-bold ${
                        d > 0.5 ? "text-[#2f8f4e]" : d < -0.5 ? "text-[#c8102e]" : ""
                      }`}
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {conSigno(d)}
                    </td>
                  );
                }
                return (
                  <td key={c.clave} className="whitespace-nowrap px-2 py-2 text-right">
                    {c.formato === "decimal" ? decimal(v) : entero(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
