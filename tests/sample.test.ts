// The sample scene doubles as a tour of the editor: check it keeps showing every built-in capability.
import { describe, it, expect } from 'vitest';
import { setDoc, doc } from '../src/core/state';
import { sampleDoc } from '../src/model/sample';
import type { Layer } from '../src/model/types';

const isGrad = (v: any) => v && typeof v === 'object' && (v.g === 'lin' || v.g === 'rad');
const tracks = (l: Layer) => Object.values(l.t);

describe('sample scene', () => {
  setDoc(sampleDoc());
  const L = doc.layers,
    by = (name: string) => L.find(l => l.name === name) as Layer,
    some = (fn: (l: Layer) => boolean) => L.some(fn);

  it('keeps the layers the browser tests rely on, in order', () => {
    const roots = L.filter(l => !l.parent).map(l => l.name);
    expect(roots[roots.length - 1]).toBe('Title');
    expect(roots[roots.length - 2]).toBe('Landscape');
    expect(by('Sun').parent).toBe(by('Sunrise').id);
    expect(by('Rays').parent).toBe(by('Sunrise').id);
    expect(by('Horizon').parent).toBe(by('Landscape').id);
    expect(L.filter(l => l.parent === by('Landscape').id)[0].name).toBe('Ground');
  });
  it('shows bones: a chain of bones carrying shapes, with rotation keyframes', () => {
    const bones = L.filter(l => l.type === 'bone');
    expect(bones.length).toBeGreaterThanOrEqual(3);
    expect(bones.some(b => bones.some(p => p.id === b.parent))).toBe(true);
    expect(some(l => l.type !== 'bone' && bones.some(b => b.id === l.parent))).toBe(true);
    expect(bones.every(b => b.t.rot && b.t.rot.length > 1)).toBe(true);
    // squash & stretch: a bone scaled along / across itself
    expect(bones.some(b => b.t.scl && b.t.scl.some(q => q[1][0] !== q[1][1]))).toBe(true);
  });
  it('shows a mask group and a clipping group, each with its folder', () => {
    for (const kind of ['mask', 'clip'] as const) {
      const g = L.find(l => l.mask === kind) as Layer;
      expect(g).toBeTruthy();
      expect(some(l => l.parent === g.id && !!l.maskSrc)).toBe(true);
      expect(some(l => l.parent === g.id && !l.maskSrc)).toBe(true);
    }
  });
  it('animates gradients, filters, blending and a hyperlink', () => {
    expect(some(l => !!l.t.fill && l.t.fill.some(q => isGrad(q[1])))).toBe(true);
    expect(some(l => isGrad(l.b.fill) && (l.b.fill as any).g === 'rad')).toBe(true);
    const fx = L.filter(l => l.fx && l.fx.length);
    expect(fx.some(l => l.fx!.some(f => f.type === 'blur'))).toBe(true);
    expect(fx.some(l => l.fx!.some(f => f.type === 'shadow'))).toBe(true);
    expect(fx.some(l => Object.keys(l.t).some(k => k.startsWith('fx.')))).toBe(true);
    expect(some(l => !!l.blend && l.blend !== 'normal')).toBe(true);
    expect(some(l => !!l.link)).toBe(true);
  });
  it('animates shapes: morph, polygon and star settings, line ends, trim, dashes, skew', () => {
    expect(some(l => !!l.t.d && l.t.d.length > 1)).toBe(true);
    expect(some(l => l.shape?.kind === 'star' && !!l.t.rad)).toBe(true);
    expect(some(l => l.shape?.kind === 'polygon' && !!l.t.rad)).toBe(true);
    expect(some(l => !!(l.t.p0 || l.t.p1))).toBe(true);
    expect(some(l => !!l.t.te)).toBe(true);
    expect(some(l => !!l.t.dof && !!l.extra['stroke-dasharray'])).toBe(true);
    expect(some(l => !!l.t.skw)).toBe(true);
  });
  it('uses a curved motion path with rotate-along-path, and varied easing', () => {
    expect(some(l => l.sm && l.or && !!l.t.pos && l.t.pos.length > 2)).toBe(true);
    const eases = new Set(L.flatMap(l => tracks(l).flatMap(tr => tr.map(q => JSON.stringify(q[2])))));
    expect(eases.has('"hold"')).toBe(true);
    expect([...eases].some(e => e.startsWith('['))).toBe(true); // a custom curve
    expect(eases.has('"outElastic"') || eases.has('"outBounce"')).toBe(true);
  });
});
