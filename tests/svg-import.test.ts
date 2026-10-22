// SVG import: transforms become position / rotate / skew / scale exactly, gradients convert exactly,
// and the converter keeps hierarchy, names, masks, text lines and images.
import { describe, it, expect } from 'vitest';
import { H } from '../src/core/constants';
import { setIdc } from '../src/core/state';
import { Converter, family } from '../src/io/svg-convert';
import { apply, decompose, inv, linOf, mul, parseSheet, placeLayer, toGrad, moveOrigin } from '../src/io/svg-paint';
import { mkLayer } from '../src/core/state';
import { parseSVG } from '../src/io/svg-import';
import type { Layer } from '../src/model/types';

/** the matrix a layer draws with (no parents) */
function matOfLayer(l: Layer) {
  const c = H.comp(l, 0) as any;
  let M = [1, 0, 0, 1, c.x, c.y];
  M = mul(M, linOf(c.r, c.kx || 0, c.ky || 0, c.sx, c.sy));
  return mul(M, [1, 0, 0, 1, -c.ox, -c.oy]);
}
const close = (a: number[], b: number[], eps = 1e-3) => a.every((v, i) => Math.abs(v - b[i]) < eps);

describe('transforms', () => {
  const mats = [
    [1, 0, 0, 1, 10, 20],
    [0.564438, 0, 0, 0.564439, 157.6, 181.5],
    [-0.725306, 0.688426, -0.688426, -0.725306, 415.8, 66.9],
    [0.9, 0.2, -0.1, 1, 5, 5],
    [-1, 0, 0, 1, 50, 0],
    [2, 0.5, 1.5, -0.7, -30, 12],
  ];
  it.each(mats)('a layer reproduces matrix %#', (...M) => {
    for (const o of [
      [0, 0],
      [40, -12],
    ] as Array<[number, number]>) {
      const l = mkLayer('rect', 'r', { x: 0, y: 0, w: 10, h: 10 }, {});
      placeLayer(l, M, o);
      expect(close(matOfLayer(l), M)).toBe(true);
      // moving the origin keeps it in place
      moveOrigin(l, [7, 9]);
      expect(close(matOfLayer(l), M, 2e-3)).toBe(true);
    }
  });
  it('decomposes into rotate · skewX · scale', () => {
    const q = decompose(linOf(30, 12, 0, 2, -0.5));
    expect(q.r).toBeCloseTo(30, 6);
    expect(q.kx).toBeCloseTo(12, 6);
    expect(q.sx).toBeCloseTo(2, 6);
    expect(q.sy).toBeCloseTo(-0.5, 6);
  });
});

describe('gradients', () => {
  // the value a linear gradient gives a point (in the gradient's user units)
  const linAt = (p: number[], M: number[], x: number, y: number) => {
    const [gx, gy] = apply(inv(M), x, y),
      d = [p[2] - p[0], p[3] - p[1]];
    return ((gx - p[0]) * d[0] + (gy - p[1]) * d[1]) / (d[0] * d[0] + d[1] * d[1]);
  };
  it('turns a rotated user-space linear gradient into box units exactly', () => {
    const p = [20, 0, 120, 0],
      M = [Math.cos(0.5), Math.sin(0.5), -Math.sin(0.5), Math.cos(0.5), 30, -10],
      box = [20, 70, 100, 40],
      g = toGrad({ kind: 'lin', p, M, s: [], bbox: false }, box);
    for (const [u, v] of [
      [0, 0],
      [1, 0],
      [0.3, 0.8],
      [1, 1],
    ]) {
      const x = box[0] + u * box[2],
        y = box[1] + v * box[3],
        P = g.p,
        d = [P[2] - P[0], P[3] - P[1]],
        ours = ((u - P[0]) * d[0] + (v - P[1]) * d[1]) / (d[0] * d[0] + d[1] * d[1]);
      expect(ours).toBeCloseTo(linAt(p, M, x, y), 2);
    }
  });
  it('turns a stretched, turned radial gradient into a turned ellipse', () => {
    const g = toGrad(
      {
        kind: 'rad',
        c: [0, 0],
        r: 0.810562,
        M: [0.959894, -0.280365, 0.201685, 0.690517, 0.59184, 0.5],
        s: [],
        bbox: true,
      },
      null,
    );
    expect(g.cx).toBeCloseTo(0.592, 3);
    expect(g.cy).toBeCloseTo(0.5, 3);
    expect(g.r).toBeCloseTo(0.81, 2);
    expect(g.ra).toBeCloseTo(-16.28, 1);
    expect(g.rr).toBeCloseTo(0.719, 2);
  });
});

describe('styles and fonts', () => {
  it('reads simple stylesheet rules by specificity', () => {
    const r = parseSheet('@font-face{x:y} .a{fill:red} rect{fill:blue} #i{fill:green} a b{fill:pink}');
    expect(r.map(x => x.sel)).toEqual(['rect', '.a', '#i']);
  });
  it('maps font families (SVGator prefixes, web fonts, generic stacks)', () => {
    expect(family('"e92aV4tZfOH1:::Roboto"')).toBe('Roboto');
    expect(family("'Open Sans', sans-serif")).toBe('Open Sans');
    expect(family('serif')).toMatch(/Georgia/);
    expect(family('Arial')).toBe('Arial');
  });
});

