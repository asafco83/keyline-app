// The triangle mesh pins bend images, text and groups through (model/mesh).
import { describe, it, expect } from 'vitest';
import { buildMesh, union } from '../src/model/mesh';

const edges = (m: { v: number[][]; t: number[][] }) => m.t.flatMap(T => T.map((i, k) => [m.v[i], m.v[T[(k + 1) % 3]]]));
const len = ([a, b]: number[][]) => Math.hypot(b[0] - a[0], b[1] - a[1]);

describe('pin mesh', () => {
  const box = { x: 0, y: 0, w: 240, h: 120 },
    m = buildMesh([box], 48);
  it('is an equilateral lattice', () => {
    const L = edges(m).map(len),
      a = L[0];
    expect(L.every(l => Math.abs(l - a) < 0.05)).toBe(true);
  });
  it('has no horizontal or vertical edges (browsers leave seams along those)', () => {
    edges(m).forEach(([a, b]) => {
      const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI,
        off = Math.abs(((ang % 90) + 90) % 90);
      expect(Math.min(off, 90 - off)).toBeGreaterThan(10);
    });
  });
  it('covers the content with about the asked number of triangles', () => {
    expect(m.t.length).toBeGreaterThan(40);
    expect(m.t.length).toBeLessThan(110);
    const U = union(m.v.map(([x, y]) => ({ x, y, w: 0, h: 0 })));
    expect(U.x).toBeLessThanOrEqual(0);
    expect(U.y).toBeLessThanOrEqual(0);
    expect(U.x + U.w).toBeGreaterThanOrEqual(240);
    expect(U.y + U.h).toBeGreaterThanOrEqual(120);
  });
  it('leaves out triangles with no content', () => {
    const apart = buildMesh(
        [
          { x: 0, y: 0, w: 40, h: 40 },
          { x: 360, y: 0, w: 40, h: 40 },
        ],
        60,
      ),
      whole = buildMesh([{ x: 0, y: 0, w: 400, h: 40 }], 60);
    expect(apart.t.length).toBeLessThan(whole.t.length * 0.6);
  });
  it('gets denser with a higher density', () => {
    expect(buildMesh([box], 160).t.length).toBeGreaterThan(m.t.length * 2);
  });
});
