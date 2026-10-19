import { describe, it, expect } from 'vitest';
import { anchorX, textLines, textWidth } from '../src/render/text-layout';

const G = (o: any) => ({ x: 10, y: 0, size: 10, family: 'sans-serif', weight: '400', text: '', ...o });

describe('text layout', () => {
  it('keeps one line per paragraph without Keep width', () => {
    expect(textLines(G({ text: 'one\ntwo three' }))).toEqual(['one', 'two three']);
  });
  it('wraps at spaces when Keep width is on', () => {
    const w = textWidth('aaaa', G({}));
    const lines = textLines(G({ text: 'aaaa bbbb cccc', wrap: true, ww: w * 2.6 }));
    expect(lines).toEqual(['aaaa bbbb', 'cccc']);
  });
  it('splits a word longer than the box', () => {
    const w = textWidth('aaaa', G({}));
    const lines = textLines(G({ text: 'aaaaaaaaaa', wrap: true, ww: w }));
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe('aaaaaaaaaa');
  });
  it('counts letter spacing in the width', () => {
    expect(textWidth('abc', G({ ls: 5 }))).toBeCloseTo(textWidth('abc', G({})) + 10);
  });
  it('puts centred and right-aligned text inside the box', () => {
    expect(anchorX(G({ wrap: true, ww: 100, anchor: 'middle' }))).toBe(60);
    expect(anchorX(G({ wrap: true, ww: 100, anchor: 'end' }))).toBe(110);
    expect(anchorX(G({ anchor: 'end' }))).toBe(10);
  });
});
