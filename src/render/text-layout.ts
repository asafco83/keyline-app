// SVGcinema — render/text-layout
// Breaks text into lines: on newlines, and (with "Keep width") wherever a line would pass the box width.
// SVG text does not wrap by itself, so the lines are written out as <tspan>s, in the editor and the export alike.
import type { Geometry } from '../model/types';

let ctx: CanvasRenderingContext2D | null | undefined;
function canvas() {
  if (ctx === undefined) {
    try {
      ctx = document.createElement('canvas').getContext('2d');
    } catch (_) {
      ctx = null;
    }
  }
  return ctx;
}
export function fontCSS(G: Geometry) {
  return `${G.italic ? 'italic ' : ''}${G.weight || 400} ${G.size || 16}px ${G.family || 'sans-serif'}`;
}
/** Width of a run of text in px (letter spacing included). */
export function textWidth(s: string, G: Geometry) {
  const c = canvas(),
    ls = (G.ls || 0) * Math.max(0, s.length - 1);
  if (c) {
    c.font = fontCSS(G);
    return c.measureText(s).width + ls;
  }
  return s.length * (G.size || 16) * 0.55 + ls;
}
/** right-to-left letters: Hebrew, Arabic, Syriac, Thaana, N'Ko and their presentation forms */
const RTL_CH = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/;
/**
 * The text's direction: the layer's own setting, else (automatic) the direction of its first letter,
 * as HTML's dir="auto" does. Right-to-left text is written with direction="rtl", so its start is on
 * the right: text-anchor and the Align buttons follow that.
 */
export function textDir(G: Geometry): 'ltr' | 'rtl' {
  if (G.dir === 'rtl' || G.dir === 'ltr') return G.dir;
  const m = /\p{L}/u.exec(String(G.text || ''));
  return m && RTL_CH.test(m[0]) ? 'rtl' : 'ltr';
}
/** The anchor as seen on screen: 'start' = left. (`G.anchor` is logical: in right-to-left text the
 *  start is on the right.) */
export function visualAnchor(G: Geometry): 'start' | 'middle' | 'end' {
  const a = G.anchor === 'middle' || G.anchor === 'end' ? G.anchor : 'start';
  if (textDir(G) !== 'rtl' || a === 'middle') return a;
  return a === 'start' ? 'end' : 'start';
}
/** The text with its letter case applied: 'upper', 'lower' or 'title' (each word capitalised). */
export function caseText(s: string, c?: string) {
  if (c === 'upper') return s.toLocaleUpperCase();
  if (c === 'lower') return s.toLocaleLowerCase();
  if (c === 'title') return s.replace(/(^|[^\p{L}\p{M}'’])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase());
  return s;
}
/** The lines to draw. Wrapping breaks at spaces, and inside words that are longer than the box. */
export function textLines(G: Geometry): string[] {
  const paras = caseText(String(G.text == null ? '' : G.text), G.tcase).split(/\r?\n/);
  if (!G.wrap || !(G.ww > 0)) return paras;
  const W = G.ww,
    out: string[] = [];
  // a run wider than the box is cut by characters
  const fit = (run: string) => {
    let r = run;
    while (r.length > 1 && textWidth(r, G) > W) {
      let k = r.length - 1;
      while (k > 1 && textWidth(r.slice(0, k), G) > W) k--;
      out.push(r.slice(0, k));
      r = r.slice(k);
    }
    out.push(r);
  };
  for (const p of paras) {
    let line = '';
    for (const w of p.split(/(\s+)/)) {
      const next = line + w;
      if (!line.trim() || textWidth(next.trimEnd(), G) <= W) line = next;
      else {
        fit(line.trimEnd());
        line = /^\s+$/.test(w) ? '' : w;
      }
    }
    fit(line.trimEnd());
  }
  return out;
}
/** x of the text anchor: with a fixed box, centred / right-aligned text sits inside the box. */
export function anchorX(G: Geometry) {
  if (!G.wrap || !(G.ww > 0)) return G.x;
  const a = visualAnchor(G);
  return G.x + (a === 'middle' ? G.ww / 2 : a === 'end' ? G.ww : 0);
}

const MIRROR: Record<string, string> = {
  '(': ')',
  ')': '(',
  '[': ']',
  ']': '[',
  '{': '}',
  '}': '{',
  '<': '>',
  '>': '<',
  '«': '»',
  '»': '«',
};
/**
 * One line of text in the order its letters sit on screen, left to right, for drawing glyphs one by
 * one (outlines). A small form of the Unicode bidi rules that covers right-to-left scripts without
 * joined letters (Hebrew): right-to-left runs are reversed (brackets mirrored), numbers and
 * left-to-right words keep their order, and in a right-to-left line the runs go from right to left.
 * Marks (Hebrew points) stay with their letter.
 */
export function visualLine(line: string, rtl: boolean): string {
  const cl = line.match(/\P{M}\p{M}*/gu) || [];
  const type = (c: string) => (RTL_CH.test(c) ? 'R' : /[\p{L}\p{N}]/u.test(c) ? 'L' : 'N');
  const ty = cl.map(type);
  // neutrals between two runs of the same direction take it, others the line's direction
  for (let i = 0; i < ty.length; i++) {
    if (ty[i] !== 'N') continue;
    let j = i;
    while (j < ty.length && ty[j] === 'N') j++;
    const a = i > 0 ? ty[i - 1] : null,
      b = j < ty.length ? ty[j] : null,
      t = a && a === b ? a : rtl ? 'R' : 'L';
    for (let k = i; k < j; k++) ty[k] = t;
    i = j - 1;
  }
  const runs: Array<{ r: boolean; s: string[] }> = [];
  cl.forEach((c, i) => {
    const r = ty[i] === 'R',
      last = runs[runs.length - 1];
    if (last && last.r === r) last.s.push(c);
    else runs.push({ r, s: [c] });
  });
  runs.forEach(run => {
    if (run.r) run.s = run.s.reverse().map(c => MIRROR[c] || c);
  });
  if (rtl) runs.reverse();
  return runs.map(run => run.s.join('')).join('');
}
