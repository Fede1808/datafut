import type { Metadata } from "next";
import Link from "next/link";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { torneo, temporada, actualizadoTexto } from "@/lib/datos";

const sans = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});
const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Probabilidades — Liga Profesional",
  description:
    "Probabilidades propias sobre la Liga Profesional argentina, calculadas con un modelo estadístico que se reentrena después de cada fecha.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-AR"
      className={`${display.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[#eceeeb] text-[#1a1c1f]">
        <a
          href="#contenido"
          className="num sr-only rounded-[2px] bg-[#1a1c1f] px-3 py-2 text-[11px] font-semibold text-white focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50"
        >
          Ir al contenido
        </a>

        {/*
          Cabecera: título tipo scoreboard y línea de edición. La línea de
          edición dice torneo, fecha de actualización y motor — es dato, no
          decoración.
        */}
        <header className="mx-auto w-full max-w-6xl px-4 pt-4">
          {/* `flex-wrap`: en pantallas angostas la nav baja a su propio
              renglón en vez de comerse el logo. */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-b border-[#d3d6d1] pb-2.5">
            <Link
              href="/"
              aria-label="Modelo/Fut — portada"
              className="block shrink-0 transition-opacity hover:opacity-70"
            >
              <span className="titular block !text-[26px] leading-none sm:!text-[32px]">
                Modelo<span className="text-[#c8102e]">/</span>Fut
              </span>
            </Link>
            <Nav />
          </div>

          <div className="num flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b-2 border-[#1a1c1f] py-1.5 text-[9.5px] uppercase tracking-[0.08em] text-[#6d7280]">
            <span className="text-[#8d9299]">
              {torneo} {temporada}
            </span>
            <span aria-hidden>·</span>
            <span>Dixon-Coles + Monte Carlo</span>
            <span aria-hidden>·</span>
            <span>Act. {actualizadoTexto()}</span>
            <span aria-hidden>·</span>
            <span>Proyecto no oficial</span>
          </div>
        </header>

        <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-4">
          {children}
        </main>

        <footer className="mx-auto mt-12 w-full max-w-6xl px-4 pb-8">
          <div className="border-t border-[#d3d6d1] pt-3 num text-[10px] leading-relaxed text-[#6d7280]">
            {/*
              El aviso nombra los escudos desde que se empezaron a usar: decir
              solo "nombres de clubes" cuando en pantalla hay 30 escudos deja
              corto justo lo que mas se ve.
            */}
            <p className="max-w-2xl">
              Probabilidades de un modelo propio. No es una herramienta de
              apuestas. Sin vínculo con los clubes ni con la AFA. Los nombres y
              escudos son marcas de sus respectivos clubes y se usan solo para
              identificarlos.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
