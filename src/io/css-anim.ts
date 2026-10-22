// SVGcinema — io/css-anim
// Reads CSS keyframe animations in an SVG (SVGator's CSS export, and simple CSS animations from
// elsewhere) into the same per-element description SVGator's JS player data uses, so both become
// keyframes the same way (io/svgator).
//
// SVGator's CSS export wraps an animated element in groups: "<id>_to" (moves it, along an
// offset-path when it follows a motion path), "_tr" (rotates), "_tk" (skews), "_ts" (scales); the
// element's own transform is its anchor point. They are folded back into one layer. Its CSS writes
// the anchor's keyframes as "translate(static) translate(animated)", applying the static one twice
// (which shifts the element in browsers); only the animated one is meant, so only that one is read.
import { H } from '../core/constants';
import { parsePath } from '../geometry/parse-path';
import type { AnimReader, Converter } from './svg-convert';
import { normColor, parseTransform } from './svg-paint';
import { animateLayer as animateSVGator } from './svgator';

type Decl = Record<string, string>;
type Stop = { pct: number; decl: Decl };
type Anim = { name: string; dur: number; delay: number; ease: any; it: number; dir: string; fill: string };
type Key = { t: number; v: any; e?: any };

/* ---------- CSS ---------- */

function decls(s: string): Decl {
  const o: Decl = {};
  s.split(';').forEach(p => {
    const i = p.indexOf(':');
    if (i > 0) o[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim();
  });
  return o;
}
/** @keyframes blocks and top-level rules of a stylesheet */
export function parseCSS(css: string) {
  const keyframes: Record<string, Stop[]> = {},
    rules: Array<{ sel: string; decl: Decl }> = [];
  let s = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!\[CDATA\[|\]\]>/g, ''),
    i = 0;
  while (i < s.length) {
    const open = s.indexOf('{', i);
    if (open < 0) break;
    const head = s.slice(i, open).trim();
    // the matching brace
    let j = open + 1,
      depth = 1;
    while (j < s.length && depth) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}') depth--;
      j++;
    }
    const body = s.slice(open + 1, j - 1);
    const km = /^@(?:-webkit-)?keyframes\s+([^\s{]+)/.exec(head);
    if (km) {
      const stops: Stop[] = [];
      const re = /([^{}]+)\{([^{}]*)\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(body))) {
        const d = decls(m[2]);
        m[1].split(',').forEach(sel => {
          const t = sel.trim().toLowerCase(),
            pct = t === 'from' ? 0 : t === 'to' ? 100 : parseFloat(t);
          if (isFinite(pct)) stops.push({ pct: pct / 100, decl: d });
        });
      }
      keyframes[km[1]] = stops.sort((a, b) => a.pct - b.pct);
    } else if (!head.startsWith('@'))
      head.split(',').forEach(sel => rules.push({ sel: sel.trim(), decl: decls(body) }));
    i = j;
  }
  return { keyframes, rules };
}
const EASE: Record<string, number[] | string> = {
  linear: 'linear',
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
  'step-start': 'hold',
  'step-end': 'hold',
};
function easeOf(s: string | undefined): any {
  if (!s) return undefined;
  const v = s.trim();
  const m = /^cubic-bezier\(([^)]+)\)$/.exec(v);
  if (m) {
    const q = m[1].split(',').map(parseFloat);
    if (q.length === 4 && q.every(isFinite)) return q;
  }
  if (/^steps\(/.test(v)) return 'hold';
  return EASE[v];
}
const isTime = (s: string) => /^-?[\d.]+m?s$/.test(s);
const ms = (s: string) => (/ms$/.test(s) ? parseFloat(s) : parseFloat(s) * 1000);
/** split on commas outside brackets */
function list(s: string) {
  const out: string[] = [];
  let d = 0,
    cur = '';
  for (const c of s) {
    if (c === '(') d++;
    if (c === ')') d--;
    if (c === ',' && !d) {
      out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
/** the animations a rule gives an element (shorthand or longhands) */
function animsOf(d: Decl): Anim[] {
  const out: Anim[] = [];
  if (d.animation) {
    list(d.animation).forEach(item => {
      const a: Anim = { name: '', dur: 0, delay: 0, ease: undefined, it: 1, dir: 'normal', fill: 'none' };
      let times = 0;
      (item.match(/[\w-]+\([^)]*\)|[^\s]+/g) || []).forEach(tok => {
        if (isTime(tok)) {
          if (times++ === 0) a.dur = ms(tok);
          else a.delay = ms(tok);
        } else if (easeOf(tok) !== undefined) a.ease = easeOf(tok);
        else if (tok === 'infinite') a.it = 0;
        else if (/^[\d.]+$/.test(tok)) a.it = parseFloat(tok);
        else if (/^(normal|reverse|alternate|alternate-reverse)$/.test(tok)) a.dir = tok;
        else if (/^(none|forwards|backwards|both)$/.test(tok)) a.fill = tok;
        else if (/^(running|paused)$/.test(tok)) return;
        else a.name = tok;
      });
      if (a.name) out.push(a);
    });
    return out;
  }
  if (!d['animation-name']) return out;
  const pick = (k: string, i: number) => {
    const v = list(d[k] || '');
    return v.length ? v[i % v.length] : undefined;
  };
  list(d['animation-name']).forEach((name, i) => {
    const it = pick('animation-iteration-count', i);
    out.push({
      name,
      dur: pick('animation-duration', i) ? ms(pick('animation-duration', i)) : 0,
      delay: pick('animation-delay', i) ? ms(pick('animation-delay', i)) : 0,
      ease: easeOf(pick('animation-timing-function', i)),
      it: it === 'infinite' ? 0 : it ? parseFloat(it) : 1,
      dir: pick('animation-direction', i) || 'normal',
      fill: pick('animation-fill-mode', i) || 'none',
    });
  });
  return out;
}

/* ---------- values ---------- */

const num = (v: string) => parseFloat(v);
function color(v: string): any {
  const s = v.trim();
  if (!s || s === 'none') return null;
  const c = normColor(s),
    q = c && H.pc(c);
  return q ? { t: 'c', v: { r: q[0], g: q[1], b: q[2], a: q[3] } } : null;
}
function dashes(v: string): number[] {
  if (!v || v.trim() === 'none') return [];
  const a = v
    .split(/[\s,]+/)
    .map(parseFloat)
    .filter(isFinite);
  return a.some(x => x > 0) ? a : [];
}
/** the functions of a CSS transform: [[name, numbers], …] */
function fns(v: string): Array<[string, number[]]> {
  const out: Array<[string, number[]]> = [];
  const re = /([a-zA-Z]+)\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(v)))
    out.push([
      m[1],
      m[2]
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(parseFloat),
    ]);
  return out;
}
/** keys that only hold the value they start or end with add nothing */
function trim(keys: Key[]): Key[] {
  const same = (a: Key, b: Key) => JSON.stringify(a.v) === JSON.stringify(b.v);
  const k = keys.slice();
  while (k.length > 1 && same(k[k.length - 1], k[k.length - 2])) k.pop();
  while (k.length > 1 && same(k[0], k[1])) k.shift();
  return k;
}

