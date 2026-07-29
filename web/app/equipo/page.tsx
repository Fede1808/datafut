import type { Metadata } from "next";
import Link from "next/link";
import { Kpis } from "@/components/Kpis";
import {
  CLUB,
  equipoClub,
  franjas,
  localVisita,
  slugClub,
  temporadas,
} from "@/lib/club";
import { clasificanPorZona, posicionPorSlug, tablaDeZona } from "@/lib/datos";

export const metadata: Metadata = {
  title: "El equipo — Ribera",
  description:
    "Dónde está Boca: posición en la zona, probabilidad de campeón y playoffs, rendimiento de local y de visitante, en qué momento del partido convierte, y temporada por temporada.",
};

/**
 * EL EQUIPO — ¿cómo venimos?
 *
 * Absorbió lo que en el diseño era una sección "Historia" propia. Se eliminó
 * porque las estadísticas avanzadas arrancan en 2023 y una sección entera para
 * cuatro temporadas es un título grande sobre cuatro filas. Acá, como un bloque
 * más, tiene el peso que le corresponde.
 */

const unDecimal = (v: number) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dosDecimales = (v: number) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Equipo() {
  const fila = posicionPorSlug(slugClub);
  const zona = fila ? tablaDeZona(fila.zona) : [];
  const topeFranja = Math.max(...franjas.flatMap((f) => [f.favor, f.contra]), 1);

  return (
    <div className="py-8 pb-16">
      <p className="etiqueta mb-2">El equipo</p>
      <h1 className="titular mb-6">Cómo venimos</h1>

      <Kpis
        items={[
          {
            valor: fila ? `${fila.puesto}º` : "—",
            etiqueta: fila ? `En la zona ${fila.zona}` : "Sin posición",
            acento: true,
          },
          { valor: `${unDecimal(equipoClub.campeon)}%`, etiqueta: "Sale campeón" },
          {
            valor: `${unDecimal(equipoClub.playoffs)}%`,
            etiqueta: `Entra a playoffs · clasifican ${clasificanPorZona} por zona`,
          },
          {
            valor: `${unDecimal(equipoClub.descenso)}%`,
            etiqueta: "Se va al descenso",
          },
        ]}
      />

      <h2 className="titular-2 mb-1.5 mt-10">De local y de visitante</h2>
      <p className="mb-3 max-w-[62ch] text-[13px] text-tinta2">
        Se compara por puntos POR PARTIDO, no por puntos totales: si jugó nueve de
        local y once de visitante, los totales miden el calendario y no al equipo.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {localVisita.map((b) => (
          <div key={b.condicion} className="tarjeta p-4 sm:p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="etiqueta">{b.condicion}</p>
              <span className="dato text-[11px] text-tinta4">{b.pj} partidos</span>
            </div>
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <div>
                <div className="cifra text-[40px] text-acento">
                  {b.pts_pp === null ? "—" : dosDecimales(b.pts_pp)}
                </div>
                <p className="dato mt-1 text-[10px] uppercase tracking-[0.14em] text-tinta4">
                  Puntos por partido
                </p>
              </div>
              <div className="dato flex flex-col gap-0.5 text-[12px] text-tinta2">
                <span>
                  {b.g}G {b.e}E {b.p}P
                </span>
                <span>
                  {b.gf} a favor · {b.gc} en contra
                </span>
                {b.xg !== null && <span>{unDecimal(b.xg)} de xG generado</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="titular-2 mb-1.5 mt-10">En qué momento se define</h2>
      <p className="mb-3 max-w-[62ch] text-[13px] text-tinta2">
        Cada gol contado en el minuto en que se convirtió. La última franja se lleva
        el tiempo agregado: un gol al 90+3 cae ahí, no en un casillero propio que no
        existe.
      </p>
      <div className="tarjeta p-4 sm:p-5">
        <div className="flex items-end gap-2 sm:gap-4">
          {franjas.map((f) => (
            <div
              key={f.etiqueta}
              className="flex min-w-0 flex-1 flex-col items-center gap-2"
            >
              <div className="flex h-[150px] w-full items-end justify-center gap-1">
                <span
                  title={`${f.favor} a favor`}
                  className="w-1/2 max-w-[26px] rounded-t-[2px] bg-acento"
                  style={{
                    height: `${(f.favor / topeFranja) * 100}%`,
                    transformOrigin: "bottom",
                    animation: "gy 560ms cubic-bezier(0.2,0.7,0.2,1) both",
                  }}
                />
                <span
                  title={`${f.contra} en contra`}
                  className="w-1/2 max-w-[26px] rounded-t-[2px] bg-tarjeta2 ring-1 ring-borde"
                  style={{
                    height: `${(f.contra / topeFranja) * 100}%`,
                    transformOrigin: "bottom",
                    animation: "gy 560ms cubic-bezier(0.2,0.7,0.2,1) both",
                  }}
                />
              </div>
              <span className="dato text-[10px] text-tinta4">{f.etiqueta}</span>
              <span className="dato text-[11px] text-tinta2">
                {f.favor}–{f.contra}
              </span>
            </div>
          ))}
        </div>
        <div className="dato mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-borde2 pt-3 text-[10px] uppercase tracking-[0.14em] text-tinta4">
          <span className="flex items-center gap-2">
            <i className="h-2.5 w-4 rounded-[2px] bg-acento" /> A favor
          </span>
          <span className="flex items-center gap-2">
            <i className="h-2.5 w-4 rounded-[2px] bg-tarjeta2 ring-1 ring-borde" /> En
            contra
          </span>
        </div>
      </div>

      {fila && zona.length > 0 && (
        <>
          <h2 className="titular-2 mb-3 mt-10">La zona {fila.zona}</h2>
          <div className="tarjeta overflow-x-auto p-2">
            <table className="dato w-full min-w-[560px] border-collapse text-[13px]">
              <thead>
                <tr className="etiqueta">
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">Equipo</th>
                  <th className="px-2 py-2 text-right">PJ</th>
                  <th className="px-2 py-2 text-right">G</th>
                  <th className="px-2 py-2 text-right">E</th>
                  <th className="px-2 py-2 text-right">P</th>
                  <th className="px-2 py-2 text-right">Dif</th>
                  <th className="px-2 py-2 text-right">Pts</th>
                </tr>
              </thead>
              <tbody>
                {zona.map((e) => {
                  const esClub = e.equipo === CLUB;
                  const clasifica = e.puesto <= clasificanPorZona;
                  return (
                    <tr
                      key={e.slug}
                      className="border-t border-borde2"
                      style={
                        esClub
                          ? { background: "var(--color-acento-fondo)" }
                          : undefined
                      }
                    >
                      <td
                        className={`px-2 py-2 ${clasifica ? "text-acento" : "text-tinta4"}`}
                      >
                        {e.puesto}
                      </td>
                      <td
                        className={`px-2 py-2 ${
                          esClub ? "font-semibold text-acento" : "text-tinta2"
                        }`}
                      >
                        {esClub ? (
                          e.equipo
                        ) : (
                          <Link href={`/equipo/${e.slug}`} className="hover:text-acento">
                            {e.equipo}
                          </Link>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right text-tinta3">{e.pj}</td>
                      <td className="px-2 py-2 text-right text-tinta3">{e.pg}</td>
                      <td className="px-2 py-2 text-right text-tinta3">{e.pe}</td>
                      <td className="px-2 py-2 text-right text-tinta3">{e.pp}</td>
                      <td className="px-2 py-2 text-right text-tinta3">
                        {e.dif > 0 ? "+" : ""}
                        {e.dif}
                      </td>
                      <td
                        className={`px-2 py-2 text-right ${
                          esClub ? "font-semibold text-acento" : "text-tinta"
                        }`}
                      >
                        {e.pts}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 px-2 text-[12px] text-tinta4">
              Los {clasificanPorZona} primeros de cada zona entran a los playoffs.
            </p>
          </div>
        </>
      )}

      <h2 className="titular-2 mb-1.5 mt-10">Temporada por temporada</h2>
      <p className="mb-3 max-w-[62ch] text-[13px] text-tinta2">
        Son las {temporadas.length} que hay, no más: las estadísticas avanzadas
        arrancan en 2023 porque la fuente no tiene nada anterior. Cuatro temporadas
        ciertas antes que seis con dos inventadas.
      </p>
      <div className="tarjeta overflow-x-auto p-2">
        <table className="dato w-full min-w-[520px] border-collapse text-[13px]">
          <thead>
            <tr className="etiqueta">
              <th className="px-2 py-2 text-left">Temporada</th>
              <th className="px-2 py-2 text-right">PJ</th>
              <th className="px-2 py-2 text-right">G</th>
              <th className="px-2 py-2 text-right">E</th>
              <th className="px-2 py-2 text-right">P</th>
              <th className="px-2 py-2 text-right">GF</th>
              <th className="px-2 py-2 text-right">GC</th>
              <th className="px-2 py-2 text-right">xG</th>
              <th className="px-2 py-2 text-right">Pts/PJ</th>
            </tr>
          </thead>
          <tbody>
            {temporadas.map((t, i) => (
              <tr key={t.temporada} className="border-t border-borde2">
                <td
                  className={`px-2 py-2 ${
                    i === 0 ? "font-semibold text-acento" : "text-tinta2"
                  }`}
                >
                  {t.temporada}
                </td>
                <td className="px-2 py-2 text-right text-tinta3">{t.pj}</td>
                <td className="px-2 py-2 text-right text-tinta3">{t.g}</td>
                <td className="px-2 py-2 text-right text-tinta3">{t.e}</td>
                <td className="px-2 py-2 text-right text-tinta3">{t.p}</td>
                <td className="px-2 py-2 text-right text-tinta3">{t.gf}</td>
                <td className="px-2 py-2 text-right text-tinta3">{t.gc}</td>
                <td className="px-2 py-2 text-right text-tinta3">
                  {t.xg === null ? "—" : unDecimal(t.xg)}
                </td>
                <td className="px-2 py-2 text-right text-tinta">
                  {t.pts_pp === null ? "—" : dosDecimales(t.pts_pp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
