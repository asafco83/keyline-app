// SVGcinema — render/fonts
// Web fonts (Google Fonts via @fontsource on jsDelivr): loading them into the editor, and preparing
// them for export, either as outlines (text → <path>) or embedded in the SVG as base64 @font-face.
//
// Outlines are the default: nothing to download when the animation plays, and it looks the same in
// every browser and inside <img>. Embedding keeps the text selectable and is smaller for long text.
import type { Geometry } from '../model/types';
import { SUBSET_RANGES, WEB_FONTS, type WebFont } from '../model/font-catalog';
import { anchorX, textLines } from './text-layout';

/* ---------- fonts installed on this computer (Local Font Access API, Chrome / Edge) ---------- */

export interface LocalFace {
  family: string;
  postscriptName: string;
  style: string;
  w: number;
  it: boolean;
  /** FontData from queryLocalFonts() */
  data: { blob(): Promise<Blob> };
}
const LOCAL: Record<string, LocalFace[]> = {};
const LS_KEY = 'cin-local-fonts';
export function localFontsSupported() {
  return typeof window !== 'undefined' && 'queryLocalFonts' in window;
}
/** Families seen on this computer, also remembered from earlier visits (names only). */
export function localFamilies(): string[] {
  let saved: string[] = [];
  try {
    saved = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch (_) {}
  return [...new Set([...Object.keys(LOCAL), ...saved])].sort((a, b) => a.localeCompare(b));
}
export function localLoaded() {
  return Object.keys(LOCAL).length > 0;
}
const WNAMES: Array<[RegExp, number]> = [
  [/thin|hairline/i, 100],
  [/extra ?light|ultra ?light/i, 200],
  [/semi ?light|demi ?light/i, 350],
  [/light/i, 300],
  [/medium/i, 500],
  [/semi ?bold|demi ?bold/i, 600],
  [/extra ?bold|ultra ?bold/i, 800],
  [/black|heavy/i, 900],
  [/bold/i, 700],
];
/** Ask the browser for the fonts on this computer (needs a click; the browser asks for permission). */
export async function loadLocalFonts(): Promise<string[]> {
  const list: any[] = await (window as any).queryLocalFonts();
  list.forEach(fd => {
    const st = String(fd.style || ''),
      w = (WNAMES.find(([r]) => r.test(st)) || [null, 400])[1];
    (LOCAL[fd.family] = LOCAL[fd.family] || []).push({
      family: fd.family,
      postscriptName: fd.postscriptName,
      style: st,
      w,
      it: /italic|oblique/i.test(st),
      data: fd,
    });
  });
  const fams = Object.keys(LOCAL).sort((a, b) => a.localeCompare(b));
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(fams));
  } catch (_) {}
  return fams;
}
export function isLocalFamily(family: unknown) {
  return typeof family === 'string' && !webFont(family) && localFamilies().includes(family);
}
function localFace(G: Geometry): LocalFace | null {
  const list = LOCAL[G.family];
  if (!list || !list.length) return null;
  const want = +String(G.weight || 400) || 400,
    it = !!G.italic,
    score = (f: LocalFace) => Math.abs(f.w - want) + (f.it === it ? 0 : 1000);
  return list.reduce((b, f) => (score(f) < score(b) ? f : b), list[0]);
}

