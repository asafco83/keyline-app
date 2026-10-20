// SVGcinema — tools/motion-path
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
/* ---------- nodes (keyframes) and their handles ---------- */

export type NodeType = 'straight' | 'mirrored' | 'asymmetric' | 'disconnected';
type V = [number, number];
const len = (v: V) => Math.hypot(v[0], v[1]);
/** handle leaving node i (relative), or null at the last node */
function outH(l: Layer, i: number): V | null {
  const tr = l.t.pos;
  if (i >= tr.length - 1) return null;
  const c = segCtrl(l, i);
  return [c[1][0] - c[0][0], c[1][1] - c[0][1]];
}
/** handle arriving at node i (relative), or null at the first node */
function inH(l: Layer, i: number): V | null {
  if (i <= 0) return null;
  const c = segCtrl(l, i - 1);
  return [c[2][0] - c[3][0], c[2][1] - c[3][1]];
}
function setOut(l: Layer, i: number, h: V) {
  const c = segCtrl(l, i);
  c[1] = [c[0][0] + h[0], c[0][1] + h[1]];
  store(l.t.pos[i], c);
}
function setIn(l: Layer, i: number, h: V) {
  const c = segCtrl(l, i - 1);
  c[2] = [c[3][0] + h[0], c[3][1] + h[1]];
  store(l.t.pos[i - 1], c);
}
/** The node the panel edits: the keyframe at the playhead, or the one before it. */
export function currentNode(l: Layer) {
  const tr = l.t.pos;
  if (!tr || tr.length < 2) return -1;
  let i = 0;
  tr.forEach((q, k) => q[0] <= S.time + 0.005 && (i = k));
  return i;
}
export function nodeType(l: Layer, i: number): NodeType {
  const q = l.t.pos[i];
  if (q[4]) return q[4] as NodeType;
  const a = inH(l, i),
    b = outH(l, i),
    la = a ? len(a) : 0,
    lb = b ? len(b) : 0;
  if ((!a || la < 0.01) && (!b || lb < 0.01)) return 'straight';
  if (!a || !b || la < 0.01 || lb < 0.01) return 'disconnected';
  const cross = (a[0] * b[1] - a[1] * b[0]) / (la * lb),
    dot = a[0] * b[0] + a[1] * b[1];
  if (Math.abs(cross) > 0.03 || dot > 0) return 'disconnected';
  return Math.abs(la - lb) < 0.5 ? 'mirrored' : 'asymmetric';
}
/** Change a node's type, reshaping the handles on both sides of it. */
export function setNodeType(l: Layer, i: number, type: NodeType) {
  const tr = l.t.pos,
    P = (k: number) => tr[Math.max(0, Math.min(tr.length - 1, k))][1] as V,
    cur = P(i),
    a = inH(l, i),
    b = outH(l, i);
  if (type === 'straight') {
    if (b) setOut(l, i, [0, 0]);
    if (a) setIn(l, i, [0, 0]);
  } else if (type === 'mirrored' || type === 'asymmetric') {
    // direction: keep a handle that is already there, else follow the neighbours
    let d: V =
      b && len(b) > 0.01
        ? b
        : a && len(a) > 0.01
          ? [-a[0], -a[1]]
          : [P(i + 1)[0] - P(i - 1)[0], P(i + 1)[1] - P(i - 1)[1]];
    const dl = len(d) || 1;
    d = [d[0] / dl, d[1] / dl];
    const nOut = Math.hypot(P(i + 1)[0] - cur[0], P(i + 1)[1] - cur[1]) / 3,
      nIn = Math.hypot(cur[0] - P(i - 1)[0], cur[1] - P(i - 1)[1]) / 3;
    let lo = b && len(b) > 0.01 ? len(b) : nOut,
      li = a && len(a) > 0.01 ? len(a) : nIn;
    if (type === 'mirrored') {
      const m = a && b ? (lo + li) / 2 : b ? lo : li;
      lo = li = m;
    }
    if (b) setOut(l, i, [d[0] * lo, d[1] * lo]);
    if (a) setIn(l, i, [-d[0] * li, -d[1] * li]);
  }
  tr[i][4] = type;
}
/** Move a node (keyframe) to a position value. */
export function setNodePos(l: Layer, i: number, v: V) {
  l.t.pos[i][1] = [r2(v[0]), r2(v[1])];
}
/** Drag one handle (0 = leaving key i, 1 = arriving at key i+1). Mirrored and asymmetric nodes keep
 *  the handle on the other side in line. */
export function motionHandleDrag(l: Layer, i: number, which: number, p0: { x: number; y: number }) {
  const node = which === 0 ? i : i + 1,
    type = nodeType(l, node),
    base = segCtrl(l, i),
    other0 = which === 0 ? inH(l, node) : outH(l, node),
    s0 = toPos(l, p0.x, p0.y),
    ed = beginEdit();
  S.drag = {
    move(p, e) {
      const m = toPos(l, p.x, p.y),
        c = clone(base) as [P, P, P, P],
        hp = c[1 + which];
      c[1 + which] = [hp[0] + m[0] - s0[0], hp[1] + m[1] - s0[1]];
      store(l.t.pos[i], c);
      // Alt breaks the pair, like the Convert Point tool
      const linked = !e.altKey && other0 && (type === 'mirrored' || type === 'asymmetric');
      if (linked) {
        const end = c[which === 0 ? 0 : 3],
          h: V = [c[1 + which][0] - end[0], c[1 + which][1] - end[1]],
          hl = len(h) || 1,
          ol = type === 'mirrored' ? hl : len(other0),
          o: V = [(-h[0] / hl) * ol, (-h[1] / hl) * ol];
        which === 0 ? setIn(l, node, o) : setOut(l, node, o);
      } else if (e.altKey) l.t.pos[node][4] = 'disconnected';
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
