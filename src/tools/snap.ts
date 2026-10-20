// Keyline — tools/snap
// Snapping while drawing and moving: to other objects (edges and centres of their boxes, and the
// canvas), to points (path nodes), to guides, to the grid and to whole pixels. Each option can be
// switched off; Enable snapping (Alt+S) switches them all. Matches are shown as magenta lines.
import type { Layer, PathData } from '../model/types';
import { H, xfp } from '../core/constants';
import { S, doc } from '../core/state';
import { VIEW } from '../core/view';
import { ellNodes, rectNodes } from '../geometry/nodes';
import { isHidden } from '../model/tree';
import { boxOf, localMatrix } from '../render/overlay';

export interface Targets {
  x: number[];
  y: number[];
  /** path nodes, for point snapping */
  pts: Array<[number, number]>;
}
const tol = () => 6 / (S.scale || 1);

/** What can be snapped to, leaving out the layers being moved. */
export function snapTargets(exclude?: Set<string> | true): Targets {
  const T: Targets = { x: [], y: [], pts: [] },
    ex = exclude instanceof Set ? exclude : new Set<string>();
  if (!VIEW.snap) return T;
  if (VIEW.sObjects) {
    T.x.push(0, doc.w / 2, doc.w);
    T.y.push(0, doc.h / 2, doc.h);
  }
  for (const l of doc.layers) {
    if (ex.has(l.id) || isHidden(l) || l.type === 'group' || l.type === 'bone') continue;
    if (VIEW.sObjects) {
      const b = boxOf(l);
      if (b && (b.w || b.h)) {
        T.x.push(b.x, b.x + b.w / 2, b.x + b.w);
        T.y.push(b.y, b.y + b.h / 2, b.y + b.h);
      }
    }
    if (VIEW.sPoints && ['path', 'rect', 'ellipse'].includes(l.type) && document.getElementById('e-' + l.id + '-s')) {
      const d: PathData =
        l.type === 'rect' ? rectNodes(l.geo) : l.type === 'ellipse' ? ellNodes(l.geo) : H.comp(l, S.time).d || [];
      let M: DOMMatrix;
      try {
        M = localMatrix(l);
      } catch (_) {
        continue;
      }
      d.forEach(sp =>
        sp.n.forEach(q => {
          const p = xfp(M, q[0], q[1]);
          T.pts.push([p.x, p.y]);
        }),
      );
    }
  }
  if (VIEW.sGuides && VIEW.guides && doc.guides) {
    T.x.push(...doc.guides.x);
    T.y.push(...doc.guides.y);
  }
  return T;
}
function nearest(v: number, list: number[], t: number) {
  let best: number | null = null,
    bd = t;
  for (const c of list) {
    const d = Math.abs(c - v);
    if (d <= bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}
function gridSnap(v: number, t: number) {
  const g = VIEW.grid,
    s = Math.round(v / g) * g;
  return Math.abs(s - v) <= t ? s : null;
}
/** Snap a point (drawing, nodes, handles). Returns the snapped point; sets the lines to draw. */
export function snapPoint(p: { x: number; y: number }, T: Targets): { x: number; y: number } {
  if (!VIEW.snap) return p;
  const t = tol();
  let x = p.x,
    y = p.y,
    lx: number | null = null,
    ly: number | null = null;
  // a node first: both axes at once
  if (VIEW.sPoints) {
    let bd = t,
      hit: [number, number] | null = null;
    for (const q of T.pts) {
      const d = Math.hypot(q[0] - p.x, q[1] - p.y);
      if (d <= bd) {
        bd = d;
        hit = q;
      }
    }
    if (hit) {
      S.snapLines = { x: [hit[0]], y: [hit[1]] };
      return { x: hit[0], y: hit[1] };
    }
  }
  const sx = nearest(p.x, T.x, t),
    sy = nearest(p.y, T.y, t);
  if (sx != null) x = lx = sx;
  else if (VIEW.sGrid) {
    const g = gridSnap(p.x, t);
    if (g != null) x = g;
  }
  if (sy != null) y = ly = sy;
  else if (VIEW.sGrid) {
    const g = gridSnap(p.y, t);
    if (g != null) y = g;
  }
  if (VIEW.sPixel) {
    if (lx == null) x = Math.round(x);
    if (ly == null) y = Math.round(y);
  }
  S.snapLines = lx != null || ly != null ? { x: lx != null ? [lx] : [], y: ly != null ? [ly] : [] } : null;
  return { x, y };
}
/** Snap a moving box (doc units): returns the corrected move. Edges and centre are tried. */
export function snapMove(
  box: { x: number; y: number; w: number; h: number },
  dx: number,
  dy: number,
  T: Targets,
): [number, number] {
  S.snapLines = null;
  if (!VIEW.snap) return [dx, dy];
  const t = tol(),
    xs = [box.x + dx, box.x + dx + box.w / 2, box.x + dx + box.w],
    ys = [box.y + dy, box.y + dy + box.h / 2, box.y + dy + box.h];
  const best = (cands: number[], list: number[]) => {
    let r: { off: number; at: number } | null = null;
    cands.forEach(c => {
      list.forEach(v => {
        const d = v - c;
        if (Math.abs(d) <= t && (!r || Math.abs(d) < Math.abs(r.off))) r = { off: d, at: v };
      });
    });
    return r as { off: number; at: number } | null;
  };
  const px = T.pts.map(q => q[0]),
    py = T.pts.map(q => q[1]);
  const bx = best(xs, [...T.x, ...(VIEW.sPoints ? px : [])]),
    by = best(ys, [...T.y, ...(VIEW.sPoints ? py : [])]);
  let ox = bx ? bx.off : 0,
    oy = by ? by.off : 0;
  if (!bx && VIEW.sGrid) {
    const g = VIEW.grid,
      v = box.x + dx,
      s = Math.round(v / g) * g;
    if (Math.abs(s - v) <= t) ox = s - v;
  }
  if (!by && VIEW.sGrid) {
    const g = VIEW.grid,
      v = box.y + dy,
      s = Math.round(v / g) * g;
    if (Math.abs(s - v) <= t) oy = s - v;
  }
  if (VIEW.sPixel) {
    if (!bx) ox = Math.round(box.x + dx + ox) - (box.x + dx);
    if (!by) oy = Math.round(box.y + dy + oy) - (box.y + dy);
  }
  if (bx || by) S.snapLines = { x: bx ? [bx.at] : [], y: by ? [by.at] : [] };
  return [dx + ox, dy + oy];
}
export function clearSnap() {
  S.snapLines = null;
}
/** The layer and everything inside it (to leave out of the targets while moving it). */
export function selfAndKids(l: Layer) {
  const out = new Set<string>([l.id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const x of doc.layers)
      if (x.parent && out.has(x.parent) && !out.has(x.id)) {
        out.add(x.id);
        grew = true;
      }
  }
  return out;
}
