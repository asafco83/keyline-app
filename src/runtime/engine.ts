// SVGcinema runtime — the animation player that ships inside every exported SVG.
// Keep it dependency-free: CinEngine.toString() is embedded verbatim in exports.

/** Keyframe: [time in seconds, value, easing to the next key, (position only) curve to the next key].
 *  The curve is [c1x, c1y, c2x, c2y]: the two control points of a cubic, c1 relative to this key's
 *  value and c2 relative to the next key's value. */
/** preset name or cubic-bezier [x1, y1, x2, y2] */
export type Ease = string | number[];
/** index 4 (editor only): the motion-path node type at this key — see tools/motion-path */
export type Keyframe = [number, any, Ease, number[]?, string?];
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
  /** polygon / star settings, so an animated corner radius ("rad") can rebuild the path */
  shape?: { kind: string; cx: number; cy: number; r: number; rot: number; n: number; ratio?: number };
  /** extra animated attributes: track key → [element id suffix, attribute] (filter parameters) */
  fa?: Record<string, [string, string]>;
  /** bones: rest angle (degrees), so scale runs along / across the bone (exported only when it matters) */
  ba?: number;
  /** editor layers: the bone's type and geometry give the rest angle */
  type?: string;
  geo?: Record<string, any>;
  /** parent layer id (bones: a child bone cancels its parent bone's scale) */
  parent?: string | null;
  /** bones: inherit the parent bone's scale (default off: the child rides the stretched tip unstretched) */
  inh?: boolean;
  /** exported child bones: 1 = cancels the parent bone's scale, at its joint `j` */
  cs?: number;
  j?: number[];
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
  d: EngineSubPath[] | undefined;
  /** skew, degrees */
  kx: number;
  ky: number;
  /** fill / stroke opacity (null = not set) */
  fo: any;
  so: any;
  /** stroke dash offset (null = not set) */
  dof: any;
  /** corner radius (null = not animated) */
  rad: any;
  /** trim path [start %, end %, offset %], or null when the whole stroke shows */
  trim: number[] | null;
  /** bones: rest angle (degrees); scale W runs along the bone and H across it */
  ba: number;
  /** child bones that don't inherit scale: the parent bone's scale to cancel, at the joint
   *  [angle, sx, sy, jx, jy], or null */
  cp: number[] | null;
}
type Handler = (this: CinPlayer, offsetMs: number) => void;
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
export interface CinPlayer {
  play(): CinPlayer;
  pause(): CinPlayer;
  toggle(): CinPlayer;
  togglePlay(): CinPlayer;
  restart(): CinPlayer;
  reverse(): CinPlayer;
  rollback(): CinPlayer;
  stop(): CinPlayer;
  seek(percent: number): CinPlayer;
  seekTo(ms: number): CinPlayer;
  seekBy(ms: number): CinPlayer;
  set(prop: 'speed' | 'fps' | 'iterations' | 'direction' | 'alternate' | 'fill', value: any): CinPlayer;
  ready(cb: (p: CinPlayer) => void): CinPlayer;
  on(events: string, fn: (offsetMs: number) => void, prepend?: boolean): CinPlayer;
  off(event: string, fn?: (offsetMs: number) => void): CinPlayer;
  destruct(): void;
  onEnd(fn: () => void): CinPlayer;
  setRate(v: number): CinPlayer;
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
  /** editor / export: how to find a layer by id that is not in this engine's own list */
  lookup(fn: ((id: string) => EngineLayer | null | undefined) | null): void;
  get(L: EngineLayer, k: string, t: number): any;
  dstr(sp: EngineSubPath[] | null | undefined): string;
  /** is the value a gradient ({ g: 'lin' | 'rad', s: stops, … }) */
  isG(v: any): boolean;
  /** gradient geometry attributes */
  gAttrs(v: any): Record<string, string>;
  /** a linear gradient's end points [x1, y1, x2, y2] (0–1 of the box) */
  linP(v: any): number[];
  /** parse a colour into [r, g, b, a] */
  pc(s: unknown): number[] | null;
  /** stroke-dasharray and -dashoffset for a trim [start, end, offset] */
  trimDash(tr: number[]): string[];
  ease(n: Ease, p: number): number;
  loc(x: number): number;
  EZ: Record<string, number[]>;
  _cleanup: Array<() => void>;
}