describe('converter', () => {
  const conv = (svg: string) => {
    setIdc(0);
    return new Converter(parseSVG(svg)!).run();
  };
  const by = (cv: Converter, n: string) => cv.layers.find(l => l.name === n)!;
  it('keeps groups, order and names (SVGator names, labels, ids)', () => {
    const cv = conv(`<svg xmlns="http://www.w3.org/2000/svg" id="proj" viewBox="0 0 100 100">
      <g id="proj-u-hero"><rect id="proj-s-rect1" width="10" height="10"/><circle id="proj-s-ellipse3" r="4"/></g>
      <g data-name="Back"><path id="path123" d="M0 0L5 5"/></g><rect id="Logo_x20_mark" width="1" height="1"/></svg>`);
    expect(cv.layers.map(l => l.name)).toEqual(['hero', 'Rectangle 1', 'Ellipse 3', 'Back', 'Path 1', 'Logo mark']);
    expect(by(cv, 'Rectangle 1').parent).toBe(by(cv, 'hero').id);
  });
  it('inherits paint from groups and stylesheets; fill and stroke stay editable', () => {
    const cv = conv(`<svg xmlns="http://www.w3.org/2000/svg"><style>.c{stroke:#00f;stroke-width:3px}</style>
      <g fill="#f00" fill-opacity=".5"><rect class="c" width="5" height="5"/></g></svg>`);
    const r = cv.layers.find(l => l.type === 'rect')!;
    expect([r.b.fill, r.b.stk, r.b.sw, r.b.fo]).toEqual(['#ff0000', '#0000ff', 3, 0.5]);
  });
  it('makes mask groups from clip paths and masks', () => {
    const cv = conv(`<svg xmlns="http://www.w3.org/2000/svg">
      <g clip-path="url(#c)"><clipPath id="c"><rect width="5" height="5"/></clipPath><path d="M0 0L9 9"/></g>
      <defs><mask id="m" mask-type="luminance"><circle r="3" fill="#fff"/></mask></defs>
      <rect width="4" height="4" mask="url(#m)"/></svg>`);
    const g = cv.layers.filter(l => l.mask);
    expect(g.map(x => [x.mask, x.mm])).toEqual([
      ['clip', undefined],
      ['mask', 'lum'],
    ]);
    g.forEach(x => expect(cv.layers.some(k => k.parent === x.id && k.maskSrc)).toBe(true));
  });
  it('reads lines of text as one text, and lines placed apart as a group', () => {
    const cv = conv(`<svg xmlns="http://www.w3.org/2000/svg">
      <text font-size="20" font-family="Roboto"><tspan x="0" y="0">One</tspan><tspan x="0" y="25">Two</tspan></text>
      <text x="5" y="5">A<tspan x="50" y="40">B</tspan></text></svg>`);
    const t = cv.layers.find(l => l.type === 'text' && l.geo.text.includes('\n'))!;
    expect(t.geo.text).toBe('One\nTwo');
    expect(t.geo.lh).toBeCloseTo(1.25);
    expect(t.geo.family).toBe('Roboto');
    const grp = cv.layers.find(l => l.type === 'group')!;
    expect(cv.layers.filter(l => l.parent === grp.id).map(l => l.geo.text)).toEqual(['A', 'B']);
  });
  it('turns a blur filter into a Blur, and other filters stay as they are', () => {
    const cv =
      conv(`<svg xmlns="http://www.w3.org/2000/svg"><defs><filter id="b"><feGaussianBlur stdDeviation="4,4"/></filter>
      <filter id="x"><feOffset dx="2"/><feMerge><feMergeNode/></feMerge></filter></defs>
      <rect width="1" height="1" filter="url(#b)"/><rect width="1" height="1" filter="url(#x)"/></svg>`);
    const [a, b] = cv.layers;
    expect(a.fx![0].type).toBe('blur');
    expect(a.b['fx.' + a.fx![0].id + '.sd']).toBe(4);
    expect(b.extra.filter).toBe('url(#x)');
    expect(cv.defsMarkup()).toContain('id="x"');
  });
  it('makes image layers from embedded pictures, fitted like the browser does', () => {
    setIdc(0);
    const cv = new Converter(
      parseSVG(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs>
        <image id="i" width="200" height="100" xlink:href="data:image/png;base64,AAAA"/></defs><use xlink:href="#i" transform="scale(.5)"/></svg>`)!,
      { image: () => ({ id: 'a1', w: 100, h: 100 }) },
    ).run();
    const l = cv.layers[0];
    expect([l.type, l.geo.x, l.geo.y, l.geo.w, l.geo.h, l.geo.asset, l.b.scl[0]]).toEqual([
      'image',
      50,
      0,
      100,
      100,
      'a1',
      0.5,
    ]);
  });
});
