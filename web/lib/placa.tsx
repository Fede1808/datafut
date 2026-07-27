/**
 * Layout compartido de las placas que se ven al compartir un link.
 *
 * Cuando alguien pega una URL del sitio en WhatsApp, Twitter o Telegram, esas
 * apps piden una imagen de vista previa. Next la genera con `ImageResponse`
 * a partir de estos componentes: se escribe como JSX pero termina siendo un
 * PNG, no HTML.
 *
 * DOS COSAS QUE CONVIENE SABER ANTES DE TOCAR ESTO:
 *
 * 1. Esto NO es un navegador. Lo dibuja Satori, que entiende un subconjunto
 *    de CSS. Nada de Tailwind, nada de grid, nada de position absolute con
 *    porcentajes raros. Y todo elemento con mas de un hijo necesita
 *    `display: flex` escrito a mano, o falla al generar.
 *
 * 2. La tipografia es la que trae el generador por defecto, no la del sitio
 *    (Space Grotesk / IBM Plex). Para usar esas habria que sumar los .ttf al
 *    repo y cargarlos aca. Se puede, pero suma peso y un paso mas; por ahora
 *    la jerarquia la dan el tamano y el color, que es lo que se lee de lejos.
 *
 * Los colores salen de los mismos tokens que globals.css. Si cambia la paleta
 * del sitio, hay que tocar los dos lados.
 */

export const TAMANO = { width: 1200, height: 630 };

export const COLOR = {
  fondo: "#15161a",
  card: "#1e2027",
  borde: "#2a2c33",
  texto: "#f2f1ec",
  texto2: "#7c8089",
  texto3: "#565962",
  aviso: "#c9cbd1",
  // Ambar: reservado para la probabilidad de campeon, igual que en el sitio.
  acento: "#ffcf5c",
};

/**
 * El marco de toda placa: marca arriba, contenido en el medio, aviso abajo.
 *
 * El aviso de "proyecto no oficial" va SIEMPRE, y no es un detalle legal para
 * cumplir de mala gana: la placa viaja sola por WhatsApp, separada del sitio,
 * asi que es el unico lugar donde ese aviso puede viajar con ella.
 */
export function Marco({
  children,
  pie,
}: {
  children: React.ReactNode;
  pie?: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: COLOR.fondo,
        padding: "44px 56px",
      }}
    >
      {/* Marca */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: COLOR.texto,
            letterSpacing: -0.5,
          }}
        >
          MODELO/FUT
        </div>
        <div style={{ fontSize: 14, color: COLOR.texto2, marginTop: 4 }}>
          DIXON-COLES · MONTE CARLO
        </div>
      </div>

      {/* Contenido */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "center",
        }}
      >
        {children}
      </div>

      {/* Aviso */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          borderTop: `1px solid ${COLOR.borde}`,
          paddingTop: 16,
        }}
      >
        <div style={{ fontSize: 15, color: COLOR.texto3 }}>
          Proyecto no oficial. Sin vínculo con los clubes ni con la AFA.
        </div>
        {pie ? (
          <div style={{ fontSize: 15, color: COLOR.texto3 }}>{pie}</div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Una barrita con los dos colores del club.
 *
 * Va al lado del nombre para que se reconozca al equipo de un vistazo, sin
 * usar escudos: el proyecto no usa logos ni imagenes de los clubes.
 */
export function Franja({
  colores,
  alto = 38,
}: {
  colores: [string, string];
  alto?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 10,
        height: alto,
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <div style={{ backgroundColor: colores[0], width: 10, height: alto / 2 }} />
      <div style={{ backgroundColor: colores[1], width: 10, height: alto / 2 }} />
    </div>
  );
}

/** Formatea 18.84 como "18.8%", igual que el sitio: un decimal, sin inventar precision. */
export function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}
