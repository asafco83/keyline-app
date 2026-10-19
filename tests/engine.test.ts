import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KLEngine, type EngineLayer } from '../src/runtime/engine';

const layer = (t: EngineLayer['t'], b: Record<string, any> = {}): EngineLayer => ({
  id: 'a',
  o: [0, 0],
  b: { pos: [0, 0], rot: 0, scl: [1, 1], op: 1, ...b },
  t,
});
const H = KLEngine({ L: [] }, null);

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
    KLEngine(
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
    const P = KLEngine({ dur: 2, it: 0, dir: 'alternate', L: [] }, null);
    expect(P.loc(2.5)).toBeCloseTo(1.5);
  });
});

describe('embedding', () => {
  it('KLEngine is self-contained so it can be serialised into exported SVGs', () => {
    const Rebuilt = new Function('return ' + KLEngine.toString())();
    const L = layer({
      pos: [
        [0, [0, 0], 'linear'],
        [1, [10, 0], 'linear'],
      ],
    });
    expect(Rebuilt({ L: [] }, null).comp(L, 0.5).x).toBeCloseTo(5);
  });
  it('contains nothing that would break the SVG CDATA block', () => {
    expect(KLEngine.toString()).not.toContain(']]>');
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
    const P = KLEngine({ p: 'x-', dur: 1, L: [L] }, document.body);
    P.apply(0.5);
    const fe = document.getElementById('x-a-f1');
    expect(fe.getAttribute('stdDeviation')).toBe('4');
    expect(fe.getAttribute('flood-color')).toBe('rgb(128,128,128)');
  });
});
