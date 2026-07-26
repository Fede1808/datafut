/**
 * La identidad de un club, sin escudo.
 *
 * Un cuadradito partido en diagonal con los dos colores del equipo. Los
 * escudos son marcas registradas y están prohibidos en este proyecto; además,
 * los colores identifican igual de rápido y hacen que el sitio no se vea como
 * todos los demás.
 *
 * El borde no es decorativo: hay clubes cuyo color principal es negro
 * (Central Córdoba, Riestra) y sobre el fondo #15161a serían invisibles. Y a
 * los de blanco puro (River, Vélez, Huracán) les pasa lo mismo al revés.
 * Un borde parejo resuelve los dos casos sin excepciones en el código.
 */
export function Chip({
  colores,
  size = 10,
}: {
  colores: [string, string];
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-[2px] border border-[#3a3d45]"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${colores[0]} 50%, ${colores[1]} 50%)`,
      }}
    />
  );
}
