import Image from "next/image";

/**
 * La portada del próximo partido: foto a sangre, los dos nombres grandes y la
 * probabilidad en cuerpo enorme.
 *
 * TRES DECISIONES QUE NO SON DECORATIVAS:
 *
 * 1. `-mx-5 sm:-mx-10` cancela el padding del contenedor para que la foto
 *    llegue al borde de la pantalla. El resto del sitio vive dentro del
 *    contenedor; esto es lo único que sangra, y por eso el margen negativo va
 *    acá y no en el layout: si el layout perdiera el padding, las siete
 *    pantallas de liga que quedaron sin link se romperían.
 *
 * 2. El gradiente NO es un velo uniforme. Va de opaco abajo a transparente
 *    arriba, porque todo el texto está abajo: un velo parejo apagaría la foto
 *    entera para proteger una franja. Además hay un segundo gradiente lateral,
 *    que es el que sostiene la legibilidad del bloque de la izquierda.
 *
 * 3. `priority` en la imagen. Es lo primero que se ve; sin esto Next la carga
 *    perezosa y el hero aparece vacío el primer segundo. Es la única imagen del
 *    sitio que lo lleva.
 */
export function Hero({
  etiqueta,
  local,
  visita,
  probabilidad,
  leyenda,
  contexto,
  barra,
}: {
  etiqueta: string;
  local: string;
  visita: string;
  probabilidad: number;
  leyenda: string;
  contexto: string[];
  barra: { valor: number; color: string; nombre: string }[];
}) {
  const unDecimal = (v: number) =>
    v.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <section className="relative -mx-5 h-[420px] overflow-hidden sm:-mx-10 sm:h-[520px]">
      <Image
        src="/portada.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, oklch(0.155 0.026 262) 4%, oklch(0.155 0.026 262 / 0.82) 34%, oklch(0.155 0.026 262 / 0.30) 76%, transparent 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, oklch(0.155 0.026 262 / 0.86) 0%, transparent 58%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col justify-end px-5 pb-8 pt-10 sm:px-10 sm:pb-10">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="min-w-0">
            <p className="etiqueta mb-2 !text-tinta2">{etiqueta}</p>
            <h1
              className="font-display text-[clamp(38px,8.4vw,82px)] font-black leading-[0.9] tracking-[-0.04em]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {local}
              <br />
              {visita}
            </h1>
            <div className="dato mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.14em] text-tinta2">
              {contexto.map((c, i) => (
                <span key={c} className="flex items-center gap-3">
                  {i > 0 && <span className="text-tinta4">|</span>}
                  {c}
                </span>
              ))}
            </div>
          </div>

          {/*
            `shrink-0` sólo a partir de `sm`. En escritorio protege al bloque
            de la probabilidad de que el nombre de los equipos lo apriete; en
            el celular los dos bloques ya van uno debajo del otro, y ahí
            `shrink-0` lo único que hacía era clavarle 358px de ancho a una
            columna de 350 —el ancho máximo de la tira de "BOCA JUNIORS 50,2 ·
            EMPATE 29,2 · ESTUDIANTES 20,6"— y sacar la foto de la pantalla.
          */}
          <div className="min-w-0 sm:shrink-0 sm:text-right">
            <div
              className="font-black leading-[0.82] tracking-[-0.04em] text-acento"
              style={{ fontFamily: "var(--font-display)" }}
            >
              <span className="text-[clamp(56px,14vw,132px)] [font-variant-numeric:tabular-nums]">
                {unDecimal(probabilidad)}
              </span>
              <span className="text-[clamp(22px,5vw,46px)]">%</span>
            </div>
            {/*
              `mt-3` y no `mt-1`. El número va con `leading-[0.82]`, así que su
              caja de línea es más baja que los glifos: a 132px las cifras
              sobresalen ~12px por debajo del renglón. Con 4px de separación la
              leyenda quedaba literalmente adentro del número (85% de solape
              medido). El interlineado apretado se mantiene —es lo que hace que
              el número pese— y lo que se corrige es la distancia de abajo.
            */}
            <p className="etiqueta mt-5 !text-tinta2">{leyenda}</p>

            {/*
              La barra usa gap real entre segmentos, no bordes: tres tramos
              pegados con colores parecidos se leen como uno solo, y el corte
              blanco de un borde metería una cuarta línea que no significa nada.
            */}
            <div className="mt-3.5 flex h-2 w-full max-w-[380px] gap-[3px] sm:ml-auto">
              {barra.map((b) => (
                <span
                  key={b.nombre}
                  className="rounded-[1px]"
                  style={{
                    width: `${b.valor}%`,
                    background: b.color,
                    transformOrigin: "left",
                    animation: "gx 620ms cubic-bezier(0.2, 0.7, 0.2, 1) both",
                  }}
                />
              ))}
            </div>
            <div className="dato mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-tinta3 sm:justify-end">
              {barra.map((b) => (
                <span key={b.nombre}>
                  {b.nombre} {unDecimal(b.valor)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
