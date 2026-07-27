"use client";

import { useEffect, useRef, useState } from "react";
import type { Stats } from "@/lib/datos";

/**
 * Las estadísticas avanzadas de un equipo, con el contexto que las hace
 * legibles.
 *
 * LA IDEA QUE HAY QUE TRANSMITIR. Los goles cuentan QUÉ PASÓ. El xG cuenta CADA
 * CUÁNTO TENDRÍA QUE PASAR: se le pone a cada remate la probabilidad que tiene
 * de terminar en gol según desde dónde y cómo se pateó, y se suman. Un equipo
 * que genera mucho xG y mete pocos goles no juega mal — está desperdiciando; y
 * uno que mete mucho más de lo que genera está teniendo un buen momento que
 * normalmente no dura.
 *
 * POR QUÉ NUNCA VA UN NÚMERO SOLO. "65.4% de posesión" no significa nada sin
 * saber que el promedio de la liga es 49.7%. Cada barra lleva la marca del
 * promedio de la liga encima, y cada cifra grande lleva su puesto entre los
 * equipos con datos.
 *
 * NOMBRES. `pases_campo_rival` y `toques_en_area_rival` NO son "pases
 * progresivos". Los pases progresivos eran una métrica de Opta y desaparecieron
 * con su feed en enero de 2026. Acá se llaman por lo que son.
 *
 * Es cliente sólo por el observador que dispara la animación de las barras al
 * entrar en pantalla; los datos siguen viniendo del JSON en tiempo de build.
 */

type ClaveBarra =
  | "posesion"
  | "remates"
  | "chances_claras"
  | "duelos_ganados"
  | "toques_en_area_rival"
  | "pases_campo_rival";

const BARRAS: {
  clave: ClaveBarra;
  label: string;
  /** Qué mide, en castellano, para el `title`. */
  ayuda: string;
  decimales: number;
  sufijo: string;
}[] = [
  {
    clave: "posesion",
    label: "Posesión",
    ayuda: "Porcentaje del tiempo con la pelota",
    decimales: 1,
    sufijo: "%",
  },
  {
    clave: "remates",
    label: "Remates",
    ayuda: "Remates por partido",
    decimales: 1,
    sufijo: "",
  },
  {
    clave: "chances_claras",
    label: "Chances claras",
    ayuda: "Situaciones claras de gol por partido",
    decimales: 1,
    sufijo: "",
  },
  {
    clave: "duelos_ganados",
    label: "Duelos ganados",
    ayuda: "Porcentaje de duelos individuales ganados",
    decimales: 1,
    sufijo: "%",
  },
  {
    clave: "toques_en_area_rival",
    label: "Toques en el área rival",
    ayuda: "Toques dentro del área contraria por partido",
    decimales: 1,
    sufijo: "",
  },
  {
    clave: "pases_campo_rival",
    label: "Pases en campo rival",
    ayuda: "Pases dados en la mitad de cancha contraria, por partido",
    decimales: 0,
    sufijo: "",
  },
];

