import { notFound } from "next/navigation";
import Link from "next/link";
import { Chip } from "@/components/Chip";
import { BarraProb } from "@/components/BarraProb";
import { partidos, coloresDe, metadatos } from "@/lib/datos";

function slugDe(p: { local_slug: string; visita_slug: string }) {
  return `${p.local_slug}-vs-${p.visita_slug}`;
}

export function generateStaticParams() {
  return partidos.map((p) => ({ slug: slugDe(p) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = partidos.find((x) => slugDe(x) === slug);
  return { title: p ? `${p.local} vs ${p.visita}` : "Partido" };
}

export default async function PaginaPartido({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = partidos.find((x) => slugDe(x) === slug);
  if (!p) notFound();

  return (
    <div className="px-4 py-5">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/equipo/${p.local_slug}`}
          className="flex min-w-0 items-center gap-2 font-[family-name:var(--font-display)] text-[15px] font-semibold"
        >
          <Chip colores={coloresDe(p.local)} size={14} />
          <span className="truncate">{p.local}</span>
        </Link>
        <span className="font-[family-name:var(--font-mono)] text-[10px] text-[#565962]">
          vs
        </span>
        <Link
          href={`/equipo/${p.visita_slug}`}
          className="flex min-w-0 items-center justify-end gap-2 font-[family-name:var(--font-display)] text-[15px] font-semibold"
        >
          <span className="truncate">{p.visita}</span>
          <Chip colores={coloresDe(p.visita)} size={14} />
        </Link>
      </div>

      <div className="mt-1 font-[family-name:var(--font-mono)] text-[9.5px] text-[#565962]">
        {p.fecha} · {p.hora}
      </div>

      {/* --- 1X2 --- */}
      <div className="mt-4 flex justify-around border-y border-[#2a2c33] py-3.5">
        {[
          { n: p.prob.local, l: "LOCAL" },
          { n: p.prob.empate, l: "EMPATE" },
          { n: p.prob.visita, l: "VISITA" },
        ].map((x) => (
          <div key={x.l} className="text-center">
            <div className="font-[family-name:var(--font-mono)] text-[24px] font-semibold">
              {Math.round(x.n)}%
            </div>
            <div className="font-[family-name:var(--font-mono)] text-[9px] tracking-wide text-[#7c8089]">
              {x.l}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <BarraProb {...p.prob} alto={6} />
      </div>

      {/* --- Marcadores --- */}
      <section className="mt-6">
        <h2 className="etiqueta">Marcadores más probables</h2>
        <div className="mt-2 flex gap-1.5">
          {p.marcadores.map((m) => (
            <div
              key={m.marcador}
              className="flex-1 rounded-[2px] bg-[#1e2027] py-2 text-center"
            >
              <div className="font-[family-name:var(--font-mono)] text-[14px] font-semibold">
                {m.marcador}
              </div>
              <div className="font-[family-name:var(--font-mono)] text-[9px] text-[#7c8089]">
                {m.prob.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
        {/*
          El marcador más probable rara vez pasa del 20%. Sin esta aclaración,
          la gente lee "el modelo dice que sale 1-1", y no es eso.
        */}
        <p className="mt-2 font-[family-name:var(--font-mono)] text-[9px] leading-relaxed text-[#565962]">
          El más probable es {p.marcadores[0].marcador} con{" "}
          {p.marcadores[0].prob.toFixed(1)}%. O sea que el otro{" "}
          {(100 - p.marcadores[0].prob).toFixed(0)}% de las veces termina
          distinto.
        </p>
      </section>

      {/* --- Derivados --- */}
      <section className="mt-6 grid grid-cols-2 gap-3">
        <Dato
          titulo="Goles esperados"
          valor={`${p.goles_esperados.local.toFixed(2)} — ${p.goles_esperados.visita.toFixed(2)}`}
        />
        <Dato titulo="Menos de 2.5 goles" valor={`${p.menos_de_2_5.toFixed(0)}%`} />
        <Dato titulo="Ambos convierten" valor={`${p.ambos_convierten.toFixed(0)}%`} />
        <Dato
          titulo="Más de 2.5 goles"
          valor={`${(100 - p.menos_de_2_5).toFixed(0)}%`}
        />
      </section>

      <p className="mt-7 border-t border-[#2a2c33] pt-3 font-[family-name:var(--font-mono)] text-[9.5px] leading-relaxed text-[#565962]">
        Son goles esperados por el modelo antes de jugarse el partido, no xG.
        El modelo acierta {metadatos.acierto_pct} de cada 100 partidos.
      </p>
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-[2px] bg-[#1e2027] px-3 py-2.5">
      <div className="etiqueta">{titulo}</div>
      <div className="mt-0.5 font-[family-name:var(--font-mono)] text-[15px] font-semibold">
        {valor}
      </div>
    </div>
  );
}
