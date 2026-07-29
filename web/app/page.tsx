import Link from "next/link";
import { Cifra } from "@/components/Cifra";
import { CLUB } from "@/lib/club";
import { partidosDe } from "@/lib/datos";

/**
 * HOY — el próximo partido.
 *
 * Es la portada porque es la pregunta que alguien se hace al entrar: qué
 * viene. Todo lo de esta pantalla es de UN partido; lo de la temporada vive en
 * `/temporada` y cómo juega el equipo en `/juego`.
 *
 * La portada anterior — la de la liga entera — sigue existiendo en `/liga`.
 * No se borró: el modelo igual calcula los 30 equipos y esas pantallas
 * funcionan. Sólo salieron de la navegación.
 */

const unDecimal = (v: number) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dosDecimales = (v: number) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const conSigno = (v: number) => (v > 0 ? "+" : "") + unDecimal(v);

export default function Hoy() {
  const p = partidosDe(CLUB)[0];

  if (!p) {
    return (
      <div className="py-10">
        <h1 className="titular mb-3">No hay partido anunciado</h1>
        <p className="max-w-[60ch] text-[#4c5058]">
          El calendario todavía no publicó el próximo partido. Mientras tanto,{" "}
          <Link href="/temporada" className="underline hover:text-[#0A2472]">
            mirá cómo viene la temporada
          </Link>
          .
        </p>
      </div>
    );
  }

  const esLocal = p.local === CLUB;
  const rival = esLocal ? p.visita : p.local;
  const golesClub = esLocal ? p.goles_esperados.local : p.goles_esperados.visita;
  const golesRival = esLocal ? p.goles_esperados.visita : p.goles_esperados.local;
  const tope = Math.max(...p.marcadores.map((m) => m.prob));

  return (
    <div className="py-6">
      <h1 className="titular mb-3.5">El próximo partido</h1>

      <div className="overflow-hidden rounded-[4px] border border-[#d3d6d1] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3.5 px-4 pb-4 pt-5">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="h-9 w-2.5 shrink-0 rounded-[2px]"
              style={{ background: esLocal ? "#0A2472" : "#8d9299" }}
            />
            <span className="titular-2">{p.local}</span>
          </div>
          <span
            className="text-[15px] font-bold tracking-[0.14em] text-[#8d9299]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            VS
          </span>
          <div className="flex min-w-0 items-center gap-3">
            <span className="titular-2">{p.visita}</span>
            <span
              className="h-9 w-2.5 shrink-0 rounded-[2px]"
              style={{ background: esLocal ? "#8d9299" : "#0A2472" }}
            />
          </div>
        </div>

        <div
          className="flex h-[42px] border-t border-[#d3d6d1]"
          role="img"
          aria-label={`Gana ${p.local} ${unDecimal(p.prob.local)}%, empate ${unDecimal(
            p.prob.empate,
          )}%, gana ${p.visita} ${unDecimal(p.prob.visita)}%`}
        >
          {[
            { v: p.prob.local, c: "#2f5fa8" },
            { v: p.prob.empate, c: "#8d9299" },
            { v: p.prob.visita, c: "#c8102e" },
          ].map((s, i) => (
            <div
              key={i}
              className="num flex items-center justify-center text-[16px] font-bold text-white"
              style={{
                width: `${s.v}%`,
                background: s.c,
                fontFamily: "var(--font-display)",
              }}
            >
              {unDecimal(s.v)}%
            </div>
          ))}
        </div>
        <div className="flex justify-between px-4 pb-4 pt-2.5 text-[12.5px] text-[#6d7280]">
          <span>Gana {p.local}</span>
          <span>Empate</span>
          <span>Gana {p.visita}</span>
        </div>
      </div>

      <div className="mt-3.5 grid gap-3.5 sm:grid-cols-3">
        <Cifra
          rotulo="Goles esperados de Boca"
          valor={dosDecimales(golesClub)}
          pie={`${rival}: ${dosDecimales(golesRival)}`}
        />
        <Cifra rotulo="Menos de 2,5 goles" valor={`${unDecimal(p.menos_de_2_5)}%`} />
        <Cifra rotulo="Convierten los dos" valor={`${unDecimal(p.ambos_convierten)}%`} />
      </div>

      <h2 className="titular-2 mb-2.5 mt-7">Marcadores más probables</h2>
      <div className="tarjeta">
        {p.marcadores.map((m) => (
          <div
            key={m.marcador}
            className="grid grid-cols-[58px_1fr_54px] items-center gap-3 py-1.5"
          >
            <span
              className="num text-[20px] font-bold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {m.marcador}
            </span>
            <span className="relative h-3 rounded-full bg-[#e2e4e0]">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-[#0A2472]"
                style={{ width: `${(m.prob / tope) * 100}%` }}
              />
            </span>
            <span className="num text-right text-[#4c5058]">{unDecimal(m.prob)}%</span>
          </div>
        ))}
      </div>

      {/*
        La comparación contra el mercado es el diferencial del proyecto, pero
        sólo aparece cuando hay cuotas. Cuando el partido todavía no abrió
        mercado, `implicita` viene en null y no se muestra nada: inventar una
        comparación sería peor que no tenerla.
      */}
      {p.implicita && p.diferencial && (
        <>
          <h2 className="titular-2 mb-2.5 mt-7">Contra el mercado</h2>
          <div className="grid gap-3.5 sm:grid-cols-3">
            <Cifra
              rotulo={`Gana ${p.local}`}
              valor={conSigno(p.diferencial.local)}
              pie={`El mercado dice ${unDecimal(p.implicita.local)}%`}
            />
            <Cifra
              rotulo="Empate"
              valor={conSigno(p.diferencial.empate)}
              pie={`El mercado dice ${unDecimal(p.implicita.empate)}%`}
            />
            <Cifra
              rotulo={`Gana ${p.visita}`}
              valor={conSigno(p.diferencial.visita)}
              pie={`El mercado dice ${unDecimal(p.implicita.visita)}%`}
            />
          </div>
        </>
      )}
    </div>
  );
}
