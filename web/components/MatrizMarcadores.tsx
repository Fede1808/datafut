/**
 * La probabilidad de CADA marcador posible, en una grilla de 7×7.
 *
 * Es la pieza que mejor explica de qué se trata el modelo: no elige un
 * resultado, reparte probabilidad sobre todos. El top 5 en lista esconde
 * justamente eso.
 *
 * CÓMO SE PINTA, y por qué no es un degradado lineal. La celda más probable
 * ronda el 14% y la mediana no llega al 1%. Con opacidad proporcional al valor,
 * 40 de las 49 celdas quedarían indistinguibles del fondo y la grilla se vería
 * vacía. Se usa raíz cuarta, que comprime los extremos y reparte el rango
 * visible entre las celdas que realmente tienen algo: sigue siendo monótona —
 * más probable nunca se ve más apagado — pero deja de ser lineal.
 *
 * El color es el acento sobre el fondo de la tarjeta. Un solo tono con
 * intensidad variable, no una escala de dos colores: acá no hay "bueno" ni
 * "malo", hay más y menos probable.
 */
export function MatrizMarcadores({
  matriz,
  local,
  visita,
}: {
  matriz: number[][];
  local: string;
  visita: string;
}) {
  const tope = Math.max(...matriz.flat());
  const maximo = matriz.flat().indexOf(tope);
  const filaMax = Math.floor(maximo / 7);
  const colMax = maximo % 7;

  return (
    <div className="tarjeta p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="titular-2">Matriz de resultados</h2>
        <p className="dato text-[10px] uppercase tracking-[0.16em] text-tinta4">
          Probabilidad de cada marcador
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[380px]">
          {/* Encabezado de columnas: goles del visitante */}
          <div className="dato mb-1 grid grid-cols-[46px_repeat(7,1fr)] gap-1 text-[10px] text-tinta4">
            <span />
            {[0, 1, 2, 3, 4, 5, 6].map((j) => (
              <span key={j} className="text-center">
                {j}
              </span>
            ))}
          </div>

          {matriz.map((fila, i) => (
            <div
              key={i}
              className="dato mb-1 grid grid-cols-[46px_repeat(7,1fr)] items-center gap-1"
            >
              <span className="text-[10px] text-tinta4">{i} gol{i === 1 ? "" : "es"}</span>
              {fila.map((v, j) => {
                const intensidad = tope ? Math.pow(v / tope, 0.25) : 0;
                const esMax = i === filaMax && j === colMax;
                return (
                  <span
                    key={j}
                    title={`${local} ${i} - ${j} ${visita}: ${v.toLocaleString("es-AR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}%`}
                    /*
                      LA TINTA DE LA CELDA, y por qué el corte está en 0,655.

                      El fondo es `color-mix` en oklab entre el acento (L 0.80)
                      y la tarjeta (L 0.22), así que su claridad es lineal en
                      la intensidad: L = 0.22 + 0.58 · intensidad. El punto
                      donde a la tinta oscura le empieza a convenir está en
                      L ≈ 0.60, o sea intensidad 0.655 — no en 0.72, que era el
                      valor anterior y dejaba texto claro sobre celdas ya
                      doradas: la peor medía 1,74:1.

                      La tinta clara pasó de `tinta2` a `tinta`. Sobre esos
                      dorados medios, tinta2 daba 2,3:1 y tinta da 3,8:1, y en
                      las celdas apagadas —que son la mayoría— las dos leen.

                      QUEDA UNA BANDA CORTA, entre intensidad 0.5 y 0.65, donde
                      la mejor de las dos tintas llega a 3,8:1 y AA pide 4,5:1
                      para 11px: es el punto medio del dorado, donde ni el
                      claro ni el oscuro alcanzan. Achicarlo pide tocar la
                      rampa, y la rampa es el dato.
                    */
                    className={`flex h-9 items-center justify-center rounded-[3px] text-[11px] ${
                      esMax ? "ring-1 ring-acento" : ""
                    } ${intensidad > 0.655 ? "text-[oklch(0.18_0.03_262)]" : "text-tinta"}`}
                    style={{
                      background: `color-mix(in oklab, var(--color-acento) ${Math.round(
                        intensidad * 100,
                      )}%, var(--color-tarjeta2))`,
                    }}
                  >
                    {v >= 0.5 ? v.toFixed(1) : ""}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="dato mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-borde2 pt-3 text-[10px] uppercase tracking-[0.14em] text-tinta4">
        <span>Filas: goles de {local}</span>
        <span>Columnas: goles de {visita}</span>
      </div>
      <p className="mt-2 text-[12px] text-tinta4">
        Las celdas por debajo de 0,5% quedan sin número: el color las sigue
        marcando, pero escribir «0,2» cuarenta veces no informa.
      </p>
    </div>
  );
}
