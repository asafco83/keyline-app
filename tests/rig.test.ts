import { describe, expect, it } from 'vitest';
import { H } from '../src/core/constants';
import { splitEase } from '../src/tools/rig';

// a pose key splits an eased segment in two; the two halves must trace the original curve exactly
describe('splitEase', () => {
  const curves = ['ease', 'inOutSine', 'outCubic', [0.2, 0.7, 0.4, 1]] as const;
  for (const e of curves)
    for (const u of [0.15, 0.5, 0.8])
      it(`${JSON.stringify(e)} at ${u}`, () => {
        const sp = splitEase(e as any, u);
        expect(sp).not.toBeNull();
        const [a, b] = sp!,
          mid = H.ease(e as any, u);
        for (let i = 1; i < 10; i++) {
          const p = i / 10,
            t = p * u,
            t2 = u + p * (1 - u);
          expect(mid * H.ease(a, p)).toBeCloseTo(H.ease(e as any, t), 3);
          expect(mid + (1 - mid) * H.ease(b, p)).toBeCloseTo(H.ease(e as any, t2), 3);
        }
      });
  it('linear and hold stay as they are', () => {
    expect(splitEase('linear', 0.3)).toEqual(['linear', 'linear']);
    expect(splitEase('hold', 0.3)).toEqual(['hold', 'hold']);
  });
});