export function CinEngine(D: EngineData, root: ParentNode | null): CinPlayer {
  // NOTE: this function is serialised with Function.prototype.toString() and embedded in every
  // exported SVG, so it must stay fully self-contained: no imports, no references to module scope.
  var K: Record<string, string> = {
    pos: 'v',
    org: 'v',
    p0: 'v',
    p1: 'v',
    rad: 'n',
    ts: 'n',
    te: 'n',
    to: 'n',
    rot: 'n',
    scl: 'v',
    op: 'n',
    fill: 'c',
    stk: 'c',
    sw: 'n',
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
  /* ---- gradients: { g: 'lin' | 'rad', s: [[offset 0–1, colour], …], a: angle°, cx, cy, r (0–1 of the box) }
     linear: p = [x1, y1, x2, y2] places the end points (else they follow the angle a)
     radial: ra = direction of the radius (°), rr = the other radius as a share of r (an ellipse) ---- */
  function isG(v: any): boolean {
    return !!v && typeof v === 'object' && (v.g === 'lin' || v.g === 'rad') && v.s && v.s.length > 0;
  }
  /** colour of a gradient at offset o */
  function gAt(G: any, o: number): string {
    var st = G.s;
    if (o <= st[0][0]) return st[0][1];
    for (var i = 0; i < st.length - 1; i++)
      if (o <= st[i + 1][0]) {
        var w = st[i + 1][0] - st[i][0];
        return mixC(st[i][1], st[i + 1][1], w > 0 ? (o - st[i][0]) / w : 0);
      }
    return st[st.length - 1][1];
  }
  function mixG(a: any, b: any, p: number): any {
    // a solid colour blends into a gradient as a gradient of that one colour
    if (!isG(a))
      a = {
        g: b.g,
        a: b.a,
        cx: b.cx,
        cy: b.cy,
        r: b.r,
        p: b.p,
        ra: b.ra,
        rr: b.rr,
        s: [
          [0, a],
          [1, a],
        ],
      };
    if (!isG(b))
      b = {
        g: a.g,
        a: a.a,
        cx: a.cx,
        cy: a.cy,
        r: a.r,
        p: a.p,
        ra: a.ra,
        rr: a.rr,
        s: [
          [0, b],
          [1, b],
        ],
      };
    if (a.g !== b.g) return p < 1 ? a : b;
    var offs: number[] = [];
    a.s.concat(b.s).forEach(function (q: any[]) {
      if (offs.indexOf(q[0]) < 0) offs.push(q[0]);
    });
    offs.sort(function (x: number, y: number) {
      return x - y;
    });
    // same stop count: blend stop by stop (offsets move); otherwise resample both on all offsets
    var st =
      a.s.length === b.s.length
        ? a.s.map(function (q: any[], i: number) {
            return [q[0] + (b.s[i][0] - q[0]) * p, mixC(q[1], b.s[i][1], p)];
          })
        : offs.map(function (o: number) {
            return [o, mixC(gAt(a, o), gAt(b, o), p)];
          });
    var n = function (x: any, y: any, d: number) {
      return (x == null ? d : x) + ((y == null ? d : y) - (x == null ? d : x)) * p;
    };
    var o: any = {
      g: a.g,
      a: n(a.a, b.a, 90),
      cx: n(a.cx, b.cx, 0.5),
      cy: n(a.cy, b.cy, 0.5),
      r: n(a.r, b.r, 0.5),
      s: st,
    };
    if (a.p || b.p) {
      var pa = linP(a),
        pb = linP(b);
      o.p = pa.map(function (x: number, i: number) {
        return x + (pb[i] - x) * p;
      });
    }
    if (a.ra != null || b.ra != null) o.ra = n(a.ra, b.ra, 0);
    if (a.rr != null || b.rr != null) o.rr = n(a.rr, b.rr, 1);
    return o;
  }
  function mixC(a: any, b: any, p: number): any {
    if (isG(a) || isG(b)) return mixG(a, b, p);
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
  function cb(A: Vec, h: number[], B: Vec, t: number): Vec {
    var u = 1 - t,
      w0 = u * u * u,
      w1 = 3 * u * u * t,
      w2 = 3 * u * t * t,
      w3 = t * t * t;
    return [
      w0 * A[0] + w1 * (A[0] + h[0]) + w2 * (B[0] + h[2]) + w3 * B[0],
      w0 * A[1] + w1 * (A[1] + h[1]) + w2 * (B[1] + h[3]) + w3 * B[1],
    ];
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
        if (k === 'pos' && a[3]) return cb(a[1], a[3], b[1], p);
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
      d: shapeOf(L, t),
      kx: k[0],
      ky: k[1],
      fo: get(L, 'fo', t),
      so: get(L, 'so', t),
      dof: get(L, 'dof', t),
      rad: L.t && L.t.rad && L.t.rad.length ? get(L, 'rad', t) : null,
      trim: trimOf(L, t),
      ba: boneAng(L),
      cp: counterScale(L, t),
    };
  }
  /** layers by id: this engine's list, else the editor's lookup */
  var IDX: Record<string, EngineLayer> = {},
    EXT: ((id: string) => EngineLayer | null | undefined) | null = null;
  for (var ii = 0; ii < D.L.length; ii++) IDX[D.L[ii].id] = D.L[ii];
  function layerOf(id: string | null | undefined): EngineLayer | null {
    if (!id) return null;
    return IDX[id] || (EXT && EXT(id)) || null;
  }
  /** a child bone that doesn't inherit scale cancels its parent bone's scale around its own joint, so
   *  it rides the stretched tip without being stretched: [parent angle, sx, sy, joint x, joint y] */
  function counterScale(L: EngineLayer, t: number): number[] | null {
    var P = L.cs || (L.type === 'bone' && !L.inh) ? layerOf(L.parent) : null;
    if (!P || (!L.cs && P.type !== 'bone')) return null;
    var s = get(P, 'scl', t) || [1, 1];
    if (s[0] === 1 && s[1] === 1) return null;
    var j = L.j || (L.geo ? [L.geo.x, L.geo.y] : [0, 0]);
    return [boneAng(P), s[0] || 1e-6, s[1] || 1e-6, j[0], j[1]];
  }
  /** a bone's rest angle: scale is applied in the bone's own frame (W along it, H across it) */
  function boneAng(L: EngineLayer): number {
    if (L.ba != null) return L.ba;
    return L.type === 'bone' && L.geo && L.geo.ang ? L.geo.ang : 0;
  }
  /** trim start / end / offset (percent of the stroke), or null when nothing is trimmed */
  function trimOf(L: EngineLayer, t: number): number[] | null {
    var T = L.t || {},
      on = ['ts', 'te', 'to'].some(function (k) {
        return (T[k] && T[k].length) || (L.b && L.b[k] != null && L.b[k] !== (k === 'te' ? 100 : 0));
      });
    if (!on) return null;
    var a = get(L, 'ts', t),
      b = get(L, 'te', t),
      o = get(L, 'to', t);
    return [a == null ? 0 : a, b == null ? 100 : b, o == null ? 0 : o];
  }
  /** stroke-dasharray / dashoffset for a trim (with pathLength 100) */
  function trimDash(tr: number[]): string[] {
    var s0 = Math.max(0, Math.min(100, Math.min(tr[0], tr[1]))),
      e0 = Math.max(0, Math.min(100, Math.max(tr[0], tr[1]))),
      len = e0 - s0,
      raw = s0 + (tr[2] || 0),
      a = ((raw % 100) + 100) % 100;
    // A zero-length dash still paints its line cap (a dot with round caps), so nothing may sit on
    // the path unless it is part of the trim: an empty trim parks its dash off the path (repeats
    // at a ± 150), and a trim that doesn't cross the end repeats every 200 (never at 100, the end).
    if (len < 1e-6) return ['0 300', String(f(150 - a))];
    if (a + len <= 100 + 1e-6) return [f(len) + ' ' + f(200 - len), String(f(-a))];
    // crossing the end: one dash per pathLength (100), so it wraps around to the start
    return [f(len) + ' ' + f(100 - len), String(f(-raw))];
  }
  /** the path at time t: morph value, with animated line ends or corner radius applied */
  function shapeOf(L: EngineLayer, t: number): EngineSubPath[] | undefined {
    var d = get(L, 'd', t),
      T = L.t || {};
    if (L.shape && T.rad && T.rad.length) return poly(L.shape, get(L, 'rad', t), true);
    if (d && d[0] && d[0].n.length === 2 && ((T.p0 && T.p0.length) || (T.p1 && T.p1.length))) {
      var n = d[0].n.map(function (q: number[], i: number) {
        var e = T['p' + i] && T['p' + i].length ? get(L, 'p' + i, t) : null;
        if (!e) return q;
        var dx = e[0] - q[0],
          dy = e[1] - q[1];
        return [q[0] + dx, q[1] + dy, q[2] + dx, q[3] + dy, q[4] + dx, q[5] + dy];
      });
      return [{ c: d[0].c, n: n }];
    }
    return d;
  }
  /** corners of a polygon / star, clockwise from the top */
  function corners(s: NonNullable<EngineLayer['shape']>): number[][] {
    var out: number[][] = [],
      star = s.kind === 'star',
      m = star ? s.n * 2 : s.n;
    for (var i = 0; i < m; i++) {
      var a = ((-90 + s.rot + (i * 360) / m) * Math.PI) / 180,
        r = star && i % 2 ? s.r * (s.ratio == null ? 0.45 : s.ratio) : s.r;
      out.push([s.cx + r * Math.cos(a), s.cy + r * Math.sin(a)]);
    }
    return out;
  }
  function dd(a: number[], b: number[]) {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }
  /** largest corner radius every corner can take */
  function maxRad(c: number[][]) {
    var m = c.length,
      best = Infinity;
    for (var i = 0; i < m; i++) {
      var p = c[(i + m - 1) % m],
        v = c[i],
        q = c[(i + 1) % m],
        a = Math.atan2(p[1] - v[1], p[0] - v[0]),
        b = Math.atan2(q[1] - v[1], q[0] - v[0]),
        th = Math.abs(a - b);
      if (th > Math.PI) th = 2 * Math.PI - th;
      best = Math.min(best, (Math.min(dd(p, v), dd(q, v)) / 2) * Math.tan(th / 2));
    }
    return isFinite(best) ? Math.max(0, best) : 0;
  }
  function r2(v: number) {
    return Math.round(v * 100) / 100;
  }
  /** polygon / star path; a corner radius > 0 makes each corner two nodes joined by a circular arc.
   *  With an animated radius every corner is always two nodes, so the path keeps its node count. */
  function poly(s: NonNullable<EngineLayer['shape']>, rad: number, keep?: boolean): EngineSubPath[] {
    var c = corners(s),
      m = c.length,
      R = Math.max(0, Math.min(rad || 0, maxRad(c))),
      n: number[][] = [];
    for (var i = 0; i < m; i++) {
      var v = c[i];
      if (R <= 0 && !keep) {
        n.push([r2(v[0]), r2(v[1]), r2(v[0]), r2(v[1]), r2(v[0]), r2(v[1])]);
        continue;
      }
      var p = c[(i + m - 1) % m],
        q = c[(i + 1) % m],
        up = [(p[0] - v[0]) / dd(p, v), (p[1] - v[1]) / dd(p, v)],
        uq = [(q[0] - v[0]) / dd(q, v), (q[1] - v[1]) / dd(q, v)],
        th = Math.acos(Math.max(-1, Math.min(1, up[0] * uq[0] + up[1] * uq[1]))),
        d = R / Math.tan(th / 2),
        h = (4 / 3) * Math.tan((Math.PI - th) / 4) * R,
        A = [v[0] + up[0] * d, v[1] + up[1] * d],
        B = [v[0] + uq[0] * d, v[1] + uq[1] * d];
      n.push([r2(A[0]), r2(A[1]), r2(A[0]), r2(A[1]), r2(A[0] - up[0] * h), r2(A[1] - up[1] * h)]);
      n.push([r2(B[0]), r2(B[1]), r2(B[0] - uq[0] * h), r2(B[1] - uq[1] * h), r2(B[0]), r2(B[1])]);
    }
    return [{ c: true, n: n }];
  }
  /** gradient geometry attributes (in the shape's bounding box, 0–1) */
  function gAttrs(v: any): Record<string, string> {
    if (v.g === 'rad') {
      var cx = v.cx == null ? 0.5 : v.cx,
        cy = v.cy == null ? 0.5 : v.cy,
        r = v.r == null ? 0.5 : v.r,
        ra = v.ra || 0,
        rr = v.rr == null ? 1 : v.rr,
        o: Record<string, string> = {
          cx: String(f(cx)),
          cy: String(f(cy)),
          r: String(f(r)),
          fx: String(f(cx)),
          fy: String(f(cy)),
        };
      // an ellipse, turned: scale the other axis around the centre
      if (f(ra) || f(rr) !== 1)
        o.gradientTransform =
          'translate(' +
          f(cx) +
          ',' +
          f(cy) +
          ') rotate(' +
          f(ra) +
          ') scale(1,' +
          f(rr) +
          ') translate(' +
          f(-cx) +
          ',' +
          f(-cy) +
          ')';
      return o;
    }
    var q = linP(v);
    return { x1: String(f(q[0])), y1: String(f(q[1])), x2: String(f(q[2])), y2: String(f(q[3])) };
  }
  function linP(v: any): number[] {
    if (v.p && v.p.length === 4) return v.p.slice();
    var a = (((v.a == null ? 90 : v.a) - 90) * Math.PI) / 180,
      dx = Math.cos(a) / 2,
      dy = Math.sin(a) / 2;
    return [0.5 - dx, 0.5 - dy, 0.5 + dx, 0.5 + dy];
  }
  function f(n: number) {
    return Math.round(n * 1000) / 1000;
  }
  function tf(c: Composite) {
    var q = c.cp;
    return (
      (q
        ? 'translate(' +
          f(q[3]) +
          ',' +
          f(q[4]) +
          ') rotate(' +
          f(q[0]) +
          ') scale(' +
          f(1 / q[1]) +
          ',' +
          f(1 / q[2]) +
          ') rotate(' +
          f(-q[0]) +
          ') translate(' +
          f(-q[3]) +
          ',' +
          f(-q[4]) +
          ') '
        : '') +
      'translate(' +
      f(c.x) +
      ',' +
      f(c.y) +
      ') rotate(' +
      f(c.r) +
      (c.kx ? ') skewX(' + f(c.kx) : '') +
      (c.ky ? ') skewY(' + f(c.ky) : '') +
      (c.ba && c.sx !== c.sy ? ') rotate(' + f(c.ba) : '') +
      ') scale(' +
      f(c.sx) +
      ',' +
      f(c.sy) +
      (c.ba && c.sx !== c.sy ? ') rotate(' + f(-c.ba) : '') +
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
  /** a fill / stroke value as an attribute; a gradient updates (or makes) its element */
  function paint(s: Element, id: string, v: any): string {
    if (!isG(v)) return v;
    var tag = v.g === 'rad' ? 'radialGradient' : 'linearGradient',
      ge = el(id);
    if (!ge || ge.tagName !== tag) {
      var n = (s.ownerDocument || document).createElementNS('http://www.w3.org/2000/svg', tag);
      n.setAttribute('id', id);
      if (ge && ge.parentNode) ge.parentNode.replaceChild(n, ge);
      else s.parentNode.insertBefore(n, s);
      ge = n;
      EL[id] = n;
    }
    var at = gAttrs(v);
    for (var k in at) ge.setAttribute(k, at[k]);
    var stops = ge.getElementsByTagName('stop');
    while (stops.length > v.s.length) ge.removeChild(stops[stops.length - 1]);
    while (stops.length < v.s.length)
      ge.appendChild((s.ownerDocument || document).createElementNS('http://www.w3.org/2000/svg', 'stop'));
    for (var i = 0; i < v.s.length; i++) {
      var c = pc(v.s[i][1]) || [0, 0, 0, 1];
      stops[i].setAttribute('offset', String(f(v.s[i][0])));
      stops[i].setAttribute(
        'stop-color',
        'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')',
      );
      stops[i].setAttribute('stop-opacity', String(f(c[3])));
    }
    return 'url(#' + id + ')';
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
      if (c.fill != null) s.setAttribute('fill', paint(s, D.p + L.id + '-gf', c.fill));
      if (c.stk != null) s.setAttribute('stroke', paint(s, D.p + L.id + '-gs', c.stk));
      if (c.sw != null) s.setAttribute('stroke-width', String(f(c.sw)));
      if (c.trim) {
        var td = trimDash(c.trim);
        s.setAttribute('pathLength', '100');
        s.setAttribute('stroke-dasharray', td[0]);
        s.setAttribute('stroke-dashoffset', td[1]);
      } else if (c.dof != null) s.setAttribute('stroke-dashoffset', String(f(c.dof)));
      if (c.fo != null) s.setAttribute('fill-opacity', String(f(c.fo)));
      if (c.so != null) s.setAttribute('stroke-opacity', String(f(c.so)));
      if (c.d) s.setAttribute('d', dstr(c.d));
      if (c.rad != null && !L.shape) {
        s.setAttribute('rx', String(f(c.rad)));
        s.setAttribute('ry', String(f(c.rad)));
      }
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
    ready: function (cb: (p: CinPlayer) => void) {
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
    lookup: function (fn: ((id: string) => EngineLayer | null | undefined) | null) {
      EXT = fn;
    },
    get: get,
    gAttrs: gAttrs,
    linP: linP,
    trimDash: trimDash,
    isG: isG,
    pc: pc,
    dstr: dstr,
    poly: poly,
    corners: corners,
    maxRad: maxRad,
    ease: ez,
    loc: loc,
    EZ: EZ,
    _cleanup: [] as Array<() => void>,
  } as unknown as CinPlayer;
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
