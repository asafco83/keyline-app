// Keyline — geometry/nodes
import { KAPPA, r2 } from '../core/constants';
import type { Geometry, Layer, PathData, PathNode, SubPath } from '../model/types';

type Pt = number[];

export function N(x: number, y: number): PathNode {
  return [x, y, x, y, x, y];
}
export function radial(cx: number, cy: number, rads: number[], ks: number[], rot?: number): PathData {
  rot = rot || 0;
  return [
    {
      c: true,
      n: rads.map((r, i) => {
        const a = ((-90 + (i * 360) / rads.length + rot) * Math.PI) / 180,
          x = cx + r * Math.cos(a),
          y = cy + r * Math.sin(a),
          tx = -Math.sin(a),
          ty = Math.cos(a),
          k = ks[i];
        return [r2(x), r2(y), r2(x - k * tx), r2(y - k * ty), r2(x + k * tx), r2(y + k * ty)];
      }),
    },
  ];
}
export function starNodes(cx: number, cy: number, ro: number, ri: number, pts: number, rot = 0): PathData {
  const n: PathNode[] = [];
  for (let i = 0; i < pts * 2; i++) {
    const a = ((-90 + rot + (i * 180) / pts) * Math.PI) / 180,
      r = i % 2 ? ri : ro;
    n.push(N(r2(cx + r * Math.cos(a)), r2(cy + r * Math.sin(a))));
  }
  return [{ c: true, n }];
}
export function rectNodes(G: Geometry): PathData {
  const { x, y, w, h } = G,
    r = Math.min(G.rx || 0, w / 2, h / 2),
    k = r * KAPPA;
  if (r <= 0) return [{ c: true, n: [N(x, y), N(x + w, y), N(x + w, y + h), N(x, y + h)] }];
  return [
    {
      c: true,
      n: [
        [x + r, y, x + r - k, y, x + r, y],
        [x + w - r, y, x + w - r, y, x + w - r + k, y],
        [x + w, y + r, x + w, y + r - k, x + w, y + r],
        [x + w, y + h - r, x + w, y + h - r, x + w, y + h - r + k],
        [x + w - r, y + h, x + w - r + k, y + h, x + w - r, y + h],
        [x + r, y + h, x + r, y + h, x + r - k, y + h],
        [x, y + h - r, x, y + h - r + k, x, y + h - r],
        [x, y + r, x, y + r, x, y + r - k],
      ].map(q => q.map(r2)),
    },
  ];
}
export function ellNodes(G: Geometry): PathData {
  const { cx, cy, rx, ry } = G,
    kx = rx * KAPPA,
    ky = ry * KAPPA;
  return [
    {
      c: true,
      n: [
        [cx, cy - ry, cx - kx, cy - ry, cx + kx, cy - ry],
        [cx + rx, cy, cx + rx, cy - ky, cx + rx, cy + ky],
        [cx, cy + ry, cx + kx, cy + ry, cx - kx, cy + ry],
        [cx - rx, cy, cx - rx, cy + ky, cx - rx, cy - ky],
      ].map(q => q.map(r2)),
    },
  ];
}
export function mid(a: Pt, b: Pt): Pt {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
export function dist(a: Pt, b: Pt) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
export function segLen(a: PathNode, b: PathNode) {
  return dist([a[0], a[1]], [a[4], a[5]]) + dist([a[4], a[5]], [b[2], b[3]]) + dist([b[2], b[3]], [b[0], b[1]]);
}
export function splitSeg(sp: SubPath, j: number) {
  const len = sp.n.length,
    a = sp.n[j],
    b = sp.n[(j + 1) % len];
  const p0 = [a[0], a[1]],
    p1 = [a[4], a[5]],
    p2 = [b[2], b[3]],
    p3 = [b[0], b[1]];
  const p01 = mid(p0, p1),
    p12 = mid(p1, p2),
    p23 = mid(p2, p3),
    p012 = mid(p01, p12),
    p123 = mid(p12, p23),
    m = mid(p012, p123);
  a[4] = r2(p01[0]);
  a[5] = r2(p01[1]);
  b[2] = r2(p23[0]);
  b[3] = r2(p23[1]);
  sp.n.splice(j + 1, 0, [r2(m[0]), r2(m[1]), r2(p012[0]), r2(p012[1]), r2(p123[0]), r2(p123[1])]);
}
export function splitTo(sp: SubPath, target: number) {
  let guard = 0;
  while (sp.n.length < target && guard++ < 2000) {
    const segs = sp.c ? sp.n.length : sp.n.length - 1;
    if (segs < 1 || (sp.n.length < 2 && !sp.c)) {
      sp.n.push(sp.n[0].slice());
      continue;
    }
    let best = 0,
      bl = -1;
    for (let j = 0; j < segs; j++) {
      const l = segLen(sp.n[j], sp.n[(j + 1) % sp.n.length]);
      if (l > bl) {
        bl = l;
        best = j;
      }
    }
    splitSeg(sp, best);
  }
}
export function padSubpaths(v: PathData, count: number) {
  while (v.length < count) {
    const ref = v[v.length - 1] || { c: true, n: [N(0, 0)] };
    const q = ref.n[ref.n.length - 1];
    v.push({ c: true, n: [N(q[0], q[1])] });
  }
}
export function equalizeValues(vals: PathData[]) {
  const sc = Math.max(...vals.map(v => v.length));
  vals.forEach(v => padSubpaths(v, sc));
  for (let i = 0; i < sc; i++) {
    const t = Math.max(...vals.map(v => v[i].n.length));
    vals.forEach(v => splitTo(v[i], t));
  }
}
export function equalizeTrack(l: Layer) {
  const vals: PathData[] = [l.b.d].concat((l.t.d || []).map(k => k[1])).filter(Boolean);
  equalizeValues(vals);
}
export function revSp(sp: SubPath): SubPath {
  return { c: sp.c, n: sp.n.map(q => [q[0], q[1], q[4], q[5], q[2], q[3]]).reverse() };
}
export function alignTo(A: PathData, B: PathData): PathData {
  return B.map((sp, i) => {
    const a = A[i];
    if (!a || a.n.length !== sp.n.length) return sp;
    let best = sp,
      bc = Infinity;
    [sp, revSp(sp)].forEach(c => {
      const n = c.n.length,
        rots = c.c ? n : 1;
      for (let k = 0; k < rots; k++) {
        let cost = 0;
        for (let j = 0; j < n; j++) {
          const q = c.n[(j + k) % n],
            p = a.n[j];
          cost += (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
        }
        if (cost < bc) {
          bc = cost;
          best = { c: c.c, n: c.n.slice(k).concat(c.n.slice(0, k)) };
        }
      }
    });
    return best;
  });
}
export function eachShapeValue(l: Layer, fn: (v: PathData) => void) {
  if (l.b.d) fn(l.b.d);
  (l.t.d || []).forEach(k => fn(k[1]));
}
export function subdivideAll(l: Layer) {
  eachShapeValue(l, v =>
    v.forEach(sp => {
      const segs = sp.c ? sp.n.length : sp.n.length - 1;
      for (let j = segs - 1; j >= 0; j--) splitSeg(sp, j);
    }),
  );
}
export function removeNodeAll(l: Layer, i: number, j: number) {
  let ok = true;
  eachShapeValue(l, v => {
    if (!v[i] || v[i].n.length <= 2) ok = false;
  });
  if (!ok) return false;
  eachShapeValue(l, v => v[i].n.splice(j, 1));
  return true;
}
export function isSmooth(q: PathNode) {
  const ix = q[2] - q[0],
    iy = q[3] - q[1],
    ox = q[4] - q[0],
    oy = q[5] - q[1];
  if (!(ix || iy) || !(ox || oy)) return false;
  return Math.abs(ix * oy - iy * ox) < 0.01 * Math.hypot(ix, iy) * Math.hypot(ox, oy) + 1e-6 && ix * ox + iy * oy < 0;
}

/* ---- drawing-tool helpers ---- */

/** A segment whose handles sit on its anchors is a straight line. */
export function isLineSeg(a: PathNode, b: PathNode) {
  return a[4] === a[0] && a[5] === a[1] && b[2] === b[0] && b[3] === b[1];
}
/** Point at `t` on the segment from node `a` to node `b` (straight segments are parametrised evenly). */
export function cubicAt(a: PathNode, b: PathNode, t: number): Pt {
  if (isLineSeg(a, b)) return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const u = 1 - t,
    w0 = u * u * u,
    w1 = 3 * u * u * t,
    w2 = 3 * u * t * t,
    w3 = t * t * t;
  return [w0 * a[0] + w1 * a[4] + w2 * b[2] + w3 * b[0], w0 * a[1] + w1 * a[5] + w2 * b[3] + w3 * b[1]];
}
/** Split segment `j` (node j → node j+1) at `t`, keeping the curve's shape. Returns the new node's index. */
export function splitSegAt(sp: SubPath, j: number, t: number) {
  const len = sp.n.length,
    a = sp.n[j],
    b = sp.n[(j + 1) % len];
  if (isLineSeg(a, b)) {
    const m = cubicAt(a, b, t);
    sp.n.splice(j + 1, 0, N(r2(m[0]), r2(m[1])));
    return j + 1;
  }
  const L = (p: Pt, q: Pt): Pt => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const p0: Pt = [a[0], a[1]],
    p1: Pt = [a[4], a[5]],
    p2: Pt = [b[2], b[3]],
    p3: Pt = [b[0], b[1]];
  const p01 = L(p0, p1),
    p12 = L(p1, p2),
    p23 = L(p2, p3),
    p012 = L(p01, p12),
    p123 = L(p12, p23),
    m = L(p012, p123);
  a[4] = r2(p01[0]);
  a[5] = r2(p01[1]);
  b[2] = r2(p23[0]);
  b[3] = r2(p23[1]);
  sp.n.splice(j + 1, 0, [r2(m[0]), r2(m[1]), r2(p012[0]), r2(p012[1]), r2(p123[0]), r2(p123[1])]);
  return j + 1;
}
/** Regular polygon with `sides` corners; `rot` in degrees (0 = a corner at the top). */
export function polygonNodes(cx: number, cy: number, r: number, sides: number, rot = 0): PathData {
  const n: PathNode[] = [];
  for (let i = 0; i < sides; i++) {
    const a = ((-90 + rot + (i * 360) / sides) * Math.PI) / 180;
    n.push(N(r2(cx + r * Math.cos(a)), r2(cy + r * Math.sin(a))));
  }
  return [{ c: true, n }];
}
/** Snap `to` so the line from `from` is at a multiple of 45°. */
export function snap45(from: Pt, to: Pt): Pt {
  const dx = to[0] - from[0],
    dy = to[1] - from[1],
    d = Math.hypot(dx, dy),
    a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return [from[0] + d * Math.cos(a), from[1] + d * Math.sin(a)];
}
/** Ramer–Douglas–Peucker: drop points that stay within `eps` of the simplified line. */
export function simplifyPts(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    const [ax, ay] = pts[s],
      [bx, by] = pts[e],
      dx = bx - ax,
      dy = by - ay,
      L = Math.hypot(dx, dy) || 1;
    let best = -1,
      bd = eps;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L;
      if (d > bd) {
        bd = d;
        best = i;
      }
    }
    if (best > 0) {
      keep[best] = 1;
      stack.push([s, best], [best, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}
/** Smooth cubic nodes through `pts` (Catmull–Rom), for freehand drawing. */
export function smoothNodes(pts: Pt[], closed: boolean): PathNode[] {
  const n = pts.length;
  return pts.map((p, i) => {
    const prev = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)],
      next = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)],
      tx = (next[0] - prev[0]) / 6,
      ty = (next[1] - prev[1]) / 6,
      end = !closed && (i === 0 || i === n - 1);
    return end
      ? [r2(p[0]), r2(p[1]), r2(p[0]), r2(p[1]), r2(p[0]), r2(p[1])]
      : [r2(p[0]), r2(p[1]), r2(p[0] - tx), r2(p[1] - ty), r2(p[0] + tx), r2(p[1] + ty)];
  });
}
/**
 * Reshape the segment a→b so its point at `t` moves by (dx, dy), changing only the two handles
 * (the smallest change that does it). Used when dragging a segment with the Convert Point tool.
 */
export function reshapeSeg(a: PathNode, b: PathNode, t: number, dx: number, dy: number) {
  const w1 = 3 * (1 - t) * (1 - t) * t,
    w2 = 3 * (1 - t) * t * t,
    k = w1 * w1 + w2 * w2 || 1;
  a[4] = r2(a[4] + (w1 * dx) / k);
  a[5] = r2(a[5] + (w1 * dy) / k);
  b[2] = r2(b[2] + (w2 * dx) / k);
  b[3] = r2(b[3] + (w2 * dy) / k);
}
