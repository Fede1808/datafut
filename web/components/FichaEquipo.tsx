"use client";

import { useState } from "react";
import Link from "next/link";
import { Escudo } from "./Escudo";
import { FilaPartido } from "./FilaPartido";
import { Escenarios } from "./Escenarios";
import { Racha } from "./Racha";
import { DistribucionPuntos } from "./DistribucionPuntos";
import { StatsAvanzadas } from "./StatsAvanzadas";
import { textoSobre, clubSobreTarjeta } from "@/lib/color";
import {
  fichas,
  promedioLiga,
  maximoLiga,
  totalConStats,
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

/**
 * Techo de cada barra comparativa: el mejor de la liga en esa métrica.
 */
const maximosBarras: Record<string, number> = {
  posesion: maximoLiga("posesion"),
  remates: maximoLiga("remates"),
  chances_claras: maximoLiga("chances_claras"),
  duelos_ganados: maximoLiga("duelos_ganados"),
  toques_en_area_rival: maximoLiga("toques_en_area_rival"),
  pases_campo_rival: maximoLiga("pases_campo_rival"),
};

/**
 * La ficha de equipo, dirección 2b: la cabecera se tiñe con los colores
 * reales del club, dos cifras y nada más arriba, y el resto agrupado en
 * pestañas para que nunca haya más de un tema a la vista.
 *
 * `--acento`/`--acento-texto` quedan seteados en el contenedor: de ahí toman
 * color las `.pestania` activas, la barra de `.fila:hover` y los enlaces.
 * `textoSobre` elige blanco o tinta oscura contra el color del club, así que
 * un club amarillo (River, IAB) no le pone texto blanco encima.
 */
export function FichaEquipo({ slug }: { slug: string }) {
  const e = equipoPorSlug(slug);
  if (!e) return null;

  const suyos = partidosDe(e.equipo);
  const pos = posicionPorSlug(slug);
  const esc = escenariosPorSlug(slug);
  const atk = ataquePct(e);
  const def = defensaPct(e);
  const racha = puntosDeRacha(e.ultimos);

  const zona = posicionesCompletas
    .filter((f) => f.zona === e.zona)
    .sort((a, b) => a.puesto - b.puesto);
  const idx = zona.findIndex((f) => f.slug === slug);
  const vecinos = idx >= 0 ? zona.slice(Math.max(0, idx - 2), idx + 3) : [];

  const [club1, club2] = e.colores;
  const textoClub = textoSobre(club1);
  const textoClubSuave =
    textoClub === "#ffffff" ? "rgba(255,255,255,.82)" : "rgba(26,28,31,.72)";
  // El color del club tal cual, salvo que sea tan claro (blanco, casi blanco)
  // que no se lea como texto/acento sobre una tarjeta blanca: ahí cae a la
  // tinta oscura. River, Gimnasia, Huracán y Vélez tienen blanco de primario.
  const club1Legible = clubSobreTarjeta(club1);

  const campeonRank = rankPor("campeon", slug);
  const playoffsRank = rankPor("playoffs", slug);

  const TABS = [
    { id: "resumen", label: "Resumen", visible: true },
    { id: "rendimiento", label: "Rendimiento", visible: true },
    {
      id: "calendario",
      label: "Calendario",
      visible: suyos.length > 0 || !!esc,
    },
    { id: "zona", label: "La zona", visible: vecinos.length > 0 },
  ].filter((t) => t.visible);

  const [tab, setTab] = useState(TABS[0].id);
  const activo = TABS.some((t) => t.id === tab) ? tab : TABS[0].id;

  return (
    <div
      className="pb-8"
      style={
        {
          "--acento": club1,
          "--acento-texto": textoClub,
        } as React.CSSProperties
      }
    >
      {/* --- Cabecera teñida del color del club --- */}
      <div
        className="rounded-[8px] px-5 pb-9 pt-4 sm:px-7"
        style={{ background: club1, border: "1px solid rgba(0,0,0,.1)" }}
      >
        <div className="flex items-center gap-3">
          <Escudo slug={e.slug} colores={e.colores} size={36} />
          <span
            className="num text-[11px] uppercase tracking-[0.08em]"
            style={{ color: textoClubSuave }}
          >
            Zona {e.zona}
            {pos && (
              <>
                {" · "}
                {pos.puesto}° · {pos.pts} pts
                {pos.pj > 0 && ` · ${pos.pj} PJ`}
              </>
            )}
          </span>
        </div>

        <div
          aria-hidden
          className="mb-3 mt-3 h-1 w-[70px]"
          style={{ background: club2 }}
        />
        <h1
          className="titular"
          style={{ color: textoClub, fontSize: "clamp(32px, 8vw, 54px)" }}
        >
          {e.equipo}
        </h1>
        <p
          className="mt-2.5 max-w-[560px] text-[15px] leading-relaxed sm:text-[16px]"
          style={{ color: textoClubSuave }}
        >
          {ordinal(campeonRank)} candidato al título de {totalEquipos} y
          clasifica a playoffs en {e.playoffs.toFixed(0)}% de las
          simulaciones.
        </p>
      </div>

      {/* --- Las dos cifras, superpuestas al borde de la cabecera --- */}
      <div className="mx-2 -mt-6 grid grid-cols-2 gap-3 sm:mx-3 sm:gap-4">
        <TarjetaCifra
          label="Sale campeón"
          valor={`${e.campeon.toFixed(1)}%`}
          detalle={`${ordinal(campeonRank)} de ${totalEquipos}`}
          color={club1Legible}
        />
        <TarjetaCifra
          label="Entra a playoffs"
          valor={`${e.playoffs.toFixed(1)}%`}
          detalle={`${ordinal(playoffsRank)} de ${totalEquipos} · entran ${clasificanPorZona}`}
        />
      </div>

      {/* --- Pestañas --- */}
      <div
        role="tablist"
        aria-label="Secciones de la ficha"
        className="mt-6 flex flex-wrap gap-2"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={activo === t.id}
            aria-controls={`panel-${t.id}`}
            aria-current={activo === t.id ? "page" : undefined}
            onClick={() => setTab(t.id)}
            className="pestania"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* --- RESUMEN --- */}
      {activo === "resumen" && (
        <div
          id="panel-resumen"
          role="tabpanel"
          aria-labelledby="tab-resumen"
          className="panel-anim mt-4 grid gap-4 lg:grid-cols-2"
        >
          <div className="tarjeta p-4 lg:col-span-2">
            <h2 className="titular-2 text-tinta">Cómo puede terminar</h2>
            <p className="num mt-0.5 text-[11px] text-tinta3">
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
            <div className="mt-3 grid grid-cols-3 gap-x-4 border-t border-borde2 pt-3">
              <Dato k="Peor escenario" v={`${e.puntos.p10}`} sub="1 de cada 10 termina abajo" />
              <Dato k="Lo más probable" v={`${e.puntos.p50}`} sub="la mitad queda de cada lado" />
              <Dato k="Mejor escenario" v={`${e.puntos.p90}`} sub="1 de cada 10 termina arriba" />
            </div>
          </div>

          {e.stats && (
            <div className="tarjeta p-4">
              <h2 className="titular-2 text-tinta">Goles vs. xG</h2>
              <div
                className="cifra mt-2 text-[36px]"
                style={{ color: e.stats.sobre_xg >= 0 ? "var(--color-sube)" : "var(--color-baja)" }}
              >
                {e.stats.sobre_xg > 0 ? "+" : e.stats.sobre_xg < 0 ? "−" : "±"}
                {Math.abs(e.stats.sobre_xg).toFixed(1)}
              </div>
              <p className="mt-1 text-[13px] leading-snug text-tinta2">
                {e.stats.sobre_xg < 0 ? (
                  <>
                    Metió <b>{Math.abs(e.stats.sobre_xg).toFixed(1)} goles menos</b> de
                    los que generó.
                  </>
                ) : (
                  <>
                    Metió <b>{e.stats.sobre_xg.toFixed(1)} goles más</b> de los
                    que generó.
                  </>
                )}
              </p>
              <BarraDoble label="Goles" valor={e.stats.goles} tope={Math.max(e.stats.goles, e.stats.xg)} color="var(--color-tinta)" />
              <BarraDoble label="xG" valor={e.stats.xg} tope={Math.max(e.stats.goles, e.stats.xg)} color={club1Legible} decimales={1} />
            </div>
          )}

          <div className={`tarjeta p-4 ${e.stats ? "" : "lg:col-span-2"}`}>
            <div className="flex items-center justify-between">
              <h2 className="titular-2 text-tinta">Cómo viene</h2>
              <div className="flex items-center gap-2">
                <Racha ultimos={e.ultimos} alto={16} ancho={9} separacion={3} />
                <span className="num text-[11px] text-tinta3">
                  {racha.pts}/{racha.max} pts
                </span>
              </div>
            </div>
            <div className="mt-2.5 flex flex-col">
              {[...e.ultimos].reverse().map((u) => (
                <Link
                  key={`${u.fecha}-${u.rival_slug}`}
                  href={`/equipo/${u.rival_slug}`}
                  className="fila flex items-center gap-2.5 border-t border-borde2 py-2"
                >
                  <span
                    className="num w-4 shrink-0 text-center text-[13px] font-extrabold"
                    style={{ color: colorResultado(u.r) }}
                  >
                    {u.r}
                  </span>
                  <span className="num w-11 shrink-0 text-[14px] font-bold">
                    {u.gf}–{u.gc}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-tinta2">
                    {u.condicion === "local" ? "local con" : "visita a"}{" "}
                    <span className="enlace-ficha">{u.rival}</span>
                  </span>
                  <span className="num shrink-0 text-[10.5px] text-tinta4">
                    {u.fecha}
                  </span>
                </Link>
              ))}
            </div>

            {e.rendimiento && (
              <div className="mt-3 border-t border-borde2 pt-3">
                <h3 className="etiqueta">Contra lo que se esperaba</h3>
                <div className="mt-1 flex items-baseline gap-2">
                  <span
                    className="cifra text-[24px]"
                    style={{ color: e.rendimiento.dif >= 0 ? "var(--color-sube)" : "var(--color-baja)" }}
                  >
                    {e.rendimiento.dif >= 0 ? "+" : "−"}
                    {Math.abs(e.rendimiento.dif).toFixed(1)}
                  </span>
                  <span className="num text-[11px] text-tinta3">
                    puntos sobre lo esperado en {e.rendimiento.pj} partidos
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- RENDIMIENTO --- */}
      {activo === "rendimiento" && (
        <div
          id="panel-rendimiento"
          role="tabpanel"
          aria-labelledby="tab-rendimiento"
          className="panel-anim mt-4 space-y-4"
        >
          <div className="tarjeta grid grid-cols-3 gap-4 p-4">
            <TarjetaMini
              label="Ataque"
              valor={`${atk >= 0 ? "+" : "−"}${Math.abs(atk).toFixed(0)}%`}
              detalle={`${ordinal(puestoAtaque(slug))} de ${totalEquipos}`}
              color={atk >= 0 ? "var(--color-sube)" : "var(--color-baja)"}
            />
            <TarjetaMini
              label="Defensa"
              valor={`${def >= 0 ? "+" : "−"}${Math.abs(def).toFixed(0)}%`}
              detalle={`${ordinal(puestoDefensa(slug))} de ${totalEquipos}`}
              color={def >= 0 ? "var(--color-sube)" : "var(--color-baja)"}
            />
            <TarjetaMini
              label="Desciende"
              valor={`${e.descenso.toFixed(1)}%`}
              detalle={`${e.descenso_promedio.toFixed(1)}% promedios · ${e.descenso_anual.toFixed(1)}% anual`}
              color={e.descenso >= 10 ? "var(--color-baja)" : undefined}
            />
          </div>

          <div className="tarjeta p-4">
            {e.stats ? (
              <StatsAvanzadas
                stats={e.stats}
                promedio={promedioLiga}
                maximos={maximosBarras}
                totalConStats={totalConStats}
              />
            ) : (
              <>
                <h2 className="etiqueta">Lo que genera y lo que concede</h2>
                <p className="num mt-1.5 max-w-[64ch] text-[10px] leading-relaxed text-tinta3">
                  Todavía no hay estadísticas avanzadas cargadas para {e.equipo}.
                  Cuando las haya van a aparecer acá: goles esperados a favor y
                  en contra, posesión y cómo genera situaciones.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* --- CALENDARIO --- */}
      {activo === "calendario" && (
        <div
          id="panel-calendario"
          role="tabpanel"
          aria-labelledby="tab-calendario"
          className="panel-anim mt-4 space-y-4"
        >
          {suyos.length > 0 && (
            <div className="tarjeta p-2">
              <h2 className="etiqueta px-2 pt-2">Próximo partido</h2>
              <div className="mt-1">
                {suyos.map((p) => (
                  <FilaPartido key={`${p.local_slug}-${p.visita_slug}`} p={p} />
                ))}
              </div>
            </div>
          )}

          {esc && (
            <div className="tarjeta p-4">
              <h2 className="titular-2 text-tinta">
                Qué se juega {esc.condicion === "local" ? "contra" : "en la cancha de"}{" "}
                {esc.rival}
              </h2>
              <p className="num mt-0.5 text-[10.5px] text-tinta3">
                {esc.fecha}
                {esc.hora ? ` · ${esc.hora}` : ""} ·{" "}
                <Link href={`/equipo/${esc.rival_slug}`} className="enlace-ficha">
                  ver a {esc.rival} →
                </Link>
              </p>
              <div className="mt-2">
                <Escenarios esc={esc} campeonBase={e.campeon} playoffsBase={e.playoffs} />
              </div>
              <p className="num mt-2 text-[10px] leading-relaxed text-tinta3">
                Diferencia en puntos porcentuales contra el{" "}
                {e.playoffs.toFixed(1)}% y el {e.campeon.toFixed(1)}% de hoy.
              </p>
            </div>
          )}
        </div>
      )}

      {/* --- LA ZONA --- */}
      {activo === "zona" && (
        <div
          id="panel-zona"
          role="tabpanel"
          aria-labelledby="tab-zona"
          className="panel-anim mt-4"
        >
          <div className="tarjeta p-4">
            <h2 className="titular-2 text-tinta">Con quién se pelea el lugar</h2>
            <div role="table" aria-label={`Entorno de ${e.equipo} en la zona ${e.zona}`}>
              <div
                role="row"
                className="mt-2 flex items-center gap-1.5 border-t-2 border-b border-tinta4 border-b-borde py-1.5"
              >
                <span role="columnheader" className="etiqueta w-6 shrink-0 text-right">#</span>
                <span role="columnheader" className="etiqueta min-w-0 flex-1">Equipo</span>
                <span role="columnheader" className="etiqueta w-8 shrink-0 text-right">Pts</span>
                <span role="columnheader" className="etiqueta w-8 shrink-0 text-right">DG</span>
                <span role="columnheader" className="etiqueta w-14 shrink-0 text-right">Playoffs</span>
                <span role="columnheader" className="etiqueta w-14 shrink-0 text-right">Campeón</span>
              </div>

              {vecinos.map((f) => {
                const yo = f.slug === slug;
                const corte = f.puesto === clasificanPorZona;
                return (
                  <Link
                    key={f.slug}
                    href={`/equipo/${f.slug}`}
                    role="row"
                    className={`fila flex items-center gap-1.5 py-2.5 ${
                      corte ? "border-b-2 border-sube" : "border-b border-borde2"
                    } ${yo ? "bg-tarjeta2" : ""}`}
                  >
                    <span role="cell" className="num w-6 shrink-0 text-right text-[11px] text-tinta3">
                      {f.puesto}
                    </span>
                    <span role="cell" className="flex min-w-0 flex-1 items-center gap-2">
                      <Escudo slug={f.slug} colores={f.colores} size={16} />
                      <span
                        className={`truncate text-[13px] ${
                          yo ? "font-bold" : "enlace-ficha"
                        }`}
                        style={yo ? { color: club1Legible } : undefined}
                      >
                        {f.equipo}
                      </span>
                    </span>
                    <span role="cell" className="num w-8 shrink-0 text-right text-[12px] font-bold">
                      {f.pts}
                    </span>
                    <span role="cell" className="num w-8 shrink-0 text-right text-[11.5px] text-tinta2">
                      {f.dif > 0 ? "+" : ""}
                      {f.dif}
                    </span>
                    <span role="cell" className="num w-14 shrink-0 text-right text-[12px]">
                      {f.playoffs.toFixed(1)}
                    </span>
                    <span role="cell" className="num w-14 shrink-0 text-right text-[12px] font-bold" style={{ color: club1Legible }}>
                      {f.campeon.toFixed(1)}
                    </span>
                  </Link>
                );
              })}
            </div>
            <p className="num mt-2 text-[9.5px] text-tinta3">
              Zona {e.zona}. La línea verde es el corte de playoffs.
            </p>
          </div>
        </div>
      )}

      <p className="num mt-8 border-t border-borde pt-3 text-[10px] leading-relaxed text-tinta3">
        {metadatos.simulaciones.toLocaleString("es-AR")} simulaciones ·{" "}
        {metadatos.acierto_pct}% de aciertos 1X2 · modelo{" "}
        {metadatos.modelo.toLowerCase()}.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function rankPor(campo: "campeon" | "playoffs", slug: string): number {
  return (
    [...fichas].sort((a, b) => b[campo] - a[campo]).findIndex((e) => e.slug === slug) + 1
  );
}

function ordinal(n: number): string {
  return `${n}°`;
}

function colorResultado(r: PartidoRacha["r"]): string {
  return r === "G" ? "var(--color-sube)" : r === "E" ? "var(--color-tinta4)" : "var(--color-baja)";
}

function TarjetaCifra({
  label,
  valor,
  detalle,
  color,
}: {
  label: string;
  valor: string;
  detalle: string;
  color?: string;
}) {
  return (
    <div className="tarjeta p-3.5 shadow-[0_2px_8px_rgba(0,0,0,.1)] sm:p-4">
      <div className="etiqueta">{label}</div>
      <div className="cifra mt-1 text-[clamp(30px,8vw,48px)]" style={{ color: color ?? "var(--color-tinta)" }}>
        {valor}
      </div>
      {/* `mt-2`: `.cifra` va con `line-height: 0.9`, así que a 48px los glifos
          sobresalen del renglón y con 2px de separación el detalle quedaba
          tocando la cifra. */}
      <div className="num mt-2 text-[10.5px] leading-snug text-tinta3">{detalle}</div>
    </div>
  );
}

function TarjetaMini({
  label,
  valor,
  detalle,
  color,
}: {
  label: string;
  valor: string;
  detalle: string;
  color?: string;
}) {
  return (
    <div>
      <div className="etiqueta">{label}</div>
      <div className="cifra mt-1 text-[26px]" style={{ color: color ?? "var(--color-tinta)" }}>
        {valor}
      </div>
      <div className="num mt-0.5 text-[9.5px] leading-snug text-tinta3">{detalle}</div>
    </div>
  );
}

function Dato({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div>
      <div className="etiqueta text-[9.5px]">{k}</div>
      <div className="num mt-0.5 text-[18px] font-bold text-tinta">{v}</div>
      <div className="num mt-0.5 text-[8.5px] leading-snug text-tinta3">{sub}</div>
    </div>
  );
}

function BarraDoble({
  label,
  valor,
  tope,
  color,
  decimales = 0,
}: {
  label: string;
  valor: number;
  tope: number;
  color: string;
  decimales?: number;
}) {
  const p = tope > 0 ? Math.min(valor / tope, 1) : 0;
  return (
    <div className="mt-2.5">
      <div className="flex items-center justify-between text-[11px] font-semibold text-tinta3">
        <span className="etiqueta">{label}</span>
        <span className="num">{valor.toFixed(decimales)}</span>
      </div>
      <div className="mt-1 h-[9px] overflow-hidden rounded-[5px] bg-tarjeta2">
        <div className="h-full rounded-[5px]" style={{ width: `${p * 100}%`, background: color }} />
      </div>
    </div>
  );
}
