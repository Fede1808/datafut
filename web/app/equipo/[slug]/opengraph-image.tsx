/**
 * Placa de la página de un equipo.
 *
 * Es la que más se va a compartir: el hincha manda el link de SU equipo al
 * grupo. Por eso el escudo del club va grande y a la izquierda —es lo primero
 * que el ojo reconoce en una miniatura— y el nombre y el número de campeón son
 * lo único que compite con él en tamaño.
 */
import { ImageResponse } from "next/og";
import { fichas, equipoPorSlug, torneo, temporada } from "@/lib/datos";
import { COLOR, Insignia, Marco, TAMANO, pct } from "@/lib/placa";

export const size = TAMANO;
export const contentType = "image/png";
export const alt = "Probabilidades del equipo";

/** Una imagen por equipo, generada en el build igual que las páginas. */
export function generateStaticParams() {
  return fichas.map((e) => ({ slug: e.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const e = equipoPorSlug(slug);

  // Si el slug no existe, la placa igual tiene que salir: una imagen rota se
  // ve peor que una generica. La pagina ya devuelve 404 por su cuenta.
  if (!e) {
    return new ImageResponse(
      (
        <Marco pie={`${torneo} ${temporada}`}>
          <div style={{ fontSize: 44, color: COLOR.texto }}>
            Probabilidades de la Liga Profesional
          </div>
        </Marco>
      ),
      { ...size },
    );
  }

  return new ImageResponse(
    (
      <Marco pie={`${torneo} ${temporada} · Zona ${e.zona}`}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {/*
            El escudo ocupa 200px: es el ancla visual de la placa. Si falta el
            PNG, `Insignia` cae sola a la franja de colores de siempre y la
            composicion se sostiene igual.
          */}
          <div style={{ display: "flex", marginRight: 40 }}>
            <Insignia slug={e.slug} colores={e.colores} tamano={200} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div
              style={{
                fontSize: 62,
                fontWeight: 700,
                color: COLOR.texto,
                letterSpacing: -1,
                lineHeight: 1.1,
              }}
            >
              {e.equipo}
            </div>

            {/*
              Los dos numeros se reparten el ancho en partes iguales (flex: 1)
              en vez de quedar pegados a la izquierda: si no, la mitad derecha
              de la placa queda vacia y la imagen se ve caida hacia un lado.
            */}
            <div style={{ display: "flex", width: "100%", marginTop: 34 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                }}
              >
                <div style={{ fontSize: 16, color: COLOR.texto2 }}>
                  SALE CAMPEÓN
                </div>
                <div
                  style={{
                    fontSize: 76,
                    fontWeight: 700,
                    color: COLOR.acento,
                    lineHeight: 1.1,
                  }}
                >
                  {pct(e.campeon)}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ fontSize: 16, color: COLOR.texto2 }}>
                  LLEGA A PLAYOFFS
                </div>
                <div
                  style={{
                    fontSize: 76,
                    fontWeight: 700,
                    color: COLOR.texto,
                    lineHeight: 1.1,
                  }}
                >
                  {pct(e.playoffs)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Marco>
    ),
    { ...size },
  );
}
