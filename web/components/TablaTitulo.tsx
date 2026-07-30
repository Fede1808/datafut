"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Escudo } from "./Escudo";
import { BarraSimple } from "./BarraProb";
import { BotonOrden } from "./BotonOrden";
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

type Fila = FilaCompleta & {
  atk: number;
  def: number;
  conv: number;
  xgdif: number;
};

type Clave = "pts" | "atk" | "def" | "xgdif" | "playoffs" | "campeon" | "conv";

const COLS: { clave: Clave; label: string; titulo: string; ancho: string; opcional?: boolean }[] = [
  { clave: "pts", label: "Pts", titulo: "Puntos en la tabla", ancho: "w-10" },
  {
    clave: "atk",
    label: "Ataque",
    titulo: "Goles que hace respecto del promedio de la liga",
    ancho: "w-[62px]",
    opcional: true,
  },
  {
    clave: "def",
    label: "Defensa",
    titulo: "Goles que evita respecto del promedio de la liga",
    ancho: "w-[66px]",
    opcional: true,
  },
  {
    // Contracara de ataque/defensa: esos dos salen del modelo, éste sale de lo
    // que realmente generó el equipo en la cancha. Cuando no coinciden, ahí
    // está la discusión.
    clave: "xgdif",
    label: "xGdif",
    titulo: "Goles esperados a favor menos en contra, en toda la temporada",
    ancho: "w-[58px]",
    opcional: true,
  },
  { clave: "playoffs", label: "Playoffs", titulo: "Probabilidad de clasificar", ancho: "w-[62px]" },
  { clave: "campeon", label: "Campeón", titulo: "Probabilidad de salir campeón", ancho: "w-[64px]" },
  {
    clave: "conv",
    label: "Conv.",
    titulo: "Campeón dividido playoffs: cuánto convierte una clasificación en título",
    ancho: "w-[58px]",
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
        xgdif: f.xg_dif,
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

  // Cambia con cada reordenamiento: remonta las filas y vuelve a correr la
  // animación de entrada, que es lo que hace legible que la tabla se movió.
  const firma = `${zona}-${orden}-${asc}`;

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
    <div className="max-w-[900px]">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5">
        <div className="flex gap-1.5" role="group" aria-label="Filtrar por zona">
          {["todas", ...zonasDisponibles].map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZona(z)}
              aria-pressed={zona === z}
              className="pestania pestania-chica"
            >
              {z === "todas" ? "Todas" : `Zona ${z}`}
            </button>
          ))}
        </div>
        <p className="num text-[9.5px] text-tinta3">
          {visibles.length} equipos · tocá un encabezado{" "}
          <span aria-hidden>▲▼</span> para ordenar
        </p>
      </div>

      <div role="table" aria-label="Probabilidad de campeón y de playoffs por equipo">
        <div
          role="row"
          className="flex items-center gap-1.5 border-t-2 border-b border-tinta4 border-b-borde py-1"
        >
          {/* # es la posición en el orden aplicado, no el puesto de la tabla:
              con las dos zonas juntas el puesto se repite. El puesto real va
              pegado al nombre, como "A12". No es ordenable: ES el orden. */}
          <span role="columnheader" className="etiqueta w-6 shrink-0 text-right">
            #
          </span>
          <span role="columnheader" className="etiqueta min-w-0 flex-1 text-left">
            Equipo
          </span>
          {COLS.map((c) => (
            <BotonOrden
              key={c.clave}
              label={c.label}
              titulo={c.titulo}
              estado={estado(c.clave)}
              ancho={c.ancho}
              onClick={() => ordenar(c.clave)}
              className={c.opcional ? "hidden sm:flex" : ""}
              respetarMayusculas={c.clave === "xgdif"}
            />
          ))}
        </div>

        <div key={firma}>
          {visibles.map((f, i) => (
            <Link
              key={f.slug}
              href={`/equipo/${f.slug}`}
              role="row"
              style={{ animationDelay: `${Math.min(i, 14) * 14}ms` }}
              className="fila fila-anim flex items-center gap-1.5 border-b border-borde2 py-2"
            >
              <span role="cell" className="num w-6 shrink-0 text-right text-[10px] text-tinta3">
                {i + 1}
              </span>
              <span role="cell" className="flex min-w-0 flex-1 items-center gap-2">
                <Escudo slug={f.slug} colores={f.colores} size={16} />
                <span className="enlace-ficha truncate text-[13px]">{f.equipo}</span>
                <span
                  className="num shrink-0 text-[9px] text-tinta4"
                  title={`${f.puesto}° de la zona ${f.zona}`}
                >
                  {f.zona}
                  {f.puesto}
                </span>
              </span>

              <span role="cell" className="num w-10 shrink-0 text-right text-[12px] text-tinta2">
                {f.pts}
              </span>
              <Delta valor={f.atk} ancho="w-[62px]" />
              <Delta valor={f.def} ancho="w-[66px]" />
              <span
                role="cell"
                className={`num hidden w-[58px] shrink-0 text-right text-[11.5px] sm:block ${
                  !f.tieneStats
                    ? "text-tinta4"
                    : f.xgdif >= 0
                      ? "text-sube"
                      : "text-baja"
                }`}
              >
                {!f.tieneStats
                  ? "—"
                  : `${f.xgdif > 0 ? "+" : f.xgdif < 0 ? "−" : "±"}${Math.abs(f.xgdif).toFixed(1)}`}
              </span>
              <span role="cell" className="num w-[62px] shrink-0 text-right text-[12.5px]">
                {f.playoffs.toFixed(1)}
              </span>
              <span role="cell" className="w-[64px] shrink-0 text-right">
                <span className="num block text-[13px] font-semibold text-tinta">
                  {f.campeon.toFixed(2)}
                </span>
                <span className="ml-auto block w-fit">
                  <BarraSimple valor={f.campeon} maximo={maxCampeon} ancho={50} />
                </span>
              </span>
              <span
                role="cell"
                className="num hidden w-[58px] shrink-0 text-right text-[11.5px] text-tinta3 sm:block"
              >
                {f.conv.toFixed(1)}%
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Delta({ valor, ancho }: { valor: number; ancho: string }) {
  return (
    <span
      role="cell"
      className={`num hidden ${ancho} shrink-0 text-right text-[11.5px] sm:block ${
        valor >= 0 ? "text-sube" : "text-baja"
      }`}
    >
      {valor >= 0 ? "+" : "−"}
      {Math.abs(valor).toFixed(0)}%
    </span>
  );
}
