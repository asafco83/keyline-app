import { describe, it, expect } from 'vitest';
import { onionTimes } from '../src/ui/onion';

describe('onion skin', () => {
  it('spaces ghosts before and after the playhead, fading with distance, inside the animation', () => {
    const o = { on: true, before: 3, after: 2, step: 0.1, fade: 60 };
    expect(onionTimes(1, o, 3)).toEqual([
      [0.9, -1, 0.6],
      [0.8, -1, 0.4],
      [0.7, -1, 0.2],
      [1.1, 1, 0.6],
      [1.2, 1, 0.3],
    ]);
    expect(
      onionTimes(0.15, o, 3)
        .filter(g => g[1] < 0)
        .map(g => g[0]),
    ).toEqual([0.05]);
    expect(onionTimes(2.95, o, 3).filter(g => g[1] > 0).length).toBe(0);
  });
});
