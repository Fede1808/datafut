import Link from "next/link";
import { Chip } from "@/components/Chip";
import {
  tablaDeZona,
  clasificanPorZona,
  partidosJugados,
  torneo,
  temporada,
  type FilaTabla,
} from "@/lib/datos";

export const metadata = {
  title: "Tabla de posiciones — Liga Profesional",
};

/**
 * La tabla de posiciones de las dos zonas.
 *
 * Es el contexto que le da sentido a todo lo demás del sitio: un 40% de
 * playoffs se lee muy distinto si el equipo está 3° que si está 12°.
 */
export default function Tabla() {
  return (
    <div className="px-4 py-5">
      <h1 className="font-[family-name:var(--font-display)] text-[20px] font-bold">
        Tabla de posiciones
      </h1>
      <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] text-[#7c8089]">
        {torneo} {temporada} · {partidosJugados} partidos jugados
      </p>

      <div className="mt-5 grid gap-5 md:grid-cols-2 md:gap-6">
        <TablaZona zona="A" />
        <TablaZona zona="B" />
      </div>

      <p className="mt-5 flex items-center gap-2 font-[family-name:var(--font-mono)] text-[9.5px] text-[#565962]">
        <span className="inline-block h-[2px] w-6 bg-[#5cc27e]" />
        Línea de corte: los {clasificanPorZona} primeros de cada zona clasifican
        a los playoffs.
      </p>

      <p className="mt-3 font-[family-name:var(--font-mono)] text-[9.5px] leading-relaxed text-[#565962]">
        Los puestos se ordenan por puntos, después por diferencia de gol y
        después por goles a favor — los mismos criterios que usa la simulación
        para decidir quién entra a playoffs. Terminar primero no da el título:
        el campeón sale de los cruces.
      </p>
    </div>
  );
}

function TablaZona({ zona }: { zona: string }) {
  const filas = tablaDeZona(zona);

  return (
    <section>
      <h2 className="etiqueta">Zona {zona}</h2>

      <div className="mt-2 overflow-hidden rounded-[3px] border border-[#2a2c33]">
        <div className="flex items-baseline gap-2 border-b border-[#2a2c33] px-3 py-2">
          <span className="etiqueta w-5 text-right">#</span>
          <span className="etiqueta flex-1">Equipo</span>
          <span className="etiqueta w-6 text-right">PJ</span>
          <span className="etiqueta hidden w-5 text-right sm:inline">G</span>
          <span className="etiqueta hidden w-5 text-right sm:inline">E</span>
          <span className="etiqueta hidden w-5 text-right sm:inline">P</span>
          <span className="etiqueta w-7 text-right">DG</span>
          <span className="etiqueta w-7 text-right">Pts</span>
        </div>

        {filas.map((f) => (
          <FilaEquipo
            key={f.slug}
            f={f}
            corte={f.puesto === clasificanPorZona}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * `corte` marca la última fila que clasifica. La línea va abajo de esa fila y
 * no como color de fondo de las ocho de arriba: una tabla teñida a la mitad
 * se lee peor, y lo que se quiere saber de un vistazo es dónde está el límite.
 */
function FilaEquipo({ f, corte }: { f: FilaTabla; corte: boolean }) {
  const dentro = f.puesto <= clasificanPorZona;

  return (
    <Link
      href={`/equipo/${f.slug}`}
      className={`flex items-baseline gap-2 px-3 py-2.5 hover:bg-[#1e2027] ${
        corte
          ? "border-b-2 border-[#5cc27e]"
          : "border-b border-[#2a2c33] last:border-b-0"
      }`}
    >
      <span
        className={`w-5 text-right font-[family-name:var(--font-mono)] text-[11px] ${
          dentro ? "text-[#c9cbd1]" : "text-[#565962]"
        }`}
      >
        {f.puesto}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <Chip colores={f.colores} size={9} />
        <span className="truncate text-[13px]">{f.equipo}</span>
      </span>
      <span className="w-6 text-right font-[family-name:var(--font-mono)] text-[12px] text-[#7c8089]">
        {f.pj}
      </span>
      <span className="hidden w-5 text-right font-[family-name:var(--font-mono)] text-[12px] text-[#7c8089] sm:inline">
        {f.pg}
      </span>
      <span className="hidden w-5 text-right font-[family-name:var(--font-mono)] text-[12px] text-[#7c8089] sm:inline">
        {f.pe}
      </span>
      <span className="hidden w-5 text-right font-[family-name:var(--font-mono)] text-[12px] text-[#7c8089] sm:inline">
        {f.pp}
      </span>
      <span className="w-7 text-right font-[family-name:var(--font-mono)] text-[12px] text-[#7c8089]">
        {f.dif > 0 ? "+" : ""}
        {f.dif}
      </span>
      <span className="w-7 text-right font-[family-name:var(--font-mono)] text-[13px] font-semibold">
        {f.pts}
      </span>
    </Link>
  );
}
