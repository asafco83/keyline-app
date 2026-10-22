import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CinEngine, type EngineLayer } from '../src/runtime/engine';

const layer = (t: EngineLayer['t'], b: Record<string, any> = {}): EngineLayer => ({
  id: 'a',
  o: [0, 0],
  b: { pos: [0, 0], rot: 0, scl: [1, 1], op: 1, ...b },
  t,
});
const H = CinEngine({ L: [] }, null);

describe('easing', () => {
  const names = [
    ...Object.keys(H.EZ),
    'linear',
    'hold',
    'inBounce',
    'outBounce',
    'inOutBounce',
    'inElastic',
    'outElastic',
    'inOutElastic',
  ];
  it.each(names)('%s starts at 0 and ends at 1', n => {
    expect(H.ease(n, 0)).toBeCloseTo(0, 5);
    if (n !== 'hold') expect(H.ease(n, 1)).toBeCloseTo(1, 5);
  });
  it('linear is the identity', () => {
    expect(H.ease('linear', 0.37)).toBeCloseTo(0.37, 6);
  });
  it('hold stays at the start value until the next key', () => {
    expect(H.ease('hold', 0.999)).toBe(0);
    expect(H.ease('hold', 1)).toBe(1);
  });
  it('custom cubic-bezier [0,0,1,1] behaves like linear', () => {
    expect(H.ease([0, 0, 1, 1], 0.42)).toBeCloseTo(0.42, 4);
  });
  it('ease-in is slower than linear in the first half', () => {
    expect(H.ease('in', 0.25)).toBeLessThan(0.25);
  });
  it('back overshoots past 1', () => {
    const peak = Math.max(...Array.from({ length: 50 }, (_, i) => H.ease('outBack', i / 49)));
    expect(peak).toBeGreaterThan(1);
  });
});

describe('interpolation', () => {
  it('interpolates position linearly', () => {
    const L = layer({
      pos: [
        [0, [0, 0], 'linear'],
        [2, [100, 50], 'linear'],
      ],
    });
    const c = H.comp(L, 1);
    expect(c.x).toBeCloseTo(50);
    expect(c.y).toBeCloseTo(25);
  });
  it('clamps before the first and after the last key', () => {
    const L = layer({
      rot: [
        [1, 10, 'linear'],
        [2, 20, 'linear'],
      ],
    });
    expect(H.comp(L, 0).r).toBe(10);
    expect(H.comp(L, 5).r).toBe(20);
  });
  it('mixes colours', () => {
    const L = layer({
      fill: [
        [0, '#000000', 'linear'],
        [1, '#ffffff', 'linear'],
      ],
    });
    expect(H.comp(L, 0.5).fill).toBe('rgb(128,128,128)');
  });
  it('steps between colours it cannot parse', () => {
    const L = layer({
      fill: [
        [0, 'url(#a)', 'linear'],
        [1, 'url(#b)', 'linear'],
      ],
    });
    expect(H.comp(L, 0.5).fill).toBe('url(#a)');
  });
  it('morphs between shapes with the same node count', () => {
    const a = [
      {
        c: true,
        n: [
          [0, 0, 0, 0, 0, 0],
          [10, 0, 10, 0, 10, 0],
        ],
      },
    ];
    const b = [
      {
        c: true,
        n: [
          [0, 10, 0, 10, 0, 10],
          [20, 0, 20, 0, 20, 0],
        ],
      },
    ];
    const L = layer({
      d: [
        [0, a, 'linear'],
        [1, b, 'linear'],
      ],
    });
    expect(H.comp(L, 0.5).d[0].n[0][1]).toBeCloseTo(5);
  });
  it('animates the origin', () => {
    const L = layer({
      org: [
        [0, [0, 0], 'linear'],
        [1, [10, 20], 'linear'],
      ],
    });
    const c = H.comp(L, 0.5);
    expect(c.ox).toBeCloseTo(5);
    expect(c.oy).toBeCloseTo(10);
  });
  it('builds compact path data', () => {
    expect(
      H.dstr([
        {
          c: true,
          n: [
            [0, 0, 0, 0, 0, 0],
            [10, 0, 10, 0, 10, 0],
            [10, 10, 10, 10, 10, 10],
          ],
        },
      ]),
    ).toBe('M0 0L10 0L10 10L0 0Z');
  });
});

