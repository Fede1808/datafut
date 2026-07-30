import type { PartidoRacha } from "@/lib/datos";

/**
 * Los últimos partidos de un equipo, del más viejo al más nuevo.
 *
 * SVG a mano, no una librería de gráficos: son seis rectángulos y un color.
 * Van cuadrados y no círculos por la misma razón que el resto del sitio usa
 * filetes: la grilla del boletín impreso no tiene esquinas redondeadas.
 *
 * El orden importa y es el mismo que el de una lectura: izquierda = hace más
 * tiempo, derecha = el último partido. Por eso el más reciente lleva un
 * remate ámbar arriba, para que se sepa de qué lado empezar a leer.
 */
export function Racha({
  ultimos,
  alto = 12,
  ancho = 7,
  separacion = 2,
}: {
  ultimos: PartidoRacha[];
  alto?: number;
  ancho?: number;
  separacion?: number;
}) {
  if (ultimos.length === 0) return null;

  const paso = ancho + separacion;
  const total = ultimos.length * paso - separacion;

  return (
    <svg
      width={total}
      height={alto}
      viewBox={`0 0 ${total} ${alto}`}
      role="img"
      aria-label={`Últimos ${ultimos.length} partidos, del más viejo al más nuevo: ${ultimos
        .map((u) => `${texto(u.r)} ${u.gf}-${u.gc} con ${u.rival}`)
        .join(", ")}`}
      className="shrink-0 overflow-visible"
    >
      {ultimos.map((u, i) => {
        const ultimo = i === ultimos.length - 1;
        return (
          <g key={`${u.fecha}-${u.rival}`}>
            <rect
              x={i * paso}
              y={0}
              width={ancho}
              height={alto}
              fill={COLOR[u.r]}
              opacity={ultimo ? 1 : 0.55 + (0.45 * i) / ultimos.length}
            />
            {ultimo && (
              <rect x={i * paso} y={-3} width={ancho} height={2} fill="var(--color-tinta)" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

const COLOR: Record<PartidoRacha["r"], string> = {
  G: "var(--color-sube)",
  E: "var(--color-tinta3)",
  P: "var(--color-baja)",
};

function texto(r: PartidoRacha["r"]): string {
  return r === "G" ? "ganó" : r === "E" ? "empató" : "perdió";
}
