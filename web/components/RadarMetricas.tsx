"use client";

import {
  EJES_RADAR,
  METRICAS_RADAR,
  PERCENTILES,
  SERIES,
  MAX_RADAR,
} from "@/lib/visualizaciones";
import { formatear, type EquipoStats } from "@/lib/estadisticas";

/**
 * El perfil de hasta tres equipos en ocho métricas, en percentiles.
 *
 * PARA QUÉ SIRVE Y PARA QUÉ NO. El radar sirve para ver una FORMA: si un equipo
 * es parejo, si está hundido de un lado, si dos equipos que salen igual en la
 * tabla llegaron ahí por caminos distintos. No sirve para medir. Nadie puede
 * mirar dos vértices y decir cuál está 7 percentiles más afuera.
 *
 * Y hay un motivo por el que engaña: el ojo compara ÁREAS, y el área de un
 * polígono crece con el cuadrado del radio. Un equipo con el doble de percentil
 * dibuja cuatro veces la superficie, y el gráfico exagera la diferencia sin que
 * nadie se dé cuenta. Por eso todo lo de abajo:
 *
 *   - TOPE DE TRES. Del cuarto en adelante los polígonos se pisan y no se lee
 *     ninguno. El tope es una limitación del gráfico, no de los datos.
 *   - CON UNO SE RELLENA, CON DOS O TRES NO. Un área sola se lee como silueta y
 *     ayuda. Dos áreas encimadas generan una tercera zona —la compartida— que no
 *     es de nadie, y ahí el ojo se pone a comparar superficies, que es
 *     exactamente lo que este gráfico hace mal. Con varios van sólo las líneas.
 *   - LOS NÚMEROS SE VAN A LA TABLA cuando hay más de uno. Tres números
 *     apilados por eje, ocho veces, es un plato de fideos. El dibujo da la
 *     silueta; la tabla mide.
 *
 * EL COLOR SIGUE AL EQUIPO, NO A SU POSICIÓN EN LA LISTA. Cada equipo ocupa un
 * slot fijo, así que al destildar el del medio los otros dos NO se repintan. Si
 * el color se asignara por orden, sacar uno cambiaría el color de los que
 * quedan y el usuario leería el cambio como si los datos se hubieran movido.
 */

type Props = {
  /** Los tres slots. `null` es un lugar libre; el índice fija el color. */
  slots: (EquipoStats | null)[];
  /** Los equipos que se pueden elegir, ya filtrados por zona. */
  elegibles: EquipoStats[];
  onAlternar: (slug: string) => void;
};

const CX = 220;
const CY = 212;
const R = 128;
/** Los anillos de referencia. El de 50 va punteado: es la mediana de la liga. */
const ANILLOS = [25, 50, 75, 100];

/** Un vértice del eje `i` a un radio `r`. Arranca arriba y gira como el reloj. */
function punto(i: number, r: number): [number, number] {
  const a = (Math.PI * 2 * i) / EJES_RADAR.length - Math.PI / 2;
  return [CX + Math.cos(a) * r, CY + Math.sin(a) * r];
}

const poligono = (radios: number[]): string =>
  radios.map((r, i) => punto(i, r).map((v) => v.toFixed(1)).join(",")).join(" ");

