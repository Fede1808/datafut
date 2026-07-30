import Link from "next/link";
import { TablaTitulo } from "@/components/TablaTitulo";
import { posicionesCompletas, ranking, torneo, temporada, metadatos } from "@/lib/datos";

export const metadata = {
  title: "Quién puede salir campeón — Liga Profesional",
};

/** Los 30 equipos con su chance de título, de playoffs y su fuerza estimada. */
export default function Titulo() {
  const maximo = ranking[0]?.campeon ?? 0;
  const lider = ranking[0];

  return (
    <div className="py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-borde pb-2">
        <h1 className="titular">Campeón</h1>
        <p className="num text-[10px] uppercase tracking-[0.08em] text-tinta3">
          {torneo} {temporada} ·{" "}
          {metadatos.simulaciones.toLocaleString("es-AR")} simulaciones
        </p>
      </div>

      {/*
        El favorito, a escala de scoreboard y FUERA de la tabla: adentro se
        movería al reordenar por otra columna, y lo que este bloque afirma es
        quién puntea por título, no quién está primero en la lista de abajo.
      */}
      {lider && (
        <div className="tarjeta mt-5 overflow-hidden">
          <div className="banda-club" aria-hidden>
            <span style={{ background: lider.colores[0] }} />
            <span style={{ background: lider.colores[1] }} />
            <span style={{ background: lider.colores[0] }} />
          </div>
          <Link href={`/equipo/${lider.slug}`} className="fila lider p-4">
            <span className="lider-cifra">
              {lider.campeon.toFixed(1)}
              <sup>%</sup>
            </span>
            <span className="min-w-0">
              <span className="titular-2 enlace-ficha block truncate">
                {lider.equipo}
              </span>
              <span className="num mt-1 block text-[11px] text-tinta3">
                Zona {lider.zona} · playoffs {lider.playoffs.toFixed(1)}% ·
                descenso {lider.descenso.toFixed(1)}%
              </span>
            </span>
          </Link>
        </div>
      )}

      <div className="tarjeta mt-4 p-4">
        <TablaTitulo filas={posicionesCompletas} />
      </div>

      <div className="num mt-5 grid gap-2 border-t border-borde pt-3 text-[9.5px] leading-relaxed text-tinta3 sm:grid-cols-2">
        <p>
          Techo {maximo.toFixed(1)}%: el título son cuatro partidos únicos
          seguidos.
        </p>
        <p>
          Ataque y defensa: goles que hace y que evita respecto del promedio de
          la liga. Conv.: título dividido playoffs.
        </p>
        <p className="sm:col-span-2">
          <strong className="font-semibold text-tinta2">xGdif:</strong> goles
          esperados a favor menos en contra, en toda la temporada. Ataque y
          defensa salen del modelo; el xGdif sale de lo que el equipo generó en
          la cancha. Datos de FotMob.
        </p>
      </div>
    </div>
  );
}
