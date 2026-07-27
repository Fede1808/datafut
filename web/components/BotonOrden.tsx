/**
 * Cabecera de columna ordenable.
 *
 * EL PROBLEMA QUE RESUELVE. Las dos tablas del sitio se ordenan haciendo clic
 * en el encabezado, y hasta acá nada lo decía: el encabezado era texto gris que
 * recién cambiaba de color al pasarle el mouse por encima. En una pantalla
 * táctil no hay "pasar por encima", así que directamente no existía la pista.
 *
 * La regla que se aplica: un control tiene que anunciarse ANTES de que lo
 * toquen. Por eso el par de flechitas está siempre en pantalla, apagado, y el
 * subrayado punteado acompaña. Cuando la columna es la que ordena, se prende la
 * flecha del sentido y el subrayado pasa a sólido y ámbar — dos señales, no
 * sólo el color, para que también se lea sin distinguir tonos.
 *
 * `aria-sort` sobre el propio botón es lo que lee el lector de pantalla; las
 * flechitas son la traducción visual de ese mismo estado.
 */
export type EstadoOrden = "ascending" | "descending" | "none";

export function BotonOrden({
  label,
  titulo,
  estado,
  ancho,
  onClick,
  className = "",
  respetarMayusculas = false,
}: {
  label: string;
  /** Qué mide la columna. Va al `title` y al `aria-label`. */
  titulo: string;
  estado: EstadoOrden;
  /** Clase de ancho de la columna, para que la grilla no baile. */
  ancho: string;
  onClick: () => void;
  className?: string;
  /**
   * Deja el label tal cual en vez de mandarlo a versalita. Sólo para "xGdif":
   * la métrica se llama así y "XGDIF" no la reconoce nadie.
   */
  respetarMayusculas?: boolean;
}) {
  const activa = estado !== "none";
  return (
    <button
      type="button"
      role="columnheader"
      aria-sort={estado}
      aria-label={`${titulo}. Ordenar.`}
      title={`${titulo} — tocá para ordenar`}
      onClick={onClick}
      // El `flex` va acá y no en `.th-orden`: ver el comentario del CSS. Las
      // columnas opcionales pasan `hidden sm:flex` por `className` y tienen que
      // poder ganarle.
      className={`th-orden ${ancho} shrink-0 items-center justify-end gap-[3px] ${
        className || "flex"
      }`}
    >
      <span className={respetarMayusculas ? "normal-case" : ""}>{label}</span>
      <span aria-hidden className="flex shrink-0 flex-col">
        <span
          className={`caret caret-arriba ${
            activa && estado === "ascending" ? "caret-prendido" : "caret-apagado"
          }`}
        />
        <span
          className={`caret caret-abajo ${
            activa && estado === "descending" ? "caret-prendido" : "caret-apagado"
          }`}
        />
      </span>
    </button>
  );
}
