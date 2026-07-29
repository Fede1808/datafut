import type { Metadata } from "next";
import { Comparador } from "@/components/Comparador";
import { Kpis } from "@/components/Kpis";
import { TablaPlantel } from "@/components/TablaPlantel";
import {
  fichasJugador,
  minPartidos,
  plantel,
  planteles,
  temporadaClub,
} from "@/lib/club";

export const metadata: Metadata = {
  title: "El plantel — Ribera",
  description:
    "Minutos, rating, goles contra goles esperados, duelos y recuperaciones de cada jugador de Boca, ordenables por cualquier columna, más un comparador por 90 minutos.",
};

/**
 * EL PLANTEL — ¿quiénes juegan?
 *
 * La tabla muestra los que tienen `minPartidos` o más. Los que jugaron menos
 * siguen teniendo ficha y se llega por URL: no están escondidos, están fuera de
 * una tabla que ordenada por rating los pondría primeros con un partido.
 */

const dosDecimales = (v: number) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Plantel() {
  const usados = plantel.filter((p) => p.minutos > 0);
  const minutosTotales = usados.reduce((a, p) => a + p.minutos, 0);
  const conRating = usados.filter((p) => p.rating !== null);
  const ratingMedio = conRating.length
    ? conRating.reduce((a, p) => a + (p.rating ?? 0), 0) / conRating.length
    : 0;
  const goleador = [...usados].sort((a, b) => b.goles - a.goles)[0];

  return (
    <div className="py-8 pb-16">
      <p className="etiqueta mb-2">El plantel</p>
      <h1 className="titular mb-6">Quiénes juegan</h1>

      <Kpis
        items={[
          {
            valor: String(usados.length),
            etiqueta: `Jugadores usados en ${temporadaClub}`,
            acento: true,
          },
          {
            valor: minutosTotales.toLocaleString("es-AR"),
            etiqueta: "Minutos repartidos",
          },
          { valor: dosDecimales(ratingMedio), etiqueta: "Rating promedio del plantel" },
          {
            valor: goleador ? String(goleador.goles) : "—",
            etiqueta: goleador ? `Máximo goleador: ${goleador.jugador}` : "Sin goles",
          },
        ]}
      />

      <h2 className="titular-2 mb-1.5 mt-10">Uno por uno</h2>
      <p className="mb-3 max-w-[62ch] text-[13px] text-tinta2">
        {planteles.length} jugadores con {minPartidos} o más partidos. Ordená por
        cualquier columna; tocá un nombre para ver su ficha completa.
      </p>
      <TablaPlantel plantel={planteles} />

      <h2 className="titular-2 mb-1.5 mt-10">Comparador</h2>
      <p className="mb-3 max-w-[62ch] text-[13px] text-tinta2">
        Dos jugadores, las mismas métricas, por 90 minutos. Elegí a cualquiera de
        los dos lados.
      </p>
      <Comparador plantel={plantel} fichas={fichasJugador} />
    </div>
  );
}
