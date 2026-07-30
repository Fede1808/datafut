import type { Escenario, Rama } from "@/lib/datos";

/**
 * Qué le pasa a un equipo según cómo salga su próximo partido.
 *
 * Son las mismas 10.000 simulaciones del Monte Carlo agrupadas por el
 * resultado de ese partido, así que campeón y playoffs de cada rama son
 * probabilidades condicionales — no una segunda corrida.
 *
 * Las ramas marcadas `confiable: false` se quedaron con muy pocas simulaciones
 * y no se muestran: ahí el número es ruido de muestreo.
 */

const TITULO: Record<Rama["resultado"], string> = {
  gana: "Gana",
  empata: "Empata",
  pierde: "Pierde",
};

export function Escenarios({
  esc,
  campeonBase,
  playoffsBase,
  compacto = false,
}: {
  esc: Escenario;
  campeonBase: number;
  playoffsBase: number;
  compacto?: boolean;
}) {
  const ramas = esc.ramas.filter((r) => r.confiable && r.playoffs !== null);
  if (ramas.length === 0) return null;

  return (
    <div className="border-t border-borde">
      <div className="num flex items-baseline gap-2 border-b border-borde2 py-1.5 text-[9px] uppercase tracking-[0.08em] text-tinta3">
        <span className="flex-1">Resultado</span>
        <span className="w-9 text-right">Prob</span>
        <span className="w-[70px] text-right">Playoffs</span>
        {!compacto && <span className="w-[70px] text-right">Campeón</span>}
      </div>

      {ramas.map((r) => (
        <div
          key={r.resultado}
          className="flex items-baseline gap-2 border-b border-borde2 py-2 last:border-b-0"
        >
          <span className="flex-1 text-[12.5px]">{TITULO[r.resultado]}</span>
          <span className="num w-9 text-right text-[11px] text-tinta3">
            {r.prob_resultado.toFixed(0)}%
          </span>
          <Celda valor={r.playoffs as number} base={playoffsBase} />
          {!compacto && (
            <Celda valor={r.campeon as number} base={campeonBase} acento />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * El valor condicional y su distancia contra el número de hoy.
 * "68%" solo no dice nada; "+17" contra el 51% actual, sí. Va en puntos
 * porcentuales, no en variación relativa.
 */
function Celda({
  valor,
  base,
  acento = false,
}: {
  valor: number;
  base: number;
  acento?: boolean;
}) {
  const d = valor - base;
  // Se redondea antes de comparar: un −0.04 mostrado como "0" no puede salir
  // pintado de rojo.
  const dr = Number(d.toFixed(1));

  return (
    <span className="num w-[70px] text-right text-[12.5px]">
      <span className={acento ? "font-semibold text-tinta" : "text-tinta"}>
        {valor.toFixed(1)}
      </span>
      <span
        className={`ml-1 text-[9.5px] ${
          dr > 0 ? "text-sube" : dr < 0 ? "text-baja" : "text-tinta3"
        }`}
      >
        {dr > 0 ? "+" : dr < 0 ? "−" : "±"}
        {Math.abs(dr).toFixed(1)}
      </span>
    </span>
  );
}
