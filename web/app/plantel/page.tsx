import type { Metadata } from "next";
import { TablaPlantel } from "@/components/TablaPlantel";
import { minPartidos, planteles, temporadaClub } from "@/lib/club";

export const metadata: Metadata = {
  title: "El plantel — Boca en números",
  description:
    "Minutos, rating, goles contra goles esperados, duelos y recuperaciones de cada jugador de Boca, ordenables por cualquier columna.",
};

/**
 * EL PLANTEL — quiénes juegan.
 *
 * Se muestran los que tienen `minPartidos` o más. Los que jugaron menos siguen
 * teniendo ficha y se llega por URL: no están escondidos, están fuera de una
 * tabla que ordenada por rating los pondría primeros con un partido.
 */
export default function Plantel() {
  return (
    <div className="py-6">
      <h1 className="titular mb-1.5">El plantel</h1>
      <p className="mb-3.5 text-[12.5px] text-[#6d7280]">
        {planteles.length} jugadores con {minPartidos} o más partidos en{" "}
        {temporadaClub}. Ordená por cualquier columna; tocá un nombre para ver su
        ficha.
      </p>

      <TablaPlantel plantel={planteles} />
    </div>
  );
}
