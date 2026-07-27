/**
 * Placa de la portada: los cinco candidatos al título.
 *
 * Es lo que se ve cuando alguien comparte el link del sitio. Muestra la
 * probabilidad de campeón, que es el dato exclusivo del proyecto: los goles
 * esperados de un partido los tiene cualquiera, esto no.
 */
import { ImageResponse } from "next/og";
import { candidatos, torneo, temporada } from "@/lib/datos";
import { COLOR, Insignia, Marco, TAMANO, pct } from "@/lib/placa";

export const size = TAMANO;
export const contentType = "image/png";
export const alt = `Candidatos al título del ${torneo} ${temporada}`;

export default async function Image() {
  // Ya vienen ordenados por probabilidad de campeón desde el pipeline.
  const top = candidatos.slice(0, 5);
  const masAlta = top[0]?.campeon ?? 1;

  return new ImageResponse(
    (
      <Marco pie={`${torneo} ${temporada}`}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 17, color: COLOR.texto2, marginBottom: 22 }}>
            PROBABILIDAD DE SALIR CAMPEÓN
          </div>

          {top.map((e) => (
            <div
              key={e.slug}
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              {/*
                46px es el punto justo: entra cinco veces sin apretar el alto
                de la placa y todavia se distingue de que club es cuando la
                miniatura de WhatsApp achica todo a un tercio.
              */}
              <Insignia slug={e.slug} colores={e.colores} tamano={46} />

              <div
                style={{
                  fontSize: 30,
                  color: COLOR.texto,
                  marginLeft: 20,
                  width: 350,
                }}
              >
                {e.equipo}
              </div>

              {/*
                Barra proporcional al puntero. No arranca en cero absoluto sino
                relativa al mas alto, porque con todos por debajo del 20% las
                barras quedarian invisibles y no se compararia nada.
              */}
              <div
                style={{
                  display: "flex",
                  width: 500,
                  height: 16,
                  backgroundColor: COLOR.card,
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: Math.round((e.campeon / masAlta) * 500),
                    height: 16,
                    backgroundColor: COLOR.acento,
                  }}
                />
              </div>

              <div
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: COLOR.acento,
                  marginLeft: 22,
                  width: 110,
                  textAlign: "right",
                }}
              >
                {pct(e.campeon)}
              </div>
            </div>
          ))}
        </div>
      </Marco>
    ),
    { ...size },
  );
}
