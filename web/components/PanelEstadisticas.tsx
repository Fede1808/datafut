"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Escudo } from "./Escudo";
import {
  BLOQUES_STATS,
  CATEGORIAS,
  LEYENDA_DIRECCION,
  TORNEOS_STATS,
  UMBRAL_MUESTRA_CHICA,
  formatear,
  puedeSerNegativa,
  ranking,
  type Categoria,
  type EquipoStats,
  type FilaRanking,
  type Metrica,
  type TorneoStats,
} from "@/lib/estadisticas";

/**
 * Los mejores equipos de cada métrica, con revelación progresiva.
 *
 * EL PROBLEMA QUE RESUELVE. Hay 39 rankings. Mostrarlos todos de entrada no es
 * informar: es tapar. Y mostrar sólo tres tampoco sirve, porque el que quiere
 * mirar en serio se queda sin nada. La salida son tres niveles, y el usuario
 * decide en cuál se queda:
 *
 *   1. PANORAMA   las 2-3 métricas principales de cada categoría. Es lo que se
 *                 ve al entrar: trece podios, agrupados y titulados.
 *   2. CATEGORÍA  elegís una y aparecen TODAS sus métricas, no sólo las
 *                 principales. Acá es donde están los rechazos y los palos.
 *   3. RANKING    expandís una métrica y se abren los 30 equipos.
 *
 * Nada de esto es obligatorio: el que entra y se va después de mirar el podio
 * de xG ya se llevó algo completo.
 *
 * POR QUÉ ES CLIENTE. Sólo por el selector y por los expandibles. Los datos
 * siguen viniendo del JSON en tiempo de build y la página sale como HTML
 * estático, igual que el resto del sitio.
 *
 * AFFORDANCE. Los controles se anuncian antes de que los toquen: el selector
 * usa las mismas cajas `.pestania` que la nav y los filtros de zona (44px de
 * toque, estado activo invertido y no sólo coloreado), y los expandibles son
 * botones con caja y un carácter que dice para dónde abren. Nada depende del
 * hover, porque en una pantalla táctil el hover no existe.
 */

const TODAS = "todas";

