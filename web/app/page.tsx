import Link from "next/link";
import { Chip } from "@/components/Chip";
import { FilaPartido } from "@/components/FilaPartido";
import {
  partidos,
  candidatos,
  torneo,
  temporada,
  metadatos,
  actualizadoTexto,
} from "@/lib/datos";

/**
 * La portada.
 *
 * Los partidos de la fecha son lo que trae a la gente de vuelta cada semana,
 * pero los candidatos al título son el dato que no tiene nadie más: por eso
 * en celular van arriba de todo, visibles sin scrollear, aunque ocupen poco.
 * En escritorio se acomodan en la columna derecha, siempre a la vista.
 */
export default function Portada() {
  const top2 = candidatos.slice(0, 2);
  const siguientes = candidatos.slice(2, 5);
  const maximo = candidatos[0]?.campeon ?? 0;

  return (
    <div className="pb-4 md:grid md:grid-cols-[1.6fr_1fr] md:gap-8 md:px-4 md:pt-6">
      {/* --- Candidatos al título --- */}
      <section className="px-4 pt-5 md:order-2 md:px-0 md:pt-0">
        <h2 className="etiqueta">
          Probabilidad de campeón · {torneo} {temporada}
        </h2>

        <div className="mt-2.5 flex gap-3 border-b border-[#2a2c33] pb-2.5">
          {top2.map((e) => (
            <Link key={e.slug} href={`/equipo/${e.slug}`} className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Chip colores={e.colores} />
                <span className="truncate text-[11px]">{e.equipo}</span>
              </div>
              <div className="font-[family-name:var(--font-mono)] text-[26px] font-semibold leading-tight text-[#ffcf5c]">
                {e.campeon.toFixed(1)}%
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-1.5 flex justify-between gap-2 font-[family-name:var(--font-mono)] text-[9px] text-[#7c8089]">
          {siguientes.map((e) => (
            <Link key={e.slug} href={`/equipo/${e.slug}`} className="truncate hover:text-[#f2f1ec]">
              {e.equipo} {e.campeon.toFixed(1)}
            </Link>
          ))}
        </div>

        {/*
          Sin esta línea, un 18.7% se lee como "casi no tiene chance". Con
          playoffs a partido único nadie llega muy alto, y hay que decirlo.
        */}
        <p className="mt-2.5 font-[family-name:var(--font-mono)] text-[8.5px] leading-relaxed text-[#565962]">
          MÁX {maximo.toFixed(1)}% — el campeón se define por playoff a partido
          único, por eso ningún equipo llega más arriba.
        </p>

        <Link
          href="/titulo"
          className="mt-3 block font-[family-name:var(--font-mono)] text-[10px] text-[#7c8089] hover:text-[#f2f1ec]"
        >
          VER LOS {candidatos.length} EQUIPOS →
        </Link>
      </section>

      {/* --- Partidos de la fecha --- */}
      <section className="mt-6 md:order-1 md:mt-0">
        <h2 className="etiqueta px-4 pb-2 md:px-0">
          Próximos partidos · {partidos.length}
        </h2>
        <div className="md:overflow-hidden md:rounded-[3px] md:border md:border-[#2a2c33]">
          {partidos.map((p) => (
            <FilaPartido key={`${p.local_slug}-${p.visita_slug}`} p={p} />
          ))}
        </div>
      </section>

      {/* --- De dónde salen los números --- */}
      <section className="mt-8 px-4 md:order-3 md:col-span-2 md:px-0">
        <div className="border-t border-[#2a2c33] pt-3 font-[family-name:var(--font-mono)] text-[9.5px] leading-relaxed text-[#565962]">
          <p>
            {metadatos.simulaciones.toLocaleString("es-AR")} simulaciones ·{" "}
            {metadatos.partidos_historicos.toLocaleString("es-AR")} partidos
            desde 2012 · actualizado {actualizadoTexto()}
          </p>
          <p className="mt-1.5">
            El modelo acierta {metadatos.acierto_pct} de cada 100 partidos. Se
            equivoca casi 6 de cada 10 veces, y está bien que así sea: el fútbol
            es difícil de predecir.
          </p>
        </div>
      </section>
    </div>
  );
}
