import { PanelEstadisticas } from "@/components/PanelEstadisticas";
import {
  equiposStats,
  fuenteStats,
  pjMax,
  pjMin,
  temporadaStats,
} from "@/lib/estadisticas";

export const metadata = {
  title: "Estadísticas — Liga Profesional",
  description:
    "Los mejores equipos de la Liga Profesional en 39 métricas de FotMob: xG, definición, posesión, defensa, duelos y disciplina.",
};

/**
 * La pestaña de estadísticas: quién es el mejor en cada cosa.
 *
 * Es la única página del sitio que NO habla de probabilidades. Cuenta lo que
 * ya pasó, medido, para que las probabilidades del resto se puedan discutir
 * con algo en la mano.
 *
 * El detalle de por qué está armada en tres niveles está en
 * `PanelEstadisticas`. Acá sólo va el encabezado y la letra chica, que es
 * server-side porque no cambia nunca.
 */
export default function Estadisticas() {
  // El sitio tiene que poder construirse sin esta capa. Si el pipeline todavía
  // no corrió `clean_stats.py`, la página existe y lo dice, no explota.
  if (equiposStats.length === 0) {
    return (
      <div className="py-5">
        <h1 className="titular">Estadísticas</h1>
        <p className="mt-3 max-w-[60ch] text-[13px] text-[#4c5058]">
          Todavía no hay estadísticas avanzadas cargadas para esta temporada.
        </p>
      </div>
    );
  }

  return (
    <div className="py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#d3d6d1] pb-2">
        <h1 className="titular">Estadísticas</h1>
        <p className="num text-[10px] uppercase tracking-[0.08em] text-[#6d7280]">
          Temporada {temporadaStats} · {equiposStats.length} equipos · {fuenteStats}
        </p>
      </div>

      <p className="mt-3 max-w-[74ch] text-[13px] leading-relaxed text-[#4c5058]">
        Quién es el mejor de la liga en cada cosa. Los datos son de{" "}
        <strong className="font-semibold text-[#1a1c1f]">{fuenteStats}</strong> y
        cubren la <strong className="font-semibold text-[#1a1c1f]">temporada {temporadaStats} completa</strong>:
        Apertura, playoffs y lo que va del Clausura.
      </p>

      <div className="tarjeta mt-5 p-4">
        <PanelEstadisticas />
      </div>

      {/* --- La letra chica. No es trámite: sin esto varios de los rankings de
          arriba se leen mal. --- */}
      <div className="num mt-8 grid gap-2.5 border-t border-[#d3d6d1] pt-3 text-[9.5px] leading-relaxed text-[#6d7280] sm:grid-cols-2">
        <p>
          <strong className="font-semibold text-[#4c5058]">
            No todos jugaron lo mismo.
          </strong>{" "}
          Los equipos llevan entre {pjMin} y {pjMax} partidos. Por eso casi todo
          va como promedio por partido: comparar totales mediría en parte quién
          jugó más. Lo que sí va total está marcado «total de la temporada».
        </p>
        <p className="flex flex-wrap items-center gap-x-1.5">
          <span>
            <strong className="font-semibold text-[#4c5058]">
              La barra mide el valor, no el mérito.
            </strong>{" "}
            En las métricas de «menos es mejor» el primero es el de la barra más
            corta, y por eso esas barras van apagadas y no en ámbar. La marca
          </span>
          <span aria-hidden className="inline-block h-[10px] w-px bg-[#1a1c1f] opacity-60" />
          <span>es el promedio de la liga.</span>
        </p>
        <p>
          <strong className="font-semibold text-[#4c5058]">
            «Depende del contexto» no es una evasiva.
          </strong>{" "}
          Tener más la pelota, rechazar más o atajar más no es jugar mejor: son
          estilos, o síntomas de sufrir. Se rankean igual, pero sin premio.
        </p>
        <p>
          <strong className="font-semibold text-[#4c5058]">Los empates comparten puesto.</strong>{" "}
          Como en una tabla de posiciones: 1, 2, 2, 4. Siete equipos tienen la
          misma cantidad de rojas y ninguno es «el más limpio» por sorteo.
        </p>
        {/* La aclaración de nombres, igual que en la ficha de equipo. No es una
            nota de cortesía: llamarlas "pases progresivos" sería mentir. */}
        <p className="sm:col-span-2">
          <strong className="font-semibold text-[#4c5058]">Sobre dos nombres.</strong>{" "}
          «Pases en campo rival» y «toques en el área rival»{" "}
          <strong className="font-semibold text-[#4c5058]">
            no son pases progresivos
          </strong>
          : esa métrica la definía Opta y dejó de publicarse en enero de 2026.
          Se parecen, miden otra cosa, y por eso van con su nombre real.
        </p>
      </div>
    </div>
  );
}
