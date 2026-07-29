import type { Metadata } from "next";
import { ComparacionLiga } from "@/components/ComparacionLiga";
import { Kpis } from "@/components/Kpis";
import { MapaRemates } from "@/components/MapaRemates";
import { remates, resumenRemates } from "@/lib/club";

export const metadata: Metadata = {
  title: "Stats — Ribera",
  description:
    "Cómo juega Boca: goles esperados, comparación contra los otros 29 equipos de la liga y el mapa de todos sus remates con el xG de cada uno.",
};

/**
 * STATS — ¿cómo jugamos?
 *
 * Junta dos cosas que estaban separadas y nunca debieron estarlo: la
 * comparación contra la liga y el mapa de remates. Las dos contestan lo mismo,
 * una desde el promedio y la otra desde el detalle.
 */

const unDecimal = (v: number) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dosDecimales = (v: number) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const entero = (v: number) => v.toLocaleString("es-AR");

export default function Stats() {
  const xgPorRemate = resumenRemates.remates
    ? resumenRemates.xg / resumenRemates.remates
    : 0;
  const diferencia = resumenRemates.xg - resumenRemates.xg_en_contra;

  return (
    <div className="py-8 pb-16">
      <p className="etiqueta mb-2">Stats</p>
      <h1 className="titular mb-6">Cómo jugamos</h1>

      <Kpis
        items={[
          {
            valor: unDecimal(resumenRemates.xg),
            etiqueta: `Goles esperados a favor · convirtió ${resumenRemates.goles}`,
            acento: true,
          },
          {
            valor: unDecimal(resumenRemates.xg_en_contra),
            etiqueta: `Goles esperados en contra · recibió ${resumenRemates.goles_en_contra}`,
          },
          {
            valor: (diferencia > 0 ? "+" : "") + unDecimal(diferencia),
            etiqueta: "Diferencia de goles esperados",
          },
          {
            valor: dosDecimales(xgPorRemate),
            etiqueta: `xG por remate · ${entero(resumenRemates.remates)} remates`,
          },
        ]}
      />

      <h2 className="titular-2 mb-1.5 mt-10">Contra los otros 29</h2>
      <p className="mb-3 max-w-[62ch] text-[13px] text-tinta2">
        Cada métrica ubicada dentro del rango de toda la liga. Lo que importa no es
        el número suelto sino dónde cae comparado con los demás.
      </p>
      <ComparacionLiga />

      <h2 className="titular-2 mb-1.5 mt-10">Dónde remata</h2>
      <p className="mb-3 max-w-[62ch] text-[13px] text-tinta2">
        Los {entero(resumenRemates.remates)} remates de la temporada, cada uno con su
        coordenada real y su propio xG. El tamaño del punto es esa probabilidad de
        gol: un punto grande cerca del arco es una ocasión clara.
      </p>
      <MapaRemates remates={remates} conFiltros />
    </div>
  );
}
