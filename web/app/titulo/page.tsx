import { TablaTitulo } from "@/components/TablaTitulo";
import { posicionesCompletas, ranking, torneo, temporada, metadatos } from "@/lib/datos";

export const metadata = {
  title: "Quién puede salir campeón — Liga Profesional",
};

/** Los 30 equipos con su chance de título, de playoffs y su fuerza estimada. */
export default function Titulo() {
  const maximo = ranking[0]?.campeon ?? 0;

  return (
    <div className="py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#2e2b27] pb-2">
        <h1 className="titular">Campeón</h1>
        <p className="num text-[10px] uppercase tracking-[0.08em] text-[#6d6862]">
          {torneo} {temporada} ·{" "}
          {metadatos.simulaciones.toLocaleString("es-AR")} simulaciones
        </p>
      </div>

      <div className="mt-5">
        <TablaTitulo filas={posicionesCompletas} />
      </div>

      <div className="num mt-5 grid gap-2 border-t border-[#2e2b27] pt-3 text-[9.5px] leading-relaxed text-[#6d6862] sm:grid-cols-2">
        <p>
          Techo {maximo.toFixed(1)}%: el título son cuatro partidos únicos
          seguidos.
        </p>
        <p>
          Ataque y defensa: goles que hace y que evita respecto del promedio de
          la liga. Conv.: título dividido playoffs.
        </p>
      </div>
    </div>
  );
}
