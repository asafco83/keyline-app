import { describe, it, expect } from 'vitest';
import { parsePath, arcToCubic } from '../src/geometry/parse-path';
import {
  cubicAt,
  ellNodes,
  equalizeValues,
  polygonNodes,
  reshapeSeg,
  rectNodes,
  simplifyPts,
  smoothNodes,
  snap45,
  splitSeg,
  splitSegAt,
  starNodes,
} from '../src/geometry/nodes';
import { KLEngine } from '../src/runtime/engine';

const H = KLEngine({ L: [] }, null);
const count = (v: any[]) => v.map(s => s.n.length);

describe('SVG path parsing', () => {
  it('reads absolute lines and closes the path', () => {
    const p = parsePath('M0 0 L10 0 L10 10 Z');
    expect(p).toHaveLength(1);
    expect(p[0].c).toBe(true);
    expect(count(p)).toEqual([3]);
  });
  it('merges a closing point that repeats the start', () => {
    const p = parsePath('M0 0 L10 0 L10 10 L0 0 Z');
    expect(count(p)).toEqual([3]);
  });
  it('handles relative commands and implicit line-tos', () => {
    const p = parsePath('m5 5 10 0 0 10');
    expect(p[0].n.map(n => [n[0], n[1]])).toEqual([
      [5, 5],
      [15, 5],
      [15, 15],
    ]);
  });
  it('handles H, V and multiple subpaths', () => {
    const p = parsePath('M0 0H10V10ZM20 20h5v5z');
    expect(count(p)).toEqual([3, 3]);
  });
  it('converts quadratic curves to cubic handles', () => {
    const p = parsePath('M0 0 Q10 10 20 0');
    const [a, b] = p[0].n;
    expect(a[4]).toBeCloseTo(20 / 3);
    expect(a[5]).toBeCloseTo(20 / 3);
    expect(b[0]).toBe(20);
  });
  it('splits arcs into quarter-circle cubics', () => {
    const segs = arcToCubic(0, 0, 10, 10, 0, 0, 1, 20, 0);
    expect(segs).toHaveLength(2);
    expect(segs[1][4]).toBeCloseTo(20);
    expect(segs[1][5]).toBeCloseTo(0);
  });
  it('parses compact arc flags like "a1 1 0 00 10 10"', () => {
    const p = parsePath('M0 0 a1 1 0 00 10 10');
    const last = p[0].n[p[0].n.length - 1];
    expect(last[0]).toBeCloseTo(10);
    expect(last[1]).toBeCloseTo(10);
  });
  it('round-trips through the runtime path writer', () => {
    expect(H.dstr(parsePath('M0 0L10 0L10 10Z'))).toBe('M0 0L10 0L10 10L0 0Z');
  });
});

describe('node utilities used for morphing', () => {
  it('splits a segment at its midpoint', () => {
    const sp = {
      c: false,
      n: [
        [0, 0, 0, 0, 0, 0],
        [10, 0, 10, 0, 10, 0],
      ],
    };
    splitSeg(sp, 0);
    expect(sp.n).toHaveLength(3);
    expect(sp.n[1][0]).toBeCloseTo(5);
  });
  it('equalizes node and subpath counts across shapes', () => {
    const a = rectNodes({ x: 0, y: 0, w: 10, h: 10, rx: 0 });
    const b = starNodes(5, 5, 5, 2, 5);
    const c = parsePath('M0 0L1 1ZM5 5L6 6L7 5Z');
    equalizeValues([a, b, c]);
    expect(count(a)).toEqual(count(b));
    expect(count(b)).toEqual(count(c));
  });
  it('builds ellipses from four smooth nodes', () => {
    expect(count(ellNodes({ cx: 0, cy: 0, rx: 10, ry: 5 }))).toEqual([4]);
  });
});

