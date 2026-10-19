// Keyline runtime — the animation player that ships inside every exported SVG.
// Keep it dependency-free: KLEngine.toString() is embedded verbatim in exports.

/** Keyframe: [time in seconds, value, easing to the next key]. */
/** preset name or cubic-bezier [x1, y1, x2, y2] */
export type Ease = string | number[];
export type Keyframe = [number, any, Ease];
export interface EngineLayer {
  id: string;
  /** transform origin in the layer's own space */
  o?: [number, number] | null;
  /** base (unanimated) values */
  b: Record<string, any>;
  /** animated tracks, keyed by property */
  t: Record<string, Keyframe[]>;
  /** curved motion path */ sm?: boolean | 1;
  /** orient along motion path */ or?: boolean | 1;
  /** extra animated attributes: track key → [element id suffix, attribute] (filter parameters) */
  fa?: Record<string, [string, string]>;
}
type EaseFn = (p: number) => number;
type Bezier = number[];
type RGBA = number[];
type Vec = number[];
/** subpath: closed flag + cubic nodes [x, y, inX, inY, outX, outY] */
export interface EngineSubPath {
  c: boolean;
  n: number[][];
}
/** A layer's resolved values at one moment. */
export interface Composite {
  x: number;
  y: number;
  r: number;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
  op: number;
  fill: any;
  stk: any;
  sw: any;
  draw: any;
  d: EngineSubPath[] | undefined;
  /** skew, degrees */
  kx: number;
  ky: number;
  /** fill / stroke opacity (null = not set) */
  fo: any;
  so: any;
  /** stroke dash offset (null = not set) */
  dof: any;
}
type Handler = (this: KLPlayer, offsetMs: number) => void;
export interface EngineData {
  /** element id prefix */ p?: string;
  dur?: number;
  it?: number;
  dir?: string;
  speed?: number;
  fps?: number;
  fill?: number | string;
  L: EngineLayer[];
}
/** Public player API (SVGator compatible). */
export interface KLPlayer {
  play(): KLPlayer;
  pause(): KLPlayer;
  toggle(): KLPlayer;
  togglePlay(): KLPlayer;
  restart(): KLPlayer;
  reverse(): KLPlayer;
  rollback(): KLPlayer;
  stop(): KLPlayer;
  seek(percent: number): KLPlayer;
  seekTo(ms: number): KLPlayer;
  seekBy(ms: number): KLPlayer;
  set(prop: 'speed' | 'fps' | 'iterations' | 'direction' | 'alternate' | 'fill', value: any): KLPlayer;
  ready(cb: (p: KLPlayer) => void): KLPlayer;
  on(events: string, fn: (offsetMs: number) => void, prepend?: boolean): KLPlayer;
  off(event: string, fn?: (offsetMs: number) => void): KLPlayer;
  destruct(): void;
  onEnd(fn: () => void): KLPlayer;
  setRate(v: number): KLPlayer;
  readonly currentTime: number;
  readonly duration: number;
  readonly totalTime: number;
  readonly fps: number;
  readonly speed: number;
  readonly direction: number;
  readonly fill: number;
  readonly iterations: number;
  readonly hasEnded: boolean;
  readonly isAlternate: boolean;
  readonly isBackwards: boolean;
  readonly isInfinite: boolean;
  readonly isPlaying: boolean;
  readonly isReversed: boolean;
  readonly isRollingBack: boolean;
  readonly state: 'playing' | 'paused' | 'ended' | 'rollback' | 'destroyed';
  // editor helpers
  apply(t: number): void;
  comp(L: EngineLayer, t: number): Composite;
  get(L: EngineLayer, k: string, t: number): any;
  dstr(sp: EngineSubPath[] | null | undefined): string;
  ease(n: Ease, p: number): number;
  loc(x: number): number;
  EZ: Record<string, number[]>;
  _cleanup: Array<() => void>;
}

