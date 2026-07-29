import type { Metadata } from "next";
import { Calibracion } from "@/components/Calibracion";
import { Cifra } from "@/components/Cifra";
import {
  aciertoClub,
  aportaInformacion,
  auditoria,
  leGanaAlMercado,
} from "@/lib/modelo";

export const metadata: Metadata = {
  title: "El modelo — Ribera",
  description:
    "Dónde acierta y dónde falla el modelo: calibración sobre 2.505 partidos, comparación contra las cuotas del mercado y el partido en que más se equivocó.",
};

/**
 * ¿SE LE PUEDE CREER?
 *
 * Esta sección existía antes y mostraba log loss y Brier score. Eso no le dice
 * nada a nadie que no los haya programado. Ahora contesta la única pregunta que
 * importa: si se le puede creer al número que el sitio publica.
 *
 * Y la contesta empezando por donde el modelo PIERDE. Un sitio de pronósticos
 * que sólo publica sus aciertos no es un sitio de pronósticos, es publicidad.
 */

const unDecimal = (v: number) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const cuatro = (v: number) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const entero = (v: number) => v.toLocaleString("es-AR");

const NOMBRES: Record<string, string> = {
  mercado: "Las casas de apuestas",
  modelo: "Nuestro modelo",
  frecuencia: "Tirar la frecuencia histórica",
  azar: "Tirar una moneda de tres lados",
};

