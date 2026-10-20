// Keyline — tools/shapes
// Ellipse (O), Rectangle (M), Polygon, Star, Line (L).
// Drag to draw. Shift constrains (square, circle, upright polygon/star, 45° line), Alt draws from the
// centre. While dragging a polygon or star, ↑/↓ change the number of sides or points.
// A click without a drag places a default-size shape.
import type { Layer, XY } from '../model/types';
import { $, HINTS, hintHTML, r2 } from '../core/constants';
import { WRAP } from '../core/dom';
import { beginEdit } from '../core/history';
import { S, doc, mkLayer, nextColor } from '../core/state';
import { N, type ShapeParams, inferShape, shapeD, snap45 } from '../geometry/nodes';

/** Give a path layer polygon / star settings and the path they produce. */
export function setShape(l: Layer, p: ShapeParams) {
  const d = shapeD(p);
  l.b.d = d;
  l.shape = { ...p, sig: JSON.stringify(d) };
}
/** The layer's polygon / star settings, while its path is still the one they produced. */
export function liveShape(l: Layer) {
  if (l.type !== 'path' || (l.t.d && l.t.d.length)) return null;
  const s = l.shape;
  if (s && s.sig === JSON.stringify(l.b.d)) return s;
  // older polygons and stars: recognise them from their points (a star's start point may differ, so
  // the path is only rewritten once a setting changes)
  const inf = inferShape(l.b.d);
  // remember what was recognised (tied to the current path), so it can be keyed like any shape
  if (inf) l.shape = { ...inf, sig: JSON.stringify(l.b.d) };
  return inf;
}
/** A two-point open path: shown with From / To. */
export function isLine(l: Layer) {
  const d = l.type === 'path' && l.b.d;
  return !!d && d.length === 1 && !d[0].c && d[0].n.length === 2;
}
import { frame, renderStage } from '../render/stage';
import { renderTools } from '../ui/tools-rail';

export const SHAPE_TOOLS = ['ellipse', 'rect', 'polygon', 'star', 'line'];
const NAMES: Record<string, string> = {
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  polygon: 'Polygon',
  star: 'Star',
  line: 'Line',
};

export function addLayer(l: Layer) {
  doc.layers.push(l);
  S.sel = l.id;
  S.selSet = new Set<string>([l.id]);
}
export function backToSelect() {
  S.tool = 'select';
  WRAP.className = 't-select';
  WRAP.style.cursor = '';
  $('#hint').innerHTML = hintHTML(HINTS.select);
  renderTools();
}
export function newShape(t: string) {
  const col = nextColor(),
    base = NAMES[t] || 'Shape',
    n = doc.layers.filter(l => l.name.startsWith(base)).length + 1,
    name = base + ' ' + n;
  if (t === 'rect') return mkLayer('rect', name, { x: 0, y: 0, w: 0, h: 0, rx: 0 }, { fill: col });
  if (t === 'ellipse') return mkLayer('ellipse', name, { cx: 0, cy: 0, rx: 0, ry: 0 }, { fill: col });
  if (t === 'line') {
    const l = mkLayer('path', name, {}, { fill: 'none', stk: col, sw: 4, d: [] });
    l.extra = { 'stroke-linecap': 'round' };
    return l;
  }
  return mkLayer('path', name, {}, { fill: col, d: [] });
}
interface ShapeOpts {
  shift: boolean;
  alt: boolean;
}
/** Write the geometry for a drag from p0 to p. */
export function setGeo(l: Layer, t: string, p0: XY, p: XY, o: ShapeOpts) {
  if (t === 'rect' || t === 'ellipse') {
    let w = Math.abs(p.x - p0.x),
      h = Math.abs(p.y - p0.y);
    if (o.shift) w = h = Math.max(w, h);
    let x: number, y: number;
    if (o.alt) {
      x = p0.x - w;
      y = p0.y - h;
      w *= 2;
      h *= 2;
    } else {
      x = p.x < p0.x ? p0.x - w : p0.x;
      y = p.y < p0.y ? p0.y - h : p0.y;
    }
    if (t === 'rect') Object.assign(l.geo, { x: r2(x), y: r2(y), w: r2(w), h: r2(h) });
    else Object.assign(l.geo, { cx: r2(x + w / 2), cy: r2(y + h / 2), rx: r2(w / 2), ry: r2(h / 2) });
    return;
  }
  if (t === 'line') {
    let b: number[] = [p.x, p.y];
    if (o.shift) b = snap45([p0.x, p0.y], b);
    const a = o.alt ? [2 * p0.x - b[0], 2 * p0.y - b[1]] : [p0.x, p0.y];
    l.b.d = [{ c: false, n: [N(r2(a[0]), r2(a[1])), N(r2(b[0]), r2(b[1]))] }];
    return;
  }
  // polygon and star are drawn from the centre; the drag direction sets the rotation
  const R = Math.max(2, Math.hypot(p.x - p0.x, p.y - p0.y)),
    rot = o.shift ? 0 : (Math.atan2(p.y - p0.y, p.x - p0.x) * 180) / Math.PI + 90;
  setShape(l, {
    kind: t === 'polygon' ? 'polygon' : 'star',
    cx: r2(p0.x),
    cy: r2(p0.y),
    r: r2(R),
    rot: r2(rot),
    n: t === 'polygon' ? S.polySides : S.starPoints,
    ...(t === 'star' ? { ratio: S.starRatio || 0.45 } : {}),
    rad: (l.shape && l.shape.rad) || 0,
  });
}
export function createDrag(t: string, p0: XY) {
  const ed = beginEdit();
  let l: Layer | null = null,
    last: XY = p0,
    opts: ShapeOpts = { shift: false, alt: false };
  const redraw = () => {
    if (!l) return;
    setGeo(l, t, p0, last, opts);
    l.o = null;
    renderStage();
    frame();
  };
  S.drag = {
    move(p, e) {
      last = p;
      opts = { shift: e.shiftKey, alt: e.altKey };
      if (!l && Math.hypot(p.x - p0.x, p.y - p0.y) * S.scale < 3) return;
      if (!l) {
        l = newShape(t);
        addLayer(l);
      }
      redraw();
    },
    key(k) {
      if ((t !== 'polygon' && t !== 'star') || (k !== 'ArrowUp' && k !== 'ArrowDown')) return false;
      const d = k === 'ArrowUp' ? 1 : -1;
      if (t === 'polygon') S.polySides = Math.min(24, Math.max(3, S.polySides + d));
      else S.starPoints = Math.min(24, Math.max(3, S.starPoints + d));
      S.drag.lbl = t === 'polygon' ? `${S.polySides} sides` : `${S.starPoints} points`;
      S.drag.lp = last;
      redraw();
      return true;
    },
    up() {
      if (!l) {
        if (t === 'line') {
          ed.end();
          return;
        }
        l = newShape(t);
        addLayer(l);
        const r = 50;
        if (t === 'rect' || t === 'ellipse')
          setGeo(l, t, p0, { x: p0.x + r, y: p0.y + r }, { shift: false, alt: true });
        else setGeo(l, t, p0, { x: p0.x, y: p0.y - r }, { shift: true, alt: false });
      }
      l.o = null;
      ed.end({ insp: true });
    },
  };
}
