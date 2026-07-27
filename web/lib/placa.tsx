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
 * 3. Los escudos NO se pueden referenciar por ruta (`/escudos/reales/x.png`).
 *    Satori no corre en un navegador y, cuando la placa se genera en el build,
 *    no hay servidor HTTP al que pedirle esa ruta: no existe un origen todavia.
 *    Por eso el PNG se lee del disco y se embebe como data URI. Ver `Insignia`.
 *
 * Los colores salen de los mismos tokens que globals.css. Si cambia la paleta
 * del sitio, hay que tocar los dos lados.
 */

import fs from "node:fs";
import path from "node:path";

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
 * Ya no es lo que se muestra normalmente: desde que el proyecto usa escudos
 * reales, la franja es el plan B de `Insignia` para cuando falta el PNG de un
 * club (por ejemplo un recien ascendido que todavia no se bajo).
 */
export function Franja({
  colores,
  alto = 38,
  ancho = 10,
}: {
  colores: [string, string];
  alto?: number;
  ancho?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: ancho,
        height: alto,
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <div
        style={{ backgroundColor: colores[0], width: ancho, height: alto / 2 }}
      />
      <div
        style={{ backgroundColor: colores[1], width: ancho, height: alto / 2 }}
      />
    </div>
  );
}

/**
 * El PNG del escudo, ya listo para meter en un `src`.
 *
 * Se lee del disco y se convierte a base64 en vez de apuntar a la URL publica
 * porque estas placas se generan en el build, donde no hay servidor que sirva
 * `/escudos/...`. `process.cwd()` es la carpeta `web/` tanto en `next dev`
 * como en `next build`, asi que la ruta sirve en los dos casos.
 *
 * Devuelve `null` si el archivo no esta, y ese es el punto: una placa rota se
 * ve peor que una placa fea, porque es lo que aparece cuando alguien comparte
 * el link en WhatsApp.
 *
 * El `Map` evita releer 5 veces el mismo archivo en la placa de la portada.
 * Son 3 KB por escudo, pero el disco se toca una sola vez por slug.
 */
const escudosCache = new Map<string, string | null>();

function escudoDataUri(slug: string): string | null {
  const cacheado = escudosCache.get(slug);
  if (cacheado !== undefined) return cacheado;

  let uri: string | null = null;
  try {
    const png = fs.readFileSync(
      path.join(process.cwd(), "public", "escudos", "reales", `${slug}.png`),
    );
    uri = `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    // Falta el escudo de ese club. No es un error que valga la pena propagar:
    // abajo se cae a la franja de colores y la placa sale igual.
    uri = null;
  }

  escudosCache.set(slug, uri);
  return uri;
}

/**
 * El escudo del club dentro de una placa, con la franja de colores de reserva.
 *
 * Los escudos de TheSportsDB vienen con contorno claro, asi que se leen bien
 * sobre el fondo oscuro sin necesidad de ponerles una base atras.
 *
 * La franja de reserva copia el alto del escudo para que, cuando toque usarla,
 * la fila mida lo mismo y no se descoloque el resto de la composicion.
 */
export function Insignia({
  slug,
  colores,
  tamano,
}: {
  slug: string;
  colores: [string, string];
  tamano: number;
}) {
  const src = escudoDataUri(slug);

  if (!src) {
    return (
      <Franja
        colores={colores}
        alto={tamano}
        ancho={Math.max(10, Math.round(tamano / 13))}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={tamano}
      height={tamano}
      style={{ width: tamano, height: tamano }}
    />
  );
}

/** Formatea 18.84 como "18.8%", igual que el sitio: un decimal, sin inventar precision. */
export function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}
