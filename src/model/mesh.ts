// SVGcinema — model/mesh
// The triangle mesh that pins bend images, text and groups through (paths bend through their own
// nodes). An equilateral lattice, turned 15° so no edge is horizontal or vertical (browsers leave
// hairline seams along axis-aligned clip edges), laid over the content; triangles with no content are
// dropped. Each triangle draws the content clipped to itself, moved by the affine map its three
// warped corners give. Pins act anywhere in space, so the mesh can be rebuilt at any time.
import type { Layer } from './types';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface MeshData {
  /** rest vertices [x, y] in the layer's content space */
  v: number[][];
  /** triangles: three vertex indices each */
  t: number[][];
}
/** the default density: about this many triangles over the content's bounds */
export const MESH_DEFAULT = 48;
export const MESH_MIN = 8;
export const MESH_MAX = 400;
const TURN = (15 * Math.PI) / 180;

/** layers pins bend through a mesh */
export function meshable(l: Layer) {
  return !!l && (l.type === 'image' || l.type === 'text' || l.type === 'group' || l.type === 'raw');
}
/** layers pins bend: paths through their nodes, the others through a mesh */
export function pinnable(l: Layer) {
  return !!l && (l.type === 'path' || l.type === 'rect' || l.type === 'ellipse' || meshable(l));
}
export function union(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  boxes.forEach(b => {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  });
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
/** does triangle a b c overlap the box (separating axis test) */
function triHitsBox(a: number[], b: number[], c: number[], q: Box) {
  const P = [a, b, c],
    R = [
      [q.x, q.y],
      [q.x + q.w, q.y],
      [q.x + q.w, q.y + q.h],
      [q.x, q.y + q.h],
    ];
  const sep = (ax: number, ay: number) => {
    let p0 = Infinity,
      p1 = -Infinity,
      r0 = Infinity,
      r1 = -Infinity;
    P.forEach(p => {
      const d = p[0] * ax + p[1] * ay;
      p0 = Math.min(p0, d);
      p1 = Math.max(p1, d);
    });
    R.forEach(p => {
      const d = p[0] * ax + p[1] * ay;
      r0 = Math.min(r0, d);
      r1 = Math.max(r1, d);
    });
    return p1 < r0 || r1 < p0;
  };
  if (sep(1, 0) || sep(0, 1)) return false;
  for (let i = 0; i < 3; i++) {
    const u = P[i],
      w = P[(i + 1) % 3];
    if (sep(-(w[1] - u[1]), w[0] - u[0])) return false;
  }
  return true;
}
const r2 = (v: number) => Math.round(v * 100) / 100;
/** an equilateral lattice over the boxes (content pieces, margins included) with about `n` triangles
 *  over their bounds; only triangles that touch a box are kept */
export function buildMesh(boxes: Box[], n: number = MESH_DEFAULT): MeshData {
  const B = union(boxes);
  if (!B || !(B.w > 0) || !(B.h > 0)) return { v: [], t: [] };
  n = Math.max(MESH_MIN, Math.min(MESH_MAX, Math.round(n)));
  const a = Math.max(1, Math.sqrt((4 * B.w * B.h) / (Math.sqrt(3) * n))),
    rh = (a * Math.sqrt(3)) / 2,
    cx = B.x + B.w / 2,
    cy = B.y + B.h / 2,
    co = Math.cos(TURN),
    si = Math.sin(TURN),
    // lattice frame → content space (turned about the centre) and back
    out = (u: number, v: number) => [cx + u * co - v * si, cy + u * si + v * co],
    inn = (x: number, y: number) => [(x - cx) * co + (y - cy) * si, -(x - cx) * si + (y - cy) * co];
  let u0 = Infinity,
    u1 = -Infinity,
    v0 = Infinity,
    v1 = -Infinity;
  [
    [B.x, B.y],
    [B.x + B.w, B.y],
    [B.x, B.y + B.h],
    [B.x + B.w, B.y + B.h],
  ].forEach(([x, y]) => {
    const [u, v] = inn(x, y);
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
    v0 = Math.min(v0, v);
    v1 = Math.max(v1, v);
  });
  const j0 = Math.floor(v0 / rh) - 1,
    j1 = Math.ceil(v1 / rh) + 1,
    i0 = Math.floor(u0 / a) - 2,
    i1 = Math.ceil(u1 / a) + 2,
    cols = i1 - i0 + 1;
  // lattice point (i, j): odd rows are shifted half a side
  const pt = (i: number, j: number) => out((i + (j & 1 ? 0.5 : 0)) * a, j * rh),
    key = (i: number, j: number) => (j - j0) * cols + (i - i0);
  const tris: number[][] = [];
  for (let j = j0; j < j1; j++)
    for (let i = i0; i < i1; i++) {
      // the row with the shift to the right holds the apex of the "up" triangle
      if (j & 1)
        tris.push([key(i, j), key(i + 1, j), key(i + 1, j + 1)], [key(i, j), key(i + 1, j + 1), key(i, j + 1)]);
      else tris.push([key(i, j), key(i + 1, j), key(i, j + 1)], [key(i + 1, j), key(i + 1, j + 1), key(i, j + 1)]);
    }
  const P: Record<number, number[]> = {},
    at = (k: number) => {
      if (!P[k]) {
        const j = Math.floor(k / cols) + j0,
          i = (k % cols) + i0;
        P[k] = pt(i, j);
      }
      return P[k];
    };
  const keep = tris.filter(tr => {
    const p = tr.map(at);
    return boxes.some(q => triHitsBox(p[0], p[1], p[2], q));
  });
  const idx: Record<number, number> = {},
    v: number[][] = [];
  const t = keep.map(tr =>
    tr.map(k => {
      if (!(k in idx)) {
        idx[k] = v.length;
        const p = at(k);
        v.push([r2(p[0]), r2(p[1])]);
      }
      return idx[k];
    }),
  );
  return { v, t };
}
/** a short hash of a string (32-bit FNV-1a), to notice when a mesh's content changed */
export function hashStr(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
