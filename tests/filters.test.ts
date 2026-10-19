import { describe, it, expect } from 'vitest';
import { addFilter, filterSVG, fxKeys, removeFilter } from '../src/model/filters';
import { layerSVG } from '../src/render/markup';
import { H } from '../src/core/constants';

const text = (geo: any = {}): any => ({
  id: 'l1',
  type: 'text',
  name: 'T',
  b: { pos: [0, 0], org: [0, 0], rot: 0, scl: [1, 1], op: 1, fill: '#000', stk: 'none', sw: 0 },
  t: {},
  geo: { x: 0, y: 20, size: 10, family: 'sans-serif', weight: '400', anchor: 'start', text: 'Hi', ...geo },
});

describe('filters', () => {
  it('adds filters with default values and a runtime attribute map', () => {
    const l = text();
    addFilter(l, 'blur');
    addFilter(l, 'shadow');
    expect(l.fx.map((f: any) => f.id)).toEqual(['f1', 'f2']);
    expect(l.b['fx.f1.sd']).toBe(4);
    expect(l.fa['fx.f2.col']).toEqual(['-f2', 'flood-color']);
    expect(fxKeys(l)).toContain('fx.f2.op');
  });
  it('removes a filter with its values and keyframes', () => {
    const l = text();
    addFilter(l, 'blur');
    l.t['fx.f1.sd'] = [[0, 1, 'ease']];
    removeFilter(l, 'f1');
    expect(l.fx).toBeUndefined();
    expect(l.fa).toBeUndefined();
    expect('fx.f1.sd' in l.b).toBe(false);
    expect(l.t['fx.f1.sd']).toBeUndefined();
  });
  it('writes the filter markup and links it from the layer', () => {
    const l = text();
    addFilter(l, 'shadow');
    expect(filterSVG(l, 'e-', k => l.b[k])).toContain('<feDropShadow id="e-l1-f1" dx="4" dy="6"');
    const svg = layerSVG(l, { pre: 'e-', t: 0 }, H.comp(l, 0));
    expect(svg).toContain('filter="url(#e-l1-fx)"');
    expect(svg).toContain('<filter id="e-l1-fx"');
  });
});

describe('text markup', () => {
  it('writes style, decoration and letter spacing only when set', () => {
    const plain = layerSVG(text(), { pre: 'e-', t: 0 }, H.comp(text(), 0));
    expect(plain).not.toMatch(/font-style|text-decoration|letter-spacing|tspan/);
    const l = text({ italic: true, deco: 'underline line-through', ls: 2 });
    const s = layerSVG(l, { pre: 'e-', t: 0 }, H.comp(l, 0));
    expect(s).toContain('font-style="italic"');
    expect(s).toContain('text-decoration="underline line-through"');
    expect(s).toContain('letter-spacing="2"');
  });
  it('writes one tspan per line', () => {
    const l = text({ text: 'a\nb\nc', lh: 1.5 });
    const s = layerSVG(l, { pre: 'e-', t: 0 }, H.comp(l, 0));
    expect(s.match(/<tspan/g).length).toBe(3);
    expect(s).toContain('dy="15"');
  });
  it('adds blending, isolation and paint opacities', () => {
    const l = text();
    l.blend = 'multiply';
    l.iso = true;
    l.b.fo = 0.5;
    const s = layerSVG(l, { pre: 'e-', t: 0 }, H.comp(l, 0));
    expect(s).toContain('style="mix-blend-mode:multiply;isolation:isolate"');
    expect(s).toContain('fill-opacity="0.5"');
    expect(s).not.toContain('stroke-opacity');
  });
});
