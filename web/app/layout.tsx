import type { Metadata } from "next";
import Link from "next/link";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { torneo, temporada, actualizadoTexto } from "@/lib/datos";

/*
  Las tres familias del rediseño "Ribera".

  Se cargan con next/font, que las descarga en tiempo de build y las
  autohospeda: no hay request a Google en runtime, no hay salto de fuente y no
  hay dependencia de un tercero para que el sitio se vea bien.

  Los pesos son exactamente los que usa el diseño, no un rango cómodo: Archivo
  en 800 y 900 (titulares y cifras), Plex Mono en 400/500/600 (todo lo que es
  dato) y Plex Sans en 400/500 (texto corrido, que es lo que menos hay).
  Cada peso extra son ~15 KB que alguien descarga sin usar.
*/
const display = Archivo({
  subsets: ["latin"],
  weight: ["800", "900"],
  variable: "--font-display",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Ribera — Boca en números",
  description:
    "Boca partido a partido: probabilidades de un modelo estadístico propio, cómo juega comparado con el resto de la liga, y las estadísticas de cada jugador del plantel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-AR"
      className={`${display.variable} ${mono.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-fondo text-tinta">
        <a
          href="#contenido"
          className="dato sr-only rounded-[4px] bg-acento px-3 py-2 text-[11px] font-semibold text-[oklch(0.18_0.03_262)] focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50"
        >
          Ir al contenido
        </a>

        {/*
          Cabecera: título tipo scoreboard y línea de edición. La línea de
          edición dice torneo, fecha de actualización y motor — es dato, no
          decoración.
        */}
        <header className="mx-auto w-full max-w-[1400px] px-5 pt-4 sm:px-10">
          {/* `flex-wrap`: en pantallas angostas la nav baja a su propio
              renglón en vez de comerse el logo. */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-b border-borde pb-2.5">
            {/*
              El sitio se llama RIBERA. Es el barrio de Boca, y por eso funciona
              como nombre: dice de qué se trata sin usar la marca del club, que
              no es nuestra. "Boca en números" describía el contenido; esto
              nombra al producto.
            */}
            <Link
              href="/"
              aria-label="Ribera — portada"
              className="block shrink-0 transition-opacity hover:opacity-70"
            >
              <span className="titular block !text-[26px] leading-none sm:!text-[32px]">
                Ribera<span className="text-acento">.</span>
              </span>
            </Link>
            <Nav />
          </div>

          <div className="dato flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-borde2 py-2 text-[10px] uppercase tracking-[0.2em] text-tinta4">
            <span className="text-acento">
              {torneo} {temporada}
            </span>
            <span aria-hidden>·</span>
            <span>Dixon-Coles + Monte Carlo</span>
            <span aria-hidden>·</span>
            <span>Act. {actualizadoTexto()}</span>
            <span aria-hidden>·</span>
            <span>No oficial</span>
          </div>
        </header>

        <main id="contenido" className="mx-auto w-full max-w-[1400px] flex-1 px-5 sm:px-10">
          {children}
        </main>

        <footer className="mx-auto mt-12 w-full max-w-[1400px] px-5 pb-8 sm:px-10">
          <div className="dato border-t border-borde pt-3 text-[10px] leading-relaxed text-tinta4">
            <p className="max-w-2xl">
              Probabilidades de un modelo propio. No es una herramienta de
              apuestas. Sin vínculo con los clubes ni con la AFA. Los nombres y
              escudos son marcas de sus respectivos clubes y se usan solo para
              identificarlos.
            </p>
            {/*
              ATRIBUCIÓN OBLIGATORIA, no un crédito de cortesía. La foto de
              portada es CC BY-SA 4.0 y esa licencia EXIGE nombrar al autor y
              enlazar la licencia. Es la condición por la que podemos usarla: si
              esto se borra, la foto pasa a estar usada sin permiso.
              Origen completo en `reference/fotos.csv`.
            */}
            <p className="mt-2 max-w-2xl">
              Foto de portada:{" "}
              <a
                href="https://commons.wikimedia.org/wiki/File:Vista_a%C3%A9rea_del_Estadio_Alberto_J._Armando_%22La_Bombonera%22_01.jpg"
                className="text-tinta3 underline hover:text-acento"
              >
                Vista aérea del Estadio Alberto J. Armando
              </a>{" "}
              por ProtoplasmaKid ·{" "}
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                className="text-tinta3 underline hover:text-acento"
              >
                CC BY-SA 4.0
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