describe('drawing-tool helpers', () => {
  const line = () => ({
    c: false,
    n: [
      [0, 0, 0, 0, 0, 0],
      [30, 0, 30, 0, 30, 0],
    ],
  });
  it('splits a segment at t without changing its shape', () => {
    const sp = {
      c: false,
      n: [
        [0, 0, 0, 0, 0, 30],
        [40, 0, 40, 30, 40, 0],
      ],
    };
    const before = [0.1, 0.3, 0.5, 0.8].map(t => cubicAt(sp.n[0], sp.n[1], t));
    const k = splitSegAt(sp, 0, 0.3);
    expect(k).toBe(1);
    expect(sp.n).toHaveLength(3);
    const at = cubicAt(sp.n[0], sp.n[1], 1);
    expect(at[0]).toBeCloseTo(before[1][0], 1);
    expect(at[1]).toBeCloseTo(before[1][1], 1);
    // a point past the split now lies on the second half
    const later = cubicAt(sp.n[1], sp.n[2], (0.8 - 0.3) / 0.7);
    expect(later[0]).toBeCloseTo(before[3][0], 1);
    expect(later[1]).toBeCloseTo(before[3][1], 1);
  });
  it('splits straight lines at the requested position', () => {
    const sp = line();
    splitSegAt(sp, 0, 0.25);
    expect(sp.n[1].slice(0, 2)).toEqual([7.5, 0]);
  });
  it('builds regular polygons with a corner at the top', () => {
    const [sp] = polygonNodes(0, 0, 10, 6);
    expect(sp.c).toBe(true);
    expect(sp.n).toHaveLength(6);
    expect(sp.n[0][0]).toBeCloseTo(0);
    expect(sp.n[0][1]).toBeCloseTo(-10);
  });
  it('rotates stars', () => {
    const [sp] = starNodes(0, 0, 10, 4, 5, 90);
    expect(sp.n).toHaveLength(10);
    expect(sp.n[0][0]).toBeCloseTo(10);
    expect(sp.n[0][1]).toBeCloseTo(0);
  });
  it('snaps to 45° steps', () => {
    const p = snap45([0, 0], [10, 1]);
    expect(p[1]).toBeCloseTo(0);
    const q = snap45([0, 0], [10, 9]);
    expect(q[0]).toBeCloseTo(q[1]);
  });
  it('simplifies a noisy straight stroke to its ends', () => {
    const pts = Array.from({ length: 50 }, (_, i) => [i, i % 2 ? 0.2 : -0.2]);
    expect(simplifyPts(pts, 1)).toEqual([pts[0], pts[49]]);
  });
  it('keeps the corner of an L-shaped stroke', () => {
    const pts = [...Array.from({ length: 10 }, (_, i) => [i, 0]), ...Array.from({ length: 10 }, (_, i) => [9, i + 1])];
    const s = simplifyPts(pts, 0.5);
    expect(s).toContainEqual([9, 0]);
    expect(s).toHaveLength(3);
  });
  it('fits smooth nodes through every point, with flat ends on open strokes', () => {
    const n = smoothNodes(
      [
        [0, 0],
        [10, 10],
        [20, 0],
      ],
      false,
    );
    expect(n.map(q => q.slice(0, 2))).toEqual([
      [0, 0],
      [10, 10],
      [20, 0],
    ]);
    expect(n[0].slice(2)).toEqual([0, 0, 0, 0]);
    expect(n[1][4]).toBeGreaterThan(10);
  });
  it('reshapes a segment so the dragged point follows the pointer', () => {
    const a = [0, 0, 0, 0, 0, 0],
      b = [30, 0, 30, 0, 30, 0];
    reshapeSeg(a, b, 0.5, 0, 12);
    expect(a.slice(0, 2)).toEqual([0, 0]);
    expect(b.slice(0, 2)).toEqual([30, 0]);
    const m = cubicAt(a, b, 0.5);
    expect(m[0]).toBeCloseTo(15, 0);
    expect(m[1]).toBeCloseTo(12, 0);
  });
});
