import { describe, it, expect } from 'vitest';
import { parsePath, arcToCubic } from '../src/geometry/parse-path';
import { equalizeValues, splitSeg, rectNodes, ellNodes, starNodes } from '../src/geometry/nodes';
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