describe('player API', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  const make = (extra = {}) =>
    CinEngine(
      {
        p: 'x-',
        dur: 2,
        it: 1,
        L: [
          layer({
            rot: [
              [0, 0, 'linear'],
              [2, 360, 'linear'],
            ],
          }),
        ],
        ...extra,
      },
      null,
    );

  it('plays, reports time and fires end once', () => {
    const P = make();
    const events: string[] = [];
    P.on('play end', function (this: any) {
      events.push('x');
    });
    P.on('end', () => events.push('end'));
    P.play();
    vi.advanceTimersByTime(1000);
    expect(P.isPlaying).toBe(true);
    expect(P.currentTime).toBeGreaterThan(900);
    expect(P.state).toBe('playing');
    vi.advanceTimersByTime(1500);
    expect(P.hasEnded).toBe(true);
    expect(P.state).toBe('ended');
    expect(P.currentTime).toBe(2000);
    expect(events.filter(e => e === 'end')).toHaveLength(1);
  });
  it('seeks by percent, absolute and relative time', () => {
    const P = make();
    expect(P.seek(50).currentTime).toBe(1000);
    expect(P.seekTo(250).currentTime).toBe(250);
    expect(P.seekBy(-100).currentTime).toBe(150);
  });
  it('rolls back to the start and stops', () => {
    const P = make();
    P.play();
    vi.advanceTimersByTime(800);
    P.rollback();
    expect(P.isRollingBack).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(P.currentTime).toBe(0);
    expect(P.state).toBe('ended');
  });
  it('respects speed', () => {
    const P = make();
    P.set('speed', 2).play();
    vi.advanceTimersByTime(500);
    expect(P.currentTime).toBeGreaterThan(900);
  });
  it('is chainable and can be destroyed', () => {
    const P = make();
    expect(P.play().pause().restart()).toBe(P);
    P.destruct();
    expect(P.state).toBe('destroyed');
  });
  it('maps alternate iterations backwards', () => {
    const P = CinEngine({ dur: 2, it: 0, dir: 'alternate', L: [] }, null);
    expect(P.loc(2.5)).toBeCloseTo(1.5);
  });
});

describe('embedding', () => {
  it('CinEngine is self-contained so it can be serialised into exported SVGs', () => {
    const Rebuilt = new Function('return ' + CinEngine.toString())();
    const L = layer({
      pos: [
        [0, [0, 0], 'linear'],
        [1, [10, 0], 'linear'],
      ],
    });
    expect(Rebuilt({ L: [] }, null).comp(L, 0.5).x).toBeCloseTo(5);
  });
  it('contains nothing that would break the SVG CDATA block', () => {
    expect(CinEngine.toString()).not.toContain(']]>');
  });
});

describe('skew, opacities, dash offset and filter tracks', () => {
  it('skews in the transform only when set', () => {
    const plain = layer({}),
      sk = layer({
        skw: [
          [0, [0, 0], 'linear'],
          [1, [20, -10], 'linear'],
        ],
      });
    expect(H.comp(plain, 0).kx).toBe(0);
    const c = H.comp(sk, 0.5);
    expect(c.kx).toBeCloseTo(10);
    expect(c.ky).toBeCloseTo(-5);
  });
  it('animates fill and stroke opacity and dash offset', () => {
    const L = layer({
      fo: [
        [0, 1, 'linear'],
        [1, 0, 'linear'],
      ],
      so: [
        [0, 0, 'linear'],
        [1, 1, 'linear'],
      ],
      dof: [
        [0, 0, 'linear'],
        [1, 40, 'linear'],
      ],
    });
    const c = H.comp(L, 0.25);
    expect(c.fo).toBeCloseTo(0.75);
    expect(c.so).toBeCloseTo(0.25);
    expect(c.dof).toBeCloseTo(10);
  });
  it('drives filter attributes and mixes colours for them', () => {
    document.body.innerHTML =
      '<svg><g id="x-a"><rect id="x-a-s"/><filter><feDropShadow id="x-a-f1"/></filter></g></svg>';
    const L: any = layer({
      'fx.f1.sd': [
        [0, 0, 'linear'],
        [1, 8, 'linear'],
      ],
      'fx.f1.col': [
        [0, '#000000', 'linear'],
        [1, '#ffffff', 'linear'],
      ],
    });
    L.fa = { 'fx.f1.sd': ['-f1', 'stdDeviation'], 'fx.f1.col': ['-f1', 'flood-color'] };
    const P = CinEngine({ p: 'x-', dur: 1, L: [L] }, document.body);
    P.apply(0.5);
    const fe = document.getElementById('x-a-f1');
    expect(fe.getAttribute('stdDeviation')).toBe('4');
    expect(fe.getAttribute('flood-color')).toBe('rgb(128,128,128)');
  });
});

