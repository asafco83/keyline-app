// Keyline — tools/edit-tools
import { bgPaint } from '../model/background';
import type { Layer, XY } from '../model/types';
import { $, FONTS, H, HINTS, byId, clone, fmt, r2, r3, xfp } from '../core/constants';
import { INSP, WRAP } from '../core/dom';
import { beginEdit, setProp } from '../core/history';
import { S, doc, mkLayer, nextColor, selLayer } from '../core/state';
import { N, isSmooth, starNodes } from '../geometry/nodes';
import { parentMatrix } from '../model/tree';
import { drawOverlay, gMatrix, localMatrix } from '../render/overlay';
import { frame, renderStage } from '../render/stage';
import { reOrigin, toHex } from '../ui/inspector';
import { addLayer, backToSelect } from './shapes';

export function cursorFor(dx: number, dy: number) {
  let a = (Math.atan2(dy, dx) * 180) / Math.PI;
  a = ((a % 180) + 180) % 180;
  return a < 22.5 || a >= 157.5 ? 'ew-resize' : a < 67.5 ? 'nwse-resize' : a < 112.5 ? 'ns-resize' : 'nesw-resize';
}
export const H9 = [
  [0, 0],
  [0.5, 0],
  [1, 0],
  [0, 0.5],
  [0.5, 0.5],
  [1, 0.5],
  [0, 1],
  [0.5, 1],
  [1, 1],
];
export function originDrag(l: Layer) {
  const g = byId('e-' + l.id);
  if (!g) return;
  const Mi = gMatrix(l).inverse(),
    b = g.getBBox(),
    ed = beginEdit();
  const pts = H9.map(([u, v]) => [b.x + b.width * u, b.y + b.height * v]);
  S.drag = {
    move(p, e) {
      const q = xfp(Mi, p.x, p.y);
      let o = [q.x, q.y];
      const near: any = pts
        .map(pt => [pt, Math.hypot(pt[0] - o[0], pt[1] - o[1])])
        .sort((x?: any, y?: any) => x[1] - y[1])[0];
      if (e.shiftKey || near[1] * S.scale < 8) o = near[0].slice();
      reOrigin(l, o);
      const oo = H.get(l, 'org', S.time);
      S.drag.lbl = `Origin ${fmt(oo[0], 1)}, ${fmt(oo[1], 1)}`;
      S.drag.lp = p;
      frame();
    },
    up() {
      ed.end();
    },
  };
}
export function setAnchor(l: Layer, u: number, v: number) {
  const g = byId('e-' + l.id);
  if (!g) return;
  const b = g.getBBox(),
    ed = beginEdit();
  reOrigin(l, [b.x + b.width * u, b.y + b.height * v]);
  ed.end();
}
export function handleDrag(kind: string, p0: XY) {
  const l = selLayer();
  if (!l) return;
  if (kind === 'org') return originDrag(l);
  const PMi = parentMatrix(l).inverse(),
    L = (p: XY) => xfp(PMi, p.x, p.y),
    c = H.comp(l, S.time),
    C = { x: c.x, y: c.y },
    ed = beginEdit(),
    q0 = L(p0);
  if (kind === 'rot') {
    const r0 = H.get(l, 'rot', S.time),
      a0 = Math.atan2(q0.y - C.y, q0.x - C.x);
    S.drag = {
      rot: true,
      move(p, e) {
        const q = L(p);
        let r = r0 + ((Math.atan2(q.y - C.y, q.x - C.x) - a0) * 180) / Math.PI;
        if (e.shiftKey) r = Math.round(r / 15) * 15;
        setProp(l, 'rot', r2(r));
        frame();
      },
      up() {
        ed.end();
      },
    };
    return;
  }
  /* Photoshop-style scaling: drag a handle; the opposite side stays put.
     Shift keeps proportions · Alt scales from the box center · Ctrl/Cmd scales around the origin · drag past the anchor to mirror */
  const g = byId('e-' + l.id),
    b = g.getBBox();
  const UV = (<Record<string, number[]>>{
    nw: [0, 0],
    n: [0.5, 0],
    ne: [1, 0],
    e: [1, 0.5],
    se: [1, 1],
    s: [0.5, 1],
    sw: [0, 1],
    w: [0, 0.5],
  })[kind];
  if (!UV) return;
  const at = (u: number, v: number) => [b.x + b.width * u, b.y + b.height * v],
    Hl = at(UV[0], UV[1]),
    ax = UV[0] !== 0.5,
    ay = UV[1] !== 0.5;
  const o = clone(H.get(l, 'org', S.time)),
    s0 = clone(H.get(l, 'scl', S.time)),
    t0 = clone(H.get(l, 'pos', S.time)),
    rad = (c.r * Math.PI) / 180,
    cs = Math.cos(rad),
    sn = Math.sin(rad);
  const T = (pt: number[], s: number[], t: number[]) => {
    const dx = (pt[0] - o[0]) * s[0],
      dy = (pt[1] - o[1]) * s[1];
    return [t[0] + o[0] + dx * cs - dy * sn, t[1] + o[1] + dx * sn + dy * cs];
  };
  S.drag = {
    move(p, e) {
      const A = e.ctrlKey || e.metaKey ? o : e.altKey ? at(0.5, 0.5) : at(1 - UV[0], 1 - UV[1]),
        TA = T(A, s0, t0),
        P = L(p);
      const vx = P.x - TA[0],
        vy = P.y - TA[1],
        rx = vx * cs + vy * sn,
        ry = -vx * sn + vy * cs,
        hx = Hl[0] - A[0],
        hy = Hl[1] - A[1];
      let sx = s0[0],
        sy = s0[1];
      if (ax && Math.abs(hx) > 1e-6) sx = rx / hx;
      if (ay && Math.abs(hy) > 1e-6) sy = ry / hy;
      if (e.shiftKey) {
        const fx = s0[0] ? sx / s0[0] : 1,
          fy = s0[1] ? sy / s0[1] : 1;
        let f = ax && ay ? (Math.abs(fx) > Math.abs(fy) ? fx : fy) : ax ? fx : fy;
        if (!isFinite(f)) f = 1;
        sx = s0[0] * f;
        sy = s0[1] * f;
      }
      const mn = 0.001;
      if (Math.abs(sx) < mn) sx = sx < 0 ? -mn : mn;
      if (Math.abs(sy) < mn) sy = sy < 0 ? -mn : mn;
      const s = [r3(sx), r3(sy)],
        TA2 = T(A, s, [0, 0]);
      setProp(l, 'scl', s);
      setProp(l, 'pos', [r2(TA[0] - TA2[0]), r2(TA[1] - TA2[1])]);
      S.drag.lbl = `W ${fmt(s[0] * 100, 0)}%  H ${fmt(s[1] * 100, 0)}%${s[0] < 0 || s[1] < 0 ? '  (mirrored)' : ''}`;
      S.drag.lp = p;
      frame();
    },
    up() {
      ed.end();
    },
  };
}
export function createText(p: XY) {
  const ed = beginEdit();
  const l = mkLayer(
    'text',
    'Text',
    { x: r2(p.x), y: r2(p.y), text: 'Text', size: 48, family: FONTS[0][0], weight: '600', anchor: 'start' },
    { fill: darkBg() ? '#F3EEE4' : '#1A2030' },
  );
  addLayer(l);
  backToSelect();
  ed.end({ insp: true });
  setTimeout(() => {
    const ta = INSP.querySelector('[data-g="text"]');
    if (ta) {
      ta.focus();
      ta.select();
    }
  }, 0);
}
/** Is the canvas background dark enough that new text should be light? */
export function darkBg() {
  const p = bgPaint(doc);
  return p.alpha >= 0.5 && lum(p.color) < 0.45;
}
export function lum(c: string) {
  const h = toHex(c);
  if (!h) return 1;
  const v = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255);
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
export function nodeDrag([i, j, part]: number[], p0: XY) {
  const l = selLayer();
  if (!l || l.type !== 'path') return;
  const Mi = localMatrix(l).inverse(),
    base = clone(H.get(l, 'd', S.time)),
    lp0 = xfp(Mi, p0.x, p0.y),
    ed = beginEdit();
  S.node = [i, j];
  const smooth = isSmooth(base[i].n[j]);
  S.drag = {
    move(p, e) {
      const lp = xfp(Mi, p.x, p.y),
        dx = lp.x - lp0.x,
        dy = lp.y - lp0.y,
        d = clone(base),
        n = d[i].n[j],
        b = base[i].n[j];
      if (part === 0) {
        for (let k = 0; k < 6; k += 2) {
          n[k] = r2(b[k] + dx);
          n[k + 1] = r2(b[k + 1] + dy);
        }
      } else {
        const k = part === 1 ? 2 : 4,
          o = part === 1 ? 4 : 2;
        n[k] = r2(b[k] + dx);
        n[k + 1] = r2(b[k + 1] + dy);
        if (smooth && !e.altKey) {
          const len = Math.hypot(b[o] - b[0], b[o + 1] - b[1]),
            vx = n[0] - n[k],
            vy = n[1] - n[k + 1],
            vl = Math.hypot(vx, vy) || 1;
          n[o] = r2(n[0] + (vx / vl) * len);
          n[o + 1] = r2(n[1] + (vy / vl) * len);
        }
      }
      setProp(l, 'd', d);
      frame();
    },
    up() {
      ed.end();
    },
  };
  frame();
}
export function toggleSmooth(i: number, j: number) {
  const l = selLayer();
  if (!l) return;
  const ed = beginEdit(),
    d = clone(H.get(l, 'd', S.time)),
    sp = d[i],
    q = sp.n[j],
    len = sp.n.length;
  const collapsed = q[2] === q[0] && q[3] === q[1] && q[4] === q[0] && q[5] === q[1];
  if (collapsed) {
    const pv = sp.n[(j - 1 + len) % len],
      nx = sp.n[(j + 1) % len];
    let vx = nx[0] - pv[0],
      vy = nx[1] - pv[1];
    const vl = Math.hypot(vx, vy) || 1;
    vx /= vl;
    vy /= vl;
    const a = Math.hypot(q[0] - pv[0], q[1] - pv[1]) / 3,
      b = Math.hypot(nx[0] - q[0], nx[1] - q[1]) / 3;
    q[2] = r2(q[0] - vx * a);
    q[3] = r2(q[1] - vy * a);
    q[4] = r2(q[0] + vx * b);
    q[5] = r2(q[1] + vy * b);
  } else {
    q[2] = q[4] = q[0];
    q[3] = q[5] = q[1];
  }
  setProp(l, 'd', d);
  ed.end();
}