export function KLEngine(D: EngineData, root: ParentNode | null): KLPlayer {
  // NOTE: this function is serialised with Function.prototype.toString() and embedded in every
  // exported SVG, so it must stay fully self-contained: no imports, no references to module scope.
  var K: Record<string, string> = {
    pos: 'v',
    org: 'v',
    rot: 'n',
    scl: 'v',
    op: 'n',
    fill: 'c',
    stk: 'c',
    sw: 'n',
    draw: 'n',
    d: 'm',
    skw: 'v',
    fo: 'n',
    so: 'n',
    dof: 'n',
  };
  var EZ: Record<string, Bezier> = {
    ease: [0.25, 0.1, 0.25, 1],
    in: [0.42, 0, 1, 1],
    out: [0, 0, 0.58, 1],
    inOut: [0.42, 0, 0.58, 1],
    inSine: [0.12, 0, 0.39, 0],
    outSine: [0.61, 1, 0.88, 1],
    inOutSine: [0.37, 0, 0.63, 1],
    inQuad: [0.11, 0, 0.5, 0],
    outQuad: [0.5, 1, 0.89, 1],
    inOutQuad: [0.45, 0, 0.55, 1],
    inCubic: [0.32, 0, 0.67, 0],
    outCubic: [0.33, 1, 0.68, 1],
    inOutCubic: [0.65, 0, 0.35, 1],
    inQuart: [0.5, 0, 0.75, 0],
    outQuart: [0.25, 1, 0.5, 1],
    inOutQuart: [0.76, 0, 0.24, 1],
    inQuint: [0.64, 0, 0.78, 0],
    outQuint: [0.22, 1, 0.36, 1],
    inOutQuint: [0.83, 0, 0.17, 1],
    inExpo: [0.7, 0, 0.84, 0],
    outExpo: [0.16, 1, 0.3, 1],
    inOutExpo: [0.87, 0, 0.13, 1],
    inCirc: [0.55, 0, 1, 0.45],
    outCirc: [0, 0.55, 0.45, 1],
    inOutCirc: [0.85, 0, 0.15, 1],
    inBack: [0.36, 0, 0.66, -0.56],
    outBack: [0.34, 1.56, 0.64, 1],
    inOutBack: [0.68, -0.6, 0.32, 1.6],
  };
  var BC: Record<string, EaseFn> = {},
    EL: Record<string, Element | null> = {},
    C4 = (2 * Math.PI) / 3,
    C5 = (2 * Math.PI) / 4.5;
  var FN: Record<string, EaseFn> = {
    hold: function (p: number) {
      return p < 1 ? 0 : 1;
    },
    outBounce: bounce,
    inBounce: function (p: number) {
      return 1 - bounce(1 - p);
    },
    inOutBounce: function (p: number) {
      return p < 0.5 ? (1 - bounce(1 - 2 * p)) / 2 : (1 + bounce(2 * p - 1)) / 2;
    },
    outElastic: function (p: number) {
      return p === 0 || p === 1 ? p : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * C4) + 1;
    },
    inElastic: function (p: number) {
      return p === 0 || p === 1 ? p : -Math.pow(2, 10 * p - 10) * Math.sin((p * 10 - 10.75) * C4);
    },
    inOutElastic: function (p: number) {
      return p === 0 || p === 1
        ? p
        : p < 0.5
          ? -(Math.pow(2, 20 * p - 10) * Math.sin((20 * p - 11.125) * C5)) / 2
          : (Math.pow(2, -20 * p + 10) * Math.sin((20 * p - 11.125) * C5)) / 2 + 1;
    },
  };
  function bez(q: Bezier): EaseFn {
    var cx = 3 * q[0],
      bx = 3 * (q[2] - q[0]) - cx,
      ax = 1 - cx - bx,
      cy = 3 * q[1],
      by = 3 * (q[3] - q[1]) - cy,
      ay = 1 - cy - by;
    function sx(t: number) {
      return ((ax * t + bx) * t + cx) * t;
    }
    function sy(t: number) {
      return ((ay * t + by) * t + cy) * t;
    }
    function dx(t: number) {
      return (3 * ax * t + 2 * bx) * t + cx;
    }
    return function (x: number) {
      var t = x,
        i: number,
        e: number,
        d: number,
        lo = 0,
        hi = 1;
      for (i = 0; i < 8; i++) {
        e = sx(t) - x;
        if (Math.abs(e) < 1e-6) return sy(t);
        d = dx(t);
        if (Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      t = x;
      while (hi - lo > 1e-6) {
        e = sx(t);
        if (Math.abs(e - x) < 1e-6) break;
        if (x > e) lo = t;
        else hi = t;
        t = (lo + hi) / 2;
      }
      return sy(t);
    };
  }
  function bounce(x: number) {
    var n = 7.5625,
      d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  }
  function ez(n: Ease, p: number): number {
    if (!n || n === 'linear') return p;
    if (typeof n !== 'string') {
      var key = n.join(',');
      return (BC[key] || (BC[key] = bez(n)))(p);
    }
    if (FN[n]) return FN[n](p);
    var f = BC[n] || (BC[n] = bez(EZ[n] || EZ.ease));
    return f(p);
  }
  function pc(s: unknown): RGBA | null {
    if (typeof s !== 'string') return null;
    var str = s.trim();
    if (str[0] === '#') {
      var h = str.slice(1);
      if (h.length === 3 || h.length === 4) h = h.replace(/./g, '$&$&');
      if (h.length === 6) h += 'ff';
      if (h.length !== 8) return null;
      return [
        parseInt(h.substr(0, 2), 16),
        parseInt(h.substr(2, 2), 16),
        parseInt(h.substr(4, 2), 16),
        parseInt(h.substr(6, 2), 16) / 255,
      ];
    }
    var m = str.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      var a = m[1]
        .split(/[\s,\/]+/)
        .filter(Boolean)
        .map(parseFloat);
      if (a.length === 3) a.push(1);
      return a.length === 4 ? a : null;
    }
    return null;
  }
  function mixC(a: string, b: string, p: number): string {
    var A = pc(a),
      B = pc(b);
    if (!A || !B) return p < 1 ? a : b;
    var c = [0, 1, 2].map(function (i: number) {
        return Math.round(A[i] + (B[i] - A[i]) * p);
      }),
      al = A[3] + (B[3] - A[3]) * p;
    return al >= 0.999 ? 'rgb(' + c.join(',') + ')' : 'rgba(' + c.join(',') + ',' + Math.round(al * 1000) / 1000 + ')';
  }
  function same(a: EngineSubPath[], b: EngineSubPath[]) {
    if (!a || !b || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i].n.length !== b[i].n.length) return false;
    return true;
  }
  function mixM(a: EngineSubPath[], b: EngineSubPath[], p: number): EngineSubPath[] {
    if (!same(a, b)) return p < 1 ? a : b;
    return a.map(function (s: EngineSubPath, i: number) {
      return {
        c: s.c,
        n: s.n.map(function (q: number[], j: number) {
          var r = b[i].n[j];
          return q.map(function (v: number, k: number) {
            return v + (r[k] - v) * p;
          });
        }),
      };
    });
  }
  function mix(k: string, a: any, b: any, p: number): any {
    if (k === 'c') return mixC(a, b, p);
    if (k === 'm') return mixM(a, b, p);
    if (k === 'v') return [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p];
    return a + (b - a) * p;
  }
  function cr(p0: Vec, p1: Vec, p2: Vec, p3: Vec, t: number): Vec {
    var t2 = t * t,
      t3 = t2 * t;
    return [0, 1].map(function (i: number) {
      return (
        0.5 *
        (2 * p1[i] +
          (-p0[i] + p2[i]) * t +
          (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 +
          (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3)
      );
    });
  }
  function at(L: EngineLayer, k: string, t: number): any {
    var tr = L.t[k],
      n = tr.length,
      i: number,
      a: Keyframe,
      b: Keyframe,
      p: number;
    if (n === 1 || t <= tr[0][0]) return tr[0][1];
    if (t >= tr[n - 1][0]) return tr[n - 1][1];
    for (i = 0; i < n - 1; i++) {
      a = tr[i];
      b = tr[i + 1];
      if (t < b[0]) {
        p = ez(a[2], (t - a[0]) / (b[0] - a[0]));
        if (k === 'pos' && L.sm && n > 2) return cr((tr[i - 1] || a)[1], a[1], b[1], (tr[i + 2] || b)[1], p);
        return mix(K[k] || (typeof a[1] === 'string' ? 'c' : typeof a[1] === 'object' ? 'v' : 'n'), a[1], b[1], p);
      }
    }
    return tr[n - 1][1];
  }
  function get(L: EngineLayer, k: string, t: number): any {
    var tr = L.t && L.t[k];
    return tr && tr.length ? at(L, k, t) : k === 'org' ? L.o || [0, 0] : L.b[k];
  }
  function comp(L: EngineLayer, t: number): Composite {
    var o = get(L, 'org', t) || [0, 0],
      p = get(L, 'pos', t) || [0, 0],
      r = get(L, 'rot', t) || 0,
      s = get(L, 'scl', t) || [1, 1],
      k = get(L, 'skw', t) || [0, 0],
      tr = L.t && L.t.pos,
      op = get(L, 'op', t);
    if (L.or && tr && tr.length > 1) {
      var t0 = tr[0][0],
        t1 = tr[tr.length - 1][0],
        e = Math.min(0.02, (t1 - t0) / 4),
        ta = Math.max(t0, Math.min(t - e, t1 - 2 * e)),
        A = get(L, 'pos', ta),
        B = get(L, 'pos', ta + 2 * e);
      if (B[0] !== A[0] || B[1] !== A[1]) r += (Math.atan2(B[1] - A[1], B[0] - A[0]) * 180) / Math.PI;
    }
    return {
      x: p[0] + o[0],
      y: p[1] + o[1],
      r: r,
      sx: s[0],
      sy: s[1],
      ox: o[0],
      oy: o[1],
      op: op == null ? 1 : op,
      fill: get(L, 'fill', t),
      stk: get(L, 'stk', t),
      sw: get(L, 'sw', t),
      draw: get(L, 'draw', t),
      d: get(L, 'd', t),
      kx: k[0],
      ky: k[1],
      fo: get(L, 'fo', t),
      so: get(L, 'so', t),
      dof: get(L, 'dof', t),
    };
  }
  function f(n: number) {
    return Math.round(n * 1000) / 1000;
  }
  function tf(c: Composite) {
    return (
      'translate(' +
      f(c.x) +
      ',' +
      f(c.y) +
      ') rotate(' +
      f(c.r) +
      (c.kx ? ') skewX(' + f(c.kx) : '') +
      (c.ky ? ') skewY(' + f(c.ky) : '') +
      ') scale(' +
      f(c.sx) +
      ',' +
      f(c.sy) +
      ') translate(' +
      f(-c.ox) +
      ',' +
      f(-c.oy) +
      ')'
    );
  }
  function dstr(sp: EngineSubPath[] | null | undefined) {
    var o = '';
    function seg(a: number[], b: number[]) {
      if (a[4] === a[0] && a[5] === a[1] && b[2] === b[0] && b[3] === b[1]) o += 'L' + f(b[0]) + ' ' + f(b[1]);
      else o += 'C' + f(a[4]) + ' ' + f(a[5]) + ' ' + f(b[2]) + ' ' + f(b[3]) + ' ' + f(b[0]) + ' ' + f(b[1]);
    }
    (sp || []).forEach(function (s: EngineSubPath) {
      var n = s.n,
        i: number;
      if (!n.length) return;
      o += 'M' + f(n[0][0]) + ' ' + f(n[0][1]);
      for (i = 1; i < n.length; i++) seg(n[i - 1], n[i]);
      if (s.c) {
        seg(n[n.length - 1], n[0]);
        o += 'Z';
      }
    });
    return o || 'M0 0';
  }
  function el(id: string) {
    if (!(id in EL)) EL[id] = root ? root.querySelector('#' + id) : null;
    return EL[id];
  }
  function apply(t: number) {
    for (var i = 0; i < D.L.length; i++) {
      var L = D.L[i],
        g = el(D.p + L.id),
        s = el(D.p + L.id + '-s');
      if (!g || !s) continue;
      var c = comp(L, t);
      g.setAttribute('transform', tf(c));
      g.setAttribute('opacity', String(f(c.op)));
      if (c.fill != null) s.setAttribute('fill', c.fill);
      if (c.stk != null) s.setAttribute('stroke', c.stk);
      if (c.sw != null) s.setAttribute('stroke-width', String(f(c.sw)));
      if (c.draw != null && (c.draw < 100 || (L.t && L.t.draw))) {
        s.setAttribute('pathLength', '100');
        s.setAttribute('stroke-dasharray', '100 100');
        s.setAttribute('stroke-dashoffset', String(f(100 - c.draw)));
      } else if (c.dof != null) s.setAttribute('stroke-dashoffset', String(f(c.dof)));
      if (c.fo != null) s.setAttribute('fill-opacity', String(f(c.fo)));
      if (c.so != null) s.setAttribute('stroke-opacity', String(f(c.so)));
      if (c.d) s.setAttribute('d', dstr(c.d));
      if (L.fa)
        for (var fk in L.fa) {
          var fe = el(D.p + L.id + L.fa[fk][0]),
            fv = get(L, fk, t);
          if (fe && fv != null) fe.setAttribute(L.fa[fk][1], typeof fv === 'number' ? String(f(fv)) : fv);
        }
    }
  }
  /* ---- player (SVGator-compatible API) ---- */
  var T = D.dur || 1,
    IT = D.it > 0 ? Math.floor(D.it) : 0,
    AL = /alternate/.test(D.dir || ''),
    BASE = /reverse/.test(D.dir || '') ? -1 : 1,
    DIR = BASE,
    SPD = D.speed > 0 ? D.speed : 1,
    FPS = D.fps > 0 ? Math.min(100, D.fps) : 100,
    FILL = D.fill === -1 || D.fill === 'backwards' ? -1 : 1,
    on = false,
    last = 0,
    lastDraw = -1e9,
    ended = false,
    rb = false,
    dead = false,
    HD: Record<string, Handler[]> = {},
    raf = 0;
  function tot() {
    return IT ? IT * T : T;
  }
  function s0() {
    return BASE > 0 ? 0 : tot();
  }
  var cur = s0();
  function loc(x: number) {
    var c = Math.floor(x / T),
      r = x - c * T;
    if (IT) {
      if (x <= 0) {
        c = 0;
        r = 0;
      } else if (c >= IT) {
        c = IT - 1;
        r = T;
      }
    }
    return AL && ((c % 2) + 2) % 2 === 1 ? T - r : r;
  }
  function emit(n: string) {
    var a = HD[n];
    if (!a) return;
    a.slice().forEach(function (fn: Handler) {
      try {
        fn.call(P, Math.round(cur * 1000));
      } catch (e) {}
    });
  }
  function draw() {
    apply(loc(cur));
    emit('keyframe');
  }
  function halt() {
    on = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  function finish() {
    halt();
    if (rb) {
      rb = false;
      DIR = BASE;
    }
    ended = true;
    if (FILL < 0) {
      cur = s0();
    }
    draw();
    emit('end');
  }
  function tick(now: number) {
    if (!on || dead) return;
    cur += ((now - last) / 1000) * SPD * DIR;
    last = now;
    if (DIR > 0 && (IT || (rb && BASE < 0)) && cur >= tot()) {
      cur = tot();
      return finish();
    }
    if (DIR < 0 && (IT || (rb && BASE > 0)) && cur <= 0) {
      cur = 0;
      return finish();
    }
    if (now - lastDraw >= 1000 / FPS - 1) {
      lastDraw = now;
      draw();
    }
    raf = requestAnimationFrame(tick);
  }
  function start() {
    if (on || dead) return;
    on = true;
    ended = false;
    last = performance.now();
    lastDraw = -1e9;
    raf = requestAnimationFrame(tick);
  }
  var P = {
    play: function () {
      if (dead || on) return P;
      if (ended) {
        DIR = BASE;
        rb = false;
        cur = s0();
      }
      start();
      emit('play');
      return P;
    },
    pause: function () {
      if (dead || !on) return P;
      halt();
      emit('pause');
      return P;
    },
    toggle: function () {
      return on ? P.pause() : P.play();
    },
    togglePlay: function () {
      return P.toggle();
    },
    restart: function () {
      if (dead) return P;
      halt();
      rb = false;
      DIR = BASE;
      cur = s0();
      ended = false;
      draw();
      start();
      emit('restart');
      return P;
    },
    reverse: function () {
      if (dead) return P;
      DIR = -DIR;
      rb = false;
      ended = false;
      start();
      emit('reverse');
      return P;
    },
    rollback: function () {
      if (dead) return P;
      if (!IT) {
        var per = AL ? 2 * T : T;
        cur = ((cur % per) + per) % per;
      }
      if (Math.abs(cur - s0()) < 1e-6 && !on) return P;
      DIR = -BASE;
      rb = true;
      ended = false;
      start();
      emit('reverse');
      return P;
    },
    stop: function () {
      if (dead) return P;
      halt();
      rb = false;
      DIR = BASE;
      cur = s0();
      ended = false;
      draw();
      emit('stop');
      return P;
    },
    seek: function (pct: number) {
      if (dead) return P;
      cur = (Math.max(0, Math.min(100, +pct || 0)) / 100) * tot();
      ended = false;
      draw();
      return P;
    },
    seekTo: function (ms: number) {
      if (dead) return P;
      cur = (+ms || 0) / 1000;
      if (IT) cur = Math.max(0, Math.min(tot(), cur));
      ended = false;
      draw();
      return P;
    },
    seekBy: function (ms: number) {
      return P.seekTo(cur * 1000 + (+ms || 0));
    },
    set: function (k: string, v: any) {
      if (dead) return P;
      if (k === 'speed') SPD = Math.max(0.01, Math.min(100, +v || 1));
      else if (k === 'fps') FPS = Math.max(1, Math.min(100, +v || 100));
      else if (k === 'iterations') IT = v === Infinity || !(+v > 0) ? 0 : Math.floor(+v);
      else if (k === 'direction') {
        DIR = +v < 0 ? -1 : 1;
        rb = false;
      } else if (k === 'alternate') AL = !!v;
      else if (k === 'fill') FILL = +v < 0 ? -1 : 1;
      return P;
    },
    ready: function (cb: (p: KLPlayer) => void) {
      if (typeof cb === 'function')
        setTimeout(function () {
          cb.call(P, P);
        }, 0);
      return P;
    },
    on: function (names: string, fn: Handler, prepend?: boolean) {
      if (typeof fn !== 'function') return P;
      String(names)
        .split(/[\s,]+/)
        .forEach(function (n: string) {
          if (!n) return;
          HD[n] = HD[n] || [];
          if (prepend) HD[n].unshift(fn);
          else HD[n].push(fn);
        });
      return P;
    },
    off: function (n: string, fn?: Handler) {
      if (HD[n])
        HD[n] = fn
          ? HD[n].filter(function (f: Handler) {
              return f !== fn;
            })
          : [];
      return P;
    },
    destruct: function () {
      if (dead) return;
      halt();
      HD = {};
      (P._cleanup || []).forEach(function (f: () => void) {
        try {
          f();
        } catch (e) {}
      });
      P._cleanup = [];
      apply(loc(s0()));
      dead = true;
    },
    onEnd: function (fn: Handler) {
      return P.on('end', fn);
    },
    setRate: function (v: number) {
      return P.set('speed', v);
    },
    apply: apply,
    comp: comp,
    get: get,
    dstr: dstr,
    ease: ez,
    loc: loc,
    EZ: EZ,
    _cleanup: [] as Array<() => void>,
  } as unknown as KLPlayer;
  var G = function (f: () => unknown): PropertyDescriptor {
    return { get: f, enumerable: true };
  };
  Object.defineProperties(P, {
    currentTime: G(function () {
      return Math.round(cur * 1000);
    }),
    duration: G(function () {
      return Math.round(T * 1000);
    }),
    totalTime: G(function () {
      return Math.round(tot() * 1000);
    }),
    fps: G(function () {
      return FPS;
    }),
    speed: G(function () {
      return SPD;
    }),
    direction: G(function () {
      return DIR;
    }),
    fill: G(function () {
      return FILL;
    }),
    iterations: G(function () {
      return IT;
    }),
    hasEnded: G(function () {
      return ended;
    }),
    isAlternate: G(function () {
      return AL;
    }),
    isBackwards: G(function () {
      return FILL < 0;
    }),
    isInfinite: G(function () {
      return !IT;
    }),
    isPlaying: G(function () {
      return on;
    }),
    isReversed: G(function () {
      return DIR < 0;
    }),
    isRollingBack: G(function () {
      return on && rb;
    }),
    state: G(function () {
      return dead ? 'destroyed' : on ? (rb ? 'rollback' : 'playing') : ended ? 'ended' : 'paused';
    }),
  });
  return P;
}
