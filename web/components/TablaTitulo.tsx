"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Escudo } from "./Escudo";
import { BarraSimple } from "./BarraProb";
import type { FilaCompleta } from "@/lib/datos";

/**
 * Los 30 equipos ordenables por cualquier columna.
 *
 * Además de campeón y playoffs muestra la fuerza estimada (ataque y defensa,
 * ya convertidas de escala logarítmica a % sobre el promedio de la liga) y la
 * conversión: de cada 100 simulaciones en las que el equipo llega a playoffs,
 * en cuántas termina levantando la copa. Ese número separa a un candidato real
 * de un equipo que sólo clasifica.
 *
 * Filas flex y no `<table>`, por el mismo motivo que la tabla de posiciones:
 * el reparto de sobrante del algoritmo de tablas desalinea las columnas.
 */

type Fila = FilaCompleta & { atk: number; def: number; conv: number };

type Clave = "pts" | "atk" | "def" | "playoffs" | "campeon" | "conv";

const COLS: { clave: Clave; label: string; titulo: string; ancho: string; opcional?: boolean }[] = [
  { clave: "pts", label: "Pts", titulo: "Puntos en la tabla", ancho: "w-8" },
  {
    clave: "atk",
    label: "Ataque",
    titulo: "Goles que hace respecto del promedio de la liga",
    ancho: "w-12",
    opcional: true,
  },
  {
    clave: "def",
    label: "Defensa",
    titulo: "Goles que evita respecto del promedio de la liga",
    ancho: "w-12",
    opcional: true,
  },
  { clave: "playoffs", label: "Playoffs", titulo: "Probabilidad de clasificar", ancho: "w-12" },
  { clave: "campeon", label: "Campeón", titulo: "Probabilidad de salir campeón", ancho: "w-14" },
  {
    clave: "conv",
    label: "Conv.",
    titulo: "Campeón dividido playoffs: cuánto convierte una clasificación en título",
    ancho: "w-12",
    opcional: true,
  },
];

export function TablaTitulo({ filas }: { filas: FilaCompleta[] }) {
  const [orden, setOrden] = useState<Clave>("campeon");
  const [asc, setAsc] = useState(false);
  const [zona, setZona] = useState<string>("todas");

  const datos = useMemo<Fila[]>(
    () =>
      filas.map((f) => ({
        ...f,
        atk: (Math.exp(f.ataque) - 1) * 100,
        def: (Math.exp(f.defensa) - 1) * 100,
        conv: f.playoffs > 0 ? (f.campeon / f.playoffs) * 100 : 0,
      })),
    [filas],
  );

  const zonasDisponibles = useMemo(
    () => [...new Set(filas.map((f) => f.zona))].sort(),
    [filas],
  );

  const visibles = useMemo(() => {
    const base = zona === "todas" ? datos : datos.filter((f) => f.zona === zona);
    return [...base].sort((a, b) => {
      const d = a[orden] - b[orden];
      return (asc ? d : -d) || b.campeon - a.campeon;
    });
  }, [datos, orden, asc, zona]);

  const maxCampeon = Math.max(...datos.map((f) => f.campeon), 0.01);

  function ordenar(c: Clave) {
    if (c === orden) setAsc(!asc);
    else {
      setOrden(c);
      setAsc(false);
    }
  }
  function estado(c: Clave): "ascending" | "descending" | "none" {
    return c === orden ? (asc ? "ascending" : "descending") : "none";
  }

  return (
    <div className="max-w-[760px]">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
        <div className="flex gap-1" role="group" aria-label="Filtrar por zona">
          {["todas", ...zonasDisponibles].map((z) => (
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
        <p className="num text-[9.5px] text-[#6d6862]">{visibles.length} equipos</p>
      </div>

      <div role="table" aria-label="Probabilidad de campeón y de playoffs por equipo">
        <div
          role="row"
          className="flex items-center gap-1.5 border-t-2 border-b border-[#f4f1ea] border-b-[#2e2b27] py-2"
        >
          {/* # es la posición en el orden aplicado, no el puesto de la tabla:
              con las dos zonas juntas el puesto se repite. El puesto real va
              pegado al nombre, como "A12". */}
          <span role="columnheader" className="etiqueta w-6 shrink-0 text-right">
            #
          </span>
          <span role="columnheader" className="etiqueta min-w-0 flex-1 text-left">
            Equipo
          </span>
          {COLS.map((c) => (
            <button
              key={c.clave}
              type="button"
              role="columnheader"
              aria-sort={estado(c.clave)}
              title={c.titulo}
              onClick={() => ordenar(c.clave)}
              className={`th-orden ${c.ancho} shrink-0 text-right ${
                c.opcional ? "hidden sm:block" : ""
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {visibles.map((f, i) => (
          <Link
            key={f.slug}
            href={`/equipo/${f.slug}`}
            role="row"
            className="fila flex items-center gap-1.5 border-b border-[#201e1b] py-2"
          >
            <span role="cell" className="num w-6 shrink-0 text-right text-[10px] text-[#6d6862]">
              {i + 1}
            </span>
            <span role="cell" className="flex min-w-0 flex-1 items-center gap-2">
              <Escudo slug={f.slug} colores={f.colores} size={16} />
              <span className="truncate text-[13px]">{f.equipo}</span>
              <span
                className="num shrink-0 text-[9px] text-[#423e38]"
                title={`${f.puesto}° de la zona ${f.zona}`}
              >
                {f.zona}
                {f.puesto}
              </span>
            </span>

            <span role="cell" className="num w-8 shrink-0 text-right text-[12px] text-[#a09a90]">
              {f.pts}
            </span>
            <Delta valor={f.atk} />
            <Delta valor={f.def} />
            <span role="cell" className="num w-12 shrink-0 text-right text-[12.5px]">
              {f.playoffs.toFixed(1)}
            </span>
            <span role="cell" className="w-14 shrink-0 text-right">
              <span className="num block text-[13px] font-semibold text-[#ffbe3d]">
                {f.campeon.toFixed(2)}
              </span>
              <span className="ml-auto block w-fit">
                <BarraSimple valor={f.campeon} maximo={maxCampeon} ancho={50} />
              </span>
            </span>
            <span
              role="cell"
              className="num hidden w-12 shrink-0 text-right text-[11.5px] text-[#6d6862] sm:block"
            >
              {f.conv.toFixed(1)}%
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Delta({ valor }: { valor: number }) {
  return (
    <span
      role="cell"
      className={`num hidden w-12 shrink-0 text-right text-[11.5px] sm:block ${
        valor >= 0 ? "text-[#5cc27e]" : "text-[#f2607d]"
      }`}
    >
      {valor >= 0 ? "+" : "−"}
      {Math.abs(valor).toFixed(0)}%
    </span>
  );
}
