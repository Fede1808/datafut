import type { Metadata } from "next";
import Link from "next/link";
import { Instrument_Serif, Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { torneo, temporada, actualizadoTexto } from "@/lib/datos";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-display",
});
const sans = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
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
      className={`${display.variable} ${mono.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#contenido"
          className="num sr-only rounded-[2px] bg-[#ffbe3d] px-3 py-2 text-[11px] font-semibold text-[#12110f] focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50"
        >
          Ir al contenido
        </a>

        {/*
          Cabecera de diario: título, línea de edición y filete doble. La línea
          de edición dice torneo, fecha de actualización y motor — es dato, no
          decoración.
        */}
        <header className="mx-auto w-full max-w-6xl px-4 pt-4">
          <div className="flex items-end justify-between gap-4 border-b border-[#2e2b27] pb-2">
            <Link href="/" className="block shrink-0">
              <span className="block font-[family-name:var(--font-display)] text-[27px] leading-none tracking-[-0.02em] sm:text-[34px]">
                Modelo<span className="text-[#ffbe3d]">/</span>Fut
              </span>
            </Link>
            <Nav />
          </div>

          <div className="num flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b-2 border-[#2e2b27] py-1.5 text-[9.5px] uppercase tracking-[0.08em] text-[#6d6862]">
            <span className="text-[#a09a90]">
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
          <div className="border-t border-[#2e2b27] pt-3 num text-[10px] leading-relaxed text-[#6d6862]">
            <p className="max-w-2xl">
              Probabilidades de un modelo propio. No es una herramienta de
              apuestas. Sin vínculo con los clubes ni con la AFA. Nombres de
              clubes con fines informativos.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
