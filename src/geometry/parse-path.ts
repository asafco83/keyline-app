// Keyline — geometry/parse-path
import { r3 } from '../core/constants';
import { N } from './nodes';

export function arcToCubic(x1?, y1?, rx?, ry?, phi?, fa?, fs?, x2?, y2?) {
  const rad = (phi * Math.PI) / 180,
    cos = Math.cos(rad),
    sin = Math.sin(rad);
  const dx = (x1 - x2) / 2,
    dy = (y1 - y2) / 2,
    x1p = cos * dx + sin * dy,
    y1p = -sin * dx + cos * dy;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  if (!rx || !ry) return [[x1, y1, x2, y2, x2, y2]];
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) {
    rx *= Math.sqrt(lam);
    ry *= Math.sqrt(lam);
  }
  const sign = fa === fs ? -1 : 1,
    num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p,
    den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, num / den)),
    cxp = (co * rx * y1p) / ry,
    cyp = (-co * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2,
    cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux?, uy?, vx?, vy?) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dt > 0) dt -= 2 * Math.PI;
  if (fs && dt < 0) dt += 2 * Math.PI;
  const segs = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2))),
    d = dt / segs,
    k = (4 / 3) * Math.tan(d / 4),
    out = [];
  const map = (p?) => [cx + rx * p[0] * cos - ry * p[1] * sin, cy + rx * p[0] * sin + ry * p[1] * cos];
  for (let i = 0; i < segs; i++) {
    const a1 = t1 + i * d,
      a2 = a1 + d,
      c1 = Math.cos(a1),
      s1 = Math.sin(a1),
      c2 = Math.cos(a2),
      s2 = Math.sin(a2);
    out.push([].concat(map([c1 - k * s1, s1 + k * c1]), map([c2 + k * s2, s2 - k * c2]), map([c2, s2])));
  }
  return out;
}
export function parsePath(d?) {
  const out = [];
  let sp = null,
    i = 0,
    cmd = '',
    x = 0,
    y = 0,
    sx = 0,
    sy = 0,
    lc = null,
    lq = null;
  const s = String(d || '');
  const ws = () => {
    while (i < s.length && /[\s,]/.test(s[i])) i++;
  };
  const num = () => {
    ws();
    const m = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i));
    if (!m) throw 0;
    i += m[0].length;
    return parseFloat(m[0]);
  };
  const flag = () => {
    ws();
    const c = s[i++];
    if (c !== '0' && c !== '1') throw 0;
    return c === '1' ? 1 : 0;
  };
  const hasNum = () => {
    ws();
    return i < s.length && /[+\-.\d]/.test(s[i]);
  };
  const start = () => {
    sp = { c: false, n: [N(x, y)] };
    out.push(sp);
  };
  const last = () => sp.n[sp.n.length - 1];
  const cubic = (x1?, y1?, x2?, y2?, ex?, ey?) => {
    if (!sp) start();
    const l = last();
    l[4] = r3(x1);
    l[5] = r3(y1);
    sp.n.push([r3(ex), r3(ey), r3(x2), r3(y2), r3(ex), r3(ey)]);
    x = ex;
    y = ey;
    lc = [x2, y2];
  };
  const line = (ex?, ey?) => {
    if (!sp) start();
    sp.n.push(N(r3(ex), r3(ey)));
    x = ex;
    y = ey;
  };
  try {
    while (i < s.length) {
      ws();
      if (i >= s.length) break;
      if (/[a-zA-Z]/.test(s[i])) cmd = s[i++];
      else if (!cmd) break;
      const rel = cmd === cmd.toLowerCase(),
        C = cmd.toUpperCase(),
        ox = rel ? x : 0,
        oy = rel ? y : 0;
      if (C === 'Z') {
        if (sp) {
          sp.c = true;
          const f = sp.n[0],
            l = last();
          if (sp.n.length > 1 && Math.abs(f[0] - l[0]) < 1e-3 && Math.abs(f[1] - l[1]) < 1e-3) {
            f[2] = l[2];
            f[3] = l[3];
            sp.n.pop();
          }
          x = sx;
          y = sy;
        }
        sp = null;
        lc = lq = null;
        continue;
      }
      do {
        const cx0 = x,
          cy0 = y,
          ox2 = rel ? x : 0,
          oy2 = rel ? y : 0;
        if (C === 'M') {
          x = ox + num();
          y = oy + num();
          sx = x;
          sy = y;
          start();
          cmd = rel ? 'l' : 'L';
          lc = lq = null;
          break;
        } else if (C === 'L') {
          line(ox2 + num(), oy2 + num());
          lc = lq = null;
        } else if (C === 'H') {
          line((rel ? x : 0) + num(), y);
          lc = lq = null;
        } else if (C === 'V') {
          line(x, (rel ? y : 0) + num());
          lc = lq = null;
        } else if (C === 'C') {
          const a = [num(), num(), num(), num(), num(), num()];
          cubic(ox2 + a[0], oy2 + a[1], ox2 + a[2], oy2 + a[3], ox2 + a[4], oy2 + a[5]);
          lq = null;
        } else if (C === 'S') {
          const a = [num(), num(), num(), num()];
          const x1 = lc ? 2 * x - lc[0] : x,
            y1 = lc ? 2 * y - lc[1] : y;
          cubic(x1, y1, ox2 + a[0], oy2 + a[1], ox2 + a[2], oy2 + a[3]);
          lq = null;
        } else if (C === 'Q' || C === 'T') {
          let qx, qy;
          if (C === 'Q') {
            qx = ox2 + num();
            qy = oy2 + num();
          } else {
            qx = lq ? 2 * x - lq[0] : x;
            qy = lq ? 2 * y - lq[1] : y;
          }
          const ex = ox2 + num(),
            ey = oy2 + num();
          cubic(
            cx0 + (2 / 3) * (qx - cx0),
            cy0 + (2 / 3) * (qy - cy0),
            ex + (2 / 3) * (qx - ex),
            ey + (2 / 3) * (qy - ey),
            ex,
            ey,
          );
          lq = [qx, qy];
          lc = null;
        } else if (C === 'A') {
          const rx = num(),
            ry = num(),
            ph = num(),
            fa = flag(),
            fs = flag(),
            ex = ox2 + num(),
            ey = oy2 + num();
          arcToCubic(cx0, cy0, rx, ry, ph, fa, fs, ex, ey).forEach((c?) => cubic(c[0], c[1], c[2], c[3], c[4], c[5]));
          lc = lq = null;
        } else {
          i++;
          break;
        }
      } while (hasNum());
      if (C === 'M') {
        while (hasNum()) {
          const rr = cmd === 'l';
          line((rr ? x : 0) + num(), (rr ? y : 0) + num());
        }
      }
    }
  } catch (e) {
    /* keep what parsed */
  }
  return out.filter((p?) => p.n.length > 0);
}
