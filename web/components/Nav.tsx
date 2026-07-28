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
 * POR QUÉ SE REHIZO. Antes eran tres palabras de 11px al lado del logo, con la
 * activa subrayada en ámbar y las otras dos en gris oscuro. El dueño reportó
 * que costaba encontrarlas — y tenía razón: parecían la bajada del título, no
 * controles. Ahora cada sección es una caja con filete, del alto mínimo de
 * toque (44px), con la activa invertida en ámbar y un punto adelante. La caja
 * dice "esto se toca" antes de que nadie lo toque, que es lo único que le
 * pedimos a una nav.
 *
 * Se reusa el lenguaje de los filtros de zona de la tabla a propósito: si todo
 * lo clickeable del sitio se ve igual, se aprende una vez.
 *
 * LA PORTADA DEJÓ DE LLAMARSE "FECHA". Tenía sentido cuando era la única
 * pantalla que mostraba partidos, pero ahora existe `/calendario` con las 16
 * fechas del torneo y dos secciones casi homónimas ("Fecha" y "Fechas")
 * confunden más de lo que ordenan. La portada pasa a "Hoy" —sigue siendo la
 * puerta de entrada y su primer bloque sigue siendo la fecha que se juega
 * ahora— y el href no se toca: nada la deja de encontrar.
 */
const SECCIONES = [
  { href: "/", label: "Hoy", ayuda: "Los partidos que vienen" },
  {
    href: "/calendario",
    label: "Fechas",
    ayuda: "Las 16 fechas del torneo, partido por partido",
  },
  { href: "/tabla", label: "Tabla", ayuda: "Posiciones y probabilidades" },
  { href: "/titulo", label: "Título", ayuda: "Quién puede salir campeón" },
  {
    href: "/estadisticas",
    label: "Stats",
    ayuda: "Los mejores en cada métrica",
  },
];

export function Nav() {
  const ruta = usePathname();

  return (
    // En el celular la nav se va a su propio renglón y las cinco cajas se
    // reparten el ancho: cinco blancos grandes son más fáciles de acertar con
    // el dedo que cinco palabras apretadas contra el logo.
    //
    // La última dice "Stats" y no "Estadísticas" por una razón de ancho: con
    // la palabra entera, cinco cajas en versalita no entran en un celular de
    // 360px y la nav se parte en dos renglones. Por lo mismo "Fechas" y no
    // "Calendario": la etiqueta larga es la que rompía el layout al agregar
    // esta sección, no el ancho de la caja en sí — ver `.pestania` en
    // globals.css, que ahora fija `white-space: nowrap` para que una etiqueta
    // que no entra se note recortando la caja, en vez de partirse en dos
    // líneas y romper el alto parejo de las cinco.
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
