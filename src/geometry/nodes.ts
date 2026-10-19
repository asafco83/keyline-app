// Keyline — geometry/nodes
import { KAPPA, r2 } from '../core/constants';

export function N(x?, y?) {
  return [x, y, x, y, x, y];
}
export function radial(cx?, cy?, rads?, ks?, rot?) {
  rot = rot || 0;
  return [
    {
      c: true,
      n: rads.map((r?, i?) => {
        const a = ((-90 + (i * 360) / rads.length + rot) * Math.PI) / 180,
          x = cx + r * Math.cos(a),
          y = cy + r * Math.sin(a),
          tx = -Math.sin(a),
          ty = Math.cos(a),
          k = ks[i];
        return [r2(x), r2(y), r2(x - k * tx), r2(y - k * ty), r2(x + k * tx), r2(y + k * ty)];
      }),
    },
  ];
}
export function starNodes(cx?, cy?, ro?, ri?, pts?) {
  const n = [];
  for (let i = 0; i < pts * 2; i++) {
    const a = ((-90 + (i * 180) / pts) * Math.PI) / 180,
      r = i % 2 ? ri : ro;
    n.push(N(r2(cx + r * Math.cos(a)), r2(cy + r * Math.sin(a))));
  }
  return [{ c: true, n }];
}
export function rectNodes(G?) {
  const { x, y, w, h } = G,
    r = Math.min(G.rx || 0, w / 2, h / 2),
    k = r * KAPPA;
  if (r <= 0) return [{ c: true, n: [N(x, y), N(x + w, y), N(x + w, y + h), N(x, y + h)] }];
  return [
    {
      c: true,
      n: [
        [x + r, y, x + r - k, y, x + r, y],
        [x + w - r, y, x + w - r, y, x + w - r + k, y],
        [x + w, y + r, x + w, y + r - k, x + w, y + r],
        [x + w, y + h - r, x + w, y + h - r, x + w, y + h - r + k],
        [x + w - r, y + h, x + w - r + k, y + h, x + w - r, y + h],
        [x + r, y + h, x + r, y + h, x + r - k, y + h],
        [x, y + h - r, x, y + h - r + k, x, y + h - r],
        [x, y + r, x, y + r, x, y + r - k],
      ].map((q?) => q.map(r2)),
    },
  ];
}
export function ellNodes(G?) {
  const { cx, cy, rx, ry } = G,
    kx = rx * KAPPA,
    ky = ry * KAPPA;
  return [
    {
      c: true,
      n: [
        [cx, cy - ry, cx - kx, cy - ry, cx + kx, cy - ry],
        [cx + rx, cy, cx + rx, cy - ky, cx + rx, cy + ky],
        [cx, cy + ry, cx + kx, cy + ry, cx - kx, cy + ry],
        [cx - rx, cy, cx - rx, cy + ky, cx - rx, cy - ky],
      ].map((q?) => q.map(r2)),
    },
  ];
}
export function mid(a?, b?) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
export function dist(a?, b?) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
export function segLen(a?, b?) {
  return dist([a[0], a[1]], [a[4], a[5]]) + dist([a[4], a[5]], [b[2], b[3]]) + dist([b[2], b[3]], [b[0], b[1]]);
}
export function splitSeg(sp?, j?) {
  const len = sp.n.length,
    a = sp.n[j],
    b = sp.n[(j + 1) % len];
  const p0 = [a[0], a[1]],
    p1 = [a[4], a[5]],
    p2 = [b[2], b[3]],
    p3 = [b[0], b[1]];
  const p01 = mid(p0, p1),
    p12 = mid(p1, p2),
    p23 = mid(p2, p3),
    p012 = mid(p01, p12),
    p123 = mid(p12, p23),
    m = mid(p012, p123);
  a[4] = r2(p01[0]);
  a[5] = r2(p01[1]);
  b[2] = r2(p23[0]);
  b[3] = r2(p23[1]);
  sp.n.splice(j + 1, 0, [r2(m[0]), r2(m[1]), r2(p012[0]), r2(p012[1]), r2(p123[0]), r2(p123[1])]);
}
export function splitTo(sp?, target?) {
  let guard = 0;
  while (sp.n.length < target && guard++ < 2000) {
    const segs = sp.c ? sp.n.length : sp.n.length - 1;
    if (segs < 1 || (sp.n.length < 2 && !sp.c)) {
      sp.n.push(sp.n[0].slice());
      continue;
    }
    let best = 0,
      bl = -1;
    for (let j = 0; j < segs; j++) {
      const l = segLen(sp.n[j], sp.n[(j + 1) % sp.n.length]);
      if (l > bl) {
        bl = l;
        best = j;
      }
    }
    splitSeg(sp, best);
  }
}
export function padSubpaths(v?, count?) {
  while (v.length < count) {
    const ref = v[v.length - 1] || { c: true, n: [N(0, 0)] };
    const q = ref.n[ref.n.length - 1];
    v.push({ c: true, n: [N(q[0], q[1])] });
  }
}
export function equalizeValues(vals?) {
  const sc = Math.max(...vals.map((v?) => v.length));
  vals.forEach((v?) => padSubpaths(v, sc));
  for (let i = 0; i < sc; i++) {
    const t = Math.max(...vals.map((v?) => v[i].n.length));
    vals.forEach((v?) => splitTo(v[i], t));
  }
}
export function equalizeTrack(l?) {
  const vals = [l.b.d].concat((l.t.d || []).map((k?) => k[1])).filter(Boolean);
  equalizeValues(vals);
}
export function revSp(sp?) {
  return { c: sp.c, n: sp.n.map((q?) => [q[0], q[1], q[4], q[5], q[2], q[3]]).reverse() };
}
export function alignTo(A?, B?) {
  return B.map((sp?, i?) => {
    const a = A[i];
    if (!a || a.n.length !== sp.n.length) return sp;
    let best = sp,
      bc = Infinity;
    [sp, revSp(sp)].forEach((c?) => {
      const n = c.n.length,
        rots = c.c ? n : 1;
      for (let k = 0; k < rots; k++) {
        let cost = 0;
        for (let j = 0; j < n; j++) {
          const q = c.n[(j + k) % n],
            p = a.n[j];
          cost += (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
        }
        if (cost < bc) {
          bc = cost;
          best = { c: c.c, n: c.n.slice(k).concat(c.n.slice(0, k)) };
        }
      }
    });
    return best;
  });
}
export function eachShapeValue(l?, fn?) {
  if (l.b.d) fn(l.b.d);
  (l.t.d || []).forEach((k?) => fn(k[1]));
}
export function subdivideAll(l?) {
  eachShapeValue(l, (v?) =>
    v.forEach((sp?) => {
      const segs = sp.c ? sp.n.length : sp.n.length - 1;
      for (let j = segs - 1; j >= 0; j--) splitSeg(sp, j);
    }),
  );
}
export function removeNodeAll(l?, i?, j?) {
  let ok = true;
  eachShapeValue(l, (v?) => {
    if (!v[i] || v[i].n.length <= 2) ok = false;
  });
  if (!ok) return false;
  eachShapeValue(l, (v?) => v[i].n.splice(j, 1));
  return true;
}
export function isSmooth(q?) {
  const ix = q[2] - q[0],
    iy = q[3] - q[1],
    ox = q[4] - q[0],
    oy = q[5] - q[1];
  if (!(ix || iy) || !(ox || oy)) return false;
  return Math.abs(ix * oy - iy * ox) < 0.01 * Math.hypot(ix, iy) * Math.hypot(ox, oy) + 1e-6 && ix * ox + iy * oy < 0;
}
