import { describe, it, expect } from 'vitest';
import { maxCornerRadius, shapeCorners, shapeD } from '../src/geometry/nodes';

const poly = (o: any = {}): any => ({ kind: 'polygon', cx: 0, cy: 0, r: 100, rot: 0, n: 6, ...o });

describe('polygon and star settings', () => {
  it('has one corner per side, the first at the top', () => {
    const c = shapeCorners(poly());
    expect(c.length).toBe(6);
    expect(c[0][0]).toBeCloseTo(0);
    expect(c[0][1]).toBeCloseTo(-100);
  });
  it('places star inner points at the ratio', () => {
    const c = shapeCorners({ kind: 'star', cx: 0, cy: 0, r: 100, rot: 0, n: 5, ratio: 0.5 });
    expect(c.length).toBe(10);
    expect(Math.hypot(c[1][0], c[1][1])).toBeCloseTo(50);
  });
  it('rounds corners with two nodes each, inside the corner limit', () => {
    expect(shapeD(poly())[0].n.length).toBe(6);
    const d = shapeD(poly({ rad: 10 }))[0].n;
    expect(d.length).toBe(12);
    // a hexagon corner (120°): the arc ends sit r / tan(60°) from the corner
    const cut = 10 / Math.tan(Math.PI / 3);
    expect(Math.hypot(d[0][0] - 0, d[0][1] + 100)).toBeCloseTo(cut, 1);
    // larger radii are capped so neighbouring corners don't overlap
    const mx = maxCornerRadius(poly());
    expect(mx).toBeCloseTo(50 * Math.tan(Math.PI / 3), 1);
    expect(JSON.stringify(shapeD(poly({ rad: 1e6 })))).toBe(JSON.stringify(shapeD(poly({ rad: mx }))));
  });
});
