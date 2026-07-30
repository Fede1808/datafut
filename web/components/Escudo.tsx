"use client";

import { useState } from "react";

/**
 * El escudo de un club.
 *
 * Hay tres niveles, del mejor al peor, y se baja de nivel solo cuando el
 * anterior falla en cargar:
 *
 *   1. `/escudos/reales/<slug>.png` — el escudo real del club, bajado de
 *      TheSportsDB por `src/escudos_reales.py`. Trazabilidad de cada archivo
 *      (fuente, URL y licencia) en `reference/escudos.csv`.
 *   2. `/escudos/<slug>.svg` — el escudo propio generado por `src/escudos.py`
 *      a partir de los colores oficiales. Es la red de seguridad para cuando
 *      ascienda un club que todavía no tiene el real bajado.
 *   3. El cuadradito de dos colores del viejo `Chip`, por si tampoco existe
 *      el generado. Así la fila nunca se rompe.
 *
 * Un `<img>` simple alcanza: son archivos estáticos en `public/`, no hace
 * falta la optimización de `next/image`. `width`/`height` fijos evitan el
 * salto de layout mientras carga.
 *
 * El fallback va con un contador (`nivel`) y no con un booleano porque ahora
 * hay dos saltos posibles, no uno.
 */
export function Escudo({
  slug,
  colores,
  size = 20,
}: {
  slug: string;
  colores: [string, string];
  size?: number;
}) {
  const [nivel, setNivel] = useState(0);
  const fuentes = [`/escudos/reales/${slug}.png`, `/escudos/${slug}.svg`];

  if (nivel >= fuentes.length) {
    return (
      <span
        aria-hidden
        className="inline-block shrink-0 rounded-[2px] border border-borde"
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, ${colores[0]} 50%, ${colores[1]} 50%)`,
        }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      // `key` fuerza a React a montar un <img> nuevo al cambiar de nivel. Sin
      // esto reusa el nodo y el navegador puede no disparar el onError otra vez.
      key={nivel}
      src={fuentes[nivel]}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className="inline-block shrink-0"
      style={{ width: size, height: size }}
      onError={() => setNivel((n) => n + 1)}
    />
  );
}
