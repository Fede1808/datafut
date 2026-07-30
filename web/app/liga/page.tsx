import Link from "next/link";
import { Escudo } from "@/components/Escudo";
import { FilaPartido } from "@/components/FilaPartido";
import { Resultados } from "@/components/Resultados";
import { BarraSimple } from "@/components/BarraProb";
import {
  partidos,
  ultimosResultados,
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
  const lider = ranking[0];
  const resto = ranking.slice(1, 8);
  const maximo = ranking[0]?.campeon ?? 0;
  const enJuego = escenariosPorAmplitud().slice(0, 8);

  return (
    <div className="pb-2 pt-5">
      {/* `[&>*]:min-w-0`: ver la nota de `app/page.tsx`. Sin esto el ancho
          mínimo del contenido interno empuja el documento y aparece scroll
          horizontal en el celular. */}
      <div className="grid gap-8 lg:grid-cols-[1fr_310px] lg:gap-10 [&>*]:min-w-0">
        {/*
          Partidos de la fecha. Si la fuente todavia no publico el fixture de
          la fecha siguiente —tarda dias— se muestran los resultados de la que
          acaba de terminar, en vez de una lista vacia.
        */}
        <section className="tarjeta p-4">
          {partidos.length > 0 ? (
            <>
              <Encabezado
                titulo="La fecha"
                detalle={`${partidos.length} partidos · ${partidos[0]?.fecha ?? ""}`}
              />
              <div className="border-t-2 border-tinta4">
                {partidos.map((p) => (
                  <FilaPartido key={`${p.local_slug}-${p.visita_slug}`} p={p} />
                ))}
              </div>
            </>
          ) : (
            <>
              <Encabezado
                titulo="Resultados"
                detalle={`${ultimosResultados.length} partidos · última fecha`}
              />
              <div className="border-t-2 border-tinta4">
                <Resultados resultados={ultimosResultados} />
              </div>
              <p className="num mt-2 text-[9px] leading-relaxed text-tinta3">
                Los partidos de la fecha que viene aparecen acá cuando se
                publica el calendario.
              </p>
            </>
          )}
        </section>

        {/* --- Candidatos --- */}
        <section className="tarjeta p-4 lg:sticky lg:top-4 lg:self-start">
          <Encabezado titulo="Campeón" detalle={`${torneo} ${temporada}`} />

          {/*
            El líder va aparte y a escala de scoreboard. Es el dato que la
            página vino a contar: si mide lo mismo que el octavo, el ranking se
            lee como una lista de precios y no como una carrera.
          */}
          {lider && (
            <>
              <div className="banda-club" aria-hidden>
                <span style={{ background: lider.colores[0] }} />
                <span style={{ background: lider.colores[1] }} />
                <span style={{ background: lider.colores[0] }} />
              </div>
              <Link
                href={`/equipo/${lider.slug}`}
                className="fila lider border-b-2 border-tinta4 px-1 py-3"
              >
                <span className="lider-cifra">
                  {lider.campeon.toFixed(1)}
                  <sup>%</sup>
                </span>
                <span className="min-w-0">
                  <span className="titular-2 enlace-ficha block truncate">
                    {lider.equipo}
                  </span>
                  <span className="num mt-1 block text-[10.5px] text-tinta3">
                    Zona {lider.zona} · playoffs {lider.playoffs.toFixed(1)}% ·
                    techo de la liga
                  </span>
                </span>
              </Link>
            </>
          )}

          <ol>
            {resto.map((e, i) => {
              const pos = posicionPorSlug(e.slug);
              return (
                <li key={e.slug} className="border-b border-borde2">
                  <Link
                    href={`/equipo/${e.slug}`}
                    className="fila flex items-center gap-2 py-2 pl-1"
                  >
                    <span className="cifra w-4 shrink-0 text-right text-[15px] text-tinta4">
                      {i + 2}
                    </span>
                    <Escudo slug={e.slug} colores={e.colores} size={16} />
                    <span className="min-w-0 flex-1">
                      <span className="enlace-ficha block truncate text-[12.5px]">
                        {e.equipo}
                      </span>
                      <span className="num block text-[9px] text-tinta3">
                        {pos ? `${pos.puesto}° zona ${e.zona} · ` : `zona ${e.zona} · `}
                        playoffs {e.playoffs.toFixed(0)}%
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="cifra block text-[22px] text-tinta">
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

          <div className="num mt-2 flex items-baseline justify-between text-[9.5px] text-tinta3">
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
      <section className="tarjeta mt-6 p-4">
        <Encabezado
          titulo="Lo que está en juego"
          detalle="Chance de playoffs según cómo salga el partido"
        />
        <div className="grid border-t-2 border-tinta4 sm:grid-cols-2 sm:gap-x-8">
          {enJuego.map((e) => (
            <FilaEnJuego key={e.slug} e={e} />
          ))}
        </div>
        <p className="num mt-2 text-[9.5px] text-tinta3">
          Las mismas {metadatos.simulaciones.toLocaleString("es-AR")}{" "}
          simulaciones, agrupadas por el resultado de ese partido.{" "}
          <Link href="/tabla" className="border-b border-tinta4 hover:border-tinta4 hover:text-tinta">
            Clasifican {clasificanPorZona} por zona
          </Link>
          .
        </p>
      </section>

      {/* --- Ficha técnica --- */}
      <section className="mt-10 border-t border-borde pt-3">
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
      <span className="num text-[9.5px] uppercase tracking-[0.08em] text-tinta3">
        {detalle}
      </span>
    </div>
  );
}

function Ficha({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[9px] uppercase tracking-[0.08em] text-tinta3">{k}</dt>
      <dd className="mt-0.5 text-[12px] text-tinta">{v}</dd>
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
    <div className="fila border-b border-borde2 py-2.5 pl-1">
      <div className="flex items-baseline justify-between gap-2">
        <Link
          href={`/equipo/${e.slug}`}
          className="flex min-w-0 items-center gap-2 py-1 transition-colors hover:text-tinta"
        >
          <Escudo slug={e.slug} colores={coloresDe(e.equipo)} size={14} />
          <span className="enlace-ficha truncate text-[12.5px] font-medium">
            {e.equipo}
          </span>
          <span className="num shrink-0 text-[9.5px] text-tinta3">
            {e.condicion === "local" ? "v." : "@"} {e.rival}
          </span>
        </Link>
        <span className="num shrink-0 text-[11px] text-tinta2">
          {amp.toFixed(0)} pp
        </span>
      </div>

      {/* Rango: la barra ocupa de la rama peor a la mejor, sobre el eje 0–100. */}
      <div className="relative mt-1.5 h-[6px] bg-tarjeta2">
        <div
          className="absolute top-0 h-full bg-tinta4"
          style={{ left: `${min}%`, width: `${amp}%` }}
        />
        <div
          className="absolute top-0 h-full w-[2px] bg-baja"
          style={{ left: `calc(${pierde}% - 1px)` }}
          title={`Si pierde: ${pierde.toFixed(1)}%`}
        />
        <div
          className="absolute top-0 h-full w-[2px] bg-sube"
          style={{ left: `calc(${gana}% - 1px)` }}
          title={`Si gana: ${gana.toFixed(1)}%`}
        />
      </div>

      <div className="num mt-1 flex justify-between text-[9.5px] text-tinta3">
        <span className="text-baja">pierde {pierde.toFixed(1)}%</span>
        <span
          aria-hidden
          className="h-px flex-1 self-center bg-tarjeta2"
          style={{ marginInline: 8 }}
        />
        <span className="text-sube">gana {gana.toFixed(1)}%</span>
      </div>
    </div>
  );
}
