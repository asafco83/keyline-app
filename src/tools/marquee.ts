// SVGcinema — tools/marquee
// Marquee selection on the canvas (Select tool): drag from an empty spot to draw a box; every layer it
// touches is selected when you let go (the ones it will pick get a dashed outline while you drag).
// As a click does, it picks top-level layers; with Ctrl it picks the shapes inside groups. Shift adds
// the layers it touches to the selection, or takes them out when they are selected already. A click on
// an empty spot without dragging still deselects (Shift keeps the selection).
import type { Layer, XY } from '../model/types';
import { S, doc } from '../core/state';
import { select, selectMany } from '../core/history';
import { isHidden, isLocked } from '../model/tree';
import { drawOverlay, obbOf } from '../render/overlay';

type Pt = { x: number; y: number };

/** does the convex quad `q` overlap the box a–b? (separating axes: the box's two, the quad's two) */
export function quadHitsBox(q: Pt[], a: Pt, b: Pt) {
  const x0 = Math.min(a.x, b.x),
    x1 = Math.max(a.x, b.x),
    y0 = Math.min(a.y, b.y),
    y1 = Math.max(a.y, b.y);
  const xs = q.map(p => p.x),
    ys = q.map(p => p.y);
  if (Math.max(...xs) < x0 || Math.min(...xs) > x1 || Math.max(...ys) < y0 || Math.min(...ys) > y1) return false;
  const box = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  for (let i = 0; i < 2; i++) {
    const p = q[i],
      n = q[i + 1],
      ax = -(n.y - p.y),
      ay = n.x - p.x;
    if (!ax && !ay) continue;
    const pr = (pts: Pt[]) => pts.map(v => v.x * ax + v.y * ay);
    const A = pr(q),
      B = pr(box);
    if (Math.max(...A) < Math.min(...B) || Math.max(...B) < Math.min(...A)) return false;
  }
  return true;
}
/** the layers a marquee can pick: top-level ones, or (Ctrl) the drawn layers inside groups */
function candidates(deep: boolean): Layer[] {
  return doc.layers.filter(
    l =>
      (deep ? l.type !== 'group' && l.type !== 'bone' : !l.parent) &&
      !isHidden(l) &&
      !isLocked(l) &&
      document.getElementById('e-' + l.id),
  );
}
export function marqueeHits(a: Pt, b: Pt, deep: boolean): string[] {
  return candidates(deep)
    .filter(l => {
      const q = obbOf(l);
      return q && q.length === 4 && quadHitsBox(q, a, b);
    })
    .map(l => l.id);
}

/** Starts a marquee at `p0` (document coordinates) from a press on an empty spot. */
export function marqueeDrag(p0: XY, e0: PointerEvent) {
  let moved = false;
  const add = e0.shiftKey;
  S.drag = {
    move(p, e) {
      if (!moved && Math.hypot(p.x - p0.x, p.y - p0.y) * S.scale < 3) return;
      moved = true;
      S.marquee = { a: { x: p0.x, y: p0.y }, b: { x: p.x, y: p.y }, hits: marqueeHits(p0, p, e.ctrlKey || e.metaKey) };
      drawOverlay();
    },
    up() {
      const m = S.marquee;
      S.marquee = null;
      if (!moved || !m) {
        // a click on an empty spot: deselect, as before (Shift keeps the selection)
        if (!add && (S.sel || S.selSet.size)) {
          S.keys.clear();
          select(null);
        } else drawOverlay();
        return;
      }
      if (add) {
        const next = new Set<string>(S.selSet);
        m.hits.forEach(id => (next.has(id) ? next.delete(id) : next.add(id)));
        // keep the primary last
        const ids = [...next].filter(id => id !== S.sel);
        if (S.sel && next.has(S.sel)) ids.push(S.sel);
        selectMany(ids);
      } else selectMany(m.hits);
      drawOverlay();
    },
  };
}
