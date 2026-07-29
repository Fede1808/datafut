"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * El retrato de un jugador, con su reemplazo cuando no hay foto.
 *
 * POR QUÉ ES CLIENTE. `src/ingest_fotos.py` baja lo que el CDN tiene, y hoy
 * tiene los 33 del plantel — pero mañana sube un juvenil y su foto no existe.
 * Sin `onError` eso sería un ícono de imagen rota; con esto cae en la inicial
 * sobre el color del club, que es exactamente el mismo tratamiento que ya usan
 * los escudos como fallback. El estado es local y mínimo: un booleano.
 *
 * La inicial NO es un placeholder gris. Un hueco gris se lee como "falta algo";
 * una inicial sobre color se lee como una decisión. El layout no cambia de alto
 * en ninguno de los dos casos, así que la grilla no salta.
 */
export function Retrato({
  id,
  nombre,
  tamano = 88,
  radio = 9,
}: {
  id: number;
  nombre: string;
  tamano?: number;
  radio?: number;
}) {
  const [falló, setFalló] = useState(false);
  const inicial = nombre.trim().charAt(0).toUpperCase() || "?";

  if (falló) {
    return (
      <div
        aria-hidden
        className="flex shrink-0 items-center justify-center border border-borde bg-tarjeta2"
        style={{
          width: tamano,
          height: tamano,
          borderRadius: radio,
          fontFamily: "var(--font-display)",
          fontWeight: 900,
          fontSize: tamano * 0.42,
          letterSpacing: "-0.03em",
          color: "var(--color-acento)",
        }}
      >
        {inicial}
      </div>
    );
  }

  return (
    <Image
      src={`/jugadores/${id}.png`}
      alt={nombre}
      width={tamano}
      height={tamano}
      onError={() => setFalló(true)}
      className="shrink-0 border border-borde bg-tarjeta2 object-cover"
      style={{ borderRadius: radio, width: tamano, height: tamano }}
    />
  );
}
