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
 * POR QUÉ SON ESTAS CINCO. Cada sección responde una pregunta que un hincha se
 * hace solo, y ninguna reproduce el orden en que se fueron construyendo las
 * pantallas — eso sería el diario de a bordo del que lo hizo:
 *
 *   Hoy      -> ¿qué viene?
 *   Equipo   -> ¿cómo venimos?
 *   Plantel  -> ¿quiénes juegan?
 *   Stats    -> ¿cómo jugamos?
 *   Modelo   -> ¿se le puede creer a este sitio?
 *
 * Tres decisiones que vale la pena no revertir sin pensarlas:
 *
 * - "Rivales" no es una sección. Nunca fue una categoría, era una comparación,
 *   y vive adentro de Stats.
 * - El mapa de remates tampoco tiene sección propia: es la mejor evidencia de
 *   cómo juega el equipo, no un tema aparte.
 * - "Historia" se eliminó. Las estadísticas avanzadas arrancan en 2023 porque
 *   FotMob no tiene más atrás, y una sección entera para cuatro temporadas es
 *   un título grande sobre cuatro filas. Lo que sí valía — temporada a
 *   temporada — es un bloque dentro de Equipo.
 *
 * Y "Modelo" dejó de mostrar log loss y Brier, que no le dicen nada a nadie
 * salvo a quien los programó. Ahora contesta si se le puede creer: calibración,
 * comparación contra el mercado, y el partido en que más se equivocó.
 *
 * LAS PANTALLAS DE LIGA SIGUEN EXISTIENDO. `/liga`, `/tabla`, `/titulo`,
 * `/calendario`, `/estadisticas`, `/equipo/[slug]` y `/partido/[slug]` no se
 * borraron ni se rompieron: salieron de la navegación. El modelo igual calcula
 * los 30 equipos, así que esas páginas siguen teniendo con qué llenarse.
 */
const SECCIONES = [
  { href: "/", label: "Hoy", ayuda: "El próximo partido" },
  { href: "/equipo", label: "Equipo", ayuda: "Tabla, racha y la temporada" },
  { href: "/plantel", label: "Plantel", ayuda: "Los jugadores, uno por uno" },
  { href: "/stats", label: "Stats", ayuda: "Cómo juega, contra los otros 29" },
  { href: "/modelo", label: "Modelo", ayuda: "¿Se le puede creer? Dónde acierta y dónde falla" },
];

export function Nav() {
  const ruta = usePathname();

  return (
    // En el celular la nav se va a su propio renglón y las cinco cajas se
    // reparten el ancho: cinco blancos grandes son más fáciles de acertar con
    // el dedo que cinco palabras apretadas contra el logo.
    <nav aria-label="Secciones" className="w-full sm:w-auto">
      <ul className="flex gap-1 sm:gap-1.5">
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
