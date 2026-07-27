/**
 * El catálogo de métricas de la página de estadísticas.
 *
 * POR QUÉ ESTE ARCHIVO EXISTE APARTE DE `datos.ts`. `estadisticas.json` pesa
 * 77 KB y lo usa UNA sola página. `datos.ts` lo importa todo el sitio: si el
 * JSON entrara ahí, la portada y las 30 fichas cargarían 40 métricas que no
 * muestran. Por eso vive acá y lo importa sólo `/estadisticas`.
 *
 * LO QUE ORDENA EL DISEÑO DE ESTA PÁGINA: revelación progresiva. Son 39
 * rankings; volcarlos todos de entrada no es informar, es tapar. Hay tres
 * niveles y el usuario decide hasta dónde baja:
 *
 *   1. Panorama    las 2-3 métricas principales de cada categoría (13 en total)
 *   2. Categoría   todas las métricas de una categoría, cuando la elegís
 *   3. Ranking     los 30 equipos de una métrica, cuando la expandís
 *
 * LA DIRECCIÓN NUNCA QUEDA AMBIGUA. Cada métrica declara si más es mejor, si
 * menos es mejor, o si depende del contexto. Recibir muchos goles no es un
 * logro, y hacer 32 rechazos por partido tampoco: es defender muy cerca del
 * propio arco. Ese tercer estado ("depende") no es una salida cómoda; es la
 * respuesta correcta para posesión, córners, rechazos, atajadas y palos, y
 * forzarlas a buenas o malas sería mentir.
 *
 * NOMBRES: `pases_campo_rival` y `toques_en_area_rival` NO son "pases
 * progresivos". Esa métrica la definía Opta y desapareció con su feed en enero
 * de 2026. Acá se llaman por lo que son. Mismo criterio que `StatsAvanzadas`.
 */

import estadisticas from "@/data/estadisticas.json";

/**
 * Qué significa el orden del ranking.
 * - `mas`     el primero es el que más tiene, y eso es bueno
 * - `menos`   el primero es el que menos tiene, y eso es bueno
 * - `depende` se ordena de mayor a menor, pero el primero no "gana" nada
 */
export type Direccion = "mas" | "menos" | "depende";

export type Metrica = {
  /** La clave dentro de cada equipo de `estadisticas.json`. */
  clave: string;
  label: string;
  /**
   * Qué mide, en una línea. Sólo las que no se entienden solas: nadie necesita
   * que le expliquen "faltas", y todo el mundo necesita que le expliquen xGOT.
   */
  def?: string;
  decimales: number;
  sufijo?: string;
  direccion: Direccion;
  /** Se muestra en el panorama de entrada. */
  principal?: boolean;
  /**
   * Es un TOTAL de la temporada, no un promedio. Va marcado en pantalla porque
   * los equipos jugaron entre 17 y 21 partidos: comparar totales entre ellos
   * mide en parte quién jugó más, no quién lo hizo mejor.
   */
  total?: boolean;
};

export type Categoria = {
  id: string;
  nombre: string;
  /** Qué pregunta contesta la categoría. Va debajo del título. */
  bajada: string;
  metricas: Metrica[];
};

