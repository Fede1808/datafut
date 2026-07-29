import { compararConLaLiga } from "@/lib/club";
import type { ClaveStat } from "@/lib/datos";

/**
 * Dónde está el club dentro del rango de la liga, métrica por métrica.
 *
 * El gráfico es una pista con dos marcas: el punto azul es el club, la línea
 * gris el promedio de la liga. Se eligió esto en vez de una barra porque una
 * barra dice "cuánto" y acá la pregunta es "dónde, comparado con los demás" —
 * y para eso hace falta ver los extremos.
 *
 * `mejorAlto: false` invierte el puesto en las métricas donde menos es mejor.
 * Sin eso, la mejor defensa de la liga aparecería trigésima.
 */

const METRICAS: { clave: ClaveStat; label: string; mejorAlto: boolean }[] = [
  { clave: "xg", label: "Goles esperados a favor", mejorAlto: true },
  { clave: "xg_contra", label: "Goles esperados en contra", mejorAlto: false },
  { clave: "xg_dif", label: "Diferencia de goles esperados", mejorAlto: true },
  { clave: "posesion", label: "Posesión", mejorAlto: true },
  { clave: "remates", label: "Remates por partido", mejorAlto: true },
  { clave: "chances_claras", label: "Chances claras", mejorAlto: true },
  { clave: "duelos_ganados", label: "Duelos ganados", mejorAlto: true },
  { clave: "toques_en_area_rival", label: "Toques en el área rival", mejorAlto: true },
  // No son pases progresivos y no hay que llamarlos así: los pases
  // progresivos eran una métrica de Opta y se fueron con Opta en enero de
  // 2026. Ver docs/fuentes-stats-avanzadas.md.
  { clave: "pases_campo_rival", label: "Pases en campo rival", mejorAlto: true },
];

const unDecimal = (v: number) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function ComparacionLiga() {
  const filas = METRICAS.map((m) => ({
    ...m,
    dato: compararConLaLiga(m.clave, m.mejorAlto),
  })).filter((f) => f.dato !== null);

  return (
    <div className="tarjeta">
      {filas.map(({ clave, label, dato }) => {
        const d = dato!;
        const ancho = d.max === d.min ? 50 : ((d.valor - d.min) / (d.max - d.min)) * 100;
        const prom =
          d.max === d.min ? 50 : ((d.promedio - d.min) / (d.max - d.min)) * 100;
        return (
          <div
            key={clave}
            className="grid grid-cols-[1fr_64px] items-center gap-x-3 gap-y-1 border-b border-borde2 py-2.5 last:border-b-0 sm:grid-cols-[200px_1fr_78px]"
          >
            <span className="text-[13px] font-semibold">{label}</span>
            <span
              className="relative col-span-2 h-3 rounded-full bg-tarjeta2 sm:col-span-1"
              role="img"
              aria-label={`${label}: ${unDecimal(d.valor)}, puesto ${d.puesto} de ${d.total}`}
            >
              <span
                className="absolute -top-[3px] -bottom-[3px] w-0.5 bg-tinta4"
                style={{ left: `${prom}%` }}
              />
              <span
                className="absolute top-1/2 -ml-[7px] -mt-[7px] h-3.5 w-3.5 rounded-full border-2 border-fondo bg-acento"
                style={{ left: `${ancho}%`, boxShadow: "0 0 0 1px oklch(0.34 0.02 262)" }}
              />
            </span>
            <span
              className="num text-right text-[20px] font-bold leading-none"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {unDecimal(d.valor)}
              <span
                className="block text-[11.5px] font-normal text-tinta4"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {d.puesto}º
              </span>
            </span>
          </div>
        );
      })}
      <p className="mt-3 text-[12.5px] text-tinta4">
        El punto es Boca. La línea gris, el promedio de la liga.
      </p>
    </div>
  );
}
