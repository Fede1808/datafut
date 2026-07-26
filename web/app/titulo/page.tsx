import Link from "next/link";
import { Chip } from "@/components/Chip";
import { candidatos, torneo, temporada, metadatos } from "@/lib/datos";

export const metadata = {
  title: "Quién puede salir campeón — Liga Profesional",
};

/** Los 30 equipos con su chance de salir campeón y de llegar a playoffs. */
export default function Titulo() {
  const maximo = candidatos[0]?.campeon ?? 0;

  return (
    <div className="px-4 py-5">
      <h1 className="font-[family-name:var(--font-display)] text-[20px] font-bold">
        Quién puede salir campeón
      </h1>
      <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] text-[#7c8089]">
        {torneo} {temporada} ·{" "}
        {metadatos.simulaciones.toLocaleString("es-AR")} simulaciones
      </p>

      <div className="mt-5 overflow-hidden rounded-[3px] border border-[#2a2c33]">
        <div className="flex items-baseline gap-3 border-b border-[#2a2c33] px-3 py-2">
          <span className="etiqueta flex-1">Equipo</span>
          <span className="etiqueta w-14 text-right">Campeón</span>
          <span className="etiqueta w-16 text-right">Playoffs</span>
        </div>

        {candidatos.map((e) => (
          <Link
            key={e.slug}
            href={`/equipo/${e.slug}`}
            className="flex items-baseline gap-3 border-b border-[#2a2c33] px-3 py-2.5 last:border-b-0 hover:bg-[#1e2027]"
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <Chip colores={e.colores} size={9} />
              <span className="truncate text-[13px]">{e.equipo}</span>
              <span className="font-[family-name:var(--font-mono)] text-[9px] text-[#565962]">
                {e.zona}
              </span>
            </span>
            <span className="w-14 text-right font-[family-name:var(--font-mono)] text-[13px] font-semibold text-[#ffcf5c]">
              {e.campeon.toFixed(1)}%
            </span>
            <span className="w-16 text-right font-[family-name:var(--font-mono)] text-[12px] text-[#7c8089]">
              {e.playoffs.toFixed(1)}%
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-4 font-[family-name:var(--font-mono)] text-[9.5px] leading-relaxed text-[#565962]">
        Ningún equipo pasa de {maximo.toFixed(1)}%, y no es un error del modelo:
        el campeón se define ganando cuatro partidos únicos seguidos. Hasta el
        mejor equipo del torneo pierde la mayoría de las veces. Por eso la
        columna de playoffs es mucho más alta que la de campeón — llegar es una
        cosa, ganarlo es otra.
      </p>
    </div>
  );
}
