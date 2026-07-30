/**
 * AUDITORÍA VISUAL DEL SITIO.
 *
 *   npm run auditoria            (contra http://localhost:3000)
 *   npm run auditoria -- --shots (además guarda capturas en scripts/capturas/)
 *   BASE=https://... npm run auditoria
 *
 * Recorre todas las pantallas en escritorio (1440px) y en celular (390px) y
 * revisa dos cosas que NO se ven leyendo el código:
 *
 *   1. TEXTOS ENCIMADOS Y DESBORDES — cajas que se pisan, contenido que se sale
 *      de su columna, y scroll horizontal del documento.
 *   2. CONTRASTE — cada texto contra el fondo que realmente tiene detrás,
 *      medido con la fórmula de WCAG.
 *
 * Sale con código 1 si aparece algo que no esté en `CONOCIDOS`. La idea es esa:
 * que romper la maqueta o la legibilidad falle, en vez de descubrirse mirando
 * producción tres días después.
 *
 * ── POR QUÉ ESTÁ ESCRITO ASÍ ──
 *
 * Las tres mediciones ingenuas que uno haría MIENTEN, y las tres mintieron
 * antes de que este archivo quedara bien. Están explicadas en cada función,
 * pero el resumen es:
 *
 *   · `getComputedStyle().color` devuelve `lab(...)`, no `rgb()`, para todo lo
 *     que salga de un token en oklch. Un parser de `rgb()` se saltea EN
 *     SILENCIO justo los colores del sistema de diseño.
 *   · `Range.getClientRects()` devuelve el texto SIN recortar, así que cada
 *     `truncate` parece pisar a su vecino.
 *   · La caja de un inline que parte en dos renglones abarca todo el bloque.
 */

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE ?? "http://localhost:3000";
const CAPTURAS = process.argv.includes("--shots");
const AQUI = path.dirname(fileURLToPath(import.meta.url));

/** Las secciones del sitio. Las páginas de detalle las encuentra el recorrido. */
const SEMILLA = [
  "/", "/equipo", "/plantel", "/stats", "/modelo",
  "/liga", "/tabla", "/titulo", "/calendario", "/estadisticas",
];

/** Como mucho dos páginas por patrón dinámico: la número 30 no dice nada nuevo. */
const POR_PATRON = 2;

const ANCHOS = [
  { w: 1440, tag: "escritorio" },
  { w: 390, tag: "celular" },
];

/**
 * Lo que se sabe que aparece y NO es un defecto. Cada línea tiene que poder
 * defenderse sola; si una deja de tener sentido, se borra y se arregla.
 */
const CONOCIDOS = [
  {
    // La foto del hero sangra a propósito con `-mx-5 sm:-mx-10` para llegar al
    // borde de la pantalla. `scrollWidth` ignora el desborde por izquierda, así
    // que lo reporta como si sobrara sólo de un lado. No genera scroll de
    // página: el `overflow-hidden` de la sección lo contiene.
    motivo: "sangrado a propósito de la foto del hero",
    aplica: (p) => p.tipo === "desborde" && p.ruta === "/" && p.el.startsWith("div.pb-16"),
  },
  {
    // El punto medio del dorado de la matriz y de la rampa del mapa de calor:
    // ni la tinta clara ni la oscura llegan a 4,5:1 ahí. El número de la celda
    // es una etiqueta redundante —el color ya dice el dato— y cerrar esas
    // décimas pide deformar rampas que están validadas para daltonismo.
    // Ver `MatrizMarcadores.tsx` y `tintaDeCalor()` en `lib/visualizaciones.ts`.
    //
    // LA EXCEPCIÓN VA ATADA AL ELEMENTO, NO AL RATIO. La primera versión de
    // esta regla decía `ratio >= 3.7` a secas y era un colador: perdonaba
    // CUALQUIER texto del sitio que cayera en ese rango. Se probó bajando
    // `--color-tinta4` de 0.62 a 0.55 —el defecto real que este script vino a
    // evitar, 305 combinaciones flojas— y la auditoría pasó en verde.
    // Una excepción amplia no documenta una deuda: esconde las que vengan.
    motivo: "tono medio de la matriz / del mapa de calor, documentado",
    aplica: (p) =>
      p.tipo === "contraste" &&
      p.ratio >= 3.7 &&
      (p.el.startsWith("span.flex.h-9") || p.el.startsWith("td.w-[22px]")),
  },
];