export function webFont(family: unknown): WebFont | null {
  return (typeof family === 'string' && WEB_FONTS.find(f => f.family === family)) || null;
}
/** font-family value for markup: the web font with its generic fallback */
export function familyCSS(family: string) {
  const f = webFont(family);
  if (f) return `${f.family}, ${f.cat === 'handwriting' || f.cat === 'display' ? 'sans-serif' : f.cat}`;
  if (isLocalFamily(family)) return `'${String(family).replace(/'/g, '')}', sans-serif`;
  return family;
}
const RANGES: Record<string, Array<[number, number]>> = {};
function rangesOf(f: WebFont, sub: string) {
  const src = (f.ur && f.ur[sub]) || SUBSET_RANGES[sub] || '',
    key = f.id + '/' + sub;
  if (!RANGES[key])
    RANGES[key] = src
      .split(',')
      .map(s => s.trim().replace(/^U\+/i, ''))
      .filter(Boolean)
      .map(s => {
        const [a, b] = s.split('-');
        return [parseInt(a, 16), parseInt(b || a, 16)] as [number, number];
      });
  return RANGES[key];
}
export function subsetOf(f: WebFont, cp: number) {
  return f.subsets.find(s => rangesOf(f, s).some(([a, b]) => cp >= a && cp <= b)) || null;
}
/** Subsets a text needs (latin first when the font has it). */
export function subsetsFor(f: WebFont, text: string) {
  const need = new Set<string>();
  for (const ch of String(text || '')) {
    const s = subsetOf(f, ch.codePointAt(0));
    if (s) need.add(s);
  }
  if (!need.size) need.add(f.subsets.includes('latin') ? 'latin' : f.subsets[0]);
  return f.subsets.filter(s => need.has(s));
}
export function pickWeight(f: WebFont, w: unknown) {
  const n = +String(w || 400) || 400;
  return f.weights.reduce((b, x) => (Math.abs(x - n) < Math.abs(b - n) ? x : b), f.weights[0]);
}
export function styleFor(f: WebFont, italic: unknown) {
  return italic && f.italic ? 'italic' : 'normal';
}
export function fontURL(f: WebFont, sub: string, w: number, st: string, ext: 'woff' | 'woff2') {
  return `https://cdn.jsdelivr.net/npm/@fontsource/${f.id}@${f.v}/files/${f.id}-${sub}-${w}-${st}.${ext}`;
}
type Face = { f?: WebFont; local?: LocalFace; sub: string; w: number; st: string; key: string };
const FACES: Record<string, Face> = {};
export function facesFor(G: Geometry): Face[] {
  const f = webFont(G.family);
  if (!f) {
    const lf = localFace(G);
    if (!lf) return [];
    const key = 'local:' + lf.postscriptName;
    return [(FACES[key] = FACES[key] || { local: lf, sub: '', w: lf.w, st: lf.it ? 'italic' : 'normal', key })];
  }
  const w = pickWeight(f, G.weight),
    st = styleFor(f, G.italic);
  return subsetsFor(f, G.text).map(sub => {
    const key = `${f.id}-${sub}-${w}-${st}`;
    return (FACES[key] = FACES[key] || { f, sub, w, st, key });
  });
}

/* ---------- editor ---------- */

const loaded = new Set<string>();
let onLoad: (() => void) | null = null,
  pend = 0;
/** Called (debounced) when a font finishes loading, to redraw text that depends on its metrics. */
export function onFontLoad(fn: () => void) {
  onLoad = fn;
}
/** Make the browser load the faces this text needs. Cheap when they are already loaded. */
export function ensureFaces(G: Geometry) {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return;
  facesFor(G).forEach(({ f, sub, w, st, key }) => {
    // fonts on this computer are already available to the page by name
    if (!f || loaded.has(key)) return;
    loaded.add(key);
    const ff = new FontFace(
      f.family,
      `url(${fontURL(f, sub, w, st, 'woff2')}) format('woff2'), url(${fontURL(f, sub, w, st, 'woff')}) format('woff')`,
      { weight: String(w), style: st, unicodeRange: (f.ur && f.ur[sub]) || SUBSET_RANGES[sub] },
    );
    (document.fonts as any).add(ff);
    ff.load()
      .then(() => {
        clearTimeout(pend);
        pend = window.setTimeout(() => onLoad && onLoad(), 30);
      })
      .catch(() => {});
  });
}

/* ---------- export ---------- */

const OT: Record<string, any> = {},
  B64: Record<string, string> = {},
  FMT: Record<string, [string, string]> = {};
