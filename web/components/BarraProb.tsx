/**
 * La barra de tres tramos: local, empate, visitante.
 *
 * Usa SIEMPRE los mismos tres colores, nunca los del club. Y hay una razón
 * concreta: River vs Independiente son los dos rojos, así que una barra con
 * los colores de cada equipo quedaría rojo-gris-rojo, ilegible. Con colores
 * fijos, el usuario aprende una sola vez qué significa cada tramo.
 *
 * La identidad del club vive en el chip, que nunca compite por el mismo
 * espacio con otro chip.
 */
export function BarraProb({
  local,
  empate,
  visita,
  alto = 4,
}: {
  local: number;
  empate: number;
  visita: number;
  alto?: number;
}) {
  return (
    <div
      className="flex overflow-hidden rounded-[2px] bg-[#2a2c33]"
      style={{ height: alto }}
      role="img"
      aria-label={`Local ${local}%, empate ${empate}%, visitante ${visita}%`}
    >
      <div style={{ width: `${local}%`, background: "#5c7cfa" }} />
      <div style={{ width: `${empate}%`, background: "#565962" }} />
      <div style={{ width: `${visita}%`, background: "#ff5c7a" }} />
    </div>
  );
}

/**
 * Marca los partidos donde los tres resultados están muy cerca.
 *
 * No es un adorno: cinco de los doce partidos de una fecha típica son así, y
 * si no se avisa, un 34/33/34 se lee igual que un 68/21/11 de reojo. Decirlo
 * explícitamente es parte de ser honesto con la incertidumbre.
 */
export function esParejo(p: { local: number; empate: number; visita: number }) {
  return Math.max(p.local, p.empate, p.visita) - Math.min(p.local, p.empate, p.visita) < 10;
}