export default function Modelo() {
  const peor = auditoria.club_peor;
  const orden = (["mercado", "modelo", "frecuencia", "azar"] as const).map((k) => ({
    clave: k,
    ...auditoria.metricas[k],
  }));
  const mejor = Math.min(...orden.map((o) => o.log_loss));
  const pierdePor = Math.abs(auditoria.contra_mercado);

  return (
    <div className="py-6">
      <p className="etiqueta mb-2">El modelo</p>
      <h1 className="titular mb-3">¿Se le puede creer?</h1>
      <p className="mb-6 max-w-[62ch] text-tinta2">
        {entero(auditoria.conjunto_comun)} partidos entre {auditoria.fechas.desde} y{" "}
        {auditoria.fechas.hasta}. En cada uno el modelo se entrenó de cero con lo
        que se sabía hasta el día anterior: nunca vio el partido que tenía que
        predecir.
      </p>

      {/*
        Se abre con la derrota, no con el logro. Es deliberado: es el dato que
        cualquiera usaría para desconfiar del sitio, y decirlo primero es la
        única forma de que el resto se lea como información y no como venta.
      */}
      <div className="grid gap-3.5 sm:grid-cols-2">
        <div className="tarjeta p-4">
          <p className="etiqueta mb-2">Contra las casas de apuestas</p>
          <div className="cifra text-[42px] text-baja">
            {leGanaAlMercado ? "Les gana" : "Pierde"}
          </div>
          <p className="mt-2 text-[13px] text-tinta2">
            Por {cuatro(pierdePor)} de log loss. El mercado predice mejor que
            nosotros, y no está cerca de ser un empate técnico.
          </p>
        </div>

        <div className="tarjeta p-4">
          <p className="etiqueta mb-2">Contra no saber nada</p>
          <div className="cifra text-[42px] text-sube">
            {aportaInformacion ? "Gana" : "Empata"}
          </div>
          <p className="mt-2 text-[13px] text-tinta2">
            Por {cuatro(Math.abs(auditoria.contra_frecuencia))}. Le gana a tirar la
            frecuencia histórica, que es lo que prueba que el modelo aporta
            información real y no está adivinando.
          </p>
        </div>
      </div>

      <h2 className="titular-2 mb-3 mt-8">Quién predice mejor</h2>
      <div className="tarjeta p-4">
        {orden.map((o) => (
          <div
            key={o.clave}
            className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-b border-borde2 py-2.5 last:border-b-0 sm:grid-cols-[220px_1fr_82px]"
          >
            <span
              className={`text-[13px] ${
                o.clave === "modelo" ? "font-semibold text-acento" : "text-tinta2"
              }`}
            >
              {NOMBRES[o.clave]}
            </span>
            <span className="relative col-span-2 h-2.5 rounded-[2px] bg-fondo2 sm:col-span-1">
              {/*
                La barra arranca en el mejor log loss de la tabla, no en cero.
                Con eje desde cero las cuatro barras serían indistinguibles: la
                diferencia entre predecir bien y tirar una moneda son cuatro
                centésimas sobre ~1,05. Lo que se compara acá es la brecha.
              */}
              <span
                className={`absolute inset-y-0 left-0 rounded-[2px] ${
                  o.clave === "modelo" ? "bg-acento" : "bg-tinta4"
                }`}
                style={{
                  width: `${Math.max(4, ((o.log_loss - mejor) / 0.05) * 100)}%`,
                }}
              />
            </span>
            <span className="dato text-right text-[12px] text-tinta2">
              {cuatro(o.log_loss)}
            </span>
          </div>
        ))}
        <p className="mt-3 text-[12px] text-tinta4">
          Log loss: cuánta probabilidad le puso a lo que realmente pasó. Más bajo
          es mejor. Las barras miden la distancia contra el mejor de la tabla.
        </p>
      </div>

      <h2 className="titular-2 mb-1.5 mt-8">Cuando dice 60%, ¿pasa el 60%?</h2>
      <p className="mb-3 max-w-[62ch] text-[13px] text-tinta2">
        Se juntan las tres probabilidades de cada partido y se agrupan por rango.
        Si las dos barras miden parecido, el modelo está bien calibrado: lo que
        dice es lo que pasa.
      </p>
      <Calibracion rangos={auditoria.calibracion} />

      <h2 className="titular-2 mb-3 mt-8">Con {auditoria.club}</h2>
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        <Cifra
          rotulo="Partidos evaluados"
          valor={entero(auditoria.club_partidos)}
          pie={`Desde ${auditoria.fechas.desde}`}
        />
        <Cifra
          rotulo="Le puso favorito y acertó"
          valor={`${unDecimal(aciertoClub)}%`}
          pie={`${auditoria.club_aciertos} de ${auditoria.club_partidos}`}
        />
        {peor && (
          <div className="tarjeta p-4">
            <p className="etiqueta mb-2">Donde más se equivocó</p>
            <div className="cifra text-[34px] text-baja">{peor.le_puso}%</div>
            <p className="mt-2 text-[13px] text-tinta2">
              {peor.local} vs {peor.visita}, {peor.fecha}. Eso es toda la
              probabilidad que le había puesto a lo que terminó pasando.
            </p>
            <p className="dato mt-2 text-[11px] text-tinta4">
              El mercado le puso {peor.mercado_le_puso}%
            </p>
          </div>
        )}
      </div>

      <h2 className="titular-2 mb-3 mt-8">Temporada por temporada</h2>
      <div className="tarjeta overflow-x-auto p-2">
        <table className="dato w-full min-w-[420px] border-collapse text-[13px]">
          <thead>
            <tr className="etiqueta">
              <th className="px-2 py-2 text-left">Temporada</th>
              <th className="px-2 py-2 text-right">Partidos</th>
              <th className="px-2 py-2 text-right">Modelo</th>
              <th className="px-2 py-2 text-right">Mercado</th>
            </tr>
          </thead>
          <tbody>
            {auditoria.por_temporada.map((t) => (
              <tr key={t.temporada} className="border-t border-borde2">
                <td className="px-2 py-2 text-tinta">{t.temporada}</td>
                <td className="px-2 py-2 text-right text-tinta3">{t.n}</td>
                <td
                  className={`px-2 py-2 text-right ${
                    t.modelo <= t.mercado ? "text-sube" : "text-tinta2"
                  }`}
                >
                  {cuatro(t.modelo)}
                </td>
                <td className="px-2 py-2 text-right text-tinta3">
                  {cuatro(t.mercado)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
