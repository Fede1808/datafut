"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Escudo } from "./Escudo";
import { BarraSimple } from "./BarraProb";
import { Racha } from "./Racha";
import type { FilaCompleta } from "@/lib/datos";

/**
 * Tabla de posiciones ordenable, con las probabilidades del modelo al lado.
 *
 * Es cliente sólo por el orden y el filtro de zona; los datos siguen viniendo
 * del JSON en tiempo de build. La gracia está en el cruce: la tabla dice dónde
 * está el equipo hoy y las dos últimas columnas dicen dónde va a terminar. Por
 * separado, en dos páginas distintas, ninguno de los dos números se compara
 * con nada.
 *
 * Va con filas flex y roles ARIA en vez de `<table>`: el algoritmo de anchos de
 * tabla reparte el sobrante entre las columnas y desalinea la grilla apenas el
 * contenedor es más ancho que el contenido. Con flex, cada columna mide lo que
 * se le dice y además la fila entera es un solo link.
 */

type Clave = keyof Pick<
  FilaCompleta,
  | "puesto"
  | "pj"
  | "pg"
  | "pe"
  | "pp"
  | "gf"
  | "gc"
  | "dif"
  | "pts"
  | "playoffs"
  | "campeon"
  | "descenso"
>;

const COLUMNAS: {
  clave: Clave;
  label: string;
  titulo: string;
  ancho: string;
  /** Si el primer clic ordena de mayor a menor. */
  desc: boolean;
  /** Se esconde en pantallas chicas. */
  opcional?: boolean;
}[] = [
  { clave: "pj", label: "PJ", titulo: "Partidos jugados", ancho: "w-7", desc: true },
  { clave: "pg", label: "G", titulo: "Ganados", ancho: "w-6", desc: true, opcional: true },
  { clave: "pe", label: "E", titulo: "Empatados", ancho: "w-6", desc: true, opcional: true },
  { clave: "pp", label: "P", titulo: "Perdidos", ancho: "w-6", desc: true, opcional: true },
  { clave: "gf", label: "GF", titulo: "Goles a favor", ancho: "w-7", desc: true, opcional: true },
  { clave: "gc", label: "GC", titulo: "Goles en contra", ancho: "w-7", desc: false, opcional: true },
  { clave: "dif", label: "DG", titulo: "Diferencia de gol", ancho: "w-9", desc: true },
  { clave: "pts", label: "PTS", titulo: "Puntos", ancho: "w-9", desc: true },
];