export const CATEGORIAS: Categoria[] = [
  {
    id: "ataque",
    nombre: "Ataque",
    bajada: "Cuánto peligro genera",
    metricas: [
      {
        clave: "xg",
        label: "Goles esperados (xG)",
        def: "A cada remate se le pone la probabilidad de terminar en gol según desde dónde y cómo se pateó, y se suman. Los goles dicen qué pasó; el xG, cada cuánto tendría que pasar.",
        decimales: 1,
        direccion: "mas",
        principal: true,
        total: true,
      },
      {
        clave: "xg_pp",
        label: "xG por partido",
        def: "El mismo xG, dividido por los partidos jugados. Es la comparación justa entre equipos que no jugaron la misma cantidad.",
        decimales: 2,
        direccion: "mas",
        principal: true,
      },
      {
        clave: "chances_claras",
        label: "Chances claras",
        def: "Situaciones en las que se espera que el atacante convierta.",
        decimales: 1,
        direccion: "mas",
        principal: true,
      },
      {
        clave: "toques_en_area_rival",
        label: "Toques en el área rival",
        def: "Veces que el equipo tocó la pelota dentro del área contraria. No son pases progresivos: miden intención ofensiva, no avance metro a metro.",
        decimales: 1,
        direccion: "mas",
      },
      {
        clave: "goles_pp",
        label: "Goles por partido",
        def: "Los goles de verdad, no los esperados. Comparar contra el xG por partido es lo que dice si el equipo define bien o si le está saliendo todo.",
        decimales: 2,
        direccion: "mas",
      },
      { clave: "remates", label: "Remates", decimales: 1, direccion: "mas" },
      {
        clave: "remates_dentro_area",
        label: "Remates dentro del área",
        def: "De dónde patea importa más que cuánto: un remate dentro del área vale varias veces uno de afuera.",
        decimales: 1,
        direccion: "mas",
      },
      {
        clave: "xg_pelota_parada",
        label: "xG de pelota parada",
        def: "Peligro generado desde córner, tiro libre o penal.",
        decimales: 2,
        direccion: "mas",
      },
      {
        clave: "corners",
        label: "Córners",
        def: "Más córners suele ser más presión territorial, pero no más peligro: un córner vale poco por sí solo.",
        decimales: 1,
        direccion: "depende",
      },
    ],
  },
  {
    id: "definicion",
    nombre: "Definición",
    bajada: "Qué hace con lo que genera",
    metricas: [
      {
        clave: "conversion",
        label: "Conversión",
        def: "Goles dividido xG. Arriba de 1.00 el equipo mete más goles de los que sugieren sus situaciones; abajo de 1.00, desperdicia. Casi nunca se sostiene lejos de 1.00 mucho tiempo.",
        decimales: 2,
        direccion: "mas",
        principal: true,
      },
      {
        clave: "punteria",
        label: "Puntería",
        def: "Porcentaje de los remates que van al arco.",
        decimales: 1,
        sufijo: "%",
        direccion: "mas",
        principal: true,
      },
      {
        clave: "xg_por_remate",
        label: "xG por remate",
        def: "Cuánto peligro tiene en promedio cada remate. Alto = pocas situaciones pero buenas. Bajo = patea de cualquier lado.",
        decimales: 3,
        direccion: "mas",
      },
      {
        clave: "xgot",
        label: "xGOT por partido",
        def: "Goles esperados contando SOLO los remates que van al arco. Mide la calidad del remate después de pegarle: si el xGOT está muy por encima del xG, el equipo le pegó bien.",
        decimales: 2,
        direccion: "mas",
      },
      {
        clave: "sobre_xg",
        label: "Goles menos xG",
        def: "Positivo: metió más de lo que generó. Negativo: desperdició peligro.",
        decimales: 1,
        direccion: "mas",
        total: true,
      },
      {
        clave: "chances_claras_erradas",
        label: "Chances claras erradas",
        decimales: 1,
        direccion: "menos",
      },
      {
        clave: "palos",
        label: "Palos",
        def: "Remates que dieron en el palo o el travesaño. Ni bueno ni malo: es suerte, y por eso no ordena a nadie mejor que a otro.",
        decimales: 2,
        direccion: "depende",
      },
    ],
  },
  {
    id: "posesion",
    nombre: "Posesión y pase",
    bajada: "Cuánto tiene la pelota y qué hace con ella",
    metricas: [
      {
        clave: "posesion",
        label: "Posesión",
        def: "Porcentaje del tiempo con la pelota. Tener más la pelota no gana partidos por sí solo: hay equipos que eligen no tenerla y les va bien.",
        decimales: 1,
        sufijo: "%",
        direccion: "depende",
        principal: true,
      },
      {
        clave: "precision_pase",
        label: "Precisión de pase",
        def: "Porcentaje de los pases intentados que llegaron a destino.",
        decimales: 1,
        sufijo: "%",
        direccion: "mas",
        principal: true,
      },
      {
        clave: "pases_campo_rival",
        label: "Pases en campo rival",
        def: "Pases completados en la mitad de cancha contraria. No son pases progresivos: esa métrica la definía Opta y dejó de publicarse en enero de 2026.",
        decimales: 0,
        direccion: "mas",
      },
      {
        clave: "pases",
        label: "Pases intentados",
        def: "El volumen a secas. Mucho pase es un estilo, no una virtud.",
        decimales: 0,
        direccion: "depende",
      },
      {
        clave: "centros_completados",
        label: "Centros completados",
        decimales: 1,
        direccion: "depende",
      },
      {
        clave: "pelotazos_completados",
        label: "Pelotazos completados",
        def: "Pases largos que llegaron. Más no es mejor: es una forma de jugar.",
        decimales: 1,
        direccion: "depende",
      },
    ],
  },
  {
    id: "defensa",
    nombre: "Defensa",
    bajada: "Lo que concede",
    metricas: [
      {
        clave: "xg_contra_pp",
        label: "xG en contra por partido",
        def: "Cuánto peligro le generaron los rivales, por partido.",
        decimales: 2,
        direccion: "menos",
        principal: true,
      },
      {
        clave: "xg_dif",
        label: "Diferencia de xG",
        def: "xG a favor menos xG en contra. Resume ataque y defensa en un número, igual que la diferencia de gol.",
        decimales: 1,
        direccion: "mas",
        principal: true,
        total: true,
      },
      {
        clave: "goles_contra_pp",
        label: "Goles en contra por partido",
        decimales: 2,
        direccion: "menos",
      },
      {
        clave: "xg_contra",
        label: "xG en contra",
        decimales: 1,
        direccion: "menos",
        total: true,
      },
      {
        clave: "quites",
        label: "Quites",
        def: "Entradas para sacarle la pelota al rival. Más quites no es mejor defensa: también es más tiempo sin la pelota.",
        decimales: 1,
        direccion: "depende",
      },
      {
        clave: "intercepciones",
        label: "Intercepciones",
        def: "Pases del rival cortados en el camino.",
        decimales: 1,
        direccion: "depende",
      },
      {
        clave: "bloqueos",
        label: "Bloqueos de remate",
        decimales: 1,
        direccion: "depende",
      },
      {
        clave: "rechazos",
        label: "Rechazos",
        def: "Despejes sin destino. Un número alto casi siempre dice que el equipo defiende muy cerca de su propio arco, no que defienda bien.",
        decimales: 1,
        direccion: "depende",
      },
      {
        clave: "atajadas",
        label: "Atajadas",
        def: "Más atajadas no es mejor arquero: es un arco más visitado.",
        decimales: 1,
        direccion: "depende",
      },
    ],
  },
  {
    id: "duelos",
    nombre: "Duelos",
    bajada: "El uno contra uno",
    metricas: [
      {
        clave: "duelos_pct",
        label: "Duelos ganados",
        def: "Porcentaje de los duelos disputados que ganó el equipo. Va en porcentaje y no en cantidad porque hay partidos de 60 duelos y partidos de 157.",
        decimales: 1,
        sufijo: "%",
        direccion: "mas",
        principal: true,
      },
      {
        clave: "duelos_aereos_pct",
        label: "Duelos aéreos ganados",
        decimales: 1,
        sufijo: "%",
        direccion: "mas",
        principal: true,
      },
      {
        clave: "duelos_suelo_pct",
        label: "Duelos de suelo ganados",
        decimales: 1,
        sufijo: "%",
        direccion: "mas",
      },
      {
        clave: "gambetas_exitosas",
        label: "Gambetas exitosas",
        def: "Regates que terminaron con el jugador pasando a su marcador.",
        decimales: 1,
        direccion: "mas",
      },
    ],
  },
  {
    id: "disciplina",
    nombre: "Disciplina",
    bajada: "Faltas, tarjetas y offsides",
    metricas: [
      {
        clave: "faltas",
        label: "Faltas cometidas",
        decimales: 1,
        direccion: "menos",
        principal: true,
      },
      {
        clave: "amarillas",
        label: "Amarillas",
        decimales: 1,
        direccion: "menos",
        principal: true,
      },
      { clave: "rojas", label: "Rojas", decimales: 2, direccion: "menos" },
      {
        clave: "offsides",
        label: "Offsides",
        def: "Ni bueno ni malo: se queda en offside el que ataca mucho y también el que se desacomoda.",
        decimales: 1,
        direccion: "depende",
      },
    ],
  },
];

