import { notFound } from "next/navigation";
import { FichaEquipo } from "@/components/FichaEquipo";
import { fichas, equipoPorSlug } from "@/lib/datos";

/** Pre-genera una página por equipo en tiempo de build: no hay servidor. */
export function generateStaticParams() {
  return fichas.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const e = equipoPorSlug(slug);
  return { title: e ? `${e.equipo} — probabilidades` : "Equipo" };
}

/**
 * Página de equipo (dirección 2b: "cancha").
 *
 * El armado en sí — cabecera teñida del color del club, tarjetas y pestañas —
 * vive en `FichaEquipo`, que es cliente porque las pestañas necesitan estado.
 * Acá sólo se valida que el slug exista; si no, 404 server-side, como antes.
 */
export default async function PaginaEquipo({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const e = equipoPorSlug(slug);
  if (!e) notFound();

  return <FichaEquipo slug={slug} />;
}