export function TablaPosiciones({
  filas,
  zonas,
  clasifican,
}: {
  filas: FilaCompleta[];
  zonas: string[];
  clasifican: number;
}) {
  const [zona, setZona] = useState<string>(zonas[0] ?? "A");
  const [orden, setOrden] = useState<Clave>("puesto");
  const [asc, setAsc] = useState(true);

  const visibles = useMemo(() => {
    const base = zona === "todas" ? filas : filas.filter((f) => f.zona === zona);
    return [...base].sort((a, b) => {
      const d = a[orden] - b[orden];
      // Desempate estable por puesto: sin esto, ordenar por PJ deja las filas
      // empatadas en cualquier orden y la tabla salta entre clics.
      return (asc ? d : -d) || a.puesto - b.puesto;
    });
  }, [filas, zona, orden, asc]);

  // Escala de las barritas: relativa al máximo, no al 100%. Con nadie arriba
  // del 20% de campeón, contra 100 todas las barras serían invisibles.
  const maxCampeon = Math.max(...filas.map((f) => f.campeon), 0.01);
  const maxPlayoffs = Math.max(...filas.map((f) => f.playoffs), 0.01);

  // La línea de corte sólo tiene sentido con el orden natural de una zona.
  const cortePosible = orden === "puesto" && asc && zona !== "todas";

  function ordenar(c: Clave, desc: boolean) {
    if (c === orden) setAsc(!asc);
    else {
      setOrden(c);
      setAsc(!desc);
    }
  }

  function estado(c: Clave): "ascending" | "descending" | "none" {
    return c === orden ? (asc ? "ascending" : "descending") : "none";
  }

  return (
    // Ancho acotado: una grilla de números estirada a 1150px deja tanto aire
    // entre columnas que las filas dejan de leerse como filas.
    <div className="max-w-[920px]">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
        <div className="flex gap-1" role="group" aria-label="Filtrar por zona">
          {[...zonas, "todas"].map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZona(z)}
              aria-pressed={zona === z}
              className={`num border px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] transition-colors ${
                zona === z
                  ? "border-[#ffbe3d] bg-[#ffbe3d] font-semibold text-[#12110f]"
                  : "border-[#2e2b27] text-[#a09a90] hover:border-[#423e38] hover:text-[#f4f1ea]"
              }`}
            >
              {z === "todas" ? "Todas" : `Zona ${z}`}
            </button>
          ))}
        </div>
        <p className="num text-[9.5px] text-[#6d6862]">Tocá una columna para ordenar</p>
      </div>

      <div role="table" aria-label="Posiciones y probabilidades por equipo">
        {/* Cabecera */}
        <div
          role="row"
          className="flex items-center gap-1.5 border-t-2 border-b border-[#f4f1ea] border-b-[#2e2b27] py-2"
        >
          <button
            type="button"
            role="columnheader"
            aria-sort={estado("puesto")}
            onClick={() => ordenar("puesto", false)}
            className="th-orden w-6 shrink-0 text-right"
          >
            #
          </button>
          <span role="columnheader" className="etiqueta min-w-0 flex-1 text-left">
            Equipo
          </span>
          {COLUMNAS.map((c) => (
            <button
              key={c.clave}
              type="button"
              role="columnheader"
              aria-sort={estado(c.clave)}
              title={c.titulo}
              onClick={() => ordenar(c.clave, c.desc)}
              className={`th-orden ${c.ancho} shrink-0 text-right ${
                c.opcional ? "hidden sm:block" : ""
              }`}
            >
              {c.label}
            </button>
          ))}
          <span
            role="columnheader"
            title="Los últimos seis partidos, del más viejo al más nuevo"
            className="etiqueta hidden w-11 shrink-0 text-right md:block"
          >
            Forma
          </span>
          <button
            type="button"
            role="columnheader"
            aria-sort={estado("descenso")}
            title="Probabilidad de descender: último de la tabla de promedios o de la anual"
            onClick={() => ordenar("descenso", true)}
            className="th-orden w-[44px] shrink-0 text-right"
          >
            Baja
          </button>
          <button
            type="button"
            role="columnheader"
            aria-sort={estado("playoffs")}
            title="Probabilidad de clasificar a playoffs"
            onClick={() => ordenar("playoffs", true)}
            className="th-orden w-[52px] shrink-0 text-right"
          >
            Playoff
          </button>
          <button
            type="button"
            role="columnheader"
            aria-sort={estado("campeon")}
            title="Probabilidad de salir campeón"
            onClick={() => ordenar("campeon", true)}
            className="th-orden w-[52px] shrink-0 text-right"
          >
            Campeón
          </button>
        </div>

        {/* Filas */}
        {visibles.map((f, i) => {
          const dentro = f.puesto <= clasifican;
          const corte =
            cortePosible && f.puesto === clasifican && i + 1 < visibles.length;
          return (
            <Link
              key={f.slug}
              href={`/equipo/${f.slug}`}
              role="row"
              className={`fila flex items-center gap-1.5 py-2 ${
                corte ? "border-b-2 border-[#5cc27e]" : "border-b border-[#201e1b]"
              }`}
            >
              <span
                role="cell"
                className={`num w-6 shrink-0 text-right text-[11px] ${
                  dentro ? "text-[#f4f1ea]" : "text-[#6d6862]"
                }`}
              >
                {f.puesto}
              </span>
              <span role="cell" className="flex min-w-0 flex-1 items-center gap-2">
                <Escudo slug={f.slug} colores={f.colores} size={16} />
                <span className="truncate text-[13px]">{f.equipo}</span>
                {zona === "todas" && (
                  <span className="num shrink-0 text-[9px] text-[#423e38]">
                    {f.zona}
                  </span>
                )}
              </span>
              {COLUMNAS.map((c) => (
                <span
                  key={c.clave}
                  role="cell"
                  className={`num ${c.ancho} shrink-0 text-right text-[12px] ${
                    c.clave === "pts"
                      ? "font-semibold text-[#f4f1ea]"
                      : "text-[#a09a90]"
                  } ${c.opcional ? "hidden sm:block" : ""}`}
                >
                  {c.clave === "dif" && f.dif > 0 ? "+" : ""}
                  {f[c.clave]}
                </span>
              ))}
              <span
                role="cell"
                className="hidden w-11 shrink-0 justify-end md:flex"
              >
                <Racha ultimos={f.ultimos} ancho={5} separacion={2} alto={11} />
              </span>
              {/* El descenso sólo se escribe cuando existe: una columna con
                  veintiocho "0.0" convierte en ruido el único número que
                  importa mirar acá. */}
              <span
                role="cell"
                className={`num w-[44px] shrink-0 text-right text-[12px] ${
                  f.descenso >= 10 ? "text-[#f2607d]" : "text-[#a09a90]"
                }`}
              >
                {f.descenso >= 0.05 ? f.descenso.toFixed(1) : "—"}
              </span>
              <span role="cell" className="w-[52px] shrink-0 text-right">
                <span className="num block text-[12px] text-[#f4f1ea]">
                  {f.playoffs.toFixed(1)}
                </span>
                <span className="ml-auto block w-fit">
                  <BarraSimple
                    valor={f.playoffs}
                    maximo={maxPlayoffs}
                    color="#5cc27e"
                    ancho={44}
                  />
                </span>
              </span>
              <span role="cell" className="w-[52px] shrink-0 text-right">
                <span className="num block text-[12px] font-semibold text-[#ffbe3d]">
                  {f.campeon.toFixed(1)}
                </span>
                <span className="ml-auto block w-fit">
                  <BarraSimple valor={f.campeon} maximo={maxCampeon} ancho={44} />
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