/** Un equipo con sus 39 métricas y sus 39 puestos. */
export type EquipoStats = {
  equipo: string;
  slug: string;
  colores: [string, string];
  pj: number;
} & Record<string, number | string | string[]>;

export const equiposStats = estadisticas.equipos as unknown as EquipoStats[];
export const temporadaStats = estadisticas.temporada;
export const fuenteStats = estadisticas.fuente;
export const pjMin = estadisticas.pj_min;
export const pjMax = estadisticas.pj_max;

/** Una fila de un ranking, ya resuelta. */
export type FilaRanking = {
  equipo: string;
  slug: string;
  colores: [string, string];
  valor: number;
  /** Viene del pipeline y los empates lo comparten: 1, 2, 2, 4. */
  puesto: number;
};

/**
 * El ranking completo de una métrica.
 *
 * Los equipos sin el dato quedan afuera en vez de aparecer con un cero: un 0
 * de relleno en "precisión de pase" se leería como un equipo malísimo, cuando
 * lo que pasa es que no hay medición.
 */
export function ranking(m: Metrica): FilaRanking[] {
  const filas: FilaRanking[] = [];
  for (const e of equiposStats) {
    const valor = e[m.clave];
    const puesto = e[`puesto_${m.clave}`];
    if (typeof valor !== "number" || typeof puesto !== "number") continue;
    filas.push({
      equipo: e.equipo,
      slug: e.slug,
      colores: e.colores,
      valor,
      puesto,
    });
  }
  return filas.sort((a, b) => a.puesto - b.puesto || a.equipo.localeCompare(b.equipo));
}

/** Cómo se escribe un valor. Nunca un 0 inventado: si no hay dato, va "—". */
export function formatear(valor: number | null, m: Metrica): string {
  if (valor === null || !Number.isFinite(valor)) return "—";
  const signo = puedeSerNegativa(m) && valor > 0 ? "+" : valor < 0 ? "−" : "";
  return `${signo}${Math.abs(valor).toFixed(m.decimales)}${m.sufijo ?? ""}`;
}

/** Las dos métricas que son restas y pueden dar negativo. */
export function puedeSerNegativa(m: Metrica): boolean {
  return m.clave === "xg_dif" || m.clave === "sobre_xg";
}

export const LEYENDA_DIRECCION: Record<Direccion, { signo: string; texto: string }> = {
  mas: { signo: "▲", texto: "más es mejor" },
  menos: { signo: "▼", texto: "menos es mejor" },
  depende: { signo: "◆", texto: "depende del contexto" },
};
