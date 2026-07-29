import type { Metadata } from "next";
import { Cifra } from "@/components/Cifra";
import { ComparacionLiga } from "@/components/ComparacionLiga";
import { MapaRemates } from "@/components/MapaRemates";
import { remates, resumenRemates } from "@/lib/club";

export const metadata: Metadata = {
  title: "El juego — Boca en números",
  description:
    "Cómo juega Boca: goles esperados, comparación contra los otros 29 equipos de la liga y el mapa de todos sus remates con el xG de cada uno.",
};

/**
 * EL JUEGO — cómo juega Boca.
 *
 * Junta dos cosas que antes estaban separadas y nunca debieron estarlo: la
 * comparación contra la liga y el mapa de remates. Las dos responden la misma
 * pregunta, una desde el promedio y la otra desde el detalle.
 */

const unDecimal = (v: number) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dosDecimales = (v: number) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const entero = (v: number) => v.toLocaleString("es-AR");

export default function Juego() {
  const xgPorRemate = resumenRemates.remates
    ? resumenRemates.xg / resumenRemates.remates
    : 0;

  return (
    <div className="py-6">
      <h1 className="titular mb-3.5">Cómo juega Boca</h1>

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra
          rotulo="Remates"
          valor={entero(resumenRemates.remates)}
          pie={`${entero(resumenRemates.al_arco)} al arco`}
        />
        <Cifra
          rotulo="Goles esperados"
          valor={unDecimal(resumenRemates.xg)}
          pie={`Convirtió ${resumenRemates.goles}`}
        />
        <Cifra rotulo="xG por remate" valor={dosDecimales(xgPorRemate)} />
        <Cifra
          rotulo="xG recibido"
          valor={unDecimal(resumenRemates.xg_en_contra)}
          pie={`${entero(resumenRemates.remates_en_contra)} remates en contra`}
        />
      </div>

      <h2 className="titular-2 mb-2.5 mt-7">Contra los otros 29 de la liga</h2>
      <ComparacionLiga />

      <h2 className="titular-2 mb-2.5 mt-7">Dónde remata</h2>
      <MapaRemates remates={remates} conFiltros />
    </div>
  );
}
