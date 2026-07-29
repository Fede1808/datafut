"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navegación con la sección activa marcada.
 *
 * Es cliente sólo por `usePathname`: sin eso no hay forma de saber en qué
 * sección estás, y una nav donde nada indica dónde estás parado es media nav.
 * El resto del sitio sigue siendo estático.
 *
 * POR QUÉ SON ESTAS CUATRO. Antes eran cinco secciones que reproducían el
 * orden en que se fueron construyendo las pantallas: Hoy, Fechas, Tabla,
 * Título, Stats. Eso es el diario de a bordo del que lo hizo, no una
 * navegación: a nadie le importa en qué orden se programó un sitio.
 *
 * Ahora cada sección responde una pregunta que un hincha se hace solo:
 *
 *   Hoy        -> ¿qué viene?
 *   Temporada  -> ¿cómo venimos?
 *   Juego      -> ¿cómo juega el equipo?
 *   Plantel    -> ¿quiénes juegan?
 *
 * Dos consecuencias de ese criterio, las dos a propósito. "Rivales" no es una
 * sección: nunca fue una categoría, era una comparación, y vive adentro de
 * Juego. Y el mapa de remates tampoco tiene sección propia, por el mismo
 * motivo — es la mejor evidencia de cómo juega el equipo, no un tema aparte.
 *
 * LAS PANTALLAS DE LIGA SIGUEN EXISTIENDO. `/liga`, `/tabla`, `/titulo`,
 * `/calendario`, `/estadisticas`, `/equipo/[slug]` y `/partido/[slug]` no se
 * borraron ni se rompieron: salieron de la navegación. El modelo igual calcula
 * los 30 equipos, así que esas páginas siguen teniendo con qué llenarse.
 */
const SECCIONES = [
  { href: "/", label: "Hoy", ayuda: "El próximo partido" },
  {
    href: "/temporada",
    label: "Temporada",
    ayuda: "Posición y probabilidades del año",
  },
  { href: "/juego", label: "Juego", ayuda: "Cómo juega el equipo" },
  { href: "/plantel", label: "Plantel", ayuda: "Los jugadores, uno por uno" },
];

export function Nav() {
  const ruta = usePathname();

  return (
    // En el celular la nav se va a su propio renglón y las cuatro cajas se
    // reparten el ancho: cuatro blancos grandes son más fáciles de acertar con
    // el dedo que cuatro palabras apretadas contra el logo.
    <nav aria-label="Secciones" className="w-full sm:w-auto">
      <ul className="flex gap-1.5">
        {SECCIONES.map((s) => {
          const activa = s.href === "/" ? ruta === "/" : ruta.startsWith(s.href);
          return (
            <li key={s.href} className="flex-1 sm:flex-none">
              <Link
                href={s.href}
                title={s.ayuda}
                aria-current={activa ? "page" : undefined}
                className="pestania w-full sm:w-auto"
              >
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
