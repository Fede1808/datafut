/**
 * Una cifra con su rótulo y, si hace falta, una línea de contexto debajo.
 *
 * Existe como componente porque se repite doce veces entre las cuatro
 * pantallas, no por gusto de abstraer: tres usos habrían sido tres divs.
 */
export function Cifra({
  rotulo,
  valor,
  pie,
}: {
  rotulo: string;
  valor: string;
  pie?: string;
}) {
  return (
    <div className="tarjeta">
      <p
        className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.09em] text-tinta4"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {rotulo}
      </p>
      <div
        className="num text-[clamp(32px,6.4vw,46px)] font-bold leading-[0.9]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {valor}
      </div>
      {pie && <p className="mt-1 text-[12.5px] text-tinta4">{pie}</p>}
    </div>
  );
}
