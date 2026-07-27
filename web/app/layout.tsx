import type { Metadata } from "next";
import Link from "next/link";
import { Space_Grotesk, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
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
        <header className="border-b border-[#2a2c33]">
          <div className="mx-auto flex max-w-5xl items-baseline justify-between px-4 py-3.5">
            <Link href="/" className="block">
              <div className="font-[family-name:var(--font-display)] text-[18px] font-bold tracking-tight">
                MODELO/FUT
              </div>
              <div className="mt-0.5 font-[family-name:var(--font-mono)] text-[9px] text-[#7c8089]">
                DIXON-COLES · MONTE CARLO
              </div>
            </Link>

            <nav className="flex gap-4 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.6px] text-[#7c8089]">
              <Link href="/tabla" className="hover:text-[#f2f1ec]">
                Tabla
              </Link>
              <Link href="/titulo" className="hover:text-[#f2f1ec]">
                Título
              </Link>
            </nav>
          </div>
        </header>

        {/*
          El aviso de proyecto no oficial va acá arriba y siempre visible, no
          escondido en el pie. Es una restricción del proyecto, no un detalle
          legal para cumplir de mala gana.
        */}
        <div className="bg-[#2a2c33] px-4 py-1.5 text-center font-[family-name:var(--font-mono)] text-[10px] leading-relaxed text-[#c9cbd1]">
          Proyecto no oficial. Sin vínculo con los clubes ni con la AFA.
        </div>

        <main className="mx-auto w-full max-w-5xl flex-1">{children}</main>

        <footer className="mx-auto mt-10 w-full max-w-5xl border-t border-[#2a2c33] px-4 py-6 font-[family-name:var(--font-mono)] text-[10px] leading-relaxed text-[#565962]">
          <p>
            Las probabilidades salen de un modelo estadístico propio y se
            equivocan seguido. No es una herramienta de apuestas y no está
            pensada para eso.
          </p>
          <p className="mt-2">
            Nombres de clubes usados con fines informativos. Sin escudos, logos
            ni imágenes de jugadores.
          </p>
        </footer>
      </body>
    </html>
  );
}
