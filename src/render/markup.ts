// Keyline — render/markup
import { filterSVG } from '../model/filters';
import { anchorX, textLines } from './text-layout';
import { ensureFaces, facesFor, familyCSS, isLocalFamily, outlineD, webFont } from './fonts';
import type { Composite } from '../runtime/engine';
import type { Layer } from '../model/types';
import { H, esc, r3 } from '../core/constants';
import { isBox, kids } from '../model/tree';

/** How markup is produced: for the editor canvas or for an exported file. */
export interface MarkupCtx {
  /** element id prefix */
  pre: string;
  /** seconds */
  t: number;
  editor?: boolean;
  /** editor: asset id → URL */
  href?: (id: string) => string;
  /** export: asset id → symbol id (or empty to skip) */
  useImg?: (id: string) => string | null | undefined;
  /** export: how web fonts are written (outlines, or text with an embedded font) */
  fonts?: 'outline' | 'embed';
  /** export: font faces that need embedding (filled while writing markup) */
  faces?: Set<string>;
}
export function attrs(o: Record<string, unknown>) {
  let s = '';
  for (const k in o) {
    const v = o[k];
    if (v == null || v === '') continue;
    s += ` ${k}="${esc(v)}"`;
  }
  return s;
}
export function tfStr(c: Composite) {
  const sk = (c.kx ? ` skewX(${r3(c.kx)})` : '') + (c.ky ? ` skewY(${r3(c.ky)})` : '');
  return `translate(${r3(c.x)},${r3(c.y)}) rotate(${r3(c.r)})${sk} scale(${r3(c.sx)},${r3(c.sy)}) translate(${r3(-c.ox)},${r3(-c.oy)})`;
}
export function layerSVG(l: Layer, ctx: MarkupCtx, c: Composite, children?: string) {
  const id = ctx.pre + l.id,
    G = l.geo;
  const a: Record<string, any> = Object.assign({}, l.extra || {});
  a.id = id + '-s';
  if (l.xf) a.transform = l.xf;
  if (c.fill != null) a.fill = c.fill;
  if (c.stk != null) a.stroke = c.stk;
  if (c.sw != null && (c.sw > 0 || (l.t.sw && l.t.sw.length))) a['stroke-width'] = r3(c.sw);
  if (c.draw != null && (c.draw < 100 || (l.t.draw && l.t.draw.length))) {
    a.pathLength = 100;
    a['stroke-dasharray'] = '100 100';
    a['stroke-dashoffset'] = r3(100 - c.draw);
  } else if (c.dof != null && (c.dof !== 0 || (l.t.dof && l.t.dof.length))) a['stroke-dashoffset'] = r3(c.dof);
  if (c.fo != null && (c.fo < 1 || (l.t.fo && l.t.fo.length))) a['fill-opacity'] = r3(c.fo);
  if (c.so != null && (c.so < 1 || (l.t.so && l.t.so.length))) a['stroke-opacity'] = r3(c.so);
  const css = [l.blend && l.blend !== 'normal' ? `mix-blend-mode:${l.blend}` : '', l.iso ? 'isolation:isolate' : '']
    .filter(Boolean)
    .join(';');
  if (css) a.style = a.style ? a.style.replace(/;?\s*$/, ';') + css : css;
  const fx = filterSVG(l, ctx.pre, k => H.get(l, k, ctx.t));
  if (fx) a.filter = `url(#${id}-fx)`;
  let inner: string;
  if (l.type === 'rect') {
    Object.assign(a, { x: G.x, y: G.y, width: G.w, height: G.h });
    const rx = c.rad != null ? r3(Math.max(0, c.rad)) : G.rx;
    if (rx) a.rx = rx;
    inner = `<rect${attrs(a)}/>`;
  } else if (l.type === 'ellipse') {
    Object.assign(a, { cx: G.cx, cy: G.cy, rx: G.rx, ry: G.ry });
    inner = `<ellipse${attrs(a)}/>`;
  } else if (l.type === 'path') {
    a.d = H.dstr(c.d);
    inner = `<path${attrs(a)}/>`;
  } else if (l.type === 'text') {
    const lines = textLines(G),
      ax = anchorX(G);
    Object.assign(a, {
      x: ax,
      y: G.y,
      'font-size': G.size,
      'font-family': familyCSS(G.family),
      'font-weight': G.weight,
      'font-style': G.italic ? 'italic' : null,
      'text-decoration': G.deco || null,
      'letter-spacing': G.ls ? r3(G.ls) : null,
      'text-anchor': G.anchor,
    });
    const lh = r3((G.lh || 1.2) * (G.size || 16)),
      wf = webFont(G.family) || isLocalFamily(G.family),
      od = wf && !ctx.editor && ctx.fonts === 'outline' ? outlineD(G) : null;
    if (wf && ctx.editor) ensureFaces(G);
    if (wf && !ctx.editor && !od && ctx.faces) facesFor(G).forEach(fc => ctx.faces.add(fc.key));
    if (od) {
      [
        'x',
        'y',
        'font-size',
        'font-family',
        'font-weight',
        'font-style',
        'text-decoration',
        'letter-spacing',
        'text-anchor',
      ].forEach(k => delete a[k]);
      a.d = od;
    }
    inner = od
      ? `<path${attrs(a)}/>`
      : lines.length === 1
        ? `<text${attrs(a)}>${esc(lines[0])}</text>`
        : `<text${attrs(a)}>${lines.map((s, i) => `<tspan x="${r3(ax)}"${i ? ` dy="${lh}"` : ''}>${esc(s) || ' '}</tspan>`).join('')}</text>`;
    // editor: a fixed-width text box is selectable (and measured) across its whole width
    if (ctx.editor && G.wrap && G.ww > 0) {
      const sz = G.size || 16;
      inner =
        `<rect class="kl-tbox" x="${r3(G.x)}" y="${r3(G.y - sz * 0.8 - (lh - sz) / 2)}" width="${r3(G.ww)}" height="${r3(Math.max(1, lines.length) * lh)}" fill="transparent"/>` +
        inner;
    }
  } else if (l.type === 'image') {
    Object.assign(a, { x: G.x, y: G.y, width: G.w, height: G.h });
    if (ctx.editor) {
      a.href = ctx.href(G.asset);
      a.preserveAspectRatio = 'none';
      inner = `<image${attrs(a)}/>`;
    } else {
      const sym = ctx.useImg(G.asset);
      inner = sym ? `<use${attrs(Object.assign(a, { href: '#' + sym }))}/>` : '';
    }
  } else if (isBox(l)) inner = `<g${attrs(a)}>${children || ''}</g>`;
  else inner = `<g${attrs(a)}>${G.markup || ''}</g>`;
  return `<g id="${id}" transform="${tfStr(c)}" opacity="${r3(c.op)}"${ctx.editor ? ` data-lid="${l.id}"` : ''}>${fx}${inner}</g>`;
}
export function markup(list: Layer[], pid: string | null, ctx: MarkupCtx): string {
  return kids(pid, list)
    .filter(l => !l.hid)
    .map(l => layerSVG(l, ctx, H.comp(l, ctx.t), isBox(l) ? markup(list, l.id, ctx) : ''))
    .join('');
}
