// Keyline — tools/motion-path
// Editing a layer's motion path on the canvas: drag a segment to curve it, drag its handles,
// double-click a segment to straighten it. A curved segment stores its two control points on the
// keyframe where it starts (Keyframe[3], see runtime/engine).
import type { Keyframe, Layer } from '../model/types';
import { H, clone, r2, xfp } from '../core/constants';
import { beginEdit } from '../core/history';
import { S } from '../core/state';
import { parentMatrix } from '../model/tree';
import { frame } from '../render/stage';

type P = [number, number];
/** The four control points of segment i (position values, i.e. without the origin). */
export function segCtrl(l: Layer, i: number): [P, P, P, P] {
  const tr = l.t.pos,
    a = tr[i],
    b = tr[i + 1],
    A = a[1] as P,
    B = b[1] as P;
  if (a[3]) return [A, [A[0] + a[3][0], A[1] + a[3][1]], [B[0] + a[3][2], B[1] + a[3][3]], B];
  if (l.sm && tr.length > 2) {
    const P0 = (tr[i - 1] || a)[1] as P,
      P3 = (tr[i + 2] || b)[1] as P;
    return [
      A,
      [A[0] + (B[0] - P0[0]) / 6, A[1] + (B[1] - P0[1]) / 6],
      [B[0] - (P3[0] - A[0]) / 6, B[1] - (P3[1] - A[1]) / 6],
      B,
    ];
  }
  return [
    A,
    [A[0] + (B[0] - A[0]) / 3, A[1] + (B[1] - A[1]) / 3],
    [B[0] - (B[0] - A[0]) / 3, B[1] - (B[1] - A[1]) / 3],
    B,
  ];
}
export function bez(c: [P, P, P, P], t: number): P {
  const u = 1 - t;
  return [0, 1].map(
    k => u * u * u * c[0][k] + 3 * u * u * t * c[1][k] + 3 * u * t * t * c[2][k] + t * t * t * c[3][k],
  ) as P;
}
function store(q: Keyframe, c: [P, P, P, P]) {
  q[3] = [r2(c[1][0] - c[0][0]), r2(c[1][1] - c[0][1]), r2(c[2][0] - c[3][0]), r2(c[2][1] - c[3][1])];
}
/** doc point → position value space of the layer */
function toPos(l: Layer, x: number, y: number): P {
  const o = H.get(l, 'org', S.time) || [0, 0],
    q = xfp(parentMatrix(l).inverse(), x, y);
  return [q.x - o[0], q.y - o[1]];
}
/** Drag segment i so the point under the pointer follows it. */
export function segmentDrag(l: Layer, i: number, p0: { x: number; y: number }) {
  const q = l.t.pos[i],
    base = segCtrl(l, i),
    s0 = toPos(l, p0.x, p0.y);
  // the curve parameter nearest to where the segment was grabbed
  let t = 0.5,
    best = Infinity;
  for (let k = 1; k < 60; k++) {
    const b = bez(base, k / 60),
      d = Math.hypot(b[0] - s0[0], b[1] - s0[1]);
    if (d < best) {
      best = d;
      t = k / 60;
    }
  }
  const w1 = 3 * (1 - t) * (1 - t) * t,
    w2 = 3 * (1 - t) * t * t,
    k = w1 * w1 + w2 * w2 || 1,
    ed = beginEdit();
  let moved = false;
  S.drag = {
    move(p) {
      const m = toPos(l, p.x, p.y),
        dx = m[0] - s0[0],
        dy = m[1] - s0[1];
      if (!moved && Math.hypot(dx, dy) * S.scale < 3) return;
      moved = true;
      const c = clone(base) as [P, P, P, P];
      c[1] = [c[1][0] + (w1 * dx) / k, c[1][1] + (w1 * dy) / k];
      c[2] = [c[2][0] + (w2 * dx) / k, c[2][1] + (w2 * dy) / k];
      store(q, c);
      frame();
    },
    up() {
      ed.end(moved ? { insp: true } : undefined);
    },
  };
}
/** Drag one handle (0 = leaving key i, 1 = arriving at key i+1). */
export function motionHandleDrag(l: Layer, i: number, which: number, p0: { x: number; y: number }) {
  const q = l.t.pos[i],
    base = segCtrl(l, i),
    s0 = toPos(l, p0.x, p0.y),
    ed = beginEdit();
  S.drag = {
    move(p) {
      const m = toPos(l, p.x, p.y),
        c = clone(base) as [P, P, P, P],
        h = c[1 + which];
      c[1 + which] = [h[0] + m[0] - s0[0], h[1] + m[1] - s0[1]];
      store(q, c);
      frame();
    },
    up() {
      ed.end({ insp: true });
    },
  };
}
/** Make segment i a straight line again. */
export function straighten(l: Layer, i: number) {
  const q = l.t.pos && l.t.pos[i];
  if (!q || !l.t.pos[i + 1]) return;
  const ed = beginEdit(),
    A = q[1] as P,
    B = l.t.pos[i + 1][1] as P;
  if (l.sm)
    store(q, [
      A,
      [A[0] + (B[0] - A[0]) / 3, A[1] + (B[1] - A[1]) / 3],
      [B[0] - (B[0] - A[0]) / 3, B[1] - (B[1] - A[1]) / 3],
      B,
    ]);
  else q.length = 3;
  ed.end({ insp: true });
}
