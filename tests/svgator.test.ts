// SVGator import: the scrambled settings, the player data, and the keyframes made from them.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { H } from '../src/core/constants';
import { setIdc } from '../src/core/state';
import { Converter } from '../src/io/svg-convert';
import { parseSVG } from '../src/io/svg-import';
import { playerData, readAnimation, unscramble } from '../src/io/svgator';

const fix = (f: string) => readFileSync(resolve(process.cwd(), 'tests/fixtures/svg', f), 'utf8');

describe('SVGator player data', () => {
  it('finds the data and unscrambles the settings', () => {
    for (const f of ['svgator-test1-js.svg', 'svgator-test2-js-named.svg']) {
      const pd = playerData(fix(f))!;
      expect(pd.key).toBe('91c80d77');
      const s = unscramble(pd.data.animations[0].s, pd.data.root, pd.key);
      expect(s).toEqual({ duration: 3000, direction: 1, iterations: 0, fill: 1, alternate: false, speed: 1, fps: 100 });
      expect(unscramble(pd.data.options, pd.data.root, pd.key)).toEqual({ start: 'load' });
    }
  });
});

describe('SVGator keyframes', () => {
  const text = fix('svgator-test2-js-named.svg');
  setIdc(0);
  const root = parseSVG(text)!,
    anim = readAnimation(root, text)!,
    cv = new Converter(root, { anim, image: () => ({ id: 'a1', w: 200, h: 200 }) }).run(),
    by = (n: string) => cv.layers.find(l => l.name === n)!;
  it('reads the settings', () => {
    expect(anim.settings).toMatchObject({ dur: 3, it: 0, dir: 'normal', fill: 'forwards', speed: 1, trigger: 'load' });
  });
  it('moves along curves at an even speed, like SVGator', () => {
    expect(by('Rectangle 2').ev).toBe(true);
    expect(anim.notes.every(n => /anchor point/.test(n))).toBe(true);
  });
  it('turns the transform into origin, rotate, skew, scale and a curved position track', () => {
    const r = by('Rectangle 2');
    expect(Object.keys(r.t).sort()).toEqual(
      [
        'da',
        'dof',
        'fill',
        'fo',
        'org',
        'op',
        'pos',
        'rad',
        'rot',
        'scl',
        'skw',
        'so',
        'stk',
        'sw',
        'sz',
        `fx.${r.fx![0].id}.sd`,
      ].sort(),
    );
    // at 1.5 s: SVGator's origin point o, rotate 48.56°, skew 10° / 6°, anchor −(76.9, 71.89)
    const c = H.comp(r, 1.5);
    expect([c.x, c.y].map(v => Math.round(v * 100) / 100)).toEqual([300.23, 230.01]);
    expect([c.ox, c.oy]).toEqual([76.899, 71.887]);
    expect(c.r).toBeCloseTo(48.56, 2);
    expect([c.kx, c.ky]).toEqual([10, 6]);
    // a curved segment
    expect(r.t.pos[0][3]).toBeTruthy();
    // scale starts at 0.7 s and eases in and out
    expect(r.t.scl.map(q => q[0])).toEqual([0.7, 2.2]);
    expect(r.t.scl[1][2]).toEqual([0.42, 0, 0.58, 1]);
  });
  it('size grows from the corner, radius, dashes and blur', () => {
    const r = by('Rectangle 2');
    expect(r.sa).toEqual([0, 0]);
    expect(r.t.sz.map(q => q[1])).toEqual([
      [106.58, 106.58],
      [171.614, 106.58],
    ]);
    expect(r.t.rad.map(q => q[1])).toEqual([0, 18]);
    expect(r.t.da.map(q => q[1])).toEqual([[], [5]]);
    expect(r.t[`fx.${r.fx![0].id}.sd`].map(q => q[1])).toEqual([4, 2]);
  });
  it('no stroke to a gradient, and a linear to a radial gradient, switch halfway (as in SVGator)', () => {
    const r = by('Rectangle 2');
    expect(r.t.stk.map(q => [q[0], typeof q[1] === 'object' ? q[1].g : q[1], q[2]])).toEqual([
      [0, 'none', 'hold'],
      [0.75, 'lin', 'hold'],
      [1.5, 'lin', 'linear'],
    ]);
    const p = by('Path 2');
    expect(p.t.fill.map(q => [q[0], q[1].g])).toEqual([
      [0, 'lin'],
      [0.4, 'rad'],
      [0.8, 'rad'],
      [1.5, 'rad'],
    ]);
    expect(p.t.d.length).toBe(2);
  });
  it('keeps the image’s eased motion', () => {
    const s = by('s1');
    expect(s.t.pos.map(q => q[0])).toEqual([0, 1.5]);
    expect(s.t.pos[0][2]).toEqual([0.075, 0.82, 0.165, 1]);
    expect(cv.keepOrigin.has(s)).toBe(true);
  });
});
