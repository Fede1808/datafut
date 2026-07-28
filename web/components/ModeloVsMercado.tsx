import type { Tercia } from "@/lib/datos";

/**
 * Modelo contra mercado: la única tabla del sitio que no se puede copiar.
 *
 * QUÉ ES EL MERCADO ACÁ. Las casas de apuestas publican cuotas. Una cuota de
 * 2.00 significa "te pagamos el doble", o sea más o menos 50% de probabilidad.
 * Si sumás 1/cuota de los tres resultados no da 100% sino más, y ese exceso es
 * la ganancia de la casa; sacándolo quedan las probabilidades que el mercado
 * les asigna de verdad. Eso es la columna "Mercado", y suma 100 exacto.
 *
 * POR QUÉ IMPORTA. El mercado es el consenso de mucha gente con plata en
 * juego, y le gana al modelo por poco en las mediciones del proyecto. Que el
 * modelo diga 45% donde el mercado dice 30% no significa que el modelo tenga
 * razón: significa que están mirando cosas distintas, y ESA diferencia es lo
 * único que este sitio tiene y ningún otro.
 *
 * La barra es SVG a mano. Escala fija de ±ESCALA puntos porcentuales para que
 * un partido se pueda comparar con otro; si se escalara al máximo de cada
 * ficha, una diferencia de 2 puntos se vería igual de grande que una de 15.
 */

const ESCALA = 15;

export function ModeloVsMercado({
  prob,
  implicita,
  diferencial,
}: {
  prob: Tercia;
  implicita: Tercia;
  diferencial: Tercia;
}) {
  const filas = [
    { clave: "local", label: "Local" },
    { clave: "empate", label: "Empate" },
    { clave: "visita", label: "Visita" },
  ] as const;

  return (
    <div role="table" aria-label="Probabilidad del modelo contra la del mercado">
      <div
        role="row"
        className="mt-1.5 flex items-center gap-1.5 border-t-2 border-b border-[#1a1c1f] border-b-[#d3d6d1] py-2"
      >
        <span role="columnheader" className="etiqueta min-w-0 flex-1">
          Resultado
        </span>
        <span role="columnheader" className="etiqueta w-12 shrink-0 text-right">
          Modelo
        </span>
        <span role="columnheader" className="etiqueta w-12 shrink-0 text-right">
          Mercado
        </span>
        <span
          role="columnheader"
          className="etiqueta w-[86px] shrink-0 text-right"
          title="Diferencia en puntos porcentuales"
        >
          Diferencia
        </span>
      </div>

      {filas.map((f) => {
        const d = diferencial[f.clave];
        return (
          <div
            key={f.clave}
            role="row"
            className="flex items-center gap-1.5 border-b border-[#e2e4e0] py-2"
          >
            <span role="cell" className="min-w-0 flex-1 text-[12.5px]">
              {f.label}
            </span>
            <span
              role="cell"
              className="num w-12 shrink-0 text-right text-[12px] font-semibold"
            >
              {prob[f.clave].toFixed(1)}
            </span>
            <span
              role="cell"
              className="num w-12 shrink-0 text-right text-[12px] text-[#4c5058]"
            >
              {implicita[f.clave].toFixed(1)}
            </span>
            <span
              role="cell"
              className="flex w-[86px] shrink-0 items-center justify-end gap-1.5"
            >
              <BarraDiferencia valor={d} />
              <span
                className={`num w-[38px] text-right text-[11.5px] ${
                  Math.abs(d) >= 5 ? "text-[#1a1c1f]" : "text-[#6d7280]"
                }`}
              >
                {d > 0 ? "+" : d < 0 ? "−" : "±"}
                {Math.abs(d).toFixed(1)}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Barra que sale del centro: a la derecha si el modelo ve más chance. */
function BarraDiferencia({ valor }: { valor: number }) {
  const ancho = 40;
  const alto = 9;
  const medio = ancho / 2;
  const largo = (Math.min(Math.abs(valor), ESCALA) / ESCALA) * medio;

  return (
    <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} aria-hidden>
      <rect x={0} y={alto / 2 - 0.5} width={ancho} height={1} fill="#e2e4e0" />
      <rect
        x={valor >= 0 ? medio : medio - largo}
        y={1}
        width={largo}
        height={alto - 2}
        fill="#1a1c1f"
        opacity={Math.abs(valor) >= 5 ? 1 : 0.5}
      />
      <rect x={medio - 0.5} y={0} width={1} height={alto} fill="#8d9299" />
    </svg>
  );
}

/** En qué resultado el modelo se aparta más del mercado. */
export function mayorDiferencia(diferencial: Tercia): {
  clave: keyof Tercia;
  valor: number;
} {
  const claves: (keyof Tercia)[] = ["local", "empate", "visita"];
  const mayor = claves.reduce((a, b) =>
    Math.abs(diferencial[b]) > Math.abs(diferencial[a]) ? b : a,
  );
  return { clave: mayor, valor: diferencial[mayor] };
}
