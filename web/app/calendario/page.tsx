import { Almanaque } from "@/components/Almanaque";
import { torneoCalendario, temporadaCalendario, totalPartidos } from "@/lib/calendario";

export const metadata = {
  title: "Calendario — Liga Profesional",
  description:
    "Las 16 fechas de la Liga Profesional argentina, partido por partido: jugadas, la que se juega ahora y las que todavía faltan.",
};

/**
 * La vista fecha a fecha del torneo completo.
 *
 * Server component fino a propósito: acá sólo va el encabezado, que es el
 * mismo dato repetido en cada página del sitio (torneo, temporada, cuánto
 * pesa la vista). Todo lo demás —la tira de las 16 fechas, el estado de cada
 * una, la tarjeta de la fecha elegida— es `Almanaque`, que necesita ser
 * cliente para recordar en cuál fecha está parado el que mira.
 */
export default function Calendario() {
  return (
    <div className="py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-borde pb-2">
        <h1 className="titular">Calendario</h1>
        <p className="num text-[10px] uppercase tracking-[0.08em] text-tinta3">
          {torneoCalendario} {temporadaCalendario} · {totalPartidos} partidos
        </p>
      </div>

      <div className="mt-5">
        <Almanaque />
      </div>
    </div>
  );
}
