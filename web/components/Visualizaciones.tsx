"use client";

import { useMemo, useState } from "react";
import { MapaCalor } from "./MapaCalor";
import { RadarMetricas } from "./RadarMetricas";
import {
  EQUIPOS_VIZ,
  MAX_RADAR,
  METRICAS_VIZ,
  ZONAS_VIZ,
  ZONA_POR_SLUG,
} from "@/lib/visualizaciones";
import type { EquipoStats } from "@/lib/estadisticas";

/**
 * El contenedor de las dos visualizaciones: sostiene los filtros, no dibuja.
 *
 * POR QUÉ LOS FILTROS VIVEN ACÁ Y NO ADENTRO DE CADA GRÁFICO. Son los mismos
 * treinta equipos en las dos vistas. Si cada componente tuviera su propio
 * filtro de zona, la página mostraría el mapa de calor de la zona A arriba y el
 * radar de la zona B abajo sin que nada lo advierta. Un solo filtro arriba
 * gobierna las dos: lo que ves es siempre el mismo recorte.
 *
 * LOS FILTROS NO TOCAN LOS PERCENTILES. Esconden filas y nada más. El percentil
 * y el puesto se calculan una sola vez sobre los 30 equipos (ver
 * `lib/visualizaciones.ts`): si dependieran de lo tildado, "mejor de la liga"
 * pasaría a significar "mejor de los que dejé prendidos" sin avisar.
 */

const TODAS = "todas";

export function Visualizaciones() {
  const [zona, setZona] = useState<string>(TODAS);
  const [elegidos, setElegidos] = useState<Set<string>>(
    () => new Set(EQUIPOS_VIZ.map((e) => e.slug)),
  );
  const [ordenPor, setOrdenPor] = useState<string>("xg_pp");
  // Los tres lugares del radar. El índice fija el color, así que sacar el del
  // medio deja un hueco en vez de correr a los otros dos.
  const [slots, setSlots] = useState<(EquipoStats | null)[]>([null, null, null]);

  const enZona = useMemo(
    () => EQUIPOS_VIZ.filter((e) => zona === TODAS || ZONA_POR_SLUG[e.slug] === zona),
    [zona],
  );
  const visibles = useMemo(
    () => enZona.filter((e) => elegidos.has(e.slug)),
    [enZona, elegidos],
  );

  function alternarEquipo(slug: string) {
    setElegidos((previos) => {
      const s = new Set(previos);
      if (s.has(slug)) s.delete(slug);
      else s.add(slug);
      return s;
    });
  }

  function alternarRadar(slug: string) {
    setSlots((previos) => {
      const i = previos.findIndex((e) => e?.slug === slug);
      if (i >= 0) {
        const copia = [...previos];
        copia[i] = null;
        return copia;
      }
      const libre = previos.indexOf(null);
      if (libre === -1) return previos;
      const equipo = EQUIPOS_VIZ.find((e) => e.slug === slug);
      if (!equipo) return previos;
      const copia = [...previos];
      copia[libre] = equipo;
      return copia;
    });
  }

  return (
    <div>
      {/* --- Filtros, comunes a las dos vistas. --- */}
      <div className="border-b border-[#d3d6d1] pb-3">
        <div className="etiqueta mb-2">Zona</div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por zona">
          <button
            type="button"
            onClick={() => setZona(TODAS)}
            aria-pressed={zona === TODAS}
            className="pestania pestania-chica"
          >
            Las dos
          </button>
          {ZONAS_VIZ.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZona(z)}
              aria-pressed={zona === z}
              className="pestania pestania-chica"
            >
              Zona {z}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="etiqueta">Equipos en el mapa</span>
          <button
            type="button"
            onClick={() => setElegidos(new Set(EQUIPOS_VIZ.map((e) => e.slug)))}
            className="pestania pestania-chica"
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setElegidos(new Set())}
            className="pestania pestania-chica"
          >
            Ninguno
          </button>
          <span className="num text-[9.5px] text-[#6d7280]">
            {visibles.length} de {enZona.length} a la vista
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Elegir equipos">
          {enZona.map((e) => (
            <button
              key={e.slug}
              type="button"
              onClick={() => alternarEquipo(e.slug)}
              aria-pressed={elegidos.has(e.slug)}
              className="pestania pestania-chica"
            >
              {e.equipo}
            </button>
          ))}
        </div>
      </div>

      {/* --- 1. El mapa de calor: todos contra todas las métricas. --- */}
      <section className="mt-6 border-t border-[#d3d6d1] pt-4">
        <h2 className="titular-2">Mapa de calor</h2>
        <p className="mt-1 max-w-[74ch] text-[13px] leading-relaxed text-[#4c5058]">
          Los {METRICAS_VIZ.length} rankings de una sola mirada. Sirve para ver si un
          equipo es parejo o si es bueno en una sola cosa.
        </p>
        <div className="mt-3">
          <MapaCalor filas={visibles} ordenPor={ordenPor} onOrdenar={setOrdenPor} />
        </div>
      </section>

      {/* --- 2. El radar: el perfil de hasta tres. --- */}
      <section className="mt-8 border-t border-[#d3d6d1] pt-4">
        <h2 className="titular-2">Perfil comparado</h2>
        <p className="mt-1 max-w-[74ch] text-[13px] leading-relaxed text-[#4c5058]">
          La forma de hasta {MAX_RADAR} equipos en ocho métricas. Sirve para ver la
          silueta —dónde es fuerte y dónde no—, no para medir diferencias finas:
          para eso está la tabla de al lado.
        </p>
        <div className="mt-3">
          <RadarMetricas slots={slots} elegibles={enZona} onAlternar={alternarRadar} />
        </div>
      </section>
    </div>
  );
}
