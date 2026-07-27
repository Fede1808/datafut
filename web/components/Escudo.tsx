"use client";

import { useState } from "react";

/**
 * El escudo de un club.
 *
 * Reemplaza al viejo `Chip` (cuadradito de dos colores). Los SVG salen de
 * `src/escudos.py`: son escudos propios generados a partir de los colores
 * oficiales, no los escudos reales de los clubes (son marca registrada, no
 * se pueden commitear). Un `<img>` simple alcanza — son archivos estáticos
 * en `public/`, no hace falta la optimización de `next/image` para esto.
 *
 * `width`/`height` fijos evitan el salto de layout mientras carga. Si el
 * archivo no existe (slug nuevo sin escudo generado todavía), el `onError`
 * cae al mismo cuadradito de colores que usaba `Chip`, así nunca se rompe.
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
  const [error, setError] = useState(false);

  if (error) {
    return (
      <span
        aria-hidden
        className="inline-block shrink-0 rounded-[2px] border border-[#3a3d45]"
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
      src={`/escudos/${slug}.svg`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className="inline-block shrink-0"
      style={{ width: size, height: size }}
      onError={() => setError(true)}
    />
  );
}
