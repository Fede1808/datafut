import { notFound } from "next/navigation";
import Link from "next/link";
import { Escudo } from "@/components/Escudo";
import { FilaPartido } from "@/components/FilaPartido";
import { Escenarios } from "@/components/Escenarios";
import { Racha } from "@/components/Racha";
import { DistribucionPuntos } from "@/components/DistribucionPuntos";
import {
  fichas,
  puntosDeRacha,
  torneo,
  temporada,
  type PartidoRacha,
  equipoPorSlug,
  posicionPorSlug,
  posicionesCompletas,
  partidosDe,
  escenariosPorSlug,
  ataquePct,
  defensaPct,
  puestoAtaque,
  puestoDefensa,
  totalEquipos,
  clasificanPorZona,
  metadatos,
} from "@/lib/datos";

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
  const pos = posicionPorSlug(slug);
  const esc = escenariosPorSlug(slug);

  const atk = ataquePct(e);
  const def = defensaPct(e);
  const racha = puntosDeRacha(e.ultimos);

  // Vecinos en la tabla de la zona: dos arriba y dos abajo. Un 41% de playoffs
  // no se entiende sin saber contra quiénes se está peleando el lugar.
  const zona = posicionesCompletas
    .filter((f) => f.zona === e.zona)
    .sort((a, b) => a.puesto - b.puesto);
  const idx = zona.findIndex((f) => f.slug === slug);
  const vecinos = idx >= 0 ? zona.slice(Math.max(0, idx - 2), idx + 3) : [];

  return (
    <div className="py-5">
      {/* --- Cabecera --- */}
      <div className="flex items-center gap-3 border-b border-[#2e2b27] pb-3">
        <Escudo slug={e.slug} colores={e.colores} size={44} />
        <div className="min-w-0">
          <h1 className="titular">{e.equipo}</h1>
          <p className="num mt-0.5 text-[10px] uppercase tracking-[0.08em] text-[#6d6862]">
            Zona {e.zona}
            {pos && (
              <>
                {" · "}
                <Link href="/tabla" className="hover:text-[#ffbe3d]">
                  {pos.puesto}° · {pos.pts} pts
                </Link>
                {/* Con 0 partidos jugados, "0-0-0 · 0:0" es ruido. */}
                {pos.pj > 0 &&
                  ` · ${pos.pj} PJ · ${pos.pg}-${pos.pe}-${pos.pp} · ${pos.gf}:${pos.gc}`}
              </>
            )}
          </p>
        </div>
      </div>

      {/* --- Las cifras de arriba --- */}
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 border-b border-[#2e2b27] pb-4 sm:grid-cols-3 lg:grid-cols-5">
        <Cifra
          label="Campeón"
          valor={`${e.campeon.toFixed(1)}%`}
          detalle={`${ordinal(rankPor("campeon", slug))} de ${totalEquipos}`}
          acento
        />
        <Cifra
          label="Playoffs"
          valor={`${e.playoffs.toFixed(1)}%`}
          detalle={`${ordinal(rankPor("playoffs", slug))} de ${totalEquipos} · entran ${clasificanPorZona}`}
        />
        <Cifra
          label="Ataque"
          valor={`${atk >= 0 ? "+" : "−"}${Math.abs(atk).toFixed(0)}%`}
          detalle={`${ordinal(puestoAtaque(slug))} de ${totalEquipos} en goles a favor`}
          color={atk >= 0 ? "#5cc27e" : "#f2607d"}
        />
        <Cifra
          label="Defensa"
          valor={`${def >= 0 ? "+" : "−"}${Math.abs(def).toFixed(0)}%`}
          detalle={`${ordinal(puestoDefensa(slug))} de ${totalEquipos} en goles evitados`}
          color={def >= 0 ? "#5cc27e" : "#f2607d"}
        />
        <Cifra
          label="Desciende"
          valor={`${e.descenso.toFixed(1)}%`}
          detalle={`${e.descenso_promedio.toFixed(1)}% por promedios · ${e.descenso_anual.toFixed(1)}% por la anual`}
          color={e.descenso >= 10 ? "#f2607d" : undefined}
        />
      </div>

      {/* A dos columnas sólo si hay algo que poner en la izquierda: sin
          próximo partido, la tabla de la zona ocupa el ancho completo en vez de
          dejar medio ancho vacío. */}
      <div
        className={`mt-7 grid gap-8 lg:gap-10 ${
          suyos.length > 0 || esc ? "lg:grid-cols-2" : ""
        }`}
      >
        {/* --- Próximo partido y escenarios --- */}
        <div className={suyos.length > 0 || esc ? "" : "hidden"}>
          {suyos.length > 0 && (
            <section>
              <h2 className="etiqueta">Próximo partido</h2>
              <div className="mt-1.5 border-t-2 border-[#f4f1ea]">
                {suyos.map((p) => (
                  <FilaPartido key={`${p.local_slug}-${p.visita_slug}`} p={p} />
                ))}
              </div>
            </section>
          )}

          {esc && (
            <section className="mt-7">
              <h2 className="etiqueta">
                Qué se juega {esc.condicion === "local" ? "contra" : "en la cancha de"}{" "}
                {esc.rival}
              </h2>
              <p className="num mt-0.5 text-[9.5px] text-[#6d6862]">
                {esc.fecha}
                {esc.hora ? ` · ${esc.hora}` : ""} ·{" "}
                <Link href={`/equipo/${esc.rival_slug}`} className="hover:text-[#ffbe3d]">
                  ver a {esc.rival} →
                </Link>
              </p>
              <div className="mt-2">
                <Escenarios
                  esc={esc}
                  campeonBase={e.campeon}
                  playoffsBase={e.playoffs}
                />
              </div>
              <p className="num mt-1.5 text-[9px] leading-relaxed text-[#6d6862]">
                Diferencia en puntos porcentuales contra el {e.playoffs.toFixed(1)}%
                y el {e.campeon.toFixed(1)}% de hoy.
              </p>
            </section>
          )}
        </div>

        {/* --- El entorno en la tabla --- */}
        {vecinos.length > 0 && (
          <section>
            <h2 className="etiqueta">Con quién se pelea el lugar</h2>
            {suyos.length === 0 && !esc && (
              <p className="num mt-0.5 text-[9.5px] text-[#6d6862]">
                Sin partido en la fecha que viene.
              </p>
            )}
            {/* Filas flex, no `<table>`: mismo motivo que en la tabla grande,
                el algoritmo de anchos de tabla desalinea las columnas. */}
            <div role="table" aria-label={`Entorno de ${e.equipo} en la zona ${e.zona}`}>
              <div
                role="row"
                className="mt-1.5 flex items-center gap-1.5 border-t-2 border-b border-[#f4f1ea] border-b-[#2e2b27] py-2"
              >
                <span role="columnheader" className="etiqueta w-6 shrink-0 text-right">
                  #
                </span>
                <span role="columnheader" className="etiqueta min-w-0 flex-1">
                  Equipo
                </span>
                <span role="columnheader" className="etiqueta w-8 shrink-0 text-right">
                  Pts
                </span>
                <span role="columnheader" className="etiqueta w-8 shrink-0 text-right">
                  DG
                </span>
                <span role="columnheader" className="etiqueta w-14 shrink-0 text-right">
                  Playoffs
                </span>
                <span role="columnheader" className="etiqueta w-14 shrink-0 text-right">
                  Campeón
                </span>
              </div>

              {vecinos.map((f) => {
                const yo = f.slug === slug;
                const corte = f.puesto === clasificanPorZona;
                return (
                  <Link
                    key={f.slug}
                    href={`/equipo/${f.slug}`}
                    role="row"
                    className={`fila flex items-center gap-1.5 py-2 ${
                      corte ? "border-b-2 border-[#5cc27e]" : "border-b border-[#201e1b]"
                    } ${yo ? "bg-[#201e1b]" : ""}`}
                  >
                    <span role="cell" className="num w-6 shrink-0 text-right text-[11px] text-[#6d6862]">
                      {f.puesto}
                    </span>
                    <span role="cell" className="flex min-w-0 flex-1 items-center gap-2">
                      <Escudo slug={f.slug} colores={f.colores} size={14} />
                      <span
                        className={`truncate text-[12.5px] ${
                          yo ? "font-semibold text-[#ffbe3d]" : ""
                        }`}
                      >
                        {f.equipo}
                      </span>
                    </span>
                    <span role="cell" className="num w-8 shrink-0 text-right text-[12px] font-semibold">
                      {f.pts}
                    </span>
                    <span role="cell" className="num w-8 shrink-0 text-right text-[11.5px] text-[#a09a90]">
                      {f.dif > 0 ? "+" : ""}
                      {f.dif}
                    </span>
                    <span role="cell" className="num w-14 shrink-0 text-right text-[12px]">
                      {f.playoffs.toFixed(1)}
                    </span>
                    <span role="cell" className="num w-14 shrink-0 text-right text-[12px] text-[#ffbe3d]">
                      {f.campeon.toFixed(1)}
                    </span>
                  </Link>
                );
              })}
            </div>
            <p className="num mt-1.5 text-[9px] text-[#6d6862]">
              Zona {e.zona}. La línea verde es el corte de playoffs.
            </p>
          </section>
        )}
      </div>

      {/* --- Cómo viene y cómo puede terminar --- */}
      <div className="mt-9 grid gap-8 lg:grid-cols-2 lg:gap-10">
        <section>
          <h2 className="etiqueta">Cómo viene</h2>
          <div className="mt-2 flex items-center gap-3">
            <Racha ultimos={e.ultimos} alto={16} ancho={9} separacion={3} />
            <span className="num text-[12px] text-[#a09a90]">
              {racha.pts} de {racha.max} puntos
            </span>
          </div>

          <div className="mt-3 border-t-2 border-[#f4f1ea]">
            {[...e.ultimos].reverse().map((u) => (
              <Link
                key={`${u.fecha}-${u.rival_slug}`}
                href={`/equipo/${u.rival_slug}`}
                className="fila flex items-center gap-2 border-b border-[#201e1b] py-1.5"
              >
                <span
                  className="num w-4 shrink-0 text-center text-[11px] font-semibold"
                  style={{ color: colorResultado(u.r) }}
                >
                  {u.r}
                </span>
                <span className="num w-11 shrink-0 text-[11.5px]">
                  {u.gf}–{u.gc}
                </span>
                <span className="num w-4 shrink-0 text-[9px] text-[#6d6862]">
                  {u.condicion === "local" ? "L" : "V"}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-[#a09a90]">
                  {u.rival}
                </span>
                <span className="num shrink-0 text-[9px] text-[#6d6862]">
                  {u.fecha}
                </span>
              </Link>
            ))}
          </div>

          {/* Rendimiento contra lo que el mercado esperaba. Es la respuesta
              honesta a la pregunta que la gente le hace al xG. */}
          {e.rendimiento && (
            <div className="mt-5">
              <h3 className="etiqueta">Contra lo que se esperaba</h3>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span
                  className="cifra text-[26px]"
                  style={{
                    color: e.rendimiento.dif >= 0 ? "#5cc27e" : "#f2607d",
                  }}
                >
                  {e.rendimiento.dif >= 0 ? "+" : "−"}
                  {Math.abs(e.rendimiento.dif).toFixed(1)}
                </span>
                <span className="num text-[11px] text-[#a09a90]">
                  puntos sobre lo esperado
                </span>
              </div>
              <p className="num mt-1 text-[10px] text-[#a09a90]">
                {e.rendimiento.pts} puntos reales contra{" "}
                {e.rendimiento.pts_esperados.toFixed(1)} esperados en{" "}
                {e.rendimiento.pj} partidos de {temporada}.
              </p>
              <p className="num mt-1.5 text-[9px] leading-relaxed text-[#6d6862]">
                Los puntos esperados salen de las cuotas de cierre de cada
                partido: cuánto sumaba en promedio un equipo con esas
                probabilidades. Rendir por encima no es sólo mérito — también
                puede ser que le esté saliendo todo.
              </p>
            </div>
          )}
        </section>

        <section>
          <h2 className="etiqueta">Cómo puede terminar</h2>
          <p className="num mt-1 text-[10px] text-[#a09a90]">
            Puntos al final del {torneo.toLowerCase()} en las{" "}
            {metadatos.simulaciones.toLocaleString("es-AR")} simulaciones.
          </p>
          <div className="mt-3">
            <DistribucionPuntos
              dist={e.puntos_dist}
              p10={e.puntos.p10}
              p50={e.puntos.p50}
              p90={e.puntos.p90}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-x-4">
            <Dato k="Peor escenario" v={`${e.puntos.p10}`} sub="1 de cada 10 termina abajo" />
            <Dato k="Lo más probable" v={`${e.puntos.p50}`} sub="la mitad queda de cada lado" />
            <Dato k="Mejor escenario" v={`${e.puntos.p90}`} sub="1 de cada 10 termina arriba" />
          </div>
          <p className="num mt-3 text-[9px] leading-relaxed text-[#6d6862]">
            El promedio es {e.puntos.promedio.toFixed(1)}, pero un promedio solo
            esconde el rango: entre el peor y el mejor escenario hay{" "}
            {e.puntos.p90 - e.puntos.p10} puntos de diferencia.
          </p>
        </section>
      </div>

      <p className="num mt-9 border-t border-[#2e2b27] pt-3 text-[9.5px] leading-relaxed text-[#6d6862]">
        {metadatos.simulaciones.toLocaleString("es-AR")} simulaciones ·{" "}
        {metadatos.acierto_pct}% de aciertos 1X2 · modelo{" "}
        {metadatos.modelo.toLowerCase()}.
      </p>
    </div>
  );
}

/** Puesto del equipo entre los 30 en una probabilidad. 1 = el más alto. */
function rankPor(campo: "campeon" | "playoffs", slug: string): number {
  return (
    [...fichas].sort((a, b) => b[campo] - a[campo]).findIndex((e) => e.slug === slug) + 1
  );
}

function ordinal(n: number): string {
  return `${n}°`;
}

function colorResultado(r: PartidoRacha["r"]): string {
  return r === "G" ? "#5cc27e" : r === "E" ? "#a09a90" : "#f2607d";
}

/** Un número chico con su etiqueta arriba y una aclaración abajo. */
function Dato({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div>
      <div className="etiqueta text-[9px]">{k}</div>
      <div className="num mt-0.5 text-[18px] font-semibold">{v}</div>
      <div className="num mt-0.5 text-[8.5px] leading-snug text-[#6d6862]">
        {sub}
      </div>
    </div>
  );
}

function Cifra({
  label,
  valor,
  detalle,
  acento = false,
  color,
}: {
  label: string;
  valor: string;
  detalle: string;
  acento?: boolean;
  color?: string;
}) {
  return (
    <div>
      <div className="etiqueta">{label}</div>
      <div
        className="cifra mt-1 text-[30px]"
        style={{ color: color ?? (acento ? "#ffbe3d" : "#f4f1ea") }}
      >
        {valor}
      </div>
      <div className="num mt-1 text-[9px] leading-snug text-[#6d6862]">
        {detalle}
      </div>
    </div>
  );
}
