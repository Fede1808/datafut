import Link from "next/link";
import { Escudo } from "./Escudo";
import { BarraProb, esParejo } from "./BarraProb";
import { coloresDe, posicionPorSlug, type Partido } from "@/lib/datos";

/**
 * Un partido en una lista.
 *
 * Es el componente que más se repite en el sitio. Cada línea trae: quién juega,
 * cómo viene cada uno en la tabla, el 1X2, los goles esperados y el marcador
 * más probable. Todo eso entra en tres renglones porque los números van en
 * mono tabular y alineados.
 */
export function FilaPartido({ p }: { p: Partido }) {
  const l = posicionPorSlug(p.local_slug);
  const v = posicionPorSlug(p.visita_slug);
  const top = p.marcadores[0];

  return (
    <Link
      href={`/partido/${p.local_slug}-vs-${p.visita_slug}`}
      className="fila block border-b border-[#d3d6d1] px-3 py-2.5 last:border-b-0"
    >
      <div className="flex items-center justify-between gap-2">
        {/* El puesto va antes del nombre, como en la planilla de un diario. No
            se agregan los puntos acá: con "0 · 0" en el medio, la línea se lee
            como un resultado y no como dos posiciones. */}
        {/* Los dos nombres se acercan al centro, como en la planilla de
            fixture de un diario: el ojo compara los dos equipos, no las dos
            puntas de la fila. El puesto queda afuera, en los márgenes. */}
        <span className="num w-5 shrink-0 text-[9.5px] text-[#8d9299]">
          {l ? `${l.puesto}°` : ""}
        </span>

        <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <span className="enlace-ficha truncate text-[13.5px] font-medium">
            {p.local}
          </span>
          <Escudo slug={p.local_slug} colores={coloresDe(p.local)} size={16} />
        </span>

        <span className="num shrink-0 text-[9px] uppercase tracking-[0.1em] text-[#8d9299]">
          vs
        </span>

        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Escudo slug={p.visita_slug} colores={coloresDe(p.visita)} size={16} />
          <span className="enlace-ficha truncate text-[13.5px] font-medium">
            {p.visita}
          </span>
        </span>

        <span className="num w-5 shrink-0 text-right text-[9.5px] text-[#8d9299]">
          {v ? `${v.puesto}°` : ""}
        </span>
        {/* Flecha permanente: la fila entera es un link a la ficha del partido
            y sin esto la única pista era el hover. */}
        <span aria-hidden className="chevron shrink-0 text-[13px] leading-none">
          ›
        </span>
      </div>

      <div className="mt-2">
        <BarraProb {...p.prob} />
      </div>

      <div className="num mt-1.5 flex items-baseline justify-between gap-2 text-[10px] text-[#4c5058]">
        <span className="shrink-0">
          <span className="text-[#2f5fa8]">{Math.round(p.prob.local)}</span>
          <span className="text-[#8d9299]"> · </span>
          <span className="text-[#4c5058]">{Math.round(p.prob.empate)}</span>
          <span className="text-[#8d9299]"> · </span>
          <span className="text-[#c8102e]">{Math.round(p.prob.visita)}</span>
          {esParejo(p.prob) && (
            <span className="ml-2 text-[9px] uppercase tracking-[0.08em] text-[#6d7280]">
              parejo
            </span>
          )}
        </span>
        <span className="truncate text-right text-[9.5px] text-[#6d7280]">
          xG {p.goles_esperados.local.toFixed(2)}–
          {p.goles_esperados.visita.toFixed(2)}
          <span className="hidden text-[#8d9299] sm:inline"> | </span>
          <span className="hidden sm:inline">
            {top.marcador} {top.prob.toFixed(0)}%
          </span>
          <span className="hidden text-[#8d9299] md:inline"> | </span>
          <span className="hidden md:inline">
            {p.fecha} {p.hora}
          </span>
        </span>
      </div>
    </Link>
  );
}
