import Link from "next/link";
import { Escudo } from "@/components/Escudo";
import { FilaPartido } from "@/components/FilaPartido";
import { BarraSimple } from "@/components/BarraProb";
import {
  partidos,
  ranking,
  totalEquipos,
  torneo,
  temporada,
  metadatos,
  escenariosPorAmplitud,
  coloresDe,
  posicionPorSlug,
  clasificanPorZona,
  type Escenario,
} from "@/lib/datos";

/**
 * La portada.
 *
 * Tres bloques: los partidos de la fecha (lo que trae a la gente cada semana),
 * los candidatos al título (el dato que no tiene nadie más) y qué se juega cada
 * equipo el fin de semana — que sale de agrupar las mismas simulaciones por el
 * resultado de cada partido y hasta ahora estaba escondido adentro de cada
 * página de equipo.
 */
export default function Portada() {
  const top = ranking.slice(0, 8);
  const maximo = ranking[0]?.campeon ?? 0;
  const enJuego = escenariosPorAmplitud().slice(0, 8);

  return (
    <div className="pb-2 pt-5">
      <div className="grid gap-8 lg:grid-cols-[1fr_310px] lg:gap-10">
        {/* --- Partidos de la fecha --- */}
        <section>
          <Encabezado
            titulo="La fecha"
            detalle={`${partidos.length} partidos · ${partidos[0]?.fecha ?? ""}`}
          />
          <div className="border-t-2 border-[#f4f1ea]">
            {partidos.map((p) => (
              <FilaPartido key={`${p.local_slug}-${p.visita_slug}`} p={p} />
            ))}
          </div>
        </section>

        {/* --- Candidatos --- */}
        <section className="lg:sticky lg:top-4 lg:self-start">
          <Encabezado titulo="Campeón" detalle={`${torneo} ${temporada}`} />

          <ol className="border-t-2 border-[#f4f1ea]">
            {top.map((e, i) => {
              const pos = posicionPorSlug(e.slug);
              return (
                <li key={e.slug} className="border-b border-[#201e1b]">
                  <Link
                    href={`/equipo/${e.slug}`}
                    className="fila flex items-center gap-2 py-2 pl-1"
                  >
                    <span className="num w-4 shrink-0 text-right text-[10px] text-[#423e38]">
                      {i + 1}
                    </span>
                    <Escudo slug={e.slug} colores={e.colores} size={16} />
                    <span className="min-w-0 flex-1">
                      <span className="enlace-ficha block truncate text-[12.5px]">
                        {e.equipo}
                      </span>
                      <span className="num block text-[9px] text-[#6d6862]">
                        {pos ? `${pos.puesto}° zona ${e.zona} · ` : `zona ${e.zona} · `}
                        playoffs {e.playoffs.toFixed(0)}%
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span
                        className={`cifra block text-[17px] ${
                          i === 0 ? "text-[#ffbe3d]" : "text-[#f4f1ea]"
                        }`}
                      >
                        {e.campeon.toFixed(1)}
                      </span>
                      <span className="ml-auto block w-fit">
                        <BarraSimple valor={e.campeon} maximo={maximo} ancho={54} />
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>

          <div className="num mt-2 flex items-baseline justify-between text-[9.5px] text-[#6d6862]">
            <span>Techo {maximo.toFixed(1)}% — el título sale de playoffs a partido único.</span>
          </div>

          {/* Caja, no texto subrayado: es la salida principal de este bloque y
              antes se leía como una nota al pie. */}
          <Link href="/titulo" className="pestania pestania-chica mt-3">
            Los {totalEquipos} equipos →
          </Link>
        </section>
      </div>

      {/* --- Qué se juega cada uno --- */}
      <section className="mt-10">
        <Encabezado
          titulo="Lo que está en juego"
          detalle="Chance de playoffs según cómo salga el partido"
        />
        <div className="grid border-t-2 border-[#f4f1ea] sm:grid-cols-2 sm:gap-x-8">
          {enJuego.map((e) => (
            <FilaEnJuego key={e.slug} e={e} />
          ))}
        </div>
        <p className="num mt-2 text-[9.5px] text-[#6d6862]">
          Las mismas {metadatos.simulaciones.toLocaleString("es-AR")}{" "}
          simulaciones, agrupadas por el resultado de ese partido.{" "}
          <Link href="/tabla" className="border-b border-[#423e38] hover:border-[#ffbe3d] hover:text-[#ffbe3d]">
            Clasifican {clasificanPorZona} por zona
          </Link>
          .
        </p>
      </section>

      {/* --- Ficha técnica --- */}
      <section className="mt-10 border-t border-[#2e2b27] pt-3">
        <dl className="num grid grid-cols-2 gap-x-6 gap-y-2 text-[10px] sm:grid-cols-4">
          <Ficha
            k="Simulaciones"
            v={metadatos.simulaciones.toLocaleString("es-AR")}
          />
          <Ficha
            k="Partidos de entrenamiento"
            v={`${metadatos.partidos_historicos.toLocaleString("es-AR")} desde 2012`}
          />
          <Ficha k="Aciertos 1X2" v={`${metadatos.acierto_pct}%`} />
          {/* El coeficiente viene en escala logarítmica: exp(x)−1 lo pasa a
              "cuántos goles más hace el local", que es lo que se puede leer. */}
          <Ficha
            k="Ventaja de local"
            v={`+${((Math.exp(metadatos.ventaja_local) - 1) * 100).toFixed(0)}% de gol`}
          />
        </dl>
      </section>
    </div>
  );
}

function Encabezado({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 pb-1.5">
      <h2 className="titular-2">{titulo}</h2>
      <span className="num text-[9.5px] uppercase tracking-[0.08em] text-[#6d6862]">
        {detalle}
      </span>
    </div>
  );
}

function Ficha({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[9px] uppercase tracking-[0.08em] text-[#6d6862]">{k}</dt>
      <dd className="mt-0.5 text-[12px] text-[#f4f1ea]">{v}</dd>
    </div>
  );
}

/**
 * Una línea del ranking de lo que está en juego.
 *
 * La barra va de la peor a la mejor rama: es el rango completo de la chance de
 * playoffs de ese equipo después del domingo. Cuanto más largo, más se juega.
 */
function FilaEnJuego({ e }: { e: Escenario }) {
  const vals = e.ramas
    .filter((r) => r.confiable && r.playoffs !== null)
    .map((r) => ({ r: r.resultado, v: r.playoffs as number }));
  if (vals.length === 0) return null;

  const gana = vals.find((x) => x.r === "gana")?.v ?? 0;
  const pierde = vals.find((x) => x.r === "pierde")?.v ?? 0;
  const min = Math.min(...vals.map((x) => x.v));
  const max = Math.max(...vals.map((x) => x.v));
  const amp = max - min;

  return (
    <div className="fila border-b border-[#201e1b] py-2.5 pl-1">
      <div className="flex items-baseline justify-between gap-2">
        <Link
          href={`/equipo/${e.slug}`}
          className="flex min-w-0 items-center gap-2 py-1 transition-colors hover:text-[#ffbe3d]"
        >
          <Escudo slug={e.slug} colores={coloresDe(e.equipo)} size={14} />
          <span className="enlace-ficha truncate text-[12.5px] font-medium">
            {e.equipo}
          </span>
          <span className="num shrink-0 text-[9.5px] text-[#6d6862]">
            {e.condicion === "local" ? "v." : "@"} {e.rival}
          </span>
        </Link>
        <span className="num shrink-0 text-[11px] text-[#a09a90]">
          {amp.toFixed(0)} pp
        </span>
      </div>

      {/* Rango: la barra ocupa de la rama peor a la mejor, sobre el eje 0–100. */}
      <div className="relative mt-1.5 h-[6px] bg-[#201e1b]">
        <div
          className="absolute top-0 h-full bg-[#423e38]"
          style={{ left: `${min}%`, width: `${amp}%` }}
        />
        <div
          className="absolute top-0 h-full w-[2px] bg-[#f2607d]"
          style={{ left: `calc(${pierde}% - 1px)` }}
          title={`Si pierde: ${pierde.toFixed(1)}%`}
        />
        <div
          className="absolute top-0 h-full w-[2px] bg-[#5cc27e]"
          style={{ left: `calc(${gana}% - 1px)` }}
          title={`Si gana: ${gana.toFixed(1)}%`}
        />
      </div>

      <div className="num mt-1 flex justify-between text-[9.5px] text-[#6d6862]">
        <span className="text-[#f2607d]">pierde {pierde.toFixed(1)}%</span>
        <span
          aria-hidden
          className="h-px flex-1 self-center bg-[#201e1b]"
          style={{ marginInline: 8 }}
        />
        <span className="text-[#5cc27e]">gana {gana.toFixed(1)}%</span>
      </div>
    </div>
  );
}
