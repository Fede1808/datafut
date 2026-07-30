/**
 * Contraste de texto sobre el color de un club.
 *
 * El 2b tiñe la cabecera de la ficha con los colores reales del club: hay
 * equipos casi blancos (amarillo) y equipos casi negros (azul marino). Un
 * "siempre texto blanco" se rompe contra el primer club amarillo. Se calcula
 * la luminancia relativa (fórmula WCAG) y se elige blanco o tinta oscura
 * según cuál da más contraste.
 */
export function textoSobre(hex: string): "#ffffff" | "#1a1c1f" {
  const l = luminancia(hex);
  // Contraste de la tinta oscura (#1a1c1f, luminancia ~0.012) contra blanco
  // puro es más alto que el del blanco puro contra negro puro, así que el
  // punto de corte no va en 0.5: va donde el contraste de las dos opciones
  // se empata.
  return l > 0.42 ? "#1a1c1f" : "#ffffff";
}

/**
 * Contraste WCAG entre dos colores (1:1 a 21:1).
 * Se usa para decidir si el color de club en sí mismo (no el texto sobre él)
 * se puede usar como texto/acento sobre una tarjeta blanca. Clubes casi
 * blancos o muy claros (River, Gimnasia, Huracán, Vélez) fallan ese contraste
 * y hay que caer a la tinta oscura — si no, el número queda invisible.
 */
export function contraste(hexA: string, hexB: string): number {
  const la = luminancia(hexA);
  const lb = luminancia(hexB);
  const [claro, oscuro] = la > lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (oscuro + 0.05);
}

/**
 * `--color-tarjeta` en sRGB. Está acá como constante porque `contraste()`
 * trabaja con hex y no puede resolver una variable CSS: si el token cambia,
 * este valor hay que actualizarlo con él.
 */
const TARJETA = "#0c1421";

/**
 * El color del club para escribir SOBRE UNA TARJETA, o la tinta del sistema si
 * el color propio del club no llega a contrastar.
 *
 * Antes se llamaba `clubSobreBlanco` y medía contra `#ffffff`, que era la
 * tarjeta del tema claro. Con el tema oscuro esa cuenta quedó al revés y hacía
 * exactamente el daño que venía a evitar: los clubes de color claro —River,
 * Gimnasia, Huracán, Vélez, justo los que mejor se leen sobre una tarjeta
 * oscura— fallaban el test contra blanco y caían a una tinta casi negra. En la
 * ficha de River el "13,2%" de "sale campeón" quedaba negro sobre negro.
 */
export function clubSobreTarjeta(hex: string, minimo = 3): string {
  return contraste(hex, TARJETA) >= minimo ? hex : "var(--color-tinta)";
}

function luminancia(hex: string): number {
  const c = hex.replace("#", "");
  const r = parseInt(c.length === 3 ? c[0] + c[0] : c.slice(0, 2), 16) / 255;
  const g = parseInt(c.length === 3 ? c[1] + c[1] : c.slice(2, 4), 16) / 255;
  const b = parseInt(c.length === 3 ? c[2] + c[2] : c.slice(4, 6), 16) / 255;
  const canal = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}
