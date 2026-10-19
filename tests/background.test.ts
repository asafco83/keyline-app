import { describe, it, expect } from 'vitest';
import { bgAttrs, bgPaint, parseBg } from '../src/model/background';
import { doc, setDoc } from '../src/core/state';
import { sampleDoc } from '../src/model/sample';
import { buildExport } from '../src/export/build';

const opaque = { color: '#112233', alpha: 1 };

describe('background paint', () => {
  it('treats an empty colour as transparent (older projects)', () => {
    expect(bgPaint({ bg: '' })).toEqual({ color: '#FFFFFF', alpha: 0 });
  });
  it('defaults to opaque when no opacity is stored', () => {
    expect(bgPaint({ bg: '#123' })).toEqual({ color: '#123', alpha: 1 });
  });
  it('clamps opacity', () => {
    expect(bgPaint({ bg: '#000', bgA: 3 }).alpha).toBe(1);
    expect(bgPaint({ bg: '#000', bgA: -1 }).alpha).toBe(0);
  });
});

describe('typing a background', () => {
  it('none / transparent / empty clears the opacity but keeps the colour', () => {
    for (const v of ['none', 'Transparent', '']) expect(parseBg(v, opaque)).toEqual({ color: '#112233', alpha: 0 });
  });
  it('reads alpha from #rrggbbaa and #rgba', () => {
    expect(parseBg('#ff000080', opaque)).toEqual({ color: '#ff0000', alpha: 0.502 });
    expect(parseBg('#f008', opaque)).toEqual({ color: '#f00', alpha: 0.533 });
  });
  it('reads alpha from rgba(), including percentages', () => {
    expect(parseBg('rgba(10, 20, 30, 0.25)', opaque)).toEqual({ color: 'rgb(10,20,30)', alpha: 0.25 });
    expect(parseBg('rgb(10 20 30 / 40%)', opaque)).toEqual({ color: 'rgb(10,20,30)', alpha: 0.4 });
  });
  it('a plain colour keeps the current opacity', () => {
    expect(parseBg('#abcdef', { color: '#000', alpha: 0.3 })).toEqual({ color: '#abcdef', alpha: 0.3 });
  });
  it('a plain colour on a transparent background makes it visible', () => {
    expect(parseBg('teal', { color: '#000', alpha: 0 })).toEqual({ color: 'teal', alpha: 1 });
  });
});

describe('exported background', () => {
  const rect = () => /<rect [^>]*width="640" height="400"[^>]*\/>/.exec(buildExport(null).code)?.[0];

  it('is omitted when transparent', () => {
    setDoc(sampleDoc());
    doc.bgA = 0;
    expect(bgAttrs(doc)).toBeNull();
    expect(rect()).toBeUndefined();
  });
  it('carries fill-opacity when partly transparent', () => {
    setDoc(sampleDoc());
    doc.bgA = 0.5;
    expect(rect()).toContain('fill="#14213D" fill-opacity="0.5"');
  });
  it('has no fill-opacity when opaque', () => {
    setDoc(sampleDoc());
    expect(rect()).toContain('fill="#14213D"');
    expect(rect()).not.toContain('fill-opacity');
  });
});
