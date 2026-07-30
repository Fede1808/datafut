"use client";

import {
  METRICAS_VIZ,
  PERCENTILES,
  PUESTOS,
  RAMPA,
  ZONA_POR_SLUG,
  colorDeCalor,
  tintaDeCalor,
} from "@/lib/visualizaciones";
import { formatear, LEYENDA_DIRECCION, type EquipoStats } from "@/lib/estadisticas";

/**
 * Los 30 equipos contra las 27 métricas direccionales, en una sola grilla.
 *
 * QUÉ RESUELVE QUE LOS RANKINGS DE ARRIBA NO. El panel de rankings contesta
 * "¿quién es el mejor en xG?" perfecto, pero para contestar "¿este equipo es
 * bueno en todo o sólo en una cosa?" hay que abrir 27 rankings y acordarse de
 * los 27 puestos. Acá esa pregunta se contesta mirando si la fila es de un
 * color parejo o si tiene un bloque rojo en el medio.
 *
 * LAS CELDAS SON PERCENTILES, NO VALORES. Un 0.72 de xG y un 70.8% de precisión
 * de pase no se pueden pintar con la misma escala: no comparten unidad ni
 * rango. El percentil los lleva a todos a la misma vara —qué lugar ocupa en la
 * liga— que es lo único comparable entre columnas. El valor real está en el
 * `title` de cada celda, no se pierde.
 *
 * EL COLOR VA DE ROJO A AZUL PASANDO POR GRIS, y nunca de rojo a verde. El
 * verde/rojo semántico que el sitio usa en subidas y bajadas colapsa bajo
 * protanopía: los dos extremos quedan del mismo tono y la grilla entera deja
 * de decir nada. El porqué completo, con las mediciones, está en `RAMPA`.
 */

type Props = {
  /** Los equipos a mostrar, ya filtrados. */
  filas: EquipoStats[];
  /** La métrica por la que se ordena la grilla. */
  ordenPor: string;
  onOrdenar: (clave: string) => void;
};

export function MapaCalor({ filas, ordenPor, onOrdenar }: Props) {
  if (filas.length === 0) {
    return (
      <p className="py-6 text-center text-[13px] text-tinta3">
        No quedó ningún equipo con los filtros de arriba.
      </p>
    );
  }

  // Se ordena por percentil y no por valor: es el mismo orden, pero deja las
  // métricas de "menos es mejor" para el lado correcto sin un caso especial.
  const ordenadas = [...filas].sort(
    (a, b) => (PERCENTILES[ordenPor][b.slug] ?? -1) - (PERCENTILES[ordenPor][a.slug] ?? -1),
  );

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="num border-collapse text-[11px]">
          <thead>
            <tr>
              {/* La columna del equipo queda fija: con 27 columnas, para cuando
                  llegás a "duelos ganados" ya no sabés de quién es la fila. */}
              <th className="sticky left-0 z-10 bg-tarjeta px-2 pb-1 text-left" />
              {METRICAS_VIZ.map((m) => (
                <th key={m.clave} className="px-0 pb-1 align-bottom">
                  <button
                    type="button"
                    onClick={() => onOrdenar(m.clave)}
                    aria-pressed={m.clave === ordenPor}
                    title={`Ordenar por ${m.label} · ${LEYENDA_DIRECCION[m.direccion].texto}`}
                    className={`h-[112px] w-[22px] cursor-pointer whitespace-nowrap text-left text-[10px] leading-none ${
                      m.clave === ordenPor ? "font-bold text-tinta" : "text-tinta3"
                    }`}
                    style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                  >
                    {m.label}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((e) => (
              <tr key={e.slug}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 whitespace-nowrap border-r border-borde bg-tarjeta py-0.5 pr-2 text-left text-[11px] font-normal text-tinta"
                >
                  <span
                    aria-hidden
                    className="mr-1.5 inline-block h-[10px] w-[3px] align-middle"
                    style={{ background: e.colores?.[0] ?? "var(--color-tinta4)" }}
                  />
                  {e.equipo}
                  <small className="ml-1 text-[9px] text-tinta4">
                    {ZONA_POR_SLUG[e.slug] ?? ""}
                  </small>
                </th>
                {METRICAS_VIZ.map((m) => {
                  const pct = PERCENTILES[m.clave][e.slug];
                  const valor = typeof e[m.clave] === "number" ? (e[m.clave] as number) : null;
                  if (pct === null) {
                    return (
                      <td
                        key={m.clave}
                        className="border border-borde2 bg-tarjeta2 text-center text-tinta4"
                      >
                        —
                      </td>
                    );
                  }
                  return (
                    <td
                      key={m.clave}
                      className="w-[22px] border border-borde text-center tabular-nums"
                      style={{ background: colorDeCalor(pct) ?? undefined, color: tintaDeCalor(pct) }}
                      title={`${e.equipo} · ${m.label}: ${formatear(valor, m)} · percentil ${pct} · puesto ${
                        PUESTOS[m.clave][e.slug] ?? "—"
                      } de 30 · ${LEYENDA_DIRECCION[m.direccion].texto}`}
                    >
                      {pct}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- La leyenda. Sin esto los números de las celdas se leen como si
          fueran el valor de la métrica. --- */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="etiqueta">Peor de la liga</span>
        <span className="flex">
          {RAMPA.map((c) => (
            <i key={c} className="block h-[12px] w-[26px]" style={{ background: c }} />
          ))}
        </span>
        <span className="etiqueta">Mejor</span>
      </div>
      <p className="num mt-2 max-w-[74ch] text-[9.5px] leading-relaxed text-tinta3">
        Cada celda es el <strong className="font-semibold text-tinta2">percentil</strong> del
        equipo en esa métrica sobre los 30 de la liga, no el valor: 100 es el mejor, 50 el
        promedio. En las métricas de «menos es mejor» el 100 ya está del lado correcto. El valor
        real, el puesto y la dirección aparecen al apoyar el puntero sobre la celda. Tocá el
        título de una columna para ordenar por ella.
      </p>
    </div>
  );
}
