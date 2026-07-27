import { TablaPosiciones } from "@/components/TablaPosiciones";
import {
  posicionesCompletas,
  zonas,
  clasificanPorZona,
  partidosJugados,
  torneo,
  temporada,
} from "@/lib/datos";

export const metadata = {
  title: "Tabla de posiciones — Liga Profesional",
};

/**
 * La tabla de posiciones, con las probabilidades del modelo pegadas al lado.
 *
 * Es el contexto que le da sentido al resto: un 40% de playoffs se lee muy
 * distinto si el equipo está 3° que si está 12°.
 */
export default function Tabla() {
  return (
    <div className="py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#2e2b27] pb-2">
        <h1 className="titular">Posiciones</h1>
        <p className="num text-[10px] uppercase tracking-[0.08em] text-[#6d6862]">
          {torneo} {temporada} · {partidosJugados} partidos jugados
        </p>
      </div>

      <div className="mt-5">
        <TablaPosiciones
          filas={posicionesCompletas}
          zonas={zonas()}
          clasifican={clasificanPorZona}
        />
      </div>

      <div className="num mt-5 grid gap-2 border-t border-[#2e2b27] pt-3 text-[9.5px] leading-relaxed text-[#6d6862] sm:grid-cols-2">
        <p className="flex items-center gap-2">
          <span aria-hidden className="inline-block h-[2px] w-6 shrink-0 bg-[#5cc27e]" />
          Corte de playoffs: los {clasificanPorZona} primeros de cada zona.
        </p>
        <p>
          Orden: puntos, diferencia de gol, goles a favor. Terminar primero no
          da el título; el campeón sale de los cruces.
        </p>
        <p className="flex items-center gap-2">
          <span aria-hidden className="inline-flex shrink-0 gap-[2px]">
            <span className="inline-block h-[10px] w-[5px] bg-[#5cc27e]" />
            <span className="inline-block h-[10px] w-[5px] bg-[#6d6862]" />
            <span className="inline-block h-[10px] w-[5px] bg-[#f2607d]" />
          </span>
          Forma: ganó, empató, perdió. Los últimos seis, del más viejo al más
          nuevo.
        </p>
        <p>
          Baja: chance de descender. Bajan dos, el último de la tabla de
          promedios (2024-2026) y el último de la anual.
        </p>
        {/* La línea que explica el xG. Discreta, pero al lado de la columna que
            lo usa: mucha gente ve "xGdif" por primera vez acá. */}
        <p className="sm:col-span-2">
          <strong className="font-semibold text-[#a09a90]">xGdif:</strong> goles
          esperados a favor menos en contra. A cada remate se le pone la
          probabilidad de terminar en gol según desde dónde se pateó, y se
          suman. La DG dice qué pasó; el xGdif, cada cuánto tendría que pasar.
          Cuando los dos no coinciden, el equipo viene desperdiciando o teniendo
          suerte. Datos de FotMob; la ficha de cada equipo lo abre entero.
        </p>
      </div>
    </div>
  );
}
