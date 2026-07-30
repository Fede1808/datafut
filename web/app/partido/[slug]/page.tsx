import { notFound } from "next/navigation";
import Link from "next/link";
import { Escudo } from "@/components/Escudo";
import { BarraProb, esParejo } from "@/components/BarraProb";
import { Escenarios } from "@/components/Escenarios";
import { ModeloVsMercado, mayorDiferencia } from "@/components/ModeloVsMercado";
import {
  partidos,
  coloresDe,
  metadatos,
  equipoPorSlug,
  posicionPorSlug,
  ataquePct,
  defensaPct,
  escenariosDelPartido,
  type Partido,
} from "@/lib/datos";

function slugDe(p: { local_slug: string; visita_slug: string }) {
  return `${p.local_slug}-vs-${p.visita_slug}`;
}

export function generateStaticParams() {
  return partidos.map((p) => ({ slug: slugDe(p) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = partidos.find((x) => slugDe(x) === slug);
  return { title: p ? `${p.local} vs ${p.visita}` : "Partido" };
}

export default async function PaginaPartido({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = partidos.find((x) => slugDe(x) === slug);
  if (!p) notFound();

  const eL = equipoPorSlug(p.local_slug);
  const eV = equipoPorSlug(p.visita_slug);
  const esc = escenariosDelPartido(p);
  const totalGoles = p.goles_esperados.local + p.goles_esperados.visita;
  const maxMarcador = Math.max(...p.marcadores.map((m) => m.prob));

  return (
    <div className="py-5">
      {/* --- Cabecera --- */}
      <div className="tarjeta p-4">
        <div className="num flex items-center gap-2 text-[9.5px] uppercase tracking-[0.08em] text-tinta3">
          <span>{p.fecha}</span>
          <span aria-hidden>·</span>
          <span>{p.hora}</span>
          {esParejo(p.prob) && (
            <>
              <span aria-hidden>·</span>
              <span className="text-tinta">Parejo</span>
            </>
          )}
        </div>

        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <LadoEquipo slug={p.local_slug} nombre={p.local} />
          <span className="num text-[10px] uppercase tracking-[0.1em] text-tinta4">
            vs
          </span>
          <LadoEquipo slug={p.visita_slug} nombre={p.visita} derecha />
        </div>

        {/* --- 1X2 --- */}
        <div className="mt-5 border-t border-borde2 pt-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { n: p.prob.local, l: "Local", c: "var(--color-local)" },
              { n: p.prob.empate, l: "Empate", c: "var(--color-tinta2)" },
              { n: p.prob.visita, l: "Visita", c: "var(--color-baja)" },
            ].map((x) => (
              <div key={x.l}>
                <div className="cifra text-[clamp(28px,9vw,42px)]" style={{ color: x.c }}>
                  {x.n.toFixed(1)}
                  <span className="text-[0.45em] align-super">%</span>
                </div>
                <div className="etiqueta mt-0.5">{x.l}</div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <BarraProb {...p.prob} alto={8} />
          </div>
        </div>
      </div>

      {/* --- Modelo contra mercado ---
          Va acá arriba, antes que los marcadores, y a propósito: es el único
          número de la página que no está en ningún otro lado. */}
      <section className="tarjeta mt-4 p-4">
        <h2 className="etiqueta">El modelo contra el mercado</h2>
        {p.implicita && p.diferencial ? (
          <>
            <p className="mt-1 max-w-[62ch] text-[12.5px] leading-relaxed text-tinta2">
              {frase(p, mayorDiferencia(p.diferencial))}
            </p>
            <div className="mt-3 max-w-[520px]">
              <ModeloVsMercado
                prob={p.prob}
                implicita={p.implicita}
                diferencial={p.diferencial}
              />
              <p className="num mt-1.5 text-[9px] leading-relaxed text-tinta3">
                Mercado = promedio de las cuotas de todas las casas, sin el
                margen de la casa. Es el consenso de mucha gente con plata en
                juego y hoy le gana al modelo por poco, así que una diferencia
                grande no quiere decir que el modelo tenga razón: quiere decir
                que están mirando cosas distintas. No es una recomendación de
                apuesta.
              </p>
            </div>
          </>
        ) : (
          <p className="num mt-1.5 text-[10px] text-tinta3">
            Este partido todavía no tiene cuotas publicadas, así que no hay con
            qué comparar.
          </p>
        )}
      </section>

      {/* `[&>*]:min-w-0`: ver la nota de `app/page.tsx`. */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        {/* --- Marcadores --- */}
        <section className="tarjeta p-4">
          <h2 className="etiqueta">Marcadores más probables</h2>
          <div className="mt-1.5 border-t-2 border-tinta4">
            {p.marcadores.map((m) => (
              <div
                key={m.marcador}
                className="flex items-center gap-3 border-b border-borde2 py-2"
              >
                <span className="num w-9 text-[14px] font-semibold">
                  {m.marcador}
                </span>
                <span className="h-[6px] flex-1 bg-tarjeta2">
                  <span
                    className="block h-full bg-tinta"
                    style={{ width: `${(m.prob / maxMarcador) * 100}%` }}
                  />
                </span>
                <span className="num w-11 text-right text-[12px] text-tinta2">
                  {m.prob.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
          <p className="num mt-1.5 text-[9.5px] text-tinta3">
            Los cinco juntos suman{" "}
            {p.marcadores.reduce((a, m) => a + m.prob, 0).toFixed(0)}%.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4">
            <Dato
              k="Goles esperados"
              v={`${p.goles_esperados.local.toFixed(2)} — ${p.goles_esperados.visita.toFixed(2)}`}
            />
            <Dato k="Total esperado" v={totalGoles.toFixed(2)} />
            <Dato k="Más de 2.5" v={`${(100 - p.menos_de_2_5).toFixed(0)}%`} />
            <Dato k="Ambos convierten" v={`${p.ambos_convierten.toFixed(0)}%`} />
          </div>
        </section>

        {/* --- Fuerzas enfrentadas --- */}
        <section className="tarjeta p-4">
          <h2 className="etiqueta">Fuerza estimada</h2>
          {/*
            Las columnas pasaron de `w-14` a `w-[66px]`: "PLAYOFFS" en
            `.etiqueta` mide 64px por el tracking de 0.2em y se salía de la
            celda, encimándose con "DEFENSA".

            Y como cuatro columnas de 66px más el nombre no entran en un
            celular, la tabla scrollea adentro de su tarjeta —el mismo recurso
            que usa la matriz de marcadores— en vez de apretar el nombre del
            equipo hasta dejarlo en tres letras.
          */}
          <div className="overflow-x-auto">
            <div
              role="table"
              aria-label="Fuerza estimada de los dos equipos"
              className="min-w-[400px]"
            >
              <div
                role="row"
                className="mt-1.5 flex items-center gap-1.5 border-t-2 border-b border-tinta4 border-b-borde py-2"
              >
                <span role="columnheader" className="etiqueta min-w-0 flex-1">
                  Equipo
                </span>
                <span role="columnheader" className="etiqueta w-[66px] shrink-0 text-right">
                  Ataque
                </span>
                <span role="columnheader" className="etiqueta w-[66px] shrink-0 text-right">
                  Defensa
                </span>
                <span role="columnheader" className="etiqueta w-[66px] shrink-0 text-right">
                  Playoffs
                </span>
                <span role="columnheader" className="etiqueta w-[66px] shrink-0 text-right">
                  Campeón
                </span>
              </div>

              {[eL, eV].map(
                (e) =>
                  e && (
                    <Link
                      key={e.slug}
                      href={`/equipo/${e.slug}`}
                      role="row"
                      className="fila flex items-center gap-1.5 border-b border-borde2 py-2"
                    >
                      <span role="cell" className="flex min-w-0 flex-1 items-center gap-2">
                        <Escudo slug={e.slug} colores={e.colores} size={16} />
                        <span className="enlace-ficha truncate text-[12.5px]">
                          {e.equipo}
                        </span>
                      </span>
                      <Pct valor={ataquePct(e)} />
                      <Pct valor={defensaPct(e)} />
                      <span role="cell" className="num w-[66px] shrink-0 text-right text-[12px]">
                        {e.playoffs.toFixed(1)}
                      </span>
                      <span role="cell" className="num w-[66px] shrink-0 text-right text-[12px] text-tinta">
                        {e.campeon.toFixed(1)}
                      </span>
                    </Link>
                  ),
              )}
            </div>
          </div>
          <p className="num mt-1.5 text-[9.5px] text-tinta3">
            Goles que hace y que evita cada uno respecto del promedio de la liga.
          </p>

          {/* --- Qué se juega cada uno --- */}
          {(esc.local || esc.visita) && (
            <div className="mt-7">
              <h2 className="etiqueta">Qué se juega cada uno acá</h2>
              <div className="mt-1.5 grid gap-5">
                {esc.local && eL && (
                  <div>
                    <div className="num text-[10px] uppercase tracking-[0.08em] text-tinta2">
                      {eL.equipo}
                    </div>
                    <Escenarios
                      esc={esc.local}
                      campeonBase={eL.campeon}
                      playoffsBase={eL.playoffs}
                    />
                  </div>
                )}
                {esc.visita && eV && (
                  <div>
                    <div className="num text-[10px] uppercase tracking-[0.08em] text-tinta2">
                      {eV.equipo}
                    </div>
                    <Escenarios
                      esc={esc.visita}
                      campeonBase={eV.campeon}
                      playoffsBase={eV.playoffs}
                    />
                  </div>
                )}
              </div>
              <p className="num mt-1.5 text-[9px] leading-relaxed text-tinta3">
                Probabilidad condicional al resultado de este partido, y su
                diferencia en puntos porcentuales contra el número de hoy.
              </p>
            </div>
          )}
        </section>
      </div>

      <p className="num mt-9 border-t border-borde pt-3 text-[9.5px] leading-relaxed text-tinta3">
        Goles esperados por el modelo antes del partido, no xG de disparos ·{" "}
        {metadatos.acierto_pct}% de aciertos 1X2 sobre{" "}
        {metadatos.partidos_historicos.toLocaleString("es-AR")} partidos.
      </p>
    </div>
  );
}

/**
 * La lectura en castellano de la mayor diferencia entre modelo y mercado.
 * Un +8.1 en la columna "Local" no le dice nada a nadie sin esta frase.
 */
function frase(
  p: Partido,
  mayor: { clave: "local" | "empate" | "visita"; valor: number },
): string {
  const como = {
    local: `que gane ${p.local}`,
    empate: "el empate",
    visita: `que gane ${p.visita}`,
  }[mayor.clave];
  const puntos = Math.abs(mayor.valor).toFixed(1);

  if (Math.abs(mayor.valor) < 2) {
    return `El modelo y el mercado ven este partido casi igual: la mayor diferencia es de ${puntos} puntos porcentuales.`;
  }
  return mayor.valor > 0
    ? `El modelo le da ${puntos} puntos porcentuales MÁS de chance a ${como} que el mercado.`
    : `El modelo le da ${puntos} puntos porcentuales MENOS de chance a ${como} que el mercado.`;
}

function LadoEquipo({
  slug,
  nombre,
  derecha = false,
}: {
  slug: string;
  nombre: string;
  derecha?: boolean;
}) {
  const pos = posicionPorSlug(slug);
  return (
    <Link
      href={`/equipo/${slug}`}
      title={`Ver la ficha de ${nombre}`}
      className={`group flex min-w-0 items-center gap-2.5 py-1 transition-colors hover:text-tinta ${
        derecha ? "flex-row-reverse text-right" : ""
      }`}
    >
      <Escudo slug={slug} colores={coloresDe(nombre)} size={34} />
      <span className="min-w-0">
        {/* Subrayado permanente: son los dos títulos más grandes de la página y
            no había nada que dijera que llevan a algún lado. */}
        <span className="titular-2 enlace-ficha block truncate">{nombre}</span>
        {pos && (
          <span className="num block text-[9.5px] text-tinta3">
            {pos.puesto}° zona {pos.zona} · {pos.pts} pts · DG{" "}
            {pos.dif > 0 ? "+" : ""}
            {pos.dif}
          </span>
        )}
      </span>
    </Link>
  );
}

function Pct({ valor }: { valor: number }) {
  return (
    <span
      role="cell"
      className={`num w-[66px] shrink-0 text-right text-[12px] ${
        valor >= 0 ? "text-sube" : "text-baja"
      }`}
    >
      {valor >= 0 ? "+" : "−"}
      {Math.abs(valor).toFixed(0)}%
    </span>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="etiqueta">{k}</div>
      <div className="num mt-0.5 text-[17px] font-semibold">{v}</div>
    </div>
  );
}