export function StatsAvanzadas({
  stats,
  promedio,
  maximos,
  totalConStats,
}: {
  stats: Stats;
  promedio: Record<string, number>;
  maximos: Record<string, number>;
  totalConStats: number;
}) {
  const visible = useVisible<HTMLDivElement>();

  // Cuántos goles se desperdician o se regalan de más. El signo se explica en
  // palabras, no con un + y un − que hay que interpretar.
  const sobre = stats.sobre_xg;
  const desperdicia = sobre < 0;

  return (
    <div ref={visible.ref}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="etiqueta">Lo que genera y lo que concede</h2>
        <span className="num text-[9px] uppercase tracking-[0.08em] text-[#423e38]">
          {stats.pj} partidos · FotMob
        </span>
      </div>

      {/* La definición, corta y arriba de todo: mucha gente no sabe qué es xG y
          sin eso las tres cifras de abajo son ruido. */}
      <p className="mt-1.5 max-w-[68ch] text-[12.5px] leading-relaxed text-[#a09a90]">
        <strong className="font-semibold text-[#f4f1ea]">Goles esperados (xG):</strong>{" "}
        a cada remate se le asigna la probabilidad de terminar en gol según desde
        dónde y cómo se pateó, y se suman. Los goles dicen qué pasó; el xG dice
        cada cuánto tendría que pasar.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-[#2e2b27] py-4 sm:grid-cols-4">
        <Cifra
          label="xG a favor"
          valor={stats.xg.toFixed(1)}
          detalle={`${stats.puesto_xg}° de ${totalConStats} · ${stats.goles} goles reales`}
        />
        <Cifra
          label="xG en contra"
          valor={stats.xg_contra.toFixed(1)}
          detalle={`${stats.puesto_xg_contra}° de ${totalConStats} · ${stats.goles_contra} recibidos`}
        />
        <Cifra
          label="Diferencia xG"
          valor={`${stats.xg_dif > 0 ? "+" : stats.xg_dif < 0 ? "−" : "±"}${Math.abs(stats.xg_dif).toFixed(1)}`}
          // `+ 0` mata el "−0.0" que sale de redondear un promedio de −0.02.
          detalle={`${stats.puesto_xg_dif}° de ${totalConStats} · promedio liga ${(Number(promedio.xg_dif.toFixed(1)) + 0).toFixed(1)}`}
          color={stats.xg_dif >= 0 ? "#5cc27e" : "#f2607d"}
        />
        <Cifra
          label="Posesión"
          valor={`${stats.posesion.toFixed(1)}%`}
          detalle={`${stats.puesto_posesion}° de ${totalConStats} · promedio liga ${promedio.posesion.toFixed(1)}%`}
        />
      </div>

      {/* --- Goles contra xG: el número que más se malinterpreta --- */}
      <div className="mt-5">
        <h3 className="etiqueta">Goles contra goles esperados</h3>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span
            className="cifra text-[28px]"
            style={{ color: desperdicia ? "#f2607d" : "#5cc27e" }}
          >
            {sobre > 0 ? "+" : sobre < 0 ? "−" : "±"}
            {Math.abs(sobre).toFixed(1)}
          </span>
          <span className="text-[12.5px] text-[#a09a90]">
            {desperdicia ? (
              <>
                metió <strong className="text-[#f4f1ea]">{Math.abs(sobre).toFixed(1)} goles menos</strong>{" "}
                de los que generó
              </>
            ) : (
              <>
                metió <strong className="text-[#f4f1ea]">{sobre.toFixed(1)} goles más</strong>{" "}
                de los que generó
              </>
            )}
          </span>
        </div>

        {/* Dos barras encimadas, misma escala: el largo de una contra la otra ES
            la diferencia. Un número solo no se ve; dos barras sí. */}
        <div className="mt-3 max-w-[420px]">
          <BarraComparada
            label="Goles"
            valor={stats.goles}
            maximo={Math.max(stats.goles, stats.xg)}
            color="#f4f1ea"
            visible={visible.activo}
            decimales={0}
            retraso={0}
          />
          <BarraComparada
            label="xG"
            valor={stats.xg}
            maximo={Math.max(stats.goles, stats.xg)}
            color="#ffbe3d"
            visible={visible.activo}
            decimales={1}
            retraso={90}
          />
        </div>

        <p className="num mt-2 max-w-[70ch] text-[9.5px] leading-relaxed text-[#6d6862]">
          {desperdicia
            ? "Generar más de lo que se convierte suele corregirse solo: si las situaciones siguen siendo las mismas, los goles tienden a aparecer."
            : "Convertir más de lo que se genera casi nunca dura. No es un defecto del equipo, es que la definición vuelve con el tiempo a lo que dicen las situaciones."}{" "}
          El promedio de la liga es{" "}
          {promedio.sobre_xg > 0 ? "+" : "−"}
          {Math.abs(promedio.sobre_xg).toFixed(1)}.
        </p>
      </div>

      {/* --- Cómo juega, contra el promedio de la liga --- */}
      <div className="mt-6">
        <h3 className="etiqueta">Cómo juega, contra el promedio de la liga</h3>
        <div className="mt-2 max-w-[540px]">
          {BARRAS.map((b, i) => (
            <BarraLiga
              key={b.clave}
              label={b.label}
              ayuda={b.ayuda}
              valor={stats[b.clave]}
              promedio={promedio[b.clave]}
              maximo={maximos[b.clave]}
              decimales={b.decimales}
              sufijo={b.sufijo}
              visible={visible.activo}
              retraso={i * 60}
            />
          ))}
        </div>
        <p className="num mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9.5px] leading-relaxed text-[#6d6862]">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-[10px] w-[2px] bg-[#f4f1ea]" />
            promedio de la liga
          </span>
          <span aria-hidden className="text-[#2e2b27]">|</span>
          <span>Escala: el máximo de cada fila es el mejor de la liga.</span>
        </p>
      </div>

      {/* La aclaración de nombres. No es una nota al pie de cortesía: llamar
          "pases progresivos" a esto sería mentir. */}
      <p className="num mt-4 max-w-[76ch] text-[9px] leading-relaxed text-[#6d6862]">
        Estadísticas avanzadas de FotMob. Remates, chances claras, toques en el
        área rival y pases en campo rival son promedios por partido. Los pases en
        campo rival y los toques en el área rival{" "}
        <strong className="font-semibold text-[#a09a90]">
          no son pases progresivos
        </strong>
        : esa métrica la definía Opta y dejó de publicarse en enero de 2026. Se
        parecen, miden otra cosa, y por eso van con su nombre real. Los totales
        de xG son de toda la temporada y los equipos no jugaron la misma cantidad
        de partidos.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Dispara una sola vez cuando el bloque entra en pantalla.
 *
 * Arranca en `true` si el navegador no soporta `IntersectionObserver`: la
 * animación es un adorno, el dato no. Nunca puede pasar que un problema del
 * observador deje las barras en cero.
 */
function useVisible<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [activo, setActivo] = useState(false);

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo || typeof IntersectionObserver === "undefined") {
      setActivo(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setActivo(true);
          obs.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    obs.observe(nodo);
    return () => obs.disconnect();
  }, []);

  return { ref, activo };
}

function Cifra({
  label,
  valor,
  detalle,
  color,
}: {
  label: string;
  valor: string;
  detalle: string;
  color?: string;
}) {
  return (
    <div>
      <div className="etiqueta">{label}</div>
      <div className="cifra mt-1 text-[26px]" style={{ color: color ?? "#f4f1ea" }}>
        {valor}
      </div>
      <div className="num mt-1 text-[9px] leading-snug text-[#6d6862]">{detalle}</div>
    </div>
  );
}

/** Dos magnitudes de la misma unidad, una arriba de la otra. */
function BarraComparada({
  label,
  valor,
  maximo,
  color,
  visible,
  decimales,
  retraso,
}: {
  label: string;
  valor: number;
  maximo: number;
  color: string;
  visible: boolean;
  decimales: number;
  retraso: number;
}) {
  const p = maximo > 0 ? Math.min(valor / maximo, 1) : 0;
  return (
    <div className="flex items-center gap-2 py-[3px]">
      <span className="num w-9 shrink-0 text-[10px] uppercase tracking-[0.06em] text-[#6d6862]">
        {label}
      </span>
      <span className="h-[9px] min-w-0 flex-1 bg-[#201e1b]">
        <span
          className="barra-crece block h-full"
          data-visible={visible ? "true" : "false"}
          style={{
            width: `${p * 100}%`,
            background: color,
            transitionDelay: `${retraso}ms`,
          }}
        />
      </span>
      <span className="num w-10 shrink-0 text-right text-[11.5px] text-[#f4f1ea]">
        {valor.toFixed(decimales)}
      </span>
    </div>
  );
}

/**
 * Una métrica contra el promedio de la liga.
 *
 * La barra se escala al máximo de la liga y la marca clara es el promedio: se
 * ve de un vistazo si el equipo está arriba o abajo, sin leer un solo número.
 */
function BarraLiga({
  label,
  ayuda,
  valor,
  promedio,
  maximo,
  decimales,
  sufijo,
  visible,
  retraso,
}: {
  label: string;
  ayuda: string;
  valor: number;
  promedio: number;
  maximo: number;
  decimales: number;
  sufijo: string;
  visible: boolean;
  retraso: number;
}) {
  const p = maximo > 0 ? Math.min(valor / maximo, 1) : 0;
  const pProm = maximo > 0 ? Math.min(promedio / maximo, 1) : 0;
  const arriba = valor >= promedio;

  return (
    <div
      className="flex items-center gap-2.5 border-b border-[#201e1b] py-2 last:border-b-0"
      title={ayuda}
    >
      <span className="w-[128px] shrink-0 text-[11.5px] text-[#a09a90] sm:w-[150px]">
        {label}
      </span>
      <span className="relative block h-[10px] min-w-0 flex-1 bg-[#201e1b]">
        <span
          className="barra-crece block h-full"
          data-visible={visible ? "true" : "false"}
          style={{
            width: `${p * 100}%`,
            background: arriba ? "#ffbe3d" : "#6d6862",
            transitionDelay: `${retraso}ms`,
          }}
        />
        {/* Marca del promedio de la liga. Va encima de la barra y siempre
            visible: es la referencia, no un adorno. */}
        <span
          aria-hidden
          className="absolute top-[-2px] block w-[2px] bg-[#f4f1ea]"
          style={{ left: `calc(${pProm * 100}% - 1px)`, height: 14 }}
        />
      </span>
      <span
        className={`num w-12 shrink-0 text-right text-[11.5px] ${
          arriba ? "text-[#f4f1ea]" : "text-[#a09a90]"
        }`}
      >
        {valor.toFixed(decimales)}
        {sufijo}
      </span>
      <span className="num hidden w-[74px] shrink-0 whitespace-nowrap text-right text-[9.5px] text-[#6d6862] sm:block">
        liga {promedio.toFixed(decimales)}
        {sufijo}
      </span>
    </div>
  );
}
