/**
 * La barra de tres tramos: local, empate, visitante.
 *
 * Colores fijos, nunca los del club: River vs Independiente son los dos rojos
 * y la barra quedaría rojo-gris-rojo. Con tres colores estables se aprende una
 * vez y sirve para todo el sitio.
 */
export function BarraProb({
  local,
  empate,
  visita,
  alto = 5,
}: {
  local: number;
  empate: number;
  visita: number;
  alto?: number;
}) {
  return (
    <div
      className="flex overflow-hidden bg-tarjeta2"
      style={{ height: alto }}
      role="img"
      aria-label={`Local ${Math.round(local)}%, empate ${Math.round(
        empate,
      )}%, visitante ${Math.round(visita)}%`}
    >
      <div style={{ width: `${local}%`, background: "var(--color-local)" }} />
      <div style={{ width: `${empate}%`, background: "var(--color-tinta3)" }} />
      <div style={{ width: `${visita}%`, background: "var(--color-baja)" }} />
    </div>
  );
}

/**
 * Marca los partidos donde los tres resultados están muy cerca.
 * Cinco de doce partidos de una fecha típica entran acá: de reojo un 34/33/34
 * se lee igual que un 68/21/11.
 */
export function esParejo(p: { local: number; empate: number; visita: number }) {
  return (
    Math.max(p.local, p.empate, p.visita) -
      Math.min(p.local, p.empate, p.visita) <
    10
  );
}

/**
 * Barra de una sola magnitud, en SVG, escalada contra un máximo.
 *
 * Se usa en las columnas de probabilidad de las tablas: el número solo obliga
 * a comparar de memoria fila contra fila; con la barra abajo el orden de
 * magnitud se ve sin leer.
 */
export function BarraSimple({
  valor,
  maximo,
  color = "var(--color-tinta)",
  ancho = 46,
}: {
  valor: number;
  maximo: number;
  color?: string;
  ancho?: number;
}) {
  const p = maximo > 0 ? Math.max(0, Math.min(valor / maximo, 1)) : 0;
  return (
    <span
      aria-hidden
      className="mt-[3px] block h-[2px] bg-borde"
      style={{ width: ancho }}
    >
      <span
        className="block h-full"
        style={{ width: `${p * 100}%`, background: color }}
      />
    </span>
  );
}
