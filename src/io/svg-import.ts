// SVGcinema — io/svg-import
import type { LayerType, PathData, PathNode } from '../model/types';
import { FONTS, NOFILL, NS } from '../core/constants';
import { beginEdit } from '../core/history';
import { S, blankDoc, doc, mkLayer, setDoc, setIdc, syncIdc } from '../core/state';
import { N } from '../geometry/nodes';
import { parsePath } from '../geometry/parse-path';
import { toast } from './open';
import { fit, frame } from '../render/stage';

export function parseStyle(s: unknown) {
  const o: Record<string, string> = {};
  String(s || '')
    .split(';')
    .forEach(p => {
      const i = p.indexOf(':');
      if (i > 0) o[p.slice(0, i).trim()] = p.slice(i + 1).trim();
    });
  return o;
}
export const PRES = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'fill-rule',
  'fill-opacity',
  'stroke-opacity',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-anchor',
  'letter-spacing',
];
export function importSVG(text: string, replace?: boolean, name?: string) {
  let dom;
  try {
    dom = new DOMParser().parseFromString(text, 'image/svg+xml');
  } catch (e) {
    dom = null;
  }
  const root = dom && dom.documentElement;
  if (!root || root.localName !== 'svg' || dom.getElementsByTagName('parsererror').length) {
    toast('That file is not valid SVG markup.');
    return false;
  }
  const ed = beginEdit();
  if (replace) {
    setDoc(blankDoc(640, 400));
    doc.bg = '';
    S.sel = null;
    S.selSet.clear();
    S.keys.clear();
    setIdc(0);
  }
  const had = doc.layers.length > 0;
  const vb = (root.getAttribute('viewBox') || '').split(/[\s,]+/).map(parseFloat),
    W = parseFloat(root.getAttribute('width')),
    Hh = parseFloat(root.getAttribute('height'));
  if (replace || !had) {
    if (vb.length === 4 && vb.every(isFinite)) {
      doc.vx = vb[0];
      doc.vy = vb[1];
      doc.w = vb[2];
      doc.h = vb[3];
    } else if (W && Hh) {
      doc.vx = doc.vy = 0;
      doc.w = W;
      doc.h = Hh;
    }
    if (replace) doc.name = name || root.getAttribute('id') || 'Imported artwork';
  }
  let rootPid = null,
    wrap = null;
  if (!replace && (had || name)) {
    wrap = mkLayer('group', name || 'Imported SVG', {}, NOFILL);
    doc.layers.push(wrap);
    rootPid = wrap.id;
    S.lexp[wrap.id] = true;
  }
  const ser = new XMLSerializer();
  let count = 0;
  const DEFS = [
    'defs',
    'style',
    'linearGradient',
    'radialGradient',
    'pattern',
    'filter',
    'clipPath',
    'mask',
    'symbol',
    'marker',
  ];
  const SKIP = ['title', 'desc', 'metadata', 'script', 'namedview', 'foreignObject'];
  function walk(node: Element, pid: string | null, inh: Record<string, string>) {
    for (const el of Array.from<any>(node.children)) {
      const tag = el.localName;
      if (SKIP.includes(tag) || el.namespaceURI !== NS) continue;
      if (DEFS.includes(tag)) {
        doc.defs = (doc.defs || '') + ser.serializeToString(el);
        continue;
      }
      if (tag === 'g') {
        const g = groupFromEl(el);
        g.parent = pid;
        doc.layers.push(g);
        count++;
        const st = parseStyle(el.getAttribute('style')),
          ni = Object.assign({}, inh);
        PRES.forEach(p => {
          const v = st[p] || el.getAttribute(p);
          if (v) ni[p] = v;
        });
        walk(el, g.id, ni);
        continue;
      }
      const l = elToLayer(el, inh, ser);
      if (l) {
        l.parent = pid;
        doc.layers.push(l);
        count++;
      }
    }
  }
  walk(root, rootPid, {});
  syncIdc();
  S.keys.clear();
  if (wrap) {
    S.sel = wrap.id;
    S.selSet = new Set<any>([wrap.id]);
  } else {
    S.sel = null;
    S.selSet.clear();
  }
  ed.end({ insp: true });
  fit();
  frame();
  toast(
    count
      ? `Imported ${count} layer${count > 1 ? 's' : ''}${wrap ? ` into “${wrap.name}”` : ''}.`
      : 'Nothing to import was found in that SVG.',
  );
  return true;
}
export function groupFromEl(el: Element) {
  const at: any = {};
  for (const a of Array.from<any>(el.attributes)) at[a.name] = a.value;
  const st = parseStyle(at.style),
    op = parseFloat(st.opacity != null ? st.opacity : at.opacity);
  const g = mkLayer(
    'group',
    at.id || at['inkscape:label'] || at['data-name'] || 'Group',
    {},
    Object.assign({}, NOFILL, { op: isFinite(op) ? op : 1 }),
  );
  g.xf = at.transform || '';
  const extra: any = {};
  for (const k in at) {
    if (['id', 'transform', 'opacity', 'style'].includes(k) || k.includes(':')) continue;
    extra[k] = at[k];
  }
  const rest = Object.keys(st)
    .filter(k => k !== 'opacity')
    .map(k => `${k}:${st[k]}`)
    .join(';');
  if (rest) extra.style = rest;
  g.extra = extra;
  return g;
}
export function elToLayer(el: Element, inh: Record<string, string>, ser: XMLSerializer) {
  const tag = el.localName,
    at: any = {};
  for (const a of Array.from<any>(el.attributes)) at[a.name] = a.value;
  const st = parseStyle(at.style);
  delete at.style;
  const pv = (n: string) => (st[n] != null ? st[n] : at[n] != null ? at[n] : inh[n]);
  const name = at.id || at['inkscape:label'] || at['data-name'] || tag;
  const used = new Set<any>(['id', 'style', 'fill', 'stroke', 'stroke-width', 'opacity', 'transform']);
  let type: LayerType | null = null,
    geo: any = {},
    d: PathData | null = null;
  const nf = (v: string) => parseFloat(v) || 0;
  if (tag === 'rect') {
    type = 'rect';
    geo = { x: nf(at.x), y: nf(at.y), w: nf(at.width), h: nf(at.height), rx: nf(at.rx || at.ry) };
    ['x', 'y', 'width', 'height', 'rx', 'ry'].forEach(k => used.add(k));
  } else if (tag === 'circle') {
    type = 'ellipse';
    geo = { cx: nf(at.cx), cy: nf(at.cy), rx: nf(at.r), ry: nf(at.r) };
    ['cx', 'cy', 'r'].forEach(k => used.add(k));
  } else if (tag === 'ellipse') {
    type = 'ellipse';
    geo = { cx: nf(at.cx), cy: nf(at.cy), rx: nf(at.rx), ry: nf(at.ry) };
    ['cx', 'cy', 'rx', 'ry'].forEach(k => used.add(k));
  } else if (tag === 'path') {
    type = 'path';
    d = parsePath(at.d);
    used.add('d');
    if (!d.length) return null;
  } else if (tag === 'line') {
    type = 'path';
    d = [{ c: false, n: [N(nf(at.x1), nf(at.y1)), N(nf(at.x2), nf(at.y2))] }];
    ['x1', 'y1', 'x2', 'y2'].forEach(k => used.add(k));
  } else if (tag === 'polygon' || tag === 'polyline') {
    type = 'path';
    const v = (at.points || '')
      .trim()
      .split(/[\s,]+/)
      .map(parseFloat);
    const n: PathNode[] = [];
    for (let i = 0; i + 1 < v.length; i += 2) n.push(N(v[i], v[i + 1]));
    if (n.length < 2) return null;
    d = [{ c: tag === 'polygon', n }];
    used.add('points');
  } else if (tag === 'text' && !el.children.length) {
    type = 'text';
    geo = {
      x: nf(at.x),
      y: nf(at.y),
      text: el.textContent,
      size: parseFloat(pv('font-size')) || 16,
      family: pv('font-family') || FONTS[0][0],
      weight: String(pv('font-weight') || '400'),
      anchor: pv('text-anchor') || 'start',
    };
    ['x', 'y', 'font-size', 'font-family', 'font-weight', 'text-anchor'].forEach(k => used.add(k));
  }
  if (!type) return mkLayer('raw', name, { markup: ser.serializeToString(el) }, NOFILL);
  const stroke = pv('stroke') || 'none',
    op = parseFloat(st.opacity != null ? st.opacity : at.opacity);
  const b: any = {
    fill: pv('fill') || (tag === 'line' ? 'none' : '#000000'),
    stk: stroke,
    sw: parseFloat(pv('stroke-width')) || (stroke !== 'none' ? 1 : 0),
    op: isFinite(op) ? op : 1,
  };
  if (d) b.d = d;
  const l = mkLayer(type, name, geo, b);
  l.xf = at.transform || '';
  const extra: any = {};
  for (const k in at) {
    if (used.has(k) || k.includes(':')) continue;
    extra[k] = at[k];
  }
  const restStyle = Object.keys(st)
    .filter(
      k =>
        ![
          'fill',
          'stroke',
          'stroke-width',
          'opacity',
          'font-size',
          'font-family',
          'font-weight',
          'text-anchor',
        ].includes(k),
    )
    .map(k => `${k}:${st[k]}`)
    .join(';');
  if (restStyle) extra.style = restStyle;
  l.extra = extra;
  return l;
}
