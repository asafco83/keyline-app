// Keyline — ui/align
// Align / distribute bar at the top of the inspector, and "Set motion path" (turn a path into position keyframes).
// One selected layer aligns to the canvas; several align to the box around the selection.
import type { Keyframe, Layer, Vec2 } from '../model/types';
import { byId, clone, esc, ic, r2, r3, valueAt, xfp } from '../core/constants';
import { beginEdit, setProp } from '../core/history';
import { S, doc, layerById } from '../core/state';
import { parentMatrix, selectedRoots } from '../model/tree';
import { boxOf, localMatrix } from '../render/overlay';

type Box = { x: number; y: number; w: number; h: number };
export const ALIGN: Array<[string, string, string]> = [
  [
    'left',
    'Align left',
    '<path d="M4 3v18"/><rect x="7" y="6" width="12" height="4" rx="1"/><rect x="7" y="14" width="7" height="4" rx="1"/>',
  ],
  [
    'hcenter',
    'Align horizontal centers',
    '<path d="M12 3v18"/><rect x="5" y="6" width="14" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/>',
  ],
  [
    'right',
    'Align right',
    '<path d="M20 3v18"/><rect x="5" y="6" width="12" height="4" rx="1"/><rect x="10" y="14" width="7" height="4" rx="1"/>',
  ],
  [
    'top',
    'Align top',
    '<path d="M3 4h18"/><rect x="6" y="7" width="4" height="12" rx="1"/><rect x="14" y="7" width="4" height="7" rx="1"/>',
  ],
  [
    'vcenter',
    'Align vertical centers',
    '<path d="M3 12h18"/><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/>',
  ],
  [
    'bottom',
    'Align bottom',
    '<path d="M3 20h18"/><rect x="6" y="5" width="4" height="12" rx="1"/><rect x="14" y="10" width="4" height="7" rx="1"/>',
  ],
  ['disth', 'Distribute horizontally', '<path d="M3 4v16M21 4v16"/><rect x="9" y="7" width="6" height="10" rx="1"/>'],
  ['distv', 'Distribute vertically', '<path d="M4 3h16M4 21h16"/><rect x="7" y="9" width="10" height="6" rx="1"/>'],
];
function targets() {
  return selectedRoots().filter(l => !l.lock && byId('e-' + l.id + '-s'));
}
export function alignBar() {
  const n = targets().length;
  return `<div class="align-bar" role="toolbar" aria-label="Align and distribute">${ALIGN.map(([k, label, p]) => {
    const dist = k.startsWith('dist'),
      off = n === 0 || (dist && n < 3),
      t = dist
        ? label + (off ? ' (select 3 or more layers)' : '')
        : label + (n > 1 ? ' (to selection)' : ' (to canvas)');
    return `<button class="btn ib" data-align="${k}" title="${t}" aria-label="${t}"${off ? ' disabled' : ''}>${ic(p)}</button>`;
  }).join('')}</div>`;
}
/** Move a layer by a delta given in document units. */
function nudge(l: Layer, dx: number, dy: number) {
  if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) return;
  const PMi = parentMatrix(l).inverse(),
    a = xfp(PMi, 0, 0),
    b = xfp(PMi, dx, dy),
    p = valueAt(l, 'pos', S.time) || [0, 0];
  setProp(l, 'pos', [r2(p[0] + b.x - a.x), r2(p[1] + b.y - a.y)]);
}
export function align(kind: string) {
  const ls = targets();
  if (!ls.length) return;
  const boxes = ls.map(l => boxOf(l) as Box);
  const ed = beginEdit();
  if (kind === 'disth' || kind === 'distv') {
    if (ls.length < 3) return ed.end();
    const h = kind === 'disth',
      order = ls.map((l, i) => ({ l, b: boxes[i] })).sort((p, q) => (h ? p.b.x - q.b.x : p.b.y - q.b.y)),
      first = order[0].b,
      last = order[order.length - 1].b,
      span = h ? last.x + last.w - first.x : last.y + last.h - first.y,
      total = order.reduce((s, o) => s + (h ? o.b.w : o.b.h), 0),
      gap = (span - total) / (order.length - 1);
    let at = h ? first.x : first.y;
    order.forEach(o => {
      const cur = h ? o.b.x : o.b.y;
      nudge(o.l, h ? at - cur : 0, h ? 0 : at - cur);
      at += (h ? o.b.w : o.b.h) + gap;
    });
    return ed.end({ insp: true });
  }
  let T: Box;
  if (ls.length === 1) T = { x: 0, y: 0, w: doc.w, h: doc.h };
  else {
    const x0 = Math.min(...boxes.map(b => b.x)),
      y0 = Math.min(...boxes.map(b => b.y)),
      x1 = Math.max(...boxes.map(b => b.x + b.w)),
      y1 = Math.max(...boxes.map(b => b.y + b.h));
    T = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  ls.forEach((l, i) => {
    const b = boxes[i];
    let dx = 0,
      dy = 0;
    if (kind === 'left') dx = T.x - b.x;
    else if (kind === 'hcenter') dx = T.x + T.w / 2 - (b.x + b.w / 2);
    else if (kind === 'right') dx = T.x + T.w - (b.x + b.w);
    else if (kind === 'top') dy = T.y - b.y;
    else if (kind === 'vcenter') dy = T.y + T.h / 2 - (b.y + b.h / 2);
    else if (kind === 'bottom') dy = T.y + T.h - (b.y + b.h);
    nudge(l, dx, dy);
  });
  ed.end({ insp: true });
}

/* ---------- Set motion path ---------- */

const PATHLIKE = ['path', 'rect', 'ellipse'];
export function motionPick(l: Layer) {
  const paths = doc.layers.filter(o => o !== l && PATHLIKE.includes(o.type));
  if (!paths.length) return '';
  return `<div class="row nk"><span class="rl">Motion</span><div class="rf"><select class="sel" id="motionPath" aria-label="Set motion path"><option value="">Set motion path…</option>${paths.map(o => `<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select></div></div>`;
}
/** Points along a shape, evenly spaced by length, in the moving layer's parent space. */
export function samplePath(src: Layer, l: Layer, n?: number): Vec2[] {
  const el = byId('e-' + src.id + '-s') as unknown as SVGGeometryElement;
  if (!el || typeof el.getTotalLength !== 'function') return [];
  const len = el.getTotalLength();
  if (!(len > 0)) return [];
  const count = n || Math.max(8, Math.min(40, Math.round(len / 30))),
    M = parentMatrix(l).inverse().multiply(localMatrix(src)),
    out: Vec2[] = [];
  for (let i = 0; i <= count; i++) {
    const p = el.getPointAtLength((len * i) / count),
      q = xfp(M, p.x, p.y);
    out.push([r2(q.x), r2(q.y)]);
  }
  return out;
}
/** Replace the layer's position track with keyframes that follow the shape over the whole animation. */
export function setMotionPath(l: Layer, srcId: string) {
  const src = layerById(srcId);
  if (!src) return false;
  const pts = samplePath(src, l);
  if (pts.length < 2) return false;
  const ed = beginEdit(),
    n = pts.length - 1;
  l.t.pos = pts.map((p, i): Keyframe => [r3((doc.dur * i) / n), clone(p), 'linear']);
  l.sm = true;
  S.exp[l.id] = true;
  ed.end({ insp: true });
  return true;
}
