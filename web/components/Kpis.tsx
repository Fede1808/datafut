/**
 * La banda de cifras con líneas divisorias.
 *
 * EL TRUCO, que viene del diseño y vale entenderlo: las líneas NO son bordes de
 * cada celda. El contenedor tiene el color del borde como fondo, y `gap: 1px`
 * deja ver ese fondo entre celda y celda. Con bordes por celda las líneas
 * internas se duplicarían (dos celdas vecinas aportan una cada una) y quedarían
 * de 2px, o habría que apagar la mitad con `:not(:last-child)`. Así son
 * siempre de 1px, sin excepciones.
 *
 * Cada celda escalona su entrada con `animation-delay`. Cuatro cifras que
 * aparecen de a una se leen; cuatro que aparecen juntas son un bloque.
 */
export function Kpis({
  items,
}: {
  items: { valor: string; etiqueta: string; acento?: boolean }[];
}) {
  return (
    <section
      className="grid gap-px sm:grid-cols-2 lg:grid-cols-4"
      style={{ background: "var(--color-borde)" }}
    >
      {items.map((k, i) => (
        <div
          key={k.etiqueta}
          className="bg-fondo2 px-6 py-6 sm:px-7"
          style={{
            animation: "fu 500ms ease both",
            animationDelay: `${i * 70}ms`,
          }}
        >
          <div
            className={`cifra text-[clamp(30px,5vw,42px)] ${
              k.acento ? "text-acento" : "text-tinta"
            }`}
          >
            {k.valor}
          </div>
          <div className="mt-2 text-[12.5px] text-tinta3">{k.etiqueta}</div>
        </div>
      ))}
    </section>
  );
}