/** a local font file's format: [mime, css format] */
function sniff(b: ArrayBuffer): [string, string] {
  const t = new TextDecoder('latin1').decode(new Uint8Array(b, 0, 4));
  return t === 'OTTO'
    ? ['font/otf', 'opentype']
    : t === 'wOF2'
      ? ['font/woff2', 'woff2']
      : t === 'wOFF'
        ? ['font/woff', 'woff']
        : ['font/ttf', 'truetype'];
}
/** Size in bytes of the embedded data for these faces (to warn about large local fonts). */
export function embeddedBytes(keys: Iterable<string>) {
  let n = 0;
  for (const k of keys) n += B64[k] ? (B64[k].length * 3) / 4 : 0;
  return n;
}
async function faceBuf(fc: Face, ext: 'woff' | 'woff2') {
  if (fc.local) return (await fc.local.data.blob()).arrayBuffer();
  return fetchBuf(fontURL(fc.f, fc.sub, fc.w, fc.st, ext));
}
async function fetchBuf(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.arrayBuffer();
}
function b64(buf: ArrayBuffer) {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000)
    s += String.fromCharCode.apply(null, Array.from(u.subarray(i, i + 0x8000)));
  return btoa(s);
}
/** True when the text reads right to left (outlines would need shaping, so such text is embedded). */
export function isRTL(s: string) {
  return /[֐-ࣿיִ-﷿ﹰ-﻿]/.test(String(s || ''));
}
/** Fetch what export needs for these text layers. Failures are left for buildExport to fall back on. */
export async function prepareFonts(geos: Geometry[], mode: 'outline' | 'embed') {
  const jobs: Promise<unknown>[] = [];
  let ot: any = null;
  for (const G of geos) {
    const outline = mode === 'outline' && !isRTL(G.text);
    for (const fc of facesFor(G)) {
      if (outline && !OT[fc.key])
        jobs.push(
          (async () => {
            ot = ot || (await import('opentype.js'));
            const parse = ot.parse || (ot.default && ot.default.parse);
            OT[fc.key] = parse(await faceBuf(fc, 'woff'));
          })().catch(() => {}),
        );
      if (!outline && !B64[fc.key])
        jobs.push(
          faceBuf(fc, 'woff2')
            .then(b => {
              B64[fc.key] = b64(b);
              if (fc.local) FMT[fc.key] = sniff(b);
            })
            .catch(() => {}),
        );
    }
  }
  await Promise.all(jobs);
}
/** For tests and previews: put a parsed font / base64 data in the caches directly. */
export function primeFont(key: string, parsed?: any, base64?: string) {
  if (parsed) OT[key] = parsed;
  if (base64) B64[key] = base64;
}
/** @font-face rules for faces that were embedded. */
export function fontFaceCSS(keys: Iterable<string>) {
  let css = '';
  for (const key of keys) {
    const fc = FACES[key];
    if (!fc || !B64[key]) continue;
    const { f, sub, w, st } = fc;
    if (fc.local) {
      const [mime, fmt] = FMT[key] || ['font/ttf', 'truetype'];
      css += `@font-face{font-family:"${fc.local.family.replace(/"/g, '')}";font-style:${st};font-weight:${w};src:url(data:${mime};base64,${B64[key]}) format("${fmt}")}`;
    } else
      css += `@font-face{font-family:"${f.family}";font-style:${st};font-weight:${w};src:url(data:font/woff2;base64,${B64[key]}) format("woff2");unicode-range:${(f.ur && f.ur[sub]) || SUBSET_RANGES[sub]}}`;
  }
  return css;
}
const r2 = (v: number) => Math.round(v * 100) / 100;
/**
 * The text as one path in the layer's own space, or null when the fonts aren't loaded (or the text
 * is right-to-left). Handles alignment, letter spacing, line breaks and decoration lines.
 */
export function outlineD(G: Geometry): string | null {
  if (isRTL(G.text)) return null;
  const faces = facesFor(G);
  if (!faces.length || faces.some(fc => !OT[fc.key])) return null;
  const f = faces[0].f,
    size = G.size || 16,
    ls = G.ls || 0,
    lh = (G.lh || 1.2) * size,
    fontFor = (cp: number) => {
      const sub = f ? subsetOf(f, cp) : '',
        fc = faces.find(x => x.sub === sub) || faces[0];
      return OT[fc.key];
    },
    main = OT[faces[0].key],
    k = size / main.unitsPerEm,
    deco = String(G.deco || '').split(/\s+/),
    post = main.tables.post || {},
    os2 = main.tables.os2 || {},
    ax = anchorX(G);
  let d = '';
  textLines(G).forEach((line, li) => {
    const y = G.y + li * lh,
      glyphs: Array<{ font: any; g: any }> = [];
    for (const ch of line) {
      const font = fontFor(ch.codePointAt(0));
      glyphs.push({ font, g: font.charToGlyph(ch) });
    }
    // advance widths, with kerning inside the same font
    const adv = glyphs.map((q, i) => {
      const s = size / q.font.unitsPerEm,
        nx = glyphs[i + 1];
      let a = q.g.advanceWidth * s;
      if (nx && nx.font === q.font) a += q.font.getKerningValue(q.g, nx.g) * s;
      return a + (i < glyphs.length - 1 ? ls : 0);
    });
    const w = adv.reduce((s, v) => s + v, 0);
    let x = G.anchor === 'middle' ? ax - w / 2 : G.anchor === 'end' ? ax - w : ax;
    const x0 = x;
    glyphs.forEach((q, i) => {
      const pd = q.g.getPath(x, y, size).toPathData(2);
      if (pd) d += pd;
      x += adv[i];
    });
    const bar = (top: number, th: number) => {
      if (w > 0) d += `M${r2(x0)} ${r2(top)}h${r2(w)}v${r2(th)}h${r2(-w)}Z`;
    };
    const ut = (post.underlineThickness || main.unitsPerEm / 14) * k;
    if (deco.includes('underline')) bar(y - (post.underlinePosition || -main.unitsPerEm / 10) * k - ut / 2, ut);
    if (deco.includes('line-through'))
      bar(
        y - (os2.yStrikeoutPosition || main.unitsPerEm * 0.3) * k,
        (os2.yStrikeoutSize || post.underlineThickness || 50) * k,
      );
    if (deco.includes('overline')) bar(y - (main.ascender || main.unitsPerEm * 0.8) * k, ut);
  });
  return d || 'M0 0';
}
