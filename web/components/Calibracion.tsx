import type { RangoCalibracion } from "@/lib/modelo";

/**
 * ¿Cuando el modelo dice 60%, pasa el 60% de las veces?
 *
 * El gráfico más honesto que puede publicar un sitio de pronósticos, y el más
 * fácil de leer mal. Por eso NO es un scatter con una diagonal: es una barra
 * por rango, con lo dicho y lo que pasó uno al lado del otro.
 *
 * La diagonal perfecta obliga a comparar dos posiciones en un plano; dos barras
 * pegadas se comparan solas. Y el `n` de cada rango va a la vista porque un
 * rango con 30 casos y otro con 2.000 no valen lo mismo, aunque el gráfico los
 * dibuje igual de anchos.
 *
 * Los rangos con menos de 20 observaciones ya vienen filtrados del pipeline:
 * con 2 casos el "observada" salta entre 0% y 100% y dibuja ruido con forma de
 * información.
 */
export function Calibracion({ rangos }: { rangos: RangoCalibracion[] }) {
  const tope = Math.max(...rangos.flatMap((r) => [r.predicha, r.observada]), 0.1);
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="tarjeta p-4">
      <div className="flex flex-col gap-3">
        {rangos.map((r) => {
          const dif = r.observada - r.predicha;
          return (
            <div key={r.desde} className="grid grid-cols-[64px_1fr_78px] items-center gap-3">
              <span className="dato text-[11px] text-tinta3">
                {pct(r.desde)}–{pct(r.hasta)}
              </span>

              <span className="flex flex-col gap-1">
                {/* Lo que dijo el modelo */}
                <span className="relative h-2.5 rounded-[2px] bg-fondo2">
                  <span
                    className="absolute inset-y-0 left-0 rounded-[2px] bg-tinta4"
                    style={{ width: `${(r.predicha / tope) * 100}%` }}
                  />
                </span>
                {/* Lo que pasó de verdad */}
                <span className="relative h-2.5 rounded-[2px] bg-fondo2">
                  <span
                    className="absolute inset-y-0 left-0 rounded-[2px] bg-acento"
                    style={{ width: `${(r.observada / tope) * 100}%` }}
                  />
                </span>
              </span>

              <span className="dato text-right text-[11px] leading-tight">
                <span className="block text-tinta2">{pct(r.observada)}</span>
                <span
                  className={
                    Math.abs(dif) < 0.02
                      ? "text-tinta4"
                      : dif > 0
                        ? "text-sube"
                        : "text-baja"
                  }
                >
                  {dif > 0 ? "+" : ""}
                  {Math.round(dif * 100)} pt
                </span>
              </span>
            </div>
          );
        })}
      </div>

      <div className="dato mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-borde2 pt-3 text-[10px] uppercase tracking-[0.14em] text-tinta4">
        <span className="flex items-center gap-2">
          <i className="h-2.5 w-4 rounded-[2px] bg-tinta4" /> Lo que dijo
        </span>
        <span className="flex items-center gap-2">
          <i className="h-2.5 w-4 rounded-[2px] bg-acento" /> Lo que pasó
        </span>
        <span>
          {rangos.reduce((a, r) => a + r.n, 0).toLocaleString("es-AR")} observaciones
        </span>
      </div>
    </div>
  );
}
