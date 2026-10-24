import { describe, it, expect } from 'vitest';
import { blankDoc, doc, mkLayer, setDoc, S } from '../src/core/state';
import { graphable, segIndex } from '../src/ui/graph';

describe('graph editor', () => {
  it('graphs numbers and points, not colours, morphs or dash patterns', () => {
    setDoc(blankDoc(100, 100));
    const l = mkLayer('rect', 'R', { x: 0, y: 0, w: 10, h: 10 }, { fill: '#f00' });
    doc.layers.push(l);
    expect(graphable(l, 'op')).toBe(true);
    expect(graphable(l, 'pos')).toBe(true);
    expect(graphable(l, 'fill')).toBe(false);
    expect(graphable(l, 'd')).toBe(false);
    expect(graphable(l, 'da')).toBe(false);
  });
  it('picks the segment of the selected key, else the one under the playhead', () => {
    const tr: any[] = [
      [0, 0, 'ease'],
      [1, 1, 'ease'],
      [2, 0, 'ease'],
    ];
    S.keys = new Set();
    S.time = 1.5;
    expect(segIndex(tr)).toBe(1);
    S.keys = new Set([tr[2]]);
    expect(segIndex(tr)).toBe(1);
    S.keys = new Set([tr[0]]);
    expect(segIndex(tr)).toBe(0);
  });
});