/* ---------- motion paths (offset-path) ---------- */

type Seg = { a: number[]; c1: number[]; c2: number[]; b: number[]; len: number };
function segsOf(d: string): Seg[] {
  const segs: Seg[] = [];
  parsePath(d).forEach(p => {
    const n = p.n;
    for (let i = 1; i < n.length + (p.c ? 1 : 0); i++) {
      const A = n[i - 1],
        B = n[i % n.length];
      const s: Seg = { a: [A[0], A[1]], c1: [A[4], A[5]], c2: [B[2], B[3]], b: [B[0], B[1]], len: 0 };
      s.len = arcLen(s, 1);
      segs.push(s);
    }
  });
  return segs;
}
function bez(s: Seg, u: number) {
  const v = 1 - u;
  return [0, 1].map(
    i => v * v * v * s.a[i] + 3 * v * v * u * s.c1[i] + 3 * v * u * u * s.c2[i] + u * u * u * s.b[i],
  ) as [number, number];
}
function arcLen(s: Seg, u: number) {
  let L = 0,
    p = s.a;
  const n = 64;
  for (let i = 1; i <= n; i++) {
    const q = bez(s, (u * i) / n);
    L += Math.hypot(q[0] - p[0], q[1] - p[1]);
    p = q;
  }
  return L;
}
/** the curve parameter at a length along a segment */
function uAt(s: Seg, len: number) {
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if (arcLen(s, m) < len) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}
/** de Casteljau: the part of a segment between u0 and u1 */
function sub(s: Seg, u0: number, u1: number): Seg {
  const split = (S: Seg, u: number): [Seg, Seg] => {
    const L = (p: number[], q: number[]) => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
    const ab = L(S.a, S.c1),
      bc = L(S.c1, S.c2),
      cd = L(S.c2, S.b),
      abc = L(ab, bc),
      bcd = L(bc, cd),
      m = L(abc, bcd);
    return [
      { a: S.a, c1: ab, c2: abc, b: m, len: 0 },
      { a: m, c1: bcd, c2: cd, b: S.b, len: 0 },
    ];
  };
  const right = split(s, u0)[1];
  return u1 >= 1 ? right : split(right, (u1 - u0) / (1 - u0))[0];
}
/** offset-distance keys (0–1 of the path's length) → SVGator motion keys with handles */
function motionKeys(d: string, keys: Key[], note: (s: string) => void): Key[] {
  const segs = segsOf(d),
    total = segs.reduce((s, g) => s + g.len, 0);
  if (!segs.length || !(total > 0)) return [];
  const where = (f: number) => {
    let L = Math.max(0, Math.min(1, f)) * total;
    for (let i = 0; i < segs.length; i++) {
      if (L <= segs[i].len + 1e-6 || i === segs.length - 1)
        return { i, u: Math.min(1, uAt(segs[i], Math.min(L, segs[i].len))) };
      L -= segs[i].len;
    }
    return { i: segs.length - 1, u: 1 };
  };
  const out: Key[] = [];
  for (let k = 0; k < keys.length; k++) {
    const A = where(keys[k].v),
      p = A.u >= 1 ? segs[A.i].b : A.u <= 0 ? segs[A.i].a : bez(segs[A.i], A.u),
      key: Key = { t: keys[k].t, v: { x: p[0], y: p[1], type: 'cusp' }, e: keys[k].e };
    const n = keys[k + 1];
    if (n) {
      const B = where(n.v);
      // the stretch of path to the next key, as one curve (exact within a segment)
      const fromSeg = A.u >= 1 && A.i < segs.length - 1 ? { i: A.i + 1, u: 0 } : A;
      if (fromSeg.i === B.i && B.u > fromSeg.u) {
        const s = sub(segs[B.i], fromSeg.u, B.u);
        key.v.end = { x: s.c1[0], y: s.c1[1] };
        (key as any).nextStart = { x: s.c2[0], y: s.c2[1] };
      } else if (fromSeg.i !== B.i)
        note('A motion path that passes several points between two keyframes was simplified.');
    }
    out.push(key);
  }
  out.forEach((k, i) => {
    const prev = out[i - 1] as any;
    if (prev && prev.nextStart) k.v.start = prev.nextStart;
  });
  out.forEach((k: any) => delete k.nextStart);
  return out;
}

