# Prompt para diseñar el sitio

Copiá todo lo que está debajo de la línea y pegalo en Claude Design.

Está escrito para que se entienda sin conocer el proyecto, con datos reales
(no inventados) para que el diseño no se rompa cuando entren los verdaderos.

---

## PROMPT (copiar desde acá)

Necesito el diseño de un sitio web público sobre fútbol argentino. Quiero que me
propongas **tres direcciones visuales distintas** para elegir una, no una sola opción.

### Qué es el proyecto

Un sitio que publica **probabilidades propias** sobre la Liga Profesional argentina,
calculadas con un modelo estadístico (Dixon-Coles + simulación Monte Carlo) que se
reentrena solo después de cada fecha.

**Qué NO es**, y es importante para el diseño:

- No es una app de resultados en vivo tipo Promiedos o Flashscore
- No es una herramienta de apuestas, y no puede parecerlo
- No es una cuenta que regrafica datos ajenos: el modelo es propio y es el diferencial

El sitio es gratuito, sin registro, sin publicidad, sin cuentas de usuario.

### Público

Hinchas argentinos, de 18 a 45 años. **Mayoría en celular.** No son analistas de datos:
hay que hacer entendible una probabilidad sin explicar estadística. El sitio está
íntegramente en **español rioplatense** (voseo).

### Restricciones que no se pueden negociar

1. **PROHIBIDO usar escudos, logos o camisetas de los clubes.** Son marcas registradas.
   El diseño tiene que identificar a cada equipo **solo con su nombre y sus colores**
   (Boca azul y amarillo, River rojo y blanco, San Lorenzo azul y rojo, etc.). Esto no
   es un capricho legal: es lo que va a hacer que el sitio no se vea igual a todos los demás.
2. **PROHIBIDO usar fotos de jugadores.**
3. Tiene que haber un **aviso visible** de que es un proyecto no oficial, sin afiliación
   con ningún club ni con la AFA. Que se vea, no letra chica escondida al final.
4. **No puede parecer un sitio de apuestas.** Nada de cuotas como protagonistas, nada de
   botones tipo "apostá", nada de verde neón de casino.

### Tono visual buscado

**Editorial de datos.** La referencia es FiveThirtyEight o The Athletic: tipografía
fuerte, mucho espacio en blanco, los números como protagonistas, gráficos limpios y
honestos. Tiene que transmitir **rigor**, porque lo que se vende es la seriedad del modelo.

Que se lea bien en celular es prioridad número uno, no una adaptación posterior.

### Las tres pantallas

#### 1. Portada — "la fecha"

Lo primero que se ve son **los partidos de la próxima fecha con sus probabilidades**.

Pero hay una regla de jerarquía importante: **la probabilidad de salir campeón tiene que
verse sin scrollear**, aunque sea en formato compacto. Es el dato exclusivo del sitio y
no puede quedar enterrado.

Datos reales de la fecha actual (12 partidos, formato: local % / empate % / visitante %):

```
Deportivo Riestra    25% / 37% / 38%   Boca Juniors        goles esperados 0.68 - 0.92
River Plate          68% / 21% / 11%   Barracas Central    goles esperados 2.04 - 0.69
Racing Club          56% / 27% / 18%   Gimnasia (LP)       goles esperados 1.62 - 0.81
Estudiantes (LP)     41% / 32% / 27%   Independiente       goles esperados 1.16 - 0.90
Newell's Old Boys    34% / 33% / 34%   Talleres (C)        goles esperados 1.04 - 1.04
Estudiantes (RC)      9% / 31% / 60%   Tigre               goles esperados 0.36 - 1.29
Vélez Sarsfield      49% / 30% / 20%   Instituto           goles esperados 1.35 - 0.77
Huracán              45% / 33% / 22%   Banfield            goles esperados 1.16 - 0.73
Lanús                40% / 33% / 28%   San Lorenzo         goles esperados 1.13 - 0.90
Atlético Tucumán     38% / 30% / 32%   Ind. Rivadavia      goles esperados 1.24 - 1.11
Gimnasia (M)         37% / 31% / 33%   Central Córdoba     goles esperados 1.19 - 1.11
Platense             37% / 34% / 29%   Unión               goles esperados 1.03 - 0.87
```

Ojo con un detalle que rompe muchos diseños: **hay muchos partidos parejos**. Cinco de
los doce tienen los tres resultados entre 27% y 40%. El diseño no puede asumir que
siempre hay un favorito claro, y tiene que mostrar bien la diferencia entre un 68/21/11
y un 34/33/34.

Módulo compacto de candidatos al título (probabilidad de campeón, 30 equipos en total):

```
Boca Juniors 18.7%  ·  River Plate 16.5%  ·  Racing Club 7.2%
Estudiantes (LP) 6.1%  ·  Independiente 5.7%  ·  Argentinos Juniors 5.0%
... y así hasta Estudiantes (RC) con 0.0%
```

Nota importante: **el máximo es 18.7%**. No hay ningún equipo con 60% ni nada parecido,
porque el campeón se define por playoffs a partido único. El diseño tiene que hacer que
un 18.7% se lea como "es el favorito" y no como "casi no tiene chance".

#### 2. Página de equipo

- Probabilidad de salir campeón y de clasificar a playoffs
- Su recorrido posible: probabilidad de llegar a octavos, cuartos, semis y final
- Su fuerza de ataque y de defensa comparada con el promedio de la liga
- Próximos partidos con probabilidades
- Últimos resultados
- Qué tan bien le viene pegando el modelo a este equipo (transparencia)

#### 3. Página de partido

- La probabilidad 1-X-2 en grande
- **Los marcadores más probables.** Ejemplo real de Boca vs River:
  `1-1 (14.3%) · 1-0 (11.5%) · 0-0 (11.2%) · 0-1 (9.2%)`
  Es el dato más lindo del modelo y merece una visualización propia, no una lista.
- Goles esperados de cada lado
- Historial entre los dos equipos

### Cómo comunicar la incertidumbre

Esto es lo más difícil del encargo y me importa especialmente.

El modelo **se equivoca seguido, y está bien que así sea**. Un 60% significa que cuatro
de cada diez veces pasa lo otro. El diseño tiene que transmitir eso con honestidad, sin
aparentar una certeza que no existe y sin que el sitio parezca inseguro o poco serio.

Nada de tildes verdes de "ganador seguro" ni lenguaje de pronóstico deportivo tradicional.

### Qué necesito que me entregues

**Tres direcciones visuales diferentes**, no tres variantes de la misma. Para cada una:

1. La portada en celular (es la vista principal)
2. La portada en escritorio
3. El componente de un partido individual, que es la pieza que más se repite
4. Paleta, tipografías y cómo resolvés la identidad de los equipos sin escudos
5. Una línea explicando qué tipo de sitio comunica esa dirección

Nombre del sitio: usá un placeholder, todavía no está definido.

## FIN DEL PROMPT