const esConocido = (p) => CONOCIDOS.find((c) => c.aplica(p));

// ───────────────────────────────────────────────────────────── medición ──

/** Todo lo que se mide adentro de la página. Corre en el navegador. */
function SONDA() {
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const nombre = (el) => {
    const cls = typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\s+/).slice(0, 4).join(".")
      : "";
    return el.tagName.toLowerCase() + cls;
  };
  const texto = (el) => (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 45);

  /**
   * Normaliza CUALQUIER formato de color pintándolo en un canvas de 1px.
   *
   * `getComputedStyle` devuelve `lab(...)` para todo lo que venga de un token
   * en oklch, y `color-mix(...)` para las mezclas. Un parser de `rgb()` hecho a
   * mano no los entiende y los descarta sin avisar — o sea que deja afuera
   * justamente los colores del sistema de diseño, que son los que importan.
   */
  const lienzo = document.createElement("canvas");
  lienzo.width = lienzo.height = 1;
  const cx = lienzo.getContext("2d", { willReadFrequently: true });
  const cacheColor = new Map();
  const color = (s) => {
    if (!s || s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    if (cacheColor.has(s)) return cacheColor.get(s);
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = "#000";
    cx.fillStyle = s; // si el valor es inválido, `fillStyle` no cambia
    if (cx.fillStyle === "#000000" && !/^(#000000|black|rgb\(0, ?0, ?0\))$/i.test(s.trim())) {
      cacheColor.set(s, null);
      return null;
    }
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    const v = { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    cacheColor.set(s, v);
    return v;
  };

  const sobre = (frente, fondo) => ({
    r: frente.r * frente.a + fondo.r * (1 - frente.a),
    g: frente.g * frente.a + fondo.g * (1 - frente.a),
    b: frente.b * frente.a + fondo.b * (1 - frente.a),
    a: 1,
  });

  const luminancia = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };

  /** Fondo EFECTIVO: sube por los ancestros apilando capas hasta una opaca. */
  const fondoDe = (el) => {
    const capas = [];
    for (let p = el; p; p = p.parentElement) {
      const c = color(getComputedStyle(p).backgroundColor);
      if (!c || c.a === 0) continue;
      capas.push(c);
      if (c.a === 1) break;
    }
    let base = capas.pop() ?? { r: 255, g: 255, b: 255, a: 1 };
    while (capas.length) base = sobre(capas.pop(), base);
    return base;
  };

  // Elementos con texto propio: los que de verdad pintan letras.
  const hojas = [...document.querySelectorAll("body *")].filter((el) => {
    if (!visible(el) || el.closest(".sr-only")) return false;
    if (/^(SCRIPT|STYLE|SVG|PATH|G|CIRCLE|RECT|LINE|TEXT|IMG|BR)$/.test(el.tagName)) return false;
    return [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  });

  /**
   * Caja de recorte: `truncate` (overflow hidden) tapa lo que sobra, pero el
   * rect del nodo de texto viene SIN recortar. Sin esto, cada nombre truncado
   * parece pisar a su vecino y el reporte se llena de fantasmas.
   */
  const recorteDe = (el) => {
    let caja = null;
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.overflow === "visible" && s.overflowX === "visible" && s.overflowY === "visible") continue;
      const r = p.getBoundingClientRect();
      caja = caja
        ? { l: Math.max(caja.l, r.left), t: Math.max(caja.t, r.top), r: Math.min(caja.r, r.right), b: Math.min(caja.b, r.bottom) }
        : { l: r.left, t: r.top, r: r.right, b: r.bottom };
    }
    return caja;
  };

  /**
   * Una caja POR LÍNEA de texto, no la caja del elemento: un `<a>` que parte en
   * dos renglones tiene una caja que abarca todo el bloque y choca con
   * cualquier vecino. Sus client rects, en cambio, son los renglones reales.
   */
  const cajas = [];
  for (const el of hojas) {
    const clip = recorteDe(el);
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const rango = document.createRange();
      rango.selectNodeContents(n);
      for (const r0 of rango.getClientRects()) {
        const r = clip
          ? { l: Math.max(r0.left, clip.l), t: Math.max(r0.top, clip.t), r: Math.min(r0.right, clip.r), b: Math.min(r0.bottom, clip.b) }
          : { l: r0.left, t: r0.top, r: r0.right, b: r0.bottom };
        if (r.r - r.l < 2 || r.b - r.t < 2) continue;
        cajas.push({ el, x: r.l, y: r.t + scrollY, w: r.r - r.l, h: r.b - r.t, r: r.r, b: r.b + scrollY });
      }
    }
  }

  const encimados = [];
  const yaVisto = new Set();
  for (let i = 0; i < cajas.length; i++) {
    for (let j = i + 1; j < cajas.length; j++) {
      const a = cajas[i], b = cajas[j];
      if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const ox = Math.min(a.r, b.r) - Math.max(a.x, b.x);
      const oy = Math.min(a.b, b.b) - Math.max(a.y, b.y);
      if (ox <= 1 || oy <= 1) continue;
      const parte = (ox * oy) / Math.min(a.w * a.h, b.w * b.h);
      if (parte < 0.1) continue; // un roce de un par de píxeles no es un defecto
      const clave = nombre(a.el) + "|" + nombre(b.el);
      if (yaVisto.has(clave)) continue;
      yaVisto.add(clave);
      encimados.push({
        pct: Math.round(parte * 100),
        y: Math.round(Math.min(a.y, b.y)),
        a: nombre(a.el) + " :: " + texto(a.el),
        b: nombre(b.el) + " :: " + texto(b.el),
      });
    }
  }

  // Un `truncate` con scrollWidth > clientWidth está HACIENDO SU TRABAJO.
  const desbordes = [...document.querySelectorAll("body *")]
    .filter((el) => {
      if (!visible(el) || el.closest(".sr-only")) return false;
      if (el.scrollWidth <= el.clientWidth + 2) return false;
      return !["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(el).overflowX);
    })
    .map((el) => ({ el: nombre(el), scroll: el.scrollWidth, client: el.clientWidth, t: texto(el) }));

  const scrollDoc = document.documentElement.scrollWidth > innerWidth + 2
    ? { scroll: document.documentElement.scrollWidth, ventana: innerWidth }
    : null;

  const flojos = [];
  const combos = new Set();
  for (const el of hojas) {
    const s = getComputedStyle(el);
    const frente0 = color(s.color);
    if (!frente0) continue;
    const fondo = fondoDe(el);
    const frente = frente0.a < 1 ? sobre(frente0, fondo) : frente0;
    const l1 = luminancia(frente), l2 = luminancia(fondo);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

    const px = parseFloat(s.fontSize);
    const grande = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700);
    const minimo = grande ? 3 : 4.5;
    if (ratio >= minimo) continue;

    const clave = nombre(el) + s.color + JSON.stringify(fondo);
    if (combos.has(clave)) continue;
    combos.add(clave);
    flojos.push({
      ratio: Math.round(ratio * 100) / 100, minimo, px: Math.round(px),
      el: nombre(el), color: s.color,
      fondo: `rgb(${Math.round(fondo.r)}, ${Math.round(fondo.g)}, ${Math.round(fondo.b)})`,
      t: texto(el),
    });
  }

  const enlaces = [...document.querySelectorAll("a[href]")]
    .map((a) => a.getAttribute("href"))
    .filter((h) => h && h.startsWith("/") && !h.startsWith("//"))
    .map((h) => h.split("#")[0]);

  return {
    encimados: encimados.sort((a, b) => b.pct - a.pct),
    desbordes,
    scrollDoc,
    flojos: flojos.sort((a, b) => a.ratio - b.ratio),
    enlaces: [...new Set(enlaces)],
  };
}