describe('curved motion path segments', () => {
  it('follows the cubic stored on the keyframe', () => {
    const L: EngineLayer = {
      id: 'c',
      b: { pos: [0, 0] },
      t: {
        pos: [
          [0, [0, 0], 'linear', [0, 100, 0, 100]],
          [1, [100, 0], 'linear'],
        ],
      },
    };
    expect(H.get(L, 'pos', 0.5)).toEqual([50, 75]);
    expect(H.get(L, 'pos', 1)).toEqual([100, 0]);
  });
  it('stays straight without a curve', () => {
    const L: EngineLayer = {
      id: 'c',
      b: {},
      t: {
        pos: [
          [0, [0, 0], 'linear'],
          [1, [100, 0], 'linear'],
        ],
      },
    };
    expect(H.get(L, 'pos', 0.5)).toEqual([50, 0]);
  });
});

describe('corner radius and line ends', () => {
  it('rebuilds a polygon path from an animated radius, keeping the node count', () => {
    const L: EngineLayer = {
      id: 'p',
      b: {},
      shape: { kind: 'polygon', cx: 0, cy: 0, r: 100, rot: 0, n: 4 },
      t: {
        rad: [
          [0, 0, 'linear'],
          [1, 20, 'linear'],
        ],
      },
    };
    const a = H.comp(L, 0).d,
      b = H.comp(L, 0.5).d;
    expect(a[0].n.length).toBe(8);
    expect(b[0].n.length).toBe(8);
    // at radius 0 both nodes of a corner sit on the corner
    expect(a[0].n[0].slice(0, 2)).toEqual(a[0].n[1].slice(0, 2));
    expect(H.comp(L, 0.5).rad).toBe(10);
  });
  it('animates a rectangle radius as rx', () => {
    const L: EngineLayer = {
      id: 'r',
      b: {},
      t: {
        rad: [
          [0, 0, 'linear'],
          [1, 8, 'linear'],
        ],
      },
    };
    expect(H.comp(L, 0.25).rad).toBe(2);
    expect(H.comp({ id: 'r', b: {}, t: {} }, 0).rad).toBeNull();
  });
  it('moves the ends of a line', () => {
    const L: EngineLayer = {
      id: 'l',
      b: {
        d: [
          {
            c: false,
            n: [
              [0, 0, 0, 0, 0, 0],
              [10, 0, 10, 0, 10, 0],
            ],
          },
        ],
      },
      t: {
        p1: [
          [0, [10, 0], 'linear'],
          [1, [10, 20], 'linear'],
        ],
      },
    };
    const d = H.comp(L, 0.5).d;
    expect(d[0].n[0]).toEqual([0, 0, 0, 0, 0, 0]);
    expect(d[0].n[1]).toEqual([10, 10, 10, 10, 10, 10]);
  });
});