export function RadarMetricas({ slots, elegibles, onAlternar }: Props) {
  const enRadar = slots.filter((e): e is EquipoStats => e !== null);
  const libres = MAX_RADAR - enRadar.length;
  const relleno = enRadar.length === 1;

  return (
    <div>
      {/* --- Elegir equipos. Los chips prendidos se pintan del color de su slot,
          que es la única leyenda que hace falta cuando hay uno solo. --- */}
      <div className="etiqueta mb-2">Comparar (hasta {MAX_RADAR})</div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Elegir equipos para comparar">
        {elegibles.map((e) => {
          const i = slots.findIndex((s) => s?.slug === e.slug);
          const puesto = i >= 0;
          return (
            <button
              key={e.slug}
              type="button"
              onClick={() => onAlternar(e.slug)}
              aria-pressed={puesto}
              // Sin lugar libre, los que no están elegidos se apagan: es más
              // honesto que aceptar el click y descartarlo en silencio.
              disabled={!puesto && libres === 0}
              className="pestania pestania-chica disabled:cursor-not-allowed disabled:opacity-40"
              style={puesto ? { background: SERIES[i], borderColor: SERIES[i], color: "#fff" } : undefined}
            >
              {e.equipo}
            </button>
          );
        })}
      </div>

      {enRadar.length === 0 ? (
        <p className="mt-4 text-[13px] text-tinta3">
          Elegí de uno a tres equipos para dibujar su perfil.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
          <svg
            viewBox="0 0 440 430"
            className="h-auto w-full"
            role="img"
            aria-label={`Perfil por percentiles de ${enRadar.map((e) => e.equipo).join(", ")} en ocho métricas`}
          >
            {/* La telaraña. El anillo del 50 punteado y más oscuro: es la
                referencia contra la que se lee todo lo demás. */}
            {ANILLOS.map((p) => (
              <polygon
                key={p}
                points={poligono(EJES_RADAR.map(() => (R * p) / 100))}
                fill="none"
                stroke={p === 50 ? "var(--color-tinta4)" : "var(--color-borde)"}
                strokeWidth="1"
                strokeDasharray={p === 50 ? "3 3" : undefined}
              />
            ))}
            {EJES_RADAR.map((clave, i) => {
              const [x, y] = punto(i, R);
              return (
                <line
                  key={clave}
                  x1={CX}
                  y1={CY}
                  x2={x.toFixed(1)}
                  y2={y.toFixed(1)}
                  stroke="var(--color-borde)"
                  strokeWidth="1"
                />
              );
            })}

            {enRadar.map((e) => {
              const i = slots.findIndex((s) => s?.slug === e.slug);
              const color = SERIES[i];
              const radios = EJES_RADAR.map((k) => (R * (PERCENTILES[k][e.slug] ?? 0)) / 100);
              return (
                <g key={e.slug}>
                  <polygon
                    points={poligono(radios)}
                    fill={relleno ? color : "none"}
                    fillOpacity={relleno ? 0.2 : 0}
                    stroke={color}
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                  {radios.map((r, j) => {
                    const [x, y] = punto(j, r);
                    return (
                      <circle
                        key={EJES_RADAR[j]}
                        cx={x.toFixed(1)}
                        cy={y.toFixed(1)}
                        r="4.5"
                        fill={color}
                        stroke="#fff"
                        strokeWidth="2"
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* Las etiquetas, afuera del último anillo. Se recortan a dos
                palabras: "xG en contra por partido" entero se pisaría con el
                eje de al lado, y el nombre completo está en la tabla. */}
            {METRICAS_RADAR.map((m, i) => {
              const [lx, ly] = punto(i, R + 36);
              const anclaje = Math.abs(lx - CX) < 12 ? "middle" : lx > CX ? "start" : "end";
              return (
                <g key={m.clave}>
                  <text
                    x={lx.toFixed(1)}
                    y={ly.toFixed(1)}
                    textAnchor={anclaje}
                    fontSize="11"
                    fill="var(--color-tinta2)"
                  >
                    {m.label.split(" ").slice(0, 2).join(" ")}
                  </text>
                  {relleno && (
                    <text
                      x={lx.toFixed(1)}
                      y={(ly + 13).toFixed(1)}
                      textAnchor={anclaje}
                      fontSize="12"
                      fontWeight="700"
                      fill="var(--color-tinta)"
                    >
                      {PERCENTILES[m.clave][enRadar[0].slug] ?? "—"}
                    </text>
                  )}
                </g>
              );
            })}
            {/* El centro es el peor de la liga, no el cero de la métrica. Sin
                esta marca el radar se lee como si el centro fuera "nada". */}
            <text x={CX} y={CY + 4} textAnchor="middle" fontSize="10" fill="var(--color-tinta4)">
              peor
            </text>
          </svg>

          {/* --- La tabla. Es la que compara de verdad. --- */}
          <div className="overflow-x-auto">
            <table className="num w-full border-collapse text-[12px]">
              <thead>
                <tr>
                  <th className="border-b border-borde py-1.5 pr-2 text-left font-semibold text-tinta3">
                    Métrica
                  </th>
                  {enRadar.map((e) => {
                    const i = slots.findIndex((s) => s?.slug === e.slug);
                    return (
                      <th
                        key={e.slug}
                        className="border-b border-borde px-2 py-1.5 text-right font-semibold"
                        style={{ color: SERIES[i] }}
                      >
                        {e.equipo}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {METRICAS_RADAR.map((m) => {
                  const pcts = enRadar.map((e) => PERCENTILES[m.clave][e.slug] ?? 0);
                  const top = Math.max(...pcts);
                  return (
                    <tr key={m.clave}>
                      <td className="border-b border-borde2 py-1.5 pr-2 text-tinta2">
                        {m.label}
                      </td>
                      {enRadar.map((e, j) => (
                        <td
                          key={e.slug}
                          // La negrita marca al mejor DE LOS ELEGIDOS en ese eje,
                          // no al mejor de la liga. Con un solo equipo no se
                          // marca nada: sería el mejor de sí mismo.
                          className={`border-b border-borde2 px-2 py-1.5 text-right ${
                            pcts[j] === top && enRadar.length > 1
                              ? "font-bold text-tinta"
                              : "text-tinta2"
                          }`}
                          title={`${m.label}: ${formatear(
                            typeof e[m.clave] === "number" ? (e[m.clave] as number) : null,
                            m,
                          )}`}
                        >
                          {pcts[j]}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="num mt-2 text-[9.5px] leading-relaxed text-tinta3">
              Los números son percentiles sobre los 30 equipos: 100 es el mejor de
              la liga en esa métrica, 50 el promedio. El valor real de cada
              métrica aparece al apoyar el puntero sobre la celda.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
