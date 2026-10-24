import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import opentype from 'opentype.js';
import {
  facesFor,
  fontURL,
  needsShaping,
  outlineD,
  pickWeight,
  primeFont,
  subsetsFor,
  webFont,
} from '../src/render/fonts';
import { layerSVG } from '../src/render/markup';
import { H } from '../src/core/constants';

const buf = readFileSync(resolve(__dirname, 'fixtures/heebo-latin-400-normal.woff'));
const heebo = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const G = (o: any = {}): any => ({
  x: 10,
  y: 50,
  size: 20,
  family: 'Heebo',
  weight: '400',
  anchor: 'start',
  text: 'Hi',
  ...o,
});
const layer = (geo: any): any => ({
  id: 'l1',
  type: 'text',
  name: 'T',
  b: { pos: [0, 0], org: [0, 0], rot: 0, scl: [1, 1], op: 1, fill: '#000', stk: 'none', sw: 0 },
  t: {},
  geo,
});

describe('web fonts', () => {
  it('knows the catalog and picks the nearest weight', () => {
    const f = webFont('Heebo');
    expect(f).toBeTruthy();
    expect(webFont('Georgia, serif')).toBeNull();
    expect(pickWeight(webFont('Bebas Neue'), '700')).toBe(400);
    expect(pickWeight(f, 650)).toBe(600);
  });
  it('loads only the alphabets the text uses', () => {
    const f = webFont('Heebo');
    expect(subsetsFor(f, 'Hello')).toEqual(['latin']);
    expect(subsetsFor(f, 'שלום Hello')).toEqual(['hebrew', 'latin']);
    expect(needsShaping('שלום')).toBe(false);
    expect(needsShaping('مرحبا')).toBe(true);
    expect(fontURL(f, 'latin', 400, 'normal', 'woff')).toBe(
      'https://cdn.jsdelivr.net/npm/@fontsource/heebo@5.3.0/files/heebo-latin-400-normal.woff',
    );
  });
  it('turns text into a path once the font is loaded', () => {
    expect(outlineD(G())).toBeNull();
    primeFont(facesFor(G())[0].key, heebo);
    const d = outlineD(G());
    expect(d).toMatch(/^M/);
    const wide = outlineD(G({ ls: 10 })),
      maxX = (s: string) => Math.max(...(s.match(/-?\d+(\.\d+)?/g) || []).filter((_, i) => i % 2 === 0).map(Number));
    expect(maxX(wide)).toBeGreaterThan(maxX(d) + 5);
    expect(outlineD(G({ deco: 'underline' })).length).toBeGreaterThan(d.length);
  });
  it('exports outlines in place of <text>, and live text in the editor', () => {
    const l = layer(G());
    const out = layerSVG(l, { pre: 'e-', t: 0, fonts: 'outline', faces: new Set() }, H.comp(l, 0));
    expect(out).toContain('<path id="e-l1-s"');
    expect(out).not.toContain('<text');
    expect(out).not.toContain('font-family');
    const ed = layerSVG(l, { pre: 'e-', t: 0, editor: true }, H.comp(l, 0));
    expect(ed).toContain('font-family="Heebo, sans-serif"');
  });
  it('lists faces to embed in embed mode', () => {
    const l = layer(G()),
      faces = new Set<string>();
    const out = layerSVG(l, { pre: 'e-', t: 0, fonts: 'embed', faces }, H.comp(l, 0));
    expect(out).toContain('<text');
    expect([...faces]).toEqual(['heebo-latin-400-normal']);
  });
});
