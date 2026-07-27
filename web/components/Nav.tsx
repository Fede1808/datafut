"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navegación con la sección activa marcada.
 *
 * Es cliente sólo por `usePathname`: sin eso no hay forma de saber en qué
 * sección estás, y una nav donde nada indica dónde estás parado es media nav.
 * El resto del sitio sigue siendo estático.
 */
const SECCIONES = [
  { href: "/", label: "Fecha" },
  { href: "/tabla", label: "Tabla" },
  { href: "/titulo", label: "Título" },
];

export function Nav() {
  const ruta = usePathname();

  return (
    <nav className="num flex gap-4 pb-1 text-[11px] uppercase tracking-[0.08em] sm:gap-6">
      {SECCIONES.map((s) => {
        const activa = s.href === "/" ? ruta === "/" : ruta.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={activa ? "page" : undefined}
            className={
              activa
                ? "border-b-2 border-[#ffbe3d] pb-1 text-[#f4f1ea]"
                : "border-b-2 border-transparent pb-1 text-[#6d6862] transition-colors hover:text-[#f4f1ea]"
            }
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