// ────────────────────────────────────────────────────────────── recorrido ──

const patronDe = (ruta) =>
  ruta.split("/").length > 2 ? ruta.replace(/\/[^/]+$/, "/*") : ruta;

async function recorrer(pagina, ancho, tag, problemas) {
  const vistas = new Set();
  const cola = [...SEMILLA];
  const cupo = {};
  const dir = path.join(AQUI, "capturas");
  if (CAPTURAS) fs.mkdirSync(dir, { recursive: true });

  while (cola.length) {
    const ruta = cola.shift();
    if (vistas.has(ruta)) continue;
    const p = patronDe(ruta);
    cupo[p] = (cupo[p] ?? 0) + 1;
    if (cupo[p] > POR_PATRON) continue;
    vistas.add(ruta);

    let res;
    try {
      res = await pagina.goto(BASE + ruta, { waitUntil: "networkidle", timeout: 45000 });
    } catch (e) {
      problemas.push({ tipo: "error", ruta, tag, detalle: String(e).slice(0, 140) });
      continue;
    }
    if (!res || res.status() >= 400) {
      problemas.push({ tipo: "error", ruta, tag, detalle: "HTTP " + res?.status() });
      continue;
    }
    await pagina.waitForTimeout(300);
    const d = await pagina.evaluate(SONDA);

    if (CAPTURAS) {
      const nombre = (ruta === "/" ? "home" : ruta.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, ""));
      await pagina.screenshot({ path: path.join(dir, `${nombre}.${tag}.png`), fullPage: true });
    }

    if (d.scrollDoc) {
      problemas.push({ tipo: "scroll", ruta, tag, ...d.scrollDoc });
    }
    for (const o of d.encimados) problemas.push({ tipo: "encimado", ruta, tag, ...o });
    for (const o of d.desbordes) problemas.push({ tipo: "desborde", ruta, tag, ...o });
    for (const o of d.flojos) problemas.push({ tipo: "contraste", ruta, tag, ...o });

    for (const l of d.enlaces) if (!vistas.has(l) && !cola.includes(l)) cola.push(l);
  }
  return vistas.size;
}