/* ---------- the reader ---------- */

export function readCSS(root: Element): AnimReader | null {
  let css = '';
  root.querySelectorAll('style').forEach(s => (css += s.textContent + '\n'));
  if (!/@(?:-webkit-)?keyframes/.test(css)) return null;
  const { keyframes, rules } = parseCSS(css);
  const byId: Record<string, Anim[]> = {},
    declOf: Record<string, Decl> = {};
  let hover = false;
  rules.forEach(r => {
    if (/:hover/.test(r.sel) && /animation-play-state|animation/.test(Object.keys(r.decl).join())) hover = true;
    const m = /^#([\w-]+)$/.exec(r.sel);
    if (!m) return;
    declOf[m[1]] = Object.assign(declOf[m[1]] || {}, r.decl);
    const a = animsOf(r.decl).filter(x => keyframes[x.name]);
    if (a.length) byId[m[1]] = (byId[m[1]] || []).concat(a);
  });
  const ids = Object.keys(byId);
  if (!ids.length) return null;
  const svgator =
    root.hasAttribute('export-id') || root.hasAttribute('project-id') || ids.some(id => /_(to|tr|tk|ts)$/.test(id));
  const notes: string[] = [];
  const note = (s: string) => !notes.includes(s) && notes.push(s);
  // settings from the first animation
  const a0 = byId[ids[0]][0],
    settings: AnimReader['settings'] = {};
  const end = Math.max(...ids.flatMap(id => byId[id].map(a => a.delay + a.dur)));
  settings.dur = (svgator ? a0.dur : end) / 1000;
  settings.it = a0.it;
  settings.dir = a0.dir;
  settings.fill = a0.fill === 'backwards' ? 'backwards' : 'forwards';
  if (hover) settings.trigger = 'hover';
  const used = new Set<string>();
  /** keys of one CSS property of an element (all its animations) */
  /** `base`: the element's own value, used where the keyframes leave out 0% or 100% (as CSS does) */
  const keysOf = (id: string, prop: string, f: (v: string) => any, base?: string): Key[] | null => {
    const out: Key[] = [];
    (byId[id] || []).forEach(a => {
      const stops = keyframes[a.name].filter(s => s.decl[prop] != null);
      if (stops.length && base != null) {
        if (stops[0].pct > 0) stops.unshift({ pct: 0, decl: { [prop]: base } });
        if (stops[stops.length - 1].pct < 1) stops.push({ pct: 1, decl: { [prop]: base } });
      }
      stops.forEach(s =>
        out.push({
          t: a.delay + s.pct * a.dur,
          v: f(s.decl[prop]),
          e: easeOf(s.decl['animation-timing-function']) ?? a.ease,
        }),
      );
    });
    if (!out.length) return null;
    used.add(id + '|' + prop);
    out.sort((x, y) => x.t - y.t);
    return trim(out.map(k => (k.e === 'linear' ? { t: k.t, v: k.v } : k)));
  };
  /** CSS's own transform animation as SVGator's parts: o = origin + the first translate, then
   *  rotate, skew, scale, and t = the last translate − origin */
  const genericTransform = (id: string, l: any, cv: Converter) => {
    const ORDER = ['translate', 'rotate', 'skewX', 'skewY', 'scale', 'translate'];
    const norm = (f: [string, number[]]): [string, number[]] => {
      const [n, v] = f;
      if (n === 'translateX') return ['translate', [v[0], 0]];
      if (n === 'translateY') return ['translate', [0, v[0]]];
      if (n === 'scaleX') return ['scale', [v[0], 1]];
      if (n === 'scaleY') return ['scale', [1, v[0]]];
      if (n === 'rotateZ') return ['rotate', v];
      if (n === 'skew') return ['skewX', [v[0]]];
      return [n, v];
    };
    const parts = (v: string) => {
      const F = fns(v).map(norm);
      let i = 0;
      const o: any = {};
      for (const [n, a] of F) {
        while (i < ORDER.length && ORDER[i] !== n) i++;
        if (i >= ORDER.length) return null;
        const slot = n === 'translate' && i === 5 ? 'b' : n;
        o[slot] = a;
        i++;
      }
      return o;
    };
    const K = keysOf(id, 'transform', parts, '');
    if (!K || K.some(k => !k.v)) return null;
    // the origin: transform-origin, in the shape's box (fill-box) or in user space (view-box)
    const d = declOf[id] || {},
      box = /fill-box/.test(d['transform-box'] || '') ? cv.localBox(l) || [0, 0, 0, 0] : [0, 0, 0, 0],
      words: Record<string, number> = { left: 0, top: 0, center: 0.5, right: 1, bottom: 1 },
      to = (d['transform-origin'] || '0 0').split(/\s+/),
      axis = (v: string | undefined, i: number) =>
        v == null
          ? box[i] + box[i + 2] * 0.5
          : v in words
            ? box[i] + box[i + 2] * words[v]
            : /%$/.test(v)
              ? box[i] + (box[i + 2] * parseFloat(v)) / 100
              : box[i] + parseFloat(v),
      O = { x: axis(to[0], 0), y: axis(to[1] ?? (to[0] === 'center' ? 'center' : undefined), 1) };
    const map = (f: (q: any) => any) => K.map(k => ({ t: k.t, v: f(k.v), e: k.e }));
    const T: any = { keys: {}, data: {} };
    T.keys.o = map(q => ({
      x: O.x + (q.translate ? q.translate[0] || 0 : 0),
      y: O.y + (q.translate ? q.translate[1] || 0 : 0),
      type: 'corner',
    }));
    T.keys.r = map(q => (q.rotate ? q.rotate[0] || 0 : 0));
    T.keys.k = map(q => ({ x: q.skewX ? q.skewX[0] || 0 : 0, y: q.skewY ? q.skewY[0] || 0 : 0 }));
    T.keys.s = map(q =>
      q.scale ? { x: q.scale[0], y: q.scale.length > 1 ? q.scale[1] : q.scale[0] } : { x: 1, y: 1 },
    );
    T.keys.t = map(q => ({ x: (q.b ? q.b[0] || 0 : 0) - O.x, y: (q.b ? q.b[1] || 0 : 0) - O.y }));
    // keys that never change are settings, not tracks
    for (const k of Object.keys(T.keys)) {
      const v = T.keys[k];
      if (v.every((q: Key) => JSON.stringify(q.v) === JSON.stringify(v[0].v))) {
        T.data[k] = v[0].v;
        delete T.keys[k];
      }
    }
    return T;
  };
  const has = (id: string, prop: string) =>
    (byId[id] || []).some(a => keyframes[a.name].some(s => s.decl[prop] != null));
  return {
    settings,
    notes,
    unwrap(g) {
      const id = g.getAttribute('id') || '';
      if (!svgator || !/_(to|tr|tk|ts)$/.test(id)) return null;
      const kids = Array.from(g.children).filter(c => !['title', 'desc'].includes(c.localName));
      return kids.length === 1 ? kids[0] : null;
    },
    animate(l, el, cv: Converter, wraps) {
      const id = el.getAttribute('id');
      const E: any = {};
      // the transform, from the wrappers and the element's own anchor
      const T = { keys: {} as any, data: {} as any };
      let moved = false;
      wraps.forEach(w => {
        const wid = w.getAttribute('id') || '',
          kind = (/_(to|tr|tk|ts)$/.exec(wid) || [])[1],
          M = parseTransform(w.getAttribute('transform')),
          st = decls(w.getAttribute('style') || '');
        if (kind === 'to') {
          const path = /path\(\s*['"]([^'"]+)['"]\s*\)/.exec(st['offset-path'] || '');
          if (path) {
            const dk = keysOf(wid, 'offset-distance', v => num(v) / 100);
            const k0 = motionKeys(path[1], dk || [{ t: 0, v: num(st['offset-distance'] || '0') / 100 }], note);
            if (dk && k0.length > 1) T.keys.o = k0;
            else if (k0.length) T.data.o = { x: k0[0].v.x, y: k0[0].v.y };
            if (/auto/.test(st['offset-rotate'] || '')) T.data.a = 1;
          } else {
            const tk = keysOf(wid, 'transform', v => {
              const t = fns(v).find(f => f[0] === 'translate');
              return t ? { x: t[1][0] || 0, y: t[1][1] || 0 } : { x: 0, y: 0 };
            });
            if (tk) T.keys.o = tk.map(k => ({ ...k, v: { ...k.v, type: 'corner' } }));
            else T.data.o = { x: M[4], y: M[5] };
          }
          moved = true;
        } else if (kind === 'tr') {
          const k = keysOf(wid, 'transform', v => (fns(v).find(f => f[0] === 'rotate') || ['', [0]])[1][0] || 0);
          if (k) T.keys.r = k;
          T.data.r = (Math.atan2(M[1], M[0]) * 180) / Math.PI;
          moved = true;
        } else if (kind === 'tk') {
          const sk = (v: string) => {
            const f = fns(v);
            return {
              x: (f.find(q => q[0] === 'skewX') || ['', [0]])[1][0] || 0,
              y: (f.find(q => q[0] === 'skewY') || ['', [0]])[1][0] || 0,
            };
          };
          const k = keysOf(wid, 'transform', sk);
          if (k) T.keys.k = k;
          T.data.k = sk(w.getAttribute('transform') || '');
          moved = true;
        } else if (kind === 'ts') {
          const sc = (v: string) => {
            const s = (fns(v).find(q => q[0] === 'scale') || ['', [1, 1]])[1];
            return { x: s[0], y: s.length > 1 ? s[1] : s[0] };
          };
          const k = keysOf(wid, 'transform', sc);
          if (k) T.keys.s = k;
          T.data.s = { x: M[0], y: M[3] };
          moved = true;
        }
        if (w.getAttribute('id') && byId[wid]) used.add(wid + '|transform');
      });
      if (id && has(id, 'transform') && !svgator) {
        // a CSS transform: translate · rotate · skew · scale (· translate), around transform-origin
        const g = genericTransform(id, l, cv);
        if (g) {
          E.transform = g;
          moved = false;
        } else note('A CSS transform animation in an unusual order wasn’t converted.');
      } else if (id && has(id, 'transform')) {
        // the anchor: the last translate (SVGator writes the static one before it as well)
        const k = keysOf(id, 'transform', v => {
          const t = fns(v).filter(f => f[0] === 'translate');
          const q = t.length ? t[t.length - 1][1] : [0, 0];
          return { x: q[0] || 0, y: q[1] || 0 };
        });
        if (k) T.keys.t = k;
        moved = true;
      }
      if (moved) {
        const M = parseTransform(el.getAttribute('transform'));
        if (!T.keys.t) T.data.t = { x: M[4], y: M[5] };
        E.transform = T;
      }
      if (id) {
        const add = (prop: string, key: string, f: (v: string) => any) => {
          const own =
            el.getAttribute(prop) ??
            {
              opacity: '1',
              'fill-opacity': '1',
              'stroke-opacity': '1',
              'stroke-dashoffset': '0',
              fill: '#000',
              stroke: 'none',
            }[prop];
          const k = keysOf(id, prop, f, own == null ? undefined : own);
          if (k) E[key] = k;
        };
        add('opacity', 'opacity', num);
        add('fill', 'fill', color);
        add('stroke', 'stroke', color);
        add('fill-opacity', 'fill-opacity', num);
        add('stroke-opacity', 'stroke-opacity', num);
        add('stroke-width', 'stroke-width', num);
        add('stroke-dashoffset', 'stroke-dashoffset', num);
        add('stroke-dasharray', 'stroke-dasharray', dashes);
        add('d', 'd', v => [(/path\(\s*['"]([^'"]+)['"]/.exec(v) || [])[1] || '']);
        // size and radius (width / height, rx / ry)
        const pair = (pa: string, pb: string, mk: (a: number, b: number) => any, key: string) => {
          const A = keysOf(id, pa, num),
            B = keysOf(id, pb, num);
          if (!A && !B) return;
          const times = [...new Set([...(A || []), ...(B || [])].map(k => k.t))].sort((x, y) => x - y);
          const val = (K: Key[] | null, t: number, def: number) => {
            if (!K) return def;
            const k = K.filter(q => q.t <= t).pop() || K[0];
            const n = K.find(q => q.t > t);
            if (!n || k === n) return k.v;
            return k.v + (n.v - k.v) * ((t - k.t) / (n.t - k.t));
          };
          const ga = num(el.getAttribute(pa === 'width' ? 'width' : 'rx') || '0'),
            gb = num(el.getAttribute(pb === 'height' ? 'height' : 'ry') || '0');
          E[key] = times.map(t => {
            const src = (A || []).find(q => q.t === t) || (B || []).find(q => q.t === t);
            return { t, v: mk(val(A, t, ga), val(B, t, gb)), e: src && src.e };
          });
        };
        pair('width', 'height', (w, h) => ({ width: w, height: h }), '#size');
        pair('rx', 'ry', (x, y) => ({ x, y }), '#radius');
        // a blur filter (SVGator writes blur(√(x² + y²)) for a blur of x by y)
        const f = svgator ? Math.SQRT2 : 1;
        const fk = keysOf(id, 'filter', v => {
          const m = /blur\(\s*([\d.]+)/.exec(v);
          const b = m ? parseFloat(m[1]) / f : 0;
          return [{ type: 'blur', value: { x: b, y: b } }];
        });
        if (fk) E['#filter'] = { keys: fk, data: { items: [['blur', id + '-filter-blur-0']] } };
        // the static blur, too
        if (svgator && l.fx) {
          const bl = l.fx.find(x => x.type === 'blur'),
            k = bl && 'fx.' + bl.id + '.sd';
          if (k && /blur\(/.test(el.getAttribute('style') || ''))
            l.b[k] = Math.round((l.b[k] / Math.SQRT2) * 1000) / 1000;
        }
      }
      // gradients whose stops (or transform) are animated
      for (const [prop, key] of [
        ['fill', 'fill'],
        ['stroke', 'stroke'],
      ]) {
        if (E[key]) continue;
        const gid = cv.refId(el.getAttribute(prop) || ''),
          g = gid ? cv.byId(gid) : null;
        if (!g) continue;
        const stops = Array.from(g.children).filter(c => c.localName === 'stop');
        const sk = stops.map(s => (s.getAttribute('id') && keysOf(s.getAttribute('id'), 'stop-color', color)) || null),
          tk = keysOf(gid, 'transform', v => fns(v));
        if (!sk.some(Boolean) && !tk) continue;
        const times = [...new Set([...sk.flatMap(k => (k || []).map(q => q.t)), ...(tk || []).map(q => q.t)])].sort(
          (a, b) => a - b,
        );
        const lin = g.localName === 'linearGradient',
          A = (k: string, d: number) => {
            const v = g.getAttribute(k);
            return v == null ? d : /%$/.test(v) ? parseFloat(v) / 100 : parseFloat(v);
          },
          gt0 = parseTransform(g.getAttribute('gradientTransform'));
        const at = (K: Key[], t: number) => (K.filter(q => q.t <= t).pop() || K[0]).v;
        E[key] = times.map(t => {
          const s = stops.map((st, i) => {
            const off = st.getAttribute('offset') || '0';
            return {
              o: /%$/.test(off) ? parseFloat(off) / 100 : parseFloat(off),
              c: sk[i]
                ? at(sk[i], t).v
                : (color(st.getAttribute('stop-color') || '#000') || { v: { r: 0, g: 0, b: 0, a: 1 } }).v,
            };
          });
          const gt = tk
            ? parseTransform(
                at(tk, t)
                  .map((f: [string, number[]]) => `${f[0]}(${f[1].join(' ')})`)
                  .join(' '),
              )
            : gt0;
          const v: any = { t: 'g', r: gid, s, gt };
          if (lin) {
            v.f = { x: A('x1', 0), y: A('y1', 0) };
            v.to = { x: A('x2', 1), y: A('y2', 0) };
          } else {
            v.c = { x: A('cx', 0.5), y: A('cy', 0.5) };
            v.rd = A('r', 0.5);
          }
          return { t, v };
        });
      }
      if (Object.keys(E).length) animateSVGator(l, el, E, cv, note);
    },
    done() {
      void declOf;
      // animations on elements that never became a layer
      const left = ids.filter(id => !Array.from(used).some(u => u.startsWith(id + '|')));
      if (left.length)
        note(`${left.length} CSS animation${left.length > 1 ? 's' : ''} couldn’t be matched to a layer.`);
    },
  };
}
