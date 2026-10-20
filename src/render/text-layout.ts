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
/** The lines to draw. Wrapping breaks at spaces, and inside words that are longer than the box. */
export function textLines(G: Geometry): string[] {
  const paras = String(G.text == null ? '' : G.text).split(/\r?\n/);
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
  return G.x + (G.anchor === 'middle' ? G.ww / 2 : G.anchor === 'end' ? G.ww : 0);
}
