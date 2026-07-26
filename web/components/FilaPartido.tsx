import Link from "next/link";
import { Chip } from "./Chip";
import { BarraProb, esParejo } from "./BarraProb";
import { coloresDe, type Partido } from "@/lib/datos";

/**
 * Un partido en la lista de la portada.
 *
 * Es el componente que más se repite en todo el sitio, así que tiene que
 * leerse de un vistazo en un celular: nombres, barra, números. Nada más.
 */
export function FilaPartido({ p }: { p: Partido }) {
  return (
    <Link
      href={`/partido/${p.local_slug}-vs-${p.visita_slug}`}
      className="block border-t border-[#2a2c33] px-4 py-3 transition-colors hover:bg-[#1e2027]"
    >
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="flex min-w-0 items-center gap-1.5">
          <Chip colores={coloresDe(p.local)} size={9} />
          <span className="truncate">{p.local}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{p.visita}</span>
          <Chip colores={coloresDe(p.visita)} size={9} />
        </span>
      </div>

      <div className="mt-2">
        <BarraProb {...p.prob} />
      </div>

      <div className="mt-1.5 flex items-baseline justify-between font-mono text-[9.5px] text-[#7c8089]">
        <span>
          {Math.round(p.prob.local)} · {Math.round(p.prob.empate)} ·{" "}
          {Math.round(p.prob.visita)}
          {esParejo(p.prob) && (
            <span className="ml-1.5 text-[#565962]">— muy parejo</span>
          )}
        </span>
        <span className="text-[#565962]">
          {p.goles_esperados.local.toFixed(2)}–{p.goles_esperados.visita.toFixed(2)}
        </span>
      </div>
    </Link>
  );
}