// ───────────────────────────────────────────────────────────────── salida ──

const navegador = await chromium.launch();
const problemas = [];
let rutas = 0;

for (const { w, tag } of ANCHOS) {
  const pagina = await navegador.newPage({ viewport: { width: w, height: 900 } });
  rutas = await recorrer(pagina, w, tag, problemas);
  await pagina.close();
}
await navegador.close();

const nuevos = [];
const conocidos = [];
for (const p of problemas) (esConocido(p) ? conocidos : nuevos).push(p);

const linea = (p) => {
  const donde = `${p.ruta} [${p.tag}]`;
  if (p.tipo === "error") return `  ERROR      ${donde}  ${p.detalle}`;
  if (p.tipo === "scroll") return `  SCROLL-H   ${donde}  el documento mide ${p.scroll}px en una ventana de ${p.ventana}px`;
  if (p.tipo === "encimado") return `  ENCIMADO   ${donde}  ${p.pct}% a la altura y=${p.y}\n               A: ${p.a}\n               B: ${p.b}`;
  if (p.tipo === "desborde") return `  DESBORDA   ${donde}  ${p.el} (${p.scroll} > ${p.client})  "${p.t}"`;
  return `  CONTRASTE  ${donde}  ${p.ratio}:1 (pide ${p.minimo}) a ${p.px}px  ${p.el}\n               ${p.color} sobre ${p.fondo}  "${p.t}"`;
};

console.log(`\nAuditoría de ${BASE} — ${rutas} rutas × ${ANCHOS.length} anchos\n`);

if (nuevos.length) {
  console.log(`SIN RESOLVER (${nuevos.length}):\n`);
  for (const p of nuevos) console.log(linea(p));
} else {
  console.log("Sin problemas nuevos.");
}

if (conocidos.length) {
  console.log(`\nConocidos y aceptados (${conocidos.length}) — ver CONOCIDOS en este archivo:`);
  const porMotivo = {};
  for (const p of conocidos) {
    const m = esConocido(p).motivo;
    porMotivo[m] = (porMotivo[m] ?? 0) + 1;
  }
  for (const [m, n] of Object.entries(porMotivo)) console.log(`  ${String(n).padStart(3)}  ${m}`);
}

console.log("");
process.exit(nuevos.length ? 1 : 0);
