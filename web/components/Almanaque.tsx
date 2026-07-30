"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Escudo } from "@/components/Escudo";
import { BarraProb } from "@/components/BarraProb";
import {
  FECHAS,
  diaLargo,
  estadoDeFecha,
  etiquetaCorta,
  proximaRonda,
  rangoDeDias,
  type Fecha,
  type PartidoFecha,
} from "@/lib/calendario";

/**
 * La vista fecha a fecha del torneo.
 *
 * Es cliente por una sola razón: la tira de arriba necesita estado. Todo lo
 * demás son los mismos datos estáticos del pipeline.
 *
 * SE NAVEGA POR FECHA, NUNCA POR DÍA. La fecha es la unidad del torneo — 16
 * escalones, 15 partidos y los 30 equipos en cada uno. Que un partido se juegue
 * el martes y otro el jueves es programación de la AFA, no estructura del
 * campeonato: por eso el día es un separador adentro de la fecha y no un nivel
 * de navegación.
 *
 * ARRANCA EN LA FECHA PRÓXIMA y no en la 1: la pregunta que trae a alguien acá
 * es «qué se juega ahora», y las quince fechas anteriores están a un toque.
 */
export function Almanaque() {
  const [ronda, setRonda] = useState(proximaRonda);
  const tira = useRef<HTMLDivElement>(null);
  const fecha = FECHAS.find((f) => f.ronda === ronda) ?? FECHAS[0];

  // Con la fecha próxima avanzada, el botón activo arranca fuera de la pantalla
  // del celular y la tira parece empezar en la 1. Se corre el scroll de la tira,
  // no el de la página: `scrollIntoView` movería el documento entero.
  useEffect(() => {
    const caja = tira.current;
    const activo = caja?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!caja || !activo) return;
    caja.scrollLeft =
      activo.offsetLeft - caja.clientWidth / 2 + activo.offsetWidth / 2;
  }, []);

  return (
    <>
      <div className="almanaque">
        <div className="tira" ref={tira} role="group" aria-label="Elegir fecha">
          {FECHAS.map((f) => (
            <button
              key={f.ronda}
              type="button"
              onClick={() => setRonda(f.ronda)}
              aria-pressed={f.ronda === ronda}
              aria-label={`Fecha ${f.ronda}`}
              data-estado={estadoDeFecha(f)}
              className="fecha-btn"
            >
              <b aria-hidden>{f.ronda}</b>
              <i aria-hidden>{etiquetaCorta(f)}</i>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-3.5 gap-y-1 pb-2.5 text-[9.5px] text-tinta3">
          <Leyenda color="var(--color-sube)">jugada</Leyenda>
          <Leyenda color="#e0a020">con partidos postergados</Leyenda>
        </div>
      </div>

      {/* `key` fuerza el remonte al cambiar de fecha: sin eso la animación de
          entrada corre una sola vez y los cambios siguientes son un salto. */}
      <TarjetaFecha key={fecha.ronda} f={fecha} />
    </>
  );
}

function Leyenda({ color, children }: { color: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-[5px] w-[5px] rounded-full"
        style={{ background: color }}
      />
      {children}
    </span>
  );
}

/** El encabezado de la fecha: qué es y cuándo se juega, en una línea. */
function detalleDe(f: Fecha): string {
  if (f.jugada) return `Jugada · ${rangoDeDias(f.dias)}`;
  if (f.postergados > 0)
    return `${f.partidos.length} partidos · ${f.postergados} sin fecha confirmada`;
  if (f.proxima) return `Se juega ahora · ${f.partidos.length} partidos`;
  return `${f.partidos.length} partidos · ${rangoDeDias(f.dias)}`;
}

function TarjetaFecha({ f }: { f: Fecha }) {
  return (
    <section className="fecha-anim tarjeta mt-4 overflow-hidden border border-borde">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b-2 border-tinta4 px-3.5 pb-2.5 pt-3">
        <h2 className="titular-2">Fecha {f.ronda}</h2>
        <span className="num text-[9.5px] uppercase tracking-[0.1em] text-tinta3">
          {detalleDe(f)}
        </span>
      </header>

      {f.grupos.map((g) => (
        <div key={g.dia ?? "postergados"}>
          {g.dia !== null && <div className="num dia-sep">{diaLargo(g.dia)}</div>}
          {g.partidos.map((p) => (
            <FilaFecha key={`${p.local_slug}-${p.visita_slug}`} p={p} />
          ))}
        </div>
      ))}

      {f.postergados > 0 && (
        <p className="border-t border-borde2 px-3.5 py-4 text-[12.5px] leading-relaxed text-tinta3">
          Los{" "}
          <strong className="font-semibold text-tinta">
            {f.postergados} partidos postergados
          </strong>{" "}
          de esta fecha siguen contando para la simulación: el modelo los juega
          igual. Cuando la AFA confirme el día, aparecen acá solos.
        </p>
      )}

      {/*
        El aviso de las fechas lejanas.

        NO dice «estimación sujeta a cambios», que no informa nada. Dice la
        razón concreta, que es una limitación conocida y documentada del modelo
        (ver `src/simulate.py`): mide fuerza por goles, así que un plantel
        distinto le llega con varias fechas de retraso. Con eso cualquiera puede
        decidir solo cuánto confiar en el número de noviembre.
      */}
      {f.partidos.some((p) => p.estimado) && (
        <p className="border-t border-borde2 px-3.5 py-4 text-[12.5px] leading-relaxed text-tinta3">
          <strong className="font-semibold text-tinta">
            Estos porcentajes son una estimación.
          </strong>{" "}
          El modelo mide la fuerza de ataque y de defensa de cada equipo a partir
          de los goles, y de nada más: no sabe de lesiones, suspensiones,
          refuerzos ni cambios de técnico. Cuando un plantel cambia se entera
          recién cuando ese equipo empieza a hacer menos goles, con varias fechas
          de retraso. Cuanto más lejos está la fecha, menos vale el número.
        </p>
      )}
    </section>
  );
}

/**
 * Un lado del partido: escudo y nombre, con el escudo siempre del lado de
 * afuera. `href` en `null` cuando el link lo pone la fila entera — dos links
 * anidados no son HTML válido.
 */
function Lado({
  nombre,
  slug,
  colores,
  href,
  apagado,
  visitante,
}: {
  nombre: string;
  slug: string;
  colores: [string, string];
  href: string | null;
  apagado: boolean;
  visitante?: boolean;
}) {
  const contenido = (
    <>
      {visitante && <Escudo slug={slug} colores={colores} size={16} />}
      <span
        className={`enlace-ficha truncate text-[13.5px] font-medium ${
          apagado ? "text-tinta4" : ""
        }`}
      >
        {nombre}
      </span>
      {!visitante && <Escudo slug={slug} colores={colores} size={16} />}
    </>
  );
  const clases = `flex min-w-0 items-center gap-2 ${
    visitante ? "" : "justify-end text-right"
  }`;

  return href ? (
    <Link href={href} className={clases}>
      {contenido}
    </Link>
  ) : (
    <span className={clases}>{contenido}</span>
  );
}

/**
 * Un partido de la fecha.
 *
 * La fila entera es un link SÓLO en la fecha próxima, que es la única con
 * página de partido: `/partido/[slug]` se genera desde `fecha.json`. En las
 * otras quince fechas linkean los dos nombres, cada uno a la ficha de su club.
 * Es preferible a inventar 225 páginas de partido con números estimados, o a
 * dejar la fila entera apuntando a un 404.
 */
function FilaFecha({ p }: { p: PartidoFecha }) {
  const jugado = p.goles_local !== null && p.goles_visita !== null;
  const conFicha = p.prob !== null && !p.estimado;
  const ganaLocal = jugado && p.goles_local! > p.goles_visita!;
  const ganaVisita = jugado && p.goles_visita! > p.goles_local!;

  const cuerpo = (
    <>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
        <Lado
          nombre={p.local}
          slug={p.local_slug}
          colores={p.colores_local}
          href={conFicha ? null : `/equipo/${p.local_slug}`}
          apagado={jugado && !ganaLocal}
        />

        {jugado ? (
          <span
            className="marcador shrink-0"
            aria-label={`${p.goles_local} a ${p.goles_visita}`}
          >
            <span data-gana={ganaLocal}>{p.goles_local}</span>
            <span data-gana={ganaVisita}>{p.goles_visita}</span>
          </span>
        ) : (
          <span className="hora-caja shrink-0">{p.hora ?? "a definir"}</span>
        )}

        <Lado
          nombre={p.visita}
          slug={p.visita_slug}
          colores={p.colores_visita}
          href={conFicha ? null : `/equipo/${p.visita_slug}`}
          apagado={jugado && !ganaVisita}
          visitante
        />
      </div>

      {p.prob && (
        <>
          <div className="mt-2.5">
            <BarraProb {...p.prob} alto={7} />
          </div>
          <div className="num mt-1.5 flex justify-between gap-2 text-[9.5px] text-tinta3">
            <span>
              local{" "}
              <strong className="font-semibold text-tinta">
                {p.prob.local.toFixed(1)}%
              </strong>
            </span>
            <span>
              empate{" "}
              <strong className="font-semibold text-tinta">
                {p.prob.empate.toFixed(1)}%
              </strong>
            </span>
            <span>
              visita{" "}
              <strong className="font-semibold text-tinta">
                {p.prob.visita.toFixed(1)}%
              </strong>
            </span>
          </div>
        </>
      )}

      {p.aplazado && (
        <span className="chip-postergado num mt-2">
          <span aria-hidden>⚠</span> Postergado — sin día confirmado
        </span>
      )}
    </>
  );

  const clases = "fila border-b border-borde2 px-3.5 py-2.5 last:border-b-0";

  return conFicha ? (
    <Link
      href={`/partido/${p.local_slug}-vs-${p.visita_slug}`}
      className={`${clases} block`}
    >
      {cuerpo}
    </Link>
  ) : (
    <div className={clases}>{cuerpo}</div>
  );
}