describe('gradients and trim path', () => {
  const G = (o: any) => ({
    g: 'lin',
    a: 90,
    s: [
      [0, '#000000'],
      [1, '#ffffff'],
    ],
    ...o,
  });
  it('blends two gradients stop by stop', () => {
    const L: EngineLayer = {
      id: 'g',
      b: {},
      t: {
        fill: [
          [0, G({}), 'linear'],
          [
            1,
            G({
              a: 0,
              s: [
                [0.5, '#000000'],
                [1, '#000000'],
              ],
            }),
            'linear',
          ],
        ],
      },
    };
    const v = H.get(L, 'fill', 0.5);
    expect(v.g).toBe('lin');
    expect(v.a).toBe(45);
    expect(v.s[0][0]).toBeCloseTo(0.25);
    expect(v.s[1][1]).toBe('rgb(128,128,128)');
  });
  it('blends a solid colour into a gradient', () => {
    const L: EngineLayer = {
      id: 'g',
      b: {},
      t: {
        fill: [
          [0, '#ff0000', 'linear'],
          [1, G({}), 'linear'],
        ],
      },
    };
    const v = H.get(L, 'fill', 0.5);
    expect(H.isG(v)).toBe(true);
    expect(v.s[0][1]).toBe('rgb(128,0,0)');
  });
  it('computes gradient geometry from the angle', () => {
    expect(H.gAttrs({ g: 'lin', a: 90, s: [] })).toEqual({ x1: '0', y1: '0.5', x2: '1', y2: '0.5' });
    expect(H.gAttrs({ g: 'rad', cx: 0.3, cy: 0.4, r: 0.6, s: [] }).r).toBe('0.6');
  });
  it('places gradients from points and as turned ellipses', () => {
    expect(H.gAttrs({ g: 'lin', a: 90, p: [0.1, 0.2, 0.9, 0.8], s: [] })).toEqual({
      x1: '0.1',
      y1: '0.2',
      x2: '0.9',
      y2: '0.8',
    });
    expect(H.gAttrs({ g: 'rad', s: [] }).gradientTransform).toBeUndefined();
    expect(H.gAttrs({ g: 'rad', cx: 0.5, cy: 0.5, r: 0.5, ra: 30, rr: 0.5, s: [] }).gradientTransform).toBe(
      'translate(0.5,0.5) rotate(30) scale(1,0.5) translate(-0.5,-0.5)',
    );
    const m = H.get(
      {
        id: 'g',
        b: {},
        t: {
          fill: [
            [
              0,
              {
                g: 'lin',
                s: [
                  [0, '#000'],
                  [1, '#fff'],
                ],
              },
              'linear',
            ],
            [
              1,
              {
                g: 'lin',
                p: [0, 0, 1, 1],
                s: [
                  [0, '#000'],
                  [1, '#fff'],
                ],
              },
              'linear',
            ],
          ],
        },
      },
      'fill',
      0.5,
    );
    expect(m.p).toEqual([0, 0.25, 1, 0.75]);
  });
  it('trim dashes paint only the trimmed part (no stray dot from a dash at the ends)', () => {
    // the dashes a dasharray / dashoffset pair puts on a path of length 100, as [start, end]
    const pieces = ([da, off]: string[]) => {
      const [d, g] = da.split(' ').map(Number),
        per = d + g,
        out: number[][] = [];
      for (let s = -Number(off) - 5 * per; s < 100 + 1e-9; s += per) {
        const a = Math.max(0, s),
          b = Math.min(100, s + d);
        if (s + d >= -1e-9 && s <= 100 + 1e-9) out.push([+a.toFixed(3), +b.toFixed(3)]);
      }
      return out;
    };
    expect(pieces(H.trimDash([0, 0, 0]))).toEqual([]);
    expect(pieces(H.trimDash([30, 30, 50]))).toEqual([]);
    expect(pieces(H.trimDash([0, 7.08, 0]))).toEqual([[0, 7.08]]);
    expect(pieces(H.trimDash([0, 100, 0]))).toEqual([[0, 100]]);
    expect(pieces(H.trimDash([50, 100, 0]))).toEqual([[50, 100]]);
    expect(pieces(H.trimDash([20, 60, 0]))).toEqual([[20, 60]]);
    // crossing the end wraps around to the start (closed shapes)
    expect(pieces(H.trimDash([60, 90, 30]))).toEqual([
      [0, 20],
      [90, 100],
    ]);
    expect(pieces(H.trimDash([10, 30, 150]))).toEqual([[60, 80]]);
  });
  it('trims the stroke', () => {
    expect(H.trimDash([10, 50, 5])).toEqual(['40 160', '-15']);
    const L: EngineLayer = {
      id: 't',
      b: {},
      t: {
        te: [
          [0, 0, 'linear'],
          [1, 100, 'linear'],
        ],
      },
    };
    expect(H.comp(L, 0.5).trim).toEqual([0, 50, 0]);
    expect(H.comp({ id: 'n', b: {}, t: {} }, 0).trim).toBeNull();
  });
});

