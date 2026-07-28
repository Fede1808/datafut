import Link from "next/link";
import { Escudo } from "@/components/Escudo";
import type { Resultado } from "@/lib/datos";

/**
 * Los resultados de la última fecha jugada.
 *
 * Por qué existe: football-data tarda días en publicar el fixture de la fecha
 * siguiente. En esa ventana la portada mostraba "0 partidos" y una lista
 * vacía, justo el día que más gente entra — el siguiente al que se jugó.
 * Cualquier diario deportivo muestra lo que acaba de pasar; esto hace lo mismo.
 *
 * El ganador va en tinta plena y el perdedor apagado: de un vistazo se lee
 * quién ganó sin tener que comparar los dos números.
 */
export function Resultados({ resultados }: { resultados: Resultado[] }) {
  if (resultados.length === 0) return null;

  // Agrupados por día, porque una fecha del fútbol argentino se juega en
  // cuatro días y verlos todos en una lista plana pierde esa estructura.
  const porDia = resultados.reduce<Record<string, Resultado[]>>((acc, r) => {
    (acc[r.fecha] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="md:overflow-hidden md:rounded-[3px] md:border md:border-[#d3d6d1]">
      {Object.entries(porDia).map(([dia, partidos]) => (
        <div key={dia}>
          <div className="num border-b border-[#d3d6d1] bg-[#e9ebe7] px-3 py-1 text-[9px] uppercase tracking-[0.08em] text-[#6d7280]">
            {new Date(dia + "T12:00:00").toLocaleDateString("es-AR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </div>

          {partidos.map((r) => {
            const ganaLocal = r.goles_local > r.goles_visita;
            const ganaVisita = r.goles_visita > r.goles_local;
            return (
              <div
                key={`${r.local_slug}-${r.visita_slug}`}
                className="fila flex items-center gap-2 px-3 py-2"
              >
                <Link
                  href={`/equipo/${r.local_slug}`}
                  className="flex min-w-0 flex-1 items-center gap-1.5"
                >
                  <Escudo slug={r.local_slug} colores={r.colores_local} size={16} />
                  <span
                    className={`enlace-ficha truncate text-[12.5px] ${
                      ganaLocal ? "text-[#1a1c1f]" : "text-[#8d9299]"
                    }`}
                  >
                    {r.local}
                  </span>
                </Link>

                <span className="num shrink-0 px-1 text-[13px] tracking-[0.05em]">
                  <span className={ganaLocal ? "text-[#1a1c1f]" : "text-[#8d9299]"}>
                    {r.goles_local}
                  </span>
                  <span className="text-[#8d9299]">–</span>
                  <span className={ganaVisita ? "text-[#1a1c1f]" : "text-[#8d9299]"}>
                    {r.goles_visita}
                  </span>
                </span>

                <Link
                  href={`/equipo/${r.visita_slug}`}
                  className="flex min-w-0 flex-1 items-center justify-end gap-1.5"
                >
                  <span
                    className={`enlace-ficha truncate text-right text-[12.5px] ${
                      ganaVisita ? "text-[#1a1c1f]" : "text-[#8d9299]"
                    }`}
                  >
                    {r.visita}
                  </span>
                  <Escudo slug={r.visita_slug} colores={r.colores_visita} size={16} />
                </Link>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
