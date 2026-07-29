import type { Metadata } from "next";
import { Cifra } from "@/components/Cifra";
import { CLUB, equipoClub, slugClub, temporadaClub } from "@/lib/club";
import { posicionPorSlug } from "@/lib/datos";

export const metadata: Metadata = {
  title: "La temporada — Boca en números",
  description:
    "Posición, probabilidad de salir campeón, de entrar a playoffs y de descender, y los puntos que Boca hizo contra los que su juego merecía.",
};

/**
 * LA TEMPORADA — dónde está Boca en el año.
 *
 * Todo lo de acá sale de la simulación de Monte Carlo, que corre sobre la liga
 * entera. Por eso el pipeline no se recortó al club: sin los otros 29 equipos
 * no hay probabilidad de campeón que calcular.
 */

const unDecimal = (v: number) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const conSigno = (v: number) => (v > 0 ? "+" : "") + unDecimal(v);

export default function Temporada() {
  const fila = posicionPorSlug(slugClub);
  const r = equipoClub.rendimiento;
  const ultimos = equipoClub.ultimos ?? [];

  return (
    <div className="py-6">
      <h1 className="titular mb-3.5">Dónde está Boca</h1>

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {fila && (
          <Cifra
            rotulo={`Puesto en la zona ${fila.zona}`}
            valor={`${fila.puesto}º`}
            pie={`${fila.pts} ${fila.pts === 1 ? "punto" : "puntos"} · ${fila.pj} ${
              fila.pj === 1 ? "partido" : "partidos"
            }`}
          />
        )}
        <Cifra rotulo="Sale campeón" valor={`${unDecimal(equipoClub.campeon)}%`} />
        <Cifra
          rotulo="Entra a playoffs"
          valor={`${unDecimal(equipoClub.playoffs)}%`}
          pie="Clasifican 8 por zona"
        />
        <Cifra rotulo="Se va al descenso" valor={`${unDecimal(equipoClub.descenso)}%`} />
      </div>

      {r && (
        <>
          <h2 className="titular-2 mb-2.5 mt-7">
            Puntos hechos contra puntos merecidos
          </h2>
          <div className="tarjeta">
            <div className="flex flex-wrap items-end gap-x-7 gap-y-3">
              <div>
                <div
                  className="num text-[clamp(32px,6.4vw,46px)] font-bold leading-[0.9]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {r.pts}
                </div>
                <p className="mt-1 text-[12.5px] text-[#6d7280]">hechos</p>
              </div>
              <div>
                <div
                  className="num text-[clamp(32px,6.4vw,46px)] font-bold leading-[0.9] text-[#6d7280]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {unDecimal(r.pts_esperados)}
                </div>
                <p className="mt-1 text-[12.5px] text-[#6d7280]">merecidos</p>
              </div>
              <div>
                <div
                  className={`num text-[clamp(32px,6.4vw,46px)] font-bold leading-[0.9] ${
                    r.dif >= 0 ? "text-[#2f8f4e]" : "text-[#c8102e]"
                  }`}
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {conSigno(r.dif)}
                </div>
                <p className="mt-1 text-[12.5px] text-[#6d7280]">de diferencia</p>
              </div>
            </div>
          </div>
        </>
      )}

      {ultimos.length > 0 && (
        <>
          <h2 className="titular-2 mb-2.5 mt-7">
            Últimos {ultimos.length} partidos
          </h2>
          <div className="tarjeta">
            <div className="flex flex-wrap gap-1.5">
              {ultimos.map((u, i) => (
                <span
                  key={`${u.fecha}-${i}`}
                  title={`${u.rival} ${u.gf}-${u.gc}`}
                  className="grid h-[33px] w-[33px] place-items-center rounded-[3px] text-[17px] font-bold text-white"
                  style={{
                    fontFamily: "var(--font-display)",
                    background:
                      u.r === "G" ? "#2f5fa8" : u.r === "E" ? "#8d9299" : "#c8102e",
                  }}
                >
                  {u.r}
                </span>
              ))}
            </div>
            <p className="mt-2.5 text-[12.5px] text-[#6d7280]">
              {ultimos
                .map((u) => `${u.rival} ${u.gf}-${u.gc}`)
                .join(" · ")}
            </p>
          </div>
        </>
      )}

      <p className="mt-7 text-[12.5px] text-[#6d7280]">
        Temporada {temporadaClub} · {CLUB}
      </p>
    </div>
  );
}
