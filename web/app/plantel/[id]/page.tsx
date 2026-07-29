import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cifra } from "@/components/Cifra";
import { MapaRemates } from "@/components/MapaRemates";
import { SerieRating } from "@/components/SerieRating";
import {
  fichaPorId,
  gruposPor90,
  jugadorPorId,
  plantel,
  rematesDe,
  temporadaClub,
} from "@/lib/club";

/**
 * La ficha de un jugador.
 *
 * Se generan TODAS las fichas, incluidas las de los que no entran a la tabla
 * del plantel por tener un solo partido. La tabla los deja afuera para que no
 * ensucien un orden por rating; la ficha existe igual, y se llega por URL.
 *
 * Las métricas se muestran POR 90 MINUTOS y no en bruto. Comparar a un titular
 * con un suplente por totales no dice nada: el titular gana todas las columnas
 * por haber jugado más, que es justamente lo que no se está preguntando.
 */

// Nombres legibles de las métricas. La clave es la del pipeline; el texto es
// el que se muestra. No hay traducción automática a propósito: `perdidas` no
// es "pérdidas de balón" en el sentido de cualquier pase errado, es
// `dispossessed` de FotMob — perder la pelota estando en posesión.
const NOMBRES: Record<string, string> = {
  toques: "Toques",
  pases_completados: "Pases completados",
  pases_ultimo_tercio: "Pases al último tercio",
  toques_en_area_rival: "Toques en el área rival",
  gambetas_exitosas: "Gambetas",
  centros_completados: "Centros completados",
  perdidas: "Pérdidas",
  remates: "Remates",
  remates_al_arco: "Remates al arco",
  chances_creadas: "Chances creadas",
  chances_claras_creadas: "Chances claras creadas",
  recuperaciones: "Recuperaciones",
  quites: "Quites",
  intercepciones: "Intercepciones",
  rechazos: "Rechazos",
  bloqueos: "Bloqueos",
  lo_gambetearon: "Lo gambetearon",
  duelos_ganados: "Duelos ganados",
  duelos_perdidos: "Duelos perdidos",
  duelos_aereos_ganados: "Duelos aéreos ganados",
  faltas_recibidas: "Faltas recibidas",
  faltas_cometidas: "Faltas cometidas",
};

const entero = (v: number | null) =>
  v === null ? "—" : Math.round(v).toLocaleString("es-AR");
const dosDecimales = (v: number | null) =>
  v === null
    ? "—"
    : v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function generateStaticParams() {
  return plantel.map((p) => ({ id: String(p.id) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const j = jugadorPorId(id);
  if (!j) return { title: "Jugador — Boca en números" };
  return {
    title: `${j.jugador} — Boca en números`,
    description: `${j.jugador} en ${temporadaClub}: ${j.pj} partidos, ${j.minutos} minutos, ${j.goles} goles y ${j.asistencias} asistencias.`,
  };
}

export default async function Jugador({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const j = jugadorPorId(id);
  const ficha = fichaPorId(id);
  if (!j || !ficha) notFound();

  const mios = rematesDe(id);

  return (
    <div className="py-6">
      <Link
        href="/plantel"
        className="mb-3.5 inline-block rounded-full border border-[#c3c8c1] px-3.5 py-1.5 text-[12.5px] text-[#4c5058] hover:border-[#0A2472] hover:text-[#0A2472]"
      >
        ← Todo el plantel
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4 rounded-[4px] bg-[#0A2472] px-5 pb-4 pt-5 text-white">
        <div>
          <h1
            className="text-[clamp(28px,6vw,44px)] font-bold uppercase leading-[0.95]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {j.jugador}
          </h1>
          <p className="mt-1 text-[13px] text-[#aebcea]">
            {j.arquero ? "Arquero" : "Jugador de campo"} · {j.pj} partidos ·{" "}
            {j.titular} como titular
          </p>
        </div>
        <div className="flex flex-wrap gap-6">
          {[
            { b: dosDecimales(j.rating), s: "Rating" },
            { b: entero(j.minutos), s: "Minutos" },
            { b: entero(j.goles), s: "Goles" },
            { b: entero(j.asistencias), s: "Asistencias" },
          ].map((t) => (
            <span key={t.s} className="text-right">
              <b
                className="num block text-[30px] font-bold leading-none"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t.b}
              </b>
              <span className="text-[11.5px] uppercase tracking-[0.08em] text-[#aebcea]">
                {t.s}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra
          rotulo="Goles esperados"
          valor={dosDecimales(j.xg)}
          pie={`Convirtió ${j.goles}`}
        />
        <Cifra
          rotulo="Asistencias esperadas"
          valor={dosDecimales(j.xa)}
          pie={`Dio ${j.asistencias}`}
        />
        <Cifra
          rotulo="Remates"
          valor={entero(ficha.totales.remates)}
          pie={`${entero(ficha.totales.remates_al_arco)} al arco`}
        />
        <Cifra
          rotulo="Duelos ganados"
          valor={entero(ficha.totales.duelos_ganados)}
          pie={`${entero(ficha.totales.duelos_perdidos)} perdidos`}
        />
      </div>

      {mios.length > 0 && (
        <>
          <h2 className="titular-2 mb-2.5 mt-7">Sus remates</h2>
          <MapaRemates remates={mios} alto={400} />
        </>
      )}

      <h2 className="titular-2 mb-2.5 mt-7">Rating partido a partido</h2>
      <SerieRating serie={ficha.serie} />

      {gruposPor90.map((g) => {
        const usa = g.metricas.filter((m) => ficha.por90[m] !== null);
        if (!usa.length) return null;
        // La barra es relativa al máximo del propio grupo, no de la liga: acá
        // la pregunta es en qué se ocupa este jugador, no si es mejor que otro.
        const tope = Math.max(...usa.map((m) => ficha.por90[m] ?? 0), 0.001);
        return (
          <div key={g.titulo}>
            <h2 className="titular-2 mb-2.5 mt-7">
              {g.titulo}{" "}
              <span className="text-[13px] font-normal normal-case tracking-normal text-[#6d7280]">
                · por 90 minutos
              </span>
            </h2>
            <div className="tarjeta">
              {usa.map((m) => (
                <div
                  key={m}
                  className="grid grid-cols-[1fr_52px] items-center gap-x-3 gap-y-1 py-1.5 sm:grid-cols-[172px_1fr_52px]"
                >
                  <span className="text-[12.5px] text-[#4c5058]">
                    {NOMBRES[m] ?? m}
                  </span>
                  <span className="relative col-span-2 h-2.5 rounded-full bg-[#e2e4e0] sm:col-span-1">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-[#0A2472]"
                      style={{ width: `${((ficha.por90[m] ?? 0) / tope) * 100}%` }}
                    />
                  </span>
                  <span
                    className="num text-right text-[16px] font-bold"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {dosDecimales(ficha.por90[m])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
