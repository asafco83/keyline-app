// CSS animations: SVGator's CSS export imports to the same keyframes as its JS export, and simple CSS
// keyframe animations from elsewhere come across too.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { H } from '../src/core/constants';
import { setIdc } from '../src/core/state';
import { Converter } from '../src/io/svg-convert';
import { parseSVG } from '../src/io/svg-import';
import { readAnimation } from '../src/io/svgator';
import { parseCSS } from '../src/io/css-anim';

const fix = (f: string) => readFileSync(resolve(process.cwd(), 'tests/fixtures/svg', f), 'utf8');
function load(text: string) {
  setIdc(0);
  const root = parseSVG(text)!,
    anim = readAnimation(root, text)!,
    cv = new Converter(root, { anim, image: () => ({ id: 'a1', w: 200, h: 200 }) }).run();
  return { anim, cv, by: (n: string) => cv.layers.find(l => l.name === n)! };
}

describe('CSS keyframes', () => {
  it('reads keyframes, per-stop easing and both animation syntaxes', () => {
    const { keyframes, rules } = parseCSS(
      '@keyframes a{0%{opacity:0;animation-timing-function:cubic-bezier(.4,0,.2,1)}50%,100%{opacity:1}} #x{animation:a 2s ease-in-out infinite alternate both} #y{animation-name:a,b;animation-duration:3000ms}',
    );
    expect(keyframes.a.map(s => s.pct)).toEqual([0, 0.5, 1]);
    expect(rules.map(r => r.sel)).toEqual(['#x', '#y']);
  });
});

describe('SVGator CSS export', () => {
  const css = load(fix('svgator-test1-css.svg')),
    js = load(fix('svgator-test1-js.svg'));
  it('reads the playback settings', () => {
    expect(css.anim.settings).toMatchObject({ dur: 3, it: 0, dir: 'normal', fill: 'forwards' });
  });
  it('folds the wrapper groups into one layer, named and placed like the JS export', () => {
    expect(css.cv.layers.map(l => l.name)).toEqual(js.cv.layers.map(l => l.name));
    expect(css.cv.layers.some(l => /_t[oksr]$/.test(l.name))).toBe(false);
  });
  it('makes the same keyframes as the JS export (the anchor read once, the blur as set)', () => {
    const a = css.by('Rectangle 2'),
      b = js.by('Rectangle 2');
    // (an easing on the last key never applies)
    const r2 = (v: any): any => (typeof v === 'number' ? Math.round(v * 100) / 100 : Array.isArray(v) ? v.map(r2) : v);
    const norm = (tr: any[]) => r2(tr.map((q, i) => (i === tr.length - 1 ? [q[0], q[1], 'linear', ...q.slice(3)] : q)));
    for (const k of ['org', 'rot', 'skw', 'scl', 'pos', 'sz', 'rad', 'fill', 'fo', 'so', 'sw', 'dof', 'da'])
      expect([k, norm(a.t[k])]).toEqual([k, norm(b.t[k])]);
    const blur = (l: any) => l.t['fx.' + l.fx[0].id + '.sd'];
    expect(blur(a)).toEqual(blur(b));
    expect([a.o, a.sa, a.ev]).toEqual([b.o, b.sa, b.ev]);
    // and it draws the same at any time
    for (const t of [0, 0.4, 1.1, 2.5]) {
      const ca = H.comp(a, t),
        cb = H.comp(b, t);
      [ca.x - cb.x, ca.y - cb.y, ca.r - cb.r, ca.sx - cb.sx, ca.sy - cb.sy].forEach(d =>
        expect(Math.abs(d)).toBeLessThan(0.01),
      );
    }
  });
});

describe('other CSS animations', () => {
  it('a spinning, pulsing shape (transform-origin in its box, a missing 0%)', () => {
    const { anim, by } = load(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><style>
      @keyframes spin { to { transform: rotate(360deg) } }
      @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: .2 } }
      #r { transform-box: fill-box; transform-origin: center; animation: spin 2s linear infinite }
      #c { animation: pulse 1s ease-in-out infinite }</style>
      <rect id="r" x="10" y="20" width="40" height="20"/><circle id="c" cx="70" cy="70" r="10"/></svg>`);
    expect(anim.settings).toMatchObject({ dur: 2, it: 0 });
    const r = by('r');
    expect(r.t.rot.map(q => [q[0], q[1]])).toEqual([
      [0, 0],
      [2, 360],
    ]);
    // it turns around the middle of the rectangle
    const c = H.comp(r, 0.5);
    expect([c.x, c.y]).toEqual([30, 30]);
    expect(by('c').t.op.map(q => q[1])).toEqual([1, 0.2, 1]);
    expect(by('c').t.op[0][2]).toEqual([0.42, 0, 0.58, 1]);
  });
});
