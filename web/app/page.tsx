import Link from "next/link";
import { Hero } from "@/components/Hero";
import { Kpis } from "@/components/Kpis";
import { MatrizMarcadores } from "@/components/MatrizMarcadores";
import { Retrato } from "@/components/Retrato";
import { CLUB, equipoClub, planteles, slugClub } from "@/lib/club";
import { partidosDe, posicionPorSlug } from "@/lib/datos";

/**
 * HOY — el próximo partido.
 *
 * La portada anterior — la de la liga entera — sigue existiendo en `/liga`. No
 * se borró: el modelo igual calcula los 30 equipos y esas pantallas funcionan.
 * Sólo salieron de la navegación.
 */

const unDecimal = (v: number) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dosDecimales = (v: number) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const conSigno = (v: number) => (v > 0 ? "+" : "") + unDecimal(v);

/** Nombre corto para el hero: "Estudiantes (LP)" no entra en 82px. */
function corto(nombre: string) {
  return nombre.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export default function Hoy() {
  const p = partidosDe(CLUB)[0];
  const fila = posicionPorSlug(slugClub);
  const r = equipoClub.rendimiento;

  if (!p) {
    return (
      <div className="py-16">
        <p className="etiqueta mb-2">Hoy</p>
        <h1 className="titular mb-3">No hay partido anunciado</h1>
        <p className="max-w-[60ch] text-tinta2">
          El calendario todavía no publicó el próximo partido.{" "}
          <Link href="/equipo" className="text-acento underline">
            Mirá cómo viene la temporada
          </Link>
          .
        </p>
      </div>
    );
  }

  const esLocal = p.local === CLUB;
  const rival = esLocal ? p.visita : p.local;
  const probClub = esLocal ? p.prob.local : p.prob.visita;
  const golesClub = esLocal ? p.goles_esperados.local : p.goles_esperados.visita;
  const golesRival = esLocal ? p.goles_esperados.visita : p.goles_esperados.local;

  const ultimos = equipoClub.ultimos ?? [];
  const gan = ultimos.filter((u) => u.r === "G").length;
  const emp = ultimos.filter((u) => u.r === "E").length;
  const per = ultimos.filter((u) => u.r === "P").length;

  /*
    La barra del hero SIEMPRE se ordena Boca / empate / rival, sin importar si
    juega de local. El 1X2 del modelo viene en orden de cancha (local, empate,
    visita), y mostrarlo así en un sitio de un solo club obligaría al lector a
    acordarse de qué lado está el suyo en cada partido.
  */
  const barra = [
    { valor: probClub, color: "var(--color-acento)", nombre: corto(CLUB).toUpperCase() },
    { valor: p.prob.empate, color: "oklch(0.50 0.02 262)", nombre: "EMPATE" },
    {
      valor: esLocal ? p.prob.visita : p.prob.local,
      color: "oklch(0.34 0.02 262)",
      nombre: corto(rival).toUpperCase(),
    },
  ];

  /* La figura esperada: el mejor rating del plantel, con un piso de partidos
     para que no la gane alguien con un solo buen partido. */
  const figura = [...planteles]
    .filter((j) => j.rating !== null && j.pj >= 5)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];

  return (
    <div className="pb-16">
      <Hero
        etiqueta={`${p.fecha} · ${p.hora} · Fecha ${p.ronda}${
          fila ? ` · Zona ${fila.zona}` : ""
        }`}
        local={corto(p.local)}
        visita={corto(p.visita)}
        probabilidad={probClub}
        leyenda={`Probabilidad de que gane ${corto(CLUB)}`}
        contexto={[
          `${ultimos.length}PJ ${gan}G ${emp}E ${per}P`,
          `${esLocal ? "De local" : "De visitante"}`,
        ]}
        barra={barra}
      />

      <div className="mt-px">
        <Kpis
          items={[
            {
              valor: dosDecimales(golesClub),
              etiqueta: `Goles esperados · ${corto(rival)} ${dosDecimales(golesRival)}`,
              acento: true,
            },
            {
              valor: `${unDecimal(p.menos_de_2_5)}%`,
              etiqueta: "Menos de 2,5 goles",
            },
            {
              valor: `${unDecimal(p.ambos_convierten)}%`,
              etiqueta: "Convierten los dos",
            },
            {
              valor: fila ? `${fila.puesto}º` : "—",
              etiqueta: fila
                ? `En la zona ${fila.zona} · ${fila.pts} pts`
                : "Sin posición todavía",
            },
          ]}
        />
      </div>

      {/*
        `[&>*]:min-w-0` no es decorativo. Los items de grid arrancan con
        `min-width: auto`, que equivale a su contenido mínimo: la matriz de
        marcadores declara `min-w-[380px]` adentro de su propio scroll
        horizontal, y sin esto ese mínimo se propagaba hacia afuera y estiraba
        la página entera a 434px en un celular de 390. El `overflow-x-auto` de
        la matriz no alcanza solo — necesita que el padre le permita achicarse.
      */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_396px] [&>*]:min-w-0">
        <div className="flex flex-col gap-4">
          <div className="tarjeta p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="titular-2">Marcadores más probables</h2>
              <p className="dato text-[10px] uppercase tracking-[0.16em] text-tinta4">
                Los cinco de arriba
              </p>
            </div>
            {p.marcadores.map((m) => (
              <div
                key={m.marcador}
                className="grid grid-cols-[62px_1fr_58px] items-center gap-3 py-1.5"
              >
                <span className="cifra text-[20px]">{m.marcador}</span>
                <span className="relative h-2 rounded-[1px] bg-tarjeta2">
                  <span
                    className="absolute inset-y-0 left-0 rounded-[1px] bg-acento"
                    style={{
                      width: `${(m.prob / p.marcadores[0].prob) * 100}%`,
                      transformOrigin: "left",
                      animation: "gx 560ms cubic-bezier(0.2,0.7,0.2,1) both",
                    }}
                  />
                </span>
                <span className="dato text-right text-[12px] text-tinta2">
                  {unDecimal(m.prob)}%
                </span>
              </div>
            ))}
          </div>

          <MatrizMarcadores
            matriz={p.matriz}
            local={corto(p.local)}
            visita={corto(p.visita)}
          />
        </div>

        <aside className="flex flex-col gap-4">
          {r && (
            <div className="tarjeta p-4 sm:p-5">
              <p className="etiqueta mb-3">Cómo viene acertando</p>
              <div className="flex items-end gap-5">
                <div>
                  <div className="cifra text-[38px]">{r.pts}</div>
                  <p className="dato mt-1 text-[10px] uppercase tracking-[0.14em] text-tinta4">
                    Puntos
                  </p>
                </div>
                <div>
                  <div className="cifra text-[38px] text-tinta3">
                    {unDecimal(r.pts_esperados)}
                  </div>
                  <p className="dato mt-1 text-[10px] uppercase tracking-[0.14em] text-tinta4">
                    Merecidos
                  </p>
                </div>
                <div>
                  <div
                    className={`cifra text-[38px] ${r.dif >= 0 ? "text-sube" : "text-baja"}`}
                  >
                    {conSigno(r.dif)}
                  </div>
                  <p className="dato mt-1 text-[10px] uppercase tracking-[0.14em] text-tinta4">
                    Diferencia
                  </p>
                </div>
              </div>
            </div>
          )}

          {ultimos.length > 0 && (
            <div className="tarjeta p-4 sm:p-5">
              <p className="etiqueta mb-3">Últimos {ultimos.length}</p>
              <div className="flex flex-wrap gap-1.5">
                {ultimos.map((u, i) => (
                  <span
                    key={`${u.fecha}-${i}`}
                    title={`${u.rival} ${u.gf}-${u.gc}`}
                    className="dato grid h-9 w-9 place-items-center rounded-[3px] text-[14px] font-semibold"
                    style={{
                      background:
                        u.r === "G"
                          ? "var(--color-acento)"
                          : u.r === "E"
                            ? "oklch(0.34 0.02 262)"
                            : "var(--color-tarjeta2)",
                      color:
                        u.r === "G" ? "oklch(0.18 0.03 262)" : "var(--color-tinta2)",
                      border: u.r === "P" ? "1px solid var(--color-baja)" : "none",
                    }}
                  >
                    {u.r}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-tinta4">
                {ultimos.map((u) => `${corto(u.rival)} ${u.gf}-${u.gc}`).join(" · ")}
              </p>
            </div>
          )}

          {figura && (
            <div className="tarjeta p-4 sm:p-5">
              <p className="etiqueta mb-3">Figura esperada</p>
              <div className="flex items-center gap-4">
                <Retrato id={figura.id} nombre={figura.jugador} tamano={88} />
                <div className="min-w-0">
                  {/*
                    Sin `truncate`: el nombre de la figura es el dato de la
                    tarjeta, y "Leandro Paredes" no entra en los 250px que
                    quedan al lado del retrato — se leía "Leandro Pare…".
                    `text-balance` reparte las dos líneas en vez de dejar una
                    llena y un apellido colgando solo abajo.
                  */}
                  <Link
                    href={`/plantel/${figura.id}`}
                    className="titular-2 block text-balance hover:text-acento"
                  >
                    {figura.jugador}
                  </Link>
                  <p className="dato mt-1.5 text-[11px] uppercase tracking-[0.14em] text-tinta4">
                    Rating {dosDecimales(figura.rating ?? 0)} · {figura.pj} PJ
                  </p>
                  <p className="mt-1 text-[12px] text-tinta3">
                    {figura.goles} {figura.goles === 1 ? "gol" : "goles"} ·{" "}
                    {figura.asistencias}{" "}
                    {figura.asistencias === 1 ? "asistencia" : "asistencias"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
