// Keyline — model/tree
import type { Layer } from './types';
import { H, byId, r2, xfp } from '../core/constants';
import { CONTENT } from '../core/dom';
import { S, doc, layerById } from '../core/state';

export function pidOf(l: Layer) {
  return l.parent || null;
}
export function isBox(l: Layer) {
  return l && (l.type === 'group' || l.type === 'bone');
}
export function kids(pid: string | null, list?: Layer[]): Layer[] {
  return (list || doc.layers).filter(l => pidOf(l) === pid);
}
export type TreeRow = [layer: Layer, depth: number];
export function treeRows(pid?: string | null, depth?: number, out?: TreeRow[], collapse?: boolean): TreeRow[] {
  pid = pid || null;
  depth = depth || 0;
  out = out || [];
  const k = kids(pid);
  for (let i = k.length - 1; i >= 0; i--) {
    const l = k[i];
    out.push([l, depth]);
    if (isBox(l) && !(collapse && S.lexp[l.id] === false)) treeRows(l.id, depth + 1, out, collapse);
  }
  return out;
}
export function descendants(l: Layer, out?: Layer[]): Layer[] {
  out = out || [];
  kids(l.id).forEach(c => {
    out.push(c);
    descendants(c, out);
  });
  return out;
}
export function ancestors(l: Layer): Layer[] {
  const a: Layer[] = [];
  let p = l.parent && layerById(l.parent),
    g = 0;
  while (p && g++ < 100) {
    a.push(p);
    p = p.parent && layerById(p.parent);
  }
  return a;
}
export function isHidden(l: Layer) {
  return l.hid || ancestors(l).some(a => a.hid);
}
export function isLocked(l: Layer) {
  return l.lock || ancestors(l).some(a => a.lock);
}
export function isAnim(l: Layer) {
  return Object.keys(l.t).some(k => l.t[k] && l.t[k].length);
}
/** Has tracks to show in the timeline, frozen ones included. */
export function hasTracks(l: Layer) {
  return isAnim(l) || (!!l.ft && Object.keys(l.ft).some(k => l.ft[k] && l.ft[k].length));
}
export function visibleLayers() {
  return doc.layers.filter(l => !isHidden(l));
}
export function selectedRoots() {
  return treeRows()
    .map(r => r[0])
    .filter(l => S.selSet.has(l.id) && !ancestors(l).some(a => S.selSet.has(a.id)));
}
export function pmOf(pid: string | null): DOMMatrix {
  if (!pid) return new DOMMatrix();
  const p = byId('e-' + pid + '-s');
  if (!p) return new DOMMatrix();
  return CONTENT.getScreenCTM().inverse().multiply(p.getScreenCTM());
}
export function parentMatrix(l: Layer): DOMMatrix {
  return pmOf(pidOf(l));
}
export function reparentKeep(l: Layer, newPM: DOMMatrix) {
  const c = H.comp(l, S.time),
    d = xfp(parentMatrix(l), c.x, c.y),
    n = xfp(newPM.inverse(), d.x, d.y),
    dx = n.x - c.x,
    dy = n.y - c.y;
  if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) return;
  if (l.t.pos && l.t.pos.length) l.t.pos.forEach(q => (q[1] = [r2(q[1][0] + dx), r2(q[1][1] + dy)]));
  else l.b.pos = [r2(l.b.pos[0] + dx), r2(l.b.pos[1] + dy)];
}
