import type { PuntosDist } from "@/lib/datos";

/**
 * Con cuántos puntos termina el equipo, en las 10.000 simulaciones.
 *
 * POR QUÉ NO ALCANZA EL PROMEDIO. "Termina con 21 puntos" suena a certeza, y
 * no lo es: el mismo equipo termina entre 14 y 27 según cómo le salgan los
 * dieciséis partidos. Publicar sólo el promedio es esconder eso. El histograma
 * muestra la forma completa: dónde está el bulto y hasta dónde llegan las
 * puntas.
 *
 * La franja ámbar es el rango del 80% central (del percentil 10 al 90): cuatro
 * de cada cinco veces el equipo termina ahí adentro. La línea clara es la
 * mediana.
 *
 * SVG escrito a mano. Son barras y dos líneas; una librería de gráficos pesaría
 * más que toda la página. Las barras se estiran al ancho del contenedor
 * (`preserveAspectRatio="none"`) y por eso los números del eje van en HTML
 * abajo y no adentro del SVG: si fueran `<text>`, el estirado los deformaría.
 */
export function DistribucionPuntos({
  dist,
  p10,
  p50,
  p90,
  alto = 56,
}: {
  dist: PuntosDist;
  p10: number;
  p50: number;
  p90: number;
  alto?: number;
}) {
  const n = dist.probs.length;
  if (n === 0) return null;

  const ancho = 100; // unidades del viewBox, no píxeles
  const paso = ancho / n;
  const maximo = Math.max(...dist.probs);
  const pos = (pts: number) => (pts - dist.desde) * paso;
  const hasta = dist.desde + n - 1;

  return (
    <div>
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        preserveAspectRatio="none"
        className="block w-full"
        style={{ height: alto }}
        role="img"
        aria-label={`Distribución de puntos al final del torneo: la mediana es ${p50} puntos y el 80% de las simulaciones termina entre ${p10} y ${p90}.`}
      >
        <rect
          x={pos(p10)}
          y={0}
          width={Math.max(pos(p90) + paso - pos(p10), paso)}
          height={alto}
          fill="#1a1c1f"
          opacity={0.07}
        />

        {dist.probs.map((p, i) => {
          const h = maximo > 0 ? (p / maximo) * alto : 0;
          const puntos = dist.desde + i;
          const dentro = puntos >= p10 && puntos <= p90;
          return (
            <rect
              key={puntos}
              x={i * paso + paso * 0.14}
              y={alto - h}
              width={paso * 0.72}
              height={h}
              fill={dentro ? "#1a1c1f" : "#8d9299"}
            />
          );
        })}

        <rect
          x={pos(p50) + paso * 0.14}
          y={0}
          width={paso * 0.72}
          height={alto}
          fill="#1a1c1f"
          opacity={0.35}
        />
      </svg>

      <div className="num mt-1 flex justify-between border-t border-[#d3d6d1] pt-1 text-[9px] text-[#6d7280]">
        <span>{dist.desde}</span>
        <span className="text-[#4c5058]">mediana {p50}</span>
        <span>{hasta}</span>
      </div>
    </div>
  );
}
