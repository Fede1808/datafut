import { notFound } from "next/navigation";
import { Chip } from "@/components/Chip";
import { FilaPartido } from "@/components/FilaPartido";
import { fichas, equipoPorSlug, partidosDe, metadatos } from "@/lib/datos";

/** Pre-genera una página por equipo en tiempo de build: no hay servidor. */
export function generateStaticParams() {
  return fichas.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const e = equipoPorSlug(slug);
  return { title: e ? `${e.equipo} — probabilidades` : "Equipo" };
}

export default async function PaginaEquipo({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const e = equipoPorSlug(slug);
  if (!e) notFound();

  const suyos = partidosDe(e.equipo);

  // El modelo guarda ataque y defensa en escala logarítmica, que no le dice
  // nada a nadie. Se convierte a "cuántos goles más o menos que el promedio",
  // que sí se entiende: +30% significa que hace un 30% más de goles.
  const ataquePct = (Math.exp(e.ataque) - 1) * 100;
  const defensaPct = (Math.exp(e.defensa) - 1) * 100;

  return (
    <div className="px-4 py-5">
      <div className="flex items-center gap-2.5">
        <Chip colores={e.colores} size={16} />
        <h1 className="font-[family-name:var(--font-display)] text-[22px] font-bold">
          {e.equipo}
        </h1>
        <span className="font-[family-name:var(--font-mono)] text-[10px] text-[#565962]">
          ZONA {e.zona}
        </span>
      </div>

      {/* --- Las dos cifras que importan --- */}
      <div className="mt-5 flex gap-3 border-y border-[#2a2c33] py-3.5">
        <div className="flex-1">
          <div className="etiqueta">Sale campeón</div>
          <div className="font-[family-name:var(--font-mono)] text-[28px] font-semibold leading-tight text-[#ffcf5c]">
            {e.campeon.toFixed(1)}%
          </div>
        </div>
        <div className="flex-1">
          <div className="etiqueta">Llega a playoffs</div>
          <div className="font-[family-name:var(--font-mono)] text-[28px] font-semibold leading-tight">
            {e.playoffs.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* --- Fuerza --- */}
      <section className="mt-6">
        <h2 className="etiqueta">Fuerza según el modelo</h2>
        <div className="mt-2.5 space-y-2.5">
          <Barra
            titulo="Ataque"
            valor={ataquePct}
            detalle={`hace ${Math.abs(ataquePct).toFixed(0)}% ${
              ataquePct >= 0 ? "más" : "menos"
            } goles que el promedio de la liga`}
          />
          <Barra
            titulo="Defensa"
            valor={defensaPct}
            detalle={`recibe ${Math.abs(defensaPct).toFixed(0)}% ${
              defensaPct >= 0 ? "menos" : "más"
            } goles que el promedio de la liga`}
          />
        </div>
      </section>

      {/* --- Próximos partidos --- */}
      {suyos.length > 0 && (
        <section className="mt-7">
          <h2 className="etiqueta">Próximo partido</h2>
          <div className="mt-1 overflow-hidden rounded-[3px] border border-[#2a2c33]">
            {suyos.map((p) => (
              <FilaPartido key={`${p.local_slug}-${p.visita_slug}`} p={p} />
            ))}
          </div>
        </section>
      )}

      <p className="mt-7 border-t border-[#2a2c33] pt-3 font-[family-name:var(--font-mono)] text-[9.5px] leading-relaxed text-[#565962]">
        Calculado con {metadatos.simulaciones.toLocaleString("es-AR")}{" "}
        simulaciones del torneo. El modelo acierta {metadatos.acierto_pct} de
        cada 100 partidos.
      </p>
    </div>
  );
}

function Barra({
  titulo,
  valor,
  detalle,
}: {
  titulo: string;
  valor: number;
  detalle: string;
}) {
  // El ancho se satura a ±50%: sin tope, un equipo muy dominante haría que
  // todos los demás se vean planos.
  const ancho = Math.min(Math.abs(valor) / 50, 1) * 50;
  const positivo = valor >= 0;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[12px]">{titulo}</span>
        <span
          className={`font-[family-name:var(--font-mono)] text-[12px] ${
            positivo ? "text-[#5cc27e]" : "text-[#ff5c7a]"
          }`}
        >
          {positivo ? "+" : ""}
          {valor.toFixed(0)}%
        </span>
      </div>
      {/* Barra centrada: a la derecha si es mejor que el promedio, a la izquierda si es peor. */}
      <div className="relative mt-1 h-1.5 rounded-[2px] bg-[#2a2c33]">
        <div className="absolute left-1/2 top-0 h-full w-px bg-[#565962]" />
        <div
          className="absolute top-0 h-full rounded-[2px]"
          style={{
            width: `${ancho}%`,
            left: positivo ? "50%" : `${50 - ancho}%`,
            background: positivo ? "#5cc27e" : "#ff5c7a",
          }}
        />
      </div>
      <div className="mt-1 font-[family-name:var(--font-mono)] text-[9px] text-[#565962]">
        {detalle}
      </div>
    </div>
  );
}