export function PanelEstadisticas() {
  // Qué torneo se está mirando. Arranca en "temporada" porque es el
  // comportamiento de siempre: nadie que ya conocía la página debería ver
  // los números cambiados sin haber tocado nada.
  const [torneo, setTorneo] = useState<TorneoStats>("temporada");
  const [categoria, setCategoria] = useState<string>(TODAS);
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());

  const bloque = BLOQUES_STATS[torneo];
  const equipos = bloque.equipos;
  // Menos que el umbral = la muestra es tan chica que rankear es casi
  // sortear. Se avisa con el rango real (pj_min a pj_max) y no con un solo
  // número: dos equipos pueden llevar cantidades distintas de partidos
  // incluso dentro del mismo torneo (fixture reprogramado, por ejemplo).
  const muestraChica = torneo !== "temporada" && bloque.pj_max < UMBRAL_MUESTRA_CHICA;

  // Las barras crecen una vez, al montar. No hace falta observador de scroll:
  // el movimiento acá es confirmación de que la página cargó, no un premio por
  // llegar scrolleando. `prefers-reduced-motion` lo apaga desde el CSS.
  const [crecidas, setCrecidas] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setCrecidas(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // En el panorama va sólo lo principal de cada categoría; cuando se elige
  // una, va entera. Ésa es toda la lógica de la revelación progresiva.
  const secciones: { cat: Categoria; metricas: Metrica[] }[] = useMemo(() => {
    if (categoria === TODAS) {
      return CATEGORIAS.map((cat) => ({
        cat,
        metricas: cat.metricas.filter((m) => m.principal),
      }));
    }
    const cat = CATEGORIAS.find((c) => c.id === categoria);
    return cat ? [{ cat, metricas: cat.metricas }] : [];
  }, [categoria]);

  function alternar(clave: string) {
    setAbiertas((previas) => {
      const s = new Set(previas);
      if (s.has(clave)) s.delete(clave);
      else s.add(clave);
      return s;
    });
  }

  return (
    <div>
      {/* --- El selector de torneo. Mismo patrón que el filtro de zona de
          /tabla (mismas clases .pestania, mismo role="group"): si todo lo
          clickeable del sitio se ve igual, se aprende una vez. --- */}
      <div className="border-b border-borde pb-3">
        <div className="etiqueta mb-2">Torneo</div>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Filtrar por torneo"
        >
          {TORNEOS_STATS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTorneo(t.id)}
              aria-pressed={torneo === t.id}
              className="pestania pestania-chica"
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="num mt-2 text-[9.5px] leading-relaxed text-tinta3">
          {torneo === "temporada"
            ? `Apertura, playoffs y lo que va del Clausura juntos, entre ${bloque.pj_min} y ${bloque.pj_max} partidos por equipo.`
            : bloque.pj_min === bloque.pj_max
              ? `Sólo ${bloque.pj_max} ${bloque.pj_max === 1 ? "partido" : "partidos"} por equipo.`
              : `Entre ${bloque.pj_min} y ${bloque.pj_max} partidos por equipo.`}
        </p>

        {/* LA MUESTRA CHICA SE DICE CON PALABRAS, NO SÓLO CON UN NÚMERO. Un
            "PJ: 1" al lado de un ranking se puede leer de pasada y ya está;
            esto no se puede leer de pasada. El dueño lo pidió así de
            explícito: mostrar el filtro sin avisar sería mentir. */}
        {muestraChica && (
          <p className="mt-2 flex max-w-[74ch] items-start gap-2.5 rounded-[4px] border-l-[3px] border-baja bg-tarjeta2 px-3 py-2.5 text-[12px] leading-relaxed text-tinta2">
            <span aria-hidden className="cifra pt-px text-[15px] text-baja">
              !
            </span>
            <span>
              <strong className="font-semibold text-tinta">
                Esto es ruido, no una tendencia.
              </strong>{" "}
              {bloque.pj_max === 1
                ? "Una sola fecha jugada no alcanza para decir quién ataca mejor: un gol de córner o un blooper del arquero mueven el ranking entero."
                : `${bloque.pj_max} partidos siguen siendo pocos: cualquier racha corta —buena o mala— todavía pesa más de lo que debería.`}{" "}
              Lo mostramos porque el filtro está para eso, pero no saques
              conclusiones de esto todavía. Para algo confiable, mirá
              «Temporada completa».
            </span>
          </p>
        )}
      </div>

      {/* --- El selector de categoría --- */}
      <div className="mt-4 border-b border-borde pb-3">
        <div className="etiqueta mb-2">Elegí qué mirar</div>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Categoría de estadísticas"
        >
          <button
            type="button"
            onClick={() => setCategoria(TODAS)}
            aria-pressed={categoria === TODAS}
            title="Las métricas principales de las seis categorías"
            className="pestania pestania-chica"
          >
            Panorama
          </button>
          {CATEGORIAS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoria(c.id)}
              aria-pressed={categoria === c.id}
              title={c.bajada}
              className="pestania pestania-chica"
            >
              {c.nombre}
            </button>
          ))}
        </div>
        <p className="num mt-2 text-[9.5px] leading-relaxed text-tinta3">
          {categoria === TODAS
            ? "Estás viendo lo principal de cada categoría. Elegí una para abrir todas sus métricas."
            : "Todas las métricas de la categoría. Volvé a «Panorama» para ver el resumen de las seis."}
        </p>
      </div>

      {/* --- Los podios --- */}
      {secciones.map(({ cat, metricas }) => (
        <section key={cat.id} className="mt-7">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-tinta4 pb-1.5">
            <h2 className="titular-2">{cat.nombre}</h2>
            <p className="num text-[9.5px] uppercase tracking-[0.08em] text-tinta3">
              {cat.bajada}
            </p>
          </div>

          <div className="mt-1">
            {metricas.map((m) => (
              <BloqueMetrica
                key={m.clave}
                metrica={m}
                equipos={equipos}
                abierta={abiertas.has(m.clave)}
                onAlternar={() => alternar(m.clave)}
                crecidas={crecidas}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * El podio de una métrica, con la opción de abrirlo a los 30.
 *
 * La dirección va SIEMPRE en pantalla, al lado del título: sin eso, "primero
 * en goles en contra" se lee como un mérito y es exactamente lo contrario.
 */
function BloqueMetrica({
  metrica,
  equipos,
  abierta,
  onAlternar,
  crecidas,
}: {
  metrica: Metrica;
  equipos: EquipoStats[];
  abierta: boolean;
  onAlternar: () => void;
  crecidas: boolean;
}) {
  const filas = useMemo(() => ranking(metrica, equipos), [metrica, equipos]);
  const visibles = abierta ? filas : filas.slice(0, 3);
  const leyenda = LEYENDA_DIRECCION[metrica.direccion];
  const idLista = `ranking-${metrica.clave}`;

  // Escala de las barras. Con negativos (xGdif, goles − xG) el cero queda en el
  // medio y la barra sale para un lado o para el otro; con todos positivos, se
  // escala contra el máximo real y no contra un 100 que dejaría todo corto.
  const negativa = puedeSerNegativa(metrica);
  const valores = filas.map((f) => f.valor);
  const escala = negativa
    ? Math.max(...valores.map(Math.abs), 0.01)
    : Math.max(...valores, 0.01);

  // La marca del promedio de la liga.
  //
  // POR QUÉ HACE FALTA. La barra se escala contra el máximo, así que en las
  // métricas que se mueven en un rango angosto —los duelos van todos entre 45%
  // y 56%— las treinta barras salen casi iguales y no se distingue nada. Con
  // la marca del promedio encima, un 53.3% contra una liga de 50% se lee de un
  // vistazo sin tocar la escala ni exagerar la diferencia.
  //
  // Es el mismo recurso que ya usa `BarraLiga` en la ficha de equipo: un solo
  // lenguaje visual para la misma idea.
  const promedio = valores.reduce((a, v) => a + v, 0) / (valores.length || 1);

  if (filas.length === 0) {
    return (
      <div className="border-b border-borde2 py-3">
        <Titulo metrica={metrica} leyenda={leyenda} />
        <p className="num mt-1 text-[10px] text-tinta3">
          Sin datos para esta métrica.
        </p>
      </div>
    );
  }

  return (
    <div className="border-b border-borde2 py-3.5 last:border-b-0">
      <Titulo metrica={metrica} leyenda={leyenda} />

      {metrica.def && (
        <p className="mt-1 max-w-[74ch] text-[12px] leading-relaxed text-tinta2">
          {metrica.def}
        </p>
      )}

      <ol
        id={idLista}
        // `key` en el contenedor: al abrir o cerrar, React remonta las filas y
        // la animación de entrada vuelve a correr. Es lo que hace ver que la
        // lista cambió, en vez de que aparezcan veintisiete filas de golpe.
        key={abierta ? "abierta" : "podio"}
        className="mt-2 max-w-[620px]"
      >
        {visibles.map((f, i) => (
          <Fila
            key={f.slug}
            fila={f}
            metrica={metrica}
            escala={escala}
            promedio={promedio}
            negativa={negativa}
            crecidas={crecidas}
            indice={i}
          />
        ))}
      </ol>

      {filas.length > 3 && (
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={abierta}
          aria-controls={idLista}
          className="pestania pestania-chica mt-2"
        >
          {abierta
            ? "▴ Ver sólo el podio"
            : `▾ Ver los ${filas.length} equipos`}
        </button>
      )}
    </div>
  );
}

function Titulo({
  metrica,
  leyenda,
}: {
  metrica: Metrica;
  leyenda: { signo: string; texto: string };
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <h3 className="text-[15px] leading-snug font-semibold text-tinta">
        {metrica.label}
      </h3>
      {/* La dirección del ranking. Va con símbolo Y con palabras: el símbolo
          solo no alcanza y el color solo tampoco. */}
      <span
        className={`num text-[9px] uppercase tracking-[0.06em] ${
          metrica.direccion === "mas"
            ? "text-sube"
            : metrica.direccion === "menos"
              ? "text-baja"
              : "text-tinta3"
        }`}
      >
        <span aria-hidden>{leyenda.signo} </span>
        {leyenda.texto}
      </span>
      <span className="num text-[9px] uppercase tracking-[0.06em] text-tinta3">
        {metrica.total ? "total de la temporada" : "por partido"}
      </span>
    </div>
  );
}

function Fila({
  fila,
  metrica,
  escala,
  promedio,
  negativa,
  crecidas,
  indice,
}: {
  fila: FilaRanking;
  metrica: Metrica;
  escala: number;
  promedio: number;
  negativa: boolean;
  crecidas: boolean;
  indice: number;
}) {
  const p = Math.min(Math.abs(fila.valor) / escala, 1);
  const positivo = fila.valor >= 0;

  // Con negativos la barra sale del centro; sin negativos, del borde izquierdo.
  // El color de las de dirección "menos" y "depende" es apagado a propósito:
  // en esas la barra más larga NO es la mejor, y pintarla de ámbar mentiría.
  const color = negativa
    ? positivo
      ? "var(--color-sube)"
      : "var(--color-baja)"
    : metrica.direccion === "mas"
      ? "var(--color-tinta)"
      : metrica.direccion === "menos"
        ? "var(--color-tinta2)"
        : "var(--color-tinta3)";

  return (
    <li
      // El escalonado se corta a los 14: con 30 filas, la última entraría casi
      // medio segundo tarde y eso ya no es respuesta, es espera.
      style={{ animationDelay: `${Math.min(indice, 14) * 14}ms` }}
      className="fila-anim flex items-center gap-2 border-b border-borde2 py-1.5 last:border-b-0"
    >
      <span
        className={`num w-6 shrink-0 text-right text-[11px] ${
          fila.puesto === 1 ? "text-tinta" : "text-tinta3"
        }`}
      >
        {fila.puesto}
      </span>
      <Escudo slug={fila.slug} colores={fila.colores} size={15} />
      <Link
        href={`/equipo/${fila.slug}`}
        className="enlace-ficha min-w-0 flex-1 truncate text-[12.5px] text-tinta hover:text-tinta"
      >
        {fila.equipo}
      </Link>

      {/* La barra se achica en el celular pero NO se esconde: es lo que deja
          comparar de un vistazo sin tener que leer treinta números. Con 56px
          todavía entran el nombre completo y el valor. */}
      <span className="relative block h-[9px] w-[56px] shrink-0 bg-tarjeta2 sm:w-[120px]">
        {negativa ? (
          <>
            {/* Eje del cero. Sin esta línea no se sabe desde dónde sale la
                barra y un −2 se lee igual que un +2. */}
            <span
              aria-hidden
              className="absolute top-[-2px] bottom-[-2px] left-1/2 w-px bg-tinta4"
            />
            <span
              className="barra-crece absolute top-0 block h-full"
              data-visible={crecidas ? "true" : "false"}
              style={{
                width: `${(p * 100) / 2}%`,
                background: color,
                left: positivo ? "50%" : undefined,
                right: positivo ? undefined : "50%",
                transformOrigin: positivo ? "left center" : "right center",
              }}
            />
          </>
        ) : (
          <>
            <span
              className="barra-crece block h-full"
              data-visible={crecidas ? "true" : "false"}
              style={{ width: `${p * 100}%`, background: color }}
            />
            {/* Promedio de la liga. Siempre visible: es la referencia contra la
                que se lee la barra, no un adorno. */}
            <span
              aria-hidden
              className="absolute top-[-2px] bottom-[-2px] w-px bg-tinta opacity-60"
              style={{ left: `${Math.min((promedio / escala) * 100, 100)}%` }}
            />
          </>
        )}
      </span>

      <span className="num w-[62px] shrink-0 text-right text-[12px] text-tinta">
        {formatear(fila.valor, metrica)}
      </span>
    </li>
  );
}