describe('size and dash pattern', () => {
  it('resizes a rectangle around its origin', () => {
    const L: EngineLayer = {
      ...layer({
        sz: [
          [0, [100, 50], 'linear'],
          [1, [200, 50], 'linear'],
        ],
      }),
      o: [0, 25],
      type: 'rect',
      geo: { x: 0, y: 0, w: 100, h: 50 },
    };
    // origin on the left edge: it grows to the right
    expect(H.comp(L, 1).gb).toEqual([0, 0, 200, 50]);
    // origin in the middle: it grows both ways
    L.o = [50, 25];
    expect(H.comp(L, 1).gb).toEqual([-50, 0, 200, 50]);
    expect(H.comp(L, 0.5).gb).toEqual([-25, 0, 150, 50]);
  });
  it('resizes an ellipse and leaves layers without a size track alone', () => {
    const L: EngineLayer = {
      ...layer({ sz: [[0, [40, 20], 'linear']] }),
      o: [10, 10],
      type: 'ellipse',
      geo: { cx: 10, cy: 10, rx: 10, ry: 5 },
    };
    expect(H.comp(L, 0).gb).toEqual([-10, 0, 40, 20]);
    expect(H.comp({ ...L, t: {} }, 0).gb).toBeNull();
  });
  it('resizes a path from the box of its base shape', () => {
    const d = [
      {
        c: true,
        n: [
          [0, 0, 0, 0, 0, 0],
          [10, 0, 10, 0, 10, 0],
          [10, 10, 10, 10, 10, 10],
        ],
      },
    ];
    const L: EngineLayer = { ...layer({ sz: [[0, [20, 5], 'linear']] }, { d }), o: [0, 0], type: 'path' };
    expect(H.comp(L, 0).d![0].n[2].slice(0, 2)).toEqual([20, 5]);
  });
  it('measures the exact box of curves', () => {
    // a half circle bulging to y = -50 (control points reach further)
    const k = 0.5523 * 50;
    const b = H.pathBox([
      {
        c: false,
        n: [
          [-50, 0, -50, 0, -50, -k],
          [0, -50, -k, -50, k, -50],
          [50, 0, 50, -k, 50, 0],
        ],
      },
    ]);
    expect(b.map(v => Math.round(v))).toEqual([-50, -50, 100, 50]);
  });
  it('blends dash patterns like SVGator: empty = zeros, different lengths repeat', () => {
    const L = layer({
      da: [
        [0, [], 'linear'],
        [1, [4], 'linear'],
      ],
    });
    expect(H.comp(L, 0.5).da).toEqual([2]);
    const M = layer({
      da: [
        [0, [2, 4], 'linear'],
        [1, [4, 2, 6], 'linear'],
      ],
    });
    expect(H.comp(M, 0.5).da).toEqual([3, 3, 4, 4, 2, 5]);
    expect(H.dashStr([])).toBe('none');
    expect(H.comp(layer({}), 0).da).toBeNull();
  });
});

describe('even speed along curves', () => {
  // a quarter-circle-like curve whose handles bunch the parameter at the start
  const tr = [
    [0, [0, 0], 'linear', [0, 0, -90, 0]],
    [1, [100, 100], 'linear'],
  ] as any;
  it('by default follows the curve parameter, with ev at even speed by length', () => {
    const plain = H.comp(layer({ pos: tr }), 0.5),
      L = { ...layer({ pos: tr }), ev: 1 as const },
      even = H.comp(L, 0.5);
    expect(plain.x).not.toBeCloseTo(even.x, 1);
    // halfway in time is halfway along the curve's length
    const len = (to: number) => {
      let s = 0,
        p = H.comp(L, 0);
      for (let i = 1; i <= 200; i++) {
        const q = H.comp(L, (to * i) / 200);
        s += Math.hypot(q.x - p.x, q.y - p.y);
        p = q;
      }
      return s;
    };
    expect(len(0.5) / len(1)).toBeCloseTo(0.5, 2);
  });
});
