"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Escudo } from "./Escudo";
import { BarraSimple } from "./BarraProb";
import { Racha } from "./Racha";
import { BotonOrden } from "./BotonOrden";
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
  | "xg_dif"
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
  { clave: "pj", label: "PJ", titulo: "Partidos jugados", ancho: "w-8", desc: true },
  { clave: "pg", label: "G", titulo: "Ganados", ancho: "w-8", desc: true, opcional: true },
  { clave: "pe", label: "E", titulo: "Empatados", ancho: "w-8", desc: true, opcional: true },
  { clave: "pp", label: "P", titulo: "Perdidos", ancho: "w-8", desc: true, opcional: true },
  { clave: "gf", label: "GF", titulo: "Goles a favor", ancho: "w-9", desc: true, opcional: true },
  { clave: "gc", label: "GC", titulo: "Goles en contra", ancho: "w-9", desc: false, opcional: true },
  { clave: "dif", label: "DG", titulo: "Diferencia de gol", ancho: "w-9", desc: true },
  { clave: "pts", label: "PTS", titulo: "Puntos", ancho: "w-10", desc: true },
  {
    // La única columna de stats avanzadas que entra en la tabla sin saturarla.
    // Se eligió xGdif y no xG a secas porque resume ataque y defensa en un
    // número, igual que la DG de al lado — y la comparación entre las dos es
    // justamente la lectura interesante: quién merece más de lo que le sale.
    clave: "xg_dif",
    label: "xGdif",
    titulo: "Goles esperados a favor menos en contra, en toda la temporada",
    ancho: "w-14",
    desc: true,
    opcional: true,
  },
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

  // Cambia con cada reordenamiento y se usa como `key` del bloque de filas:
  // React remonta las filas y la animación de entrada vuelve a correr. Es lo
  // que hace visible que la tabla se acaba de reordenar en vez de saltar.
  const firma = `${zona}-${orden}-${asc}`;

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
    <div className="max-w-[1000px]">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5">
        <div className="flex gap-1.5" role="group" aria-label="Filtrar por zona">
          {[...zonas, "todas"].map((z) => (
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
        {/* La instrucción explícita queda igual, pero ahora es refuerzo y no la
            única pista: los encabezados se anuncian solos. */}
        <p className="num text-[9.5px] text-[#6d7280]">
          Tocá un encabezado <span aria-hidden>▲▼</span> para ordenar
        </p>
      </div>

      {/* Red de seguridad para pantallas muy angostas: la grilla tiene un ancho
          mínimo y, si no entra, el bloque scrollea en horizontal. Sin esto la
          columna del nombre —la única flexible— se comprime hasta desaparecer y
          quedan filas de números sin equipo, que es peor que scrollear. */}
      <div className="overflow-x-auto">
      <div role="table" aria-label="Posiciones y probabilidades por equipo" className="min-w-[458px]">
        {/* Cabecera */}
        <div
          role="row"
          className="flex items-center gap-1.5 border-t-2 border-b border-[#1a1c1f] border-b-[#d3d6d1] py-1"
        >
          <BotonOrden
            label="#"
            titulo="Puesto en la zona"
            estado={estado("puesto")}
            ancho="w-8"
            onClick={() => ordenar("puesto", false)}
          />
          <span role="columnheader" className="etiqueta min-w-0 flex-1 text-left">
            Equipo
          </span>
          {COLUMNAS.map((c) => (
            <BotonOrden
              key={c.clave}
              label={c.label}
              titulo={c.titulo}
              estado={estado(c.clave)}
              ancho={c.ancho}
              onClick={() => ordenar(c.clave, c.desc)}
              className={c.opcional ? "hidden sm:flex" : ""}
              respetarMayusculas={c.clave === "xg_dif"}
            />
          ))}
          <span
            role="columnheader"
            title="Los últimos seis partidos, del más viejo al más nuevo"
            className="etiqueta hidden w-11 shrink-0 text-right md:block"
          >
            Forma
          </span>
          <BotonOrden
            label="Baja"
            titulo="Probabilidad de descender: último de la tabla de promedios o de la anual"
            estado={estado("descenso")}
            ancho="w-11"
            onClick={() => ordenar("descenso", true)}
          />
          <BotonOrden
            label="Playoff"
            titulo="Probabilidad de clasificar a playoffs"
            estado={estado("playoffs")}
            ancho="w-[56px]"
            onClick={() => ordenar("playoffs", true)}
          />
          <BotonOrden
            label="Campeón"
            titulo="Probabilidad de salir campeón"
            estado={estado("campeon")}
            ancho="w-[58px]"
            onClick={() => ordenar("campeon", true)}
          />
        </div>

        {/* Filas */}
        <div key={firma}>
          {visibles.map((f, i) => {
            const dentro = f.puesto <= clasifican;
            const corte =
              cortePosible && f.puesto === clasifican && i + 1 < visibles.length;
            return (
              <Link
                key={f.slug}
                href={`/equipo/${f.slug}`}
                role="row"
                // El escalonado se corta a los 14 elementos: con 30 filas a
                // 14ms cada una, la última entraría casi medio segundo tarde y
                // eso ya no es feedback, es esperar.
                style={{ animationDelay: `${Math.min(i, 14) * 14}ms` }}
                className={`fila fila-anim flex items-center gap-1.5 py-2 ${
                  corte ? "border-b-2 border-[#2f8f4e]" : "border-b border-[#e2e4e0]"
                }`}
              >
                <span
                  role="cell"
                  className={`num w-8 shrink-0 text-right text-[11px] ${
                    dentro ? "text-[#1a1c1f]" : "text-[#6d7280]"
                  }`}
                >
                  {f.puesto}
                </span>
                <span role="cell" className="flex min-w-0 flex-1 items-center gap-2">
                  <Escudo slug={f.slug} colores={f.colores} size={16} />
                  {/* Subrayado punteado permanente: sin él, el nombre parece
                      texto y nadie descubre que hay una ficha atrás. */}
                  <span className="enlace-ficha truncate text-[13px]">{f.equipo}</span>
                  {zona === "todas" && (
                    <span className="num shrink-0 text-[9px] text-[#8d9299]">
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
                        ? "font-semibold text-[#1a1c1f]"
                        : c.clave === "xg_dif"
                          ? f.xg_dif >= 0
                            ? "text-[#2f8f4e]"
                            : "text-[#c8102e]"
                          : "text-[#4c5058]"
                    } ${c.opcional ? "hidden sm:block" : ""}`}
                  >
                    {c.clave === "xg_dif" ? (
                      // Sin stats no se inventa un cero: se dice que no hay.
                      !f.tieneStats ? (
                        <span className="text-[#8d9299]">—</span>
                      ) : (
                        `${f.xg_dif > 0 ? "+" : f.xg_dif < 0 ? "−" : "±"}${Math.abs(f.xg_dif).toFixed(1)}`
                      )
                    ) : (
                      <>
                        {c.clave === "dif" && f.dif > 0 ? "+" : ""}
                        {f[c.clave]}
                      </>
                    )}
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
                  className={`num w-11 shrink-0 text-right text-[12px] ${
                    f.descenso >= 10 ? "text-[#c8102e]" : "text-[#4c5058]"
                  }`}
                >
                  {f.descenso >= 0.05 ? f.descenso.toFixed(1) : "—"}
                </span>
                <span role="cell" className="w-[56px] shrink-0 text-right">
                  <span className="num block text-[12px] text-[#1a1c1f]">
                    {f.playoffs.toFixed(1)}
                  </span>
                  <span className="ml-auto block w-fit">
                    <BarraSimple
                      valor={f.playoffs}
                      maximo={maxPlayoffs}
                      color="#2f8f4e"
                      ancho={44}
                    />
                  </span>
                </span>
                <span role="cell" className="w-[58px] shrink-0 text-right">
                  <span className="num block text-[12px] font-semibold text-[#1a1c1f]">
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
      </div>
    </div>
  );
}
