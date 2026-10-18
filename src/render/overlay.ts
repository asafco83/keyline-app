// Keyline — render/overlay
import { H, byId, fmt, r2, xfp } from '../core/constants';
import { CONTENT, OV, svgEl } from '../core/dom';
import { S, doc, layerById, selLayer } from '../core/state';
import { isHidden, isLocked, parentMatrix } from '../model/tree';
import { drawBone } from '../tools/bones';
import { cursorFor } from '../tools/edit-tools';

export function toDoc(x?, y?) {
  return new DOMPoint(x, y).matrixTransform(CONTENT.getScreenCTM().inverse());
}
export function docPt(e?) {
  return toDoc(e.clientX, e.clientY);
}
export function localMatrix(l?) {
  const s = byId('e-' + l.id + '-s');
  return CONTENT.getScreenCTM().inverse().multiply(s.getScreenCTM());
}
export function boxOf(l?) {
  const s = byId('e-' + l.id + '-s');
  if (!s) return null;
  const rc = s.getBoundingClientRect(),
    a = toDoc(rc.left, rc.top),
    b = toDoc(rc.right, rc.bottom);
  return { x: a.x, y: a.y, w: Math.max(0, b.x - a.x), h: Math.max(0, b.y - a.y) };
}
export function gMatrix(l?) {
  const g = byId('e-' + l.id);
  return CONTENT.getScreenCTM().inverse().multiply(g.getScreenCTM());
}
export function obbOf(l?) {
  const s = byId('e-' + l.id);
  if (!s) return null;
  let b;
  try {
    b = s.getBBox();
  } catch (e) {
    return null;
  }
  const M = gMatrix(l);
  return [
    [b.x, b.y],
    [b.x + b.width, b.y],
    [b.x + b.width, b.y + b.height],
    [b.x, b.y + b.height],
  ].map(([x, y]) => xfp(M, x, y));
}
export function quadPts(q?) {
  return q.map(p => r2(p.x) + ',' + r2(p.y)).join(' ');
}
export function drawOverlay() {
  OV.replaceChildren();
  const u = 1 / S.scale;
  if (S.pen) drawPen(u);
  if (S.showBones && ['select', 'bone', 'node'].includes(S.tool))
    doc.layers.forEach(b => {
      if (b.type === 'bone' && !isHidden(b)) drawBone(b, u, S.selSet.has(b.id));
    });
  if (S.boneDraft) {
    const A = S.boneDraft.a,
      B = S.boneDraft.b;
    OV.append(svgEl('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, class: 'ov-bdraft' }));
    OV.append(svgEl('circle', { cx: A.x, cy: A.y, r: 4.5 * u, class: 'ov-bj is-sel' }));
  }
  S.selSet.forEach(id => {
    if (id === S.sel) return;
    const o = layerById(id);
    const q = o && !isHidden(o) && obbOf(o);
    if (q) OV.append(svgEl('polygon', { points: quadPts(q), class: 'ov-box', 'stroke-dasharray': '3 3' }));
  });
  const l = selLayer();
  if (!l || isHidden(l)) return;
  const Q = obbOf(l);
  if (!Q) return;
  const PM = parentMatrix(l),
    mp = (x, y) => xfp(PM, x, y),
    tr = l.t.pos,
    o = H.get(l, 'org', S.time) || [0, 0];
  if (tr && tr.length > 1) {
    const t0 = tr[0][0],
      t1 = tr[tr.length - 1][0],
      pts = [];
    for (let i = 0; i <= 90; i++) {
      const p = H.get(l, 'pos', t0 + ((t1 - t0) * i) / 90),
        q = mp(p[0] + o[0], p[1] + o[1]);
      pts.push(r2(q.x) + ',' + r2(q.y));
    }
    OV.append(svgEl('polyline', { points: pts.join(' '), class: 'ov-path' }));
    tr.forEach(k => {
      const q = mp(k[1][0] + o[0], k[1][1] + o[1]);
      OV.append(svgEl('circle', { cx: q.x, cy: q.y, r: 3.5 * u, class: 'ov-kdot' }));
    });
  }
  if (l.type === 'bone') {
    if (S.drag && S.drag.lbl && S.drag.lp) {
      const t = svgEl('text', {
        x: S.drag.lp.x + 14 * u,
        y: S.drag.lp.y - 12 * u,
        class: 'ov-ang',
        'font-size': 11 * u,
        'stroke-width': 2.5 * u,
      });
      t.textContent = S.drag.lbl;
      OV.append(t);
    }
    return;
  }
  OV.append(svgEl('polygon', { points: quadPts(Q), class: 'ov-box' }));
  if (S.tool === 'node' && l.type === 'path') {
    drawNodes(l, u);
    return;
  }
  if (isLocked(l) || S.tool !== 'select') return;
  const c = H.comp(l, S.time),
    C = mp(c.x, c.y),
    hs = 8 * u;
  OV.append(svgEl('circle', { cx: C.x, cy: C.y, r: 4 * u, class: 'ov-org' }));
  OV.append(
    svgEl('path', { d: `M${C.x - 8 * u} ${C.y}H${C.x + 8 * u}M${C.x} ${C.y - 8 * u}V${C.y + 8 * u}`, class: 'ov-org' }),
  );
  const ang = (Math.atan2(Q[1].y - Q[0].y, Q[1].x - Q[0].x) * 180) / Math.PI,
    mx = (Q[0].x + Q[2].x) / 2,
    my = (Q[0].y + Q[2].y) / 2;
  const mid2 = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const H8: any[] = [
    ['nw', Q[0]],
    ['n', mid2(Q[0], Q[1])],
    ['ne', Q[1]],
    ['e', mid2(Q[1], Q[2])],
    ['se', Q[2]],
    ['s', mid2(Q[2], Q[3])],
    ['sw', Q[3]],
    ['w', mid2(Q[3], Q[0])],
  ];
  H8.forEach(([k, p]) => {
    const edge = k.length === 1,
      sz = edge ? hs * 0.8 : hs;
    OV.append(
      svgEl('rect', {
        x: p.x - sz / 2,
        y: p.y - sz / 2,
        width: sz,
        height: sz,
        class: 'ov-h' + (edge ? ' ov-he' : ''),
        'data-h': k,
        transform: `rotate(${r2(ang)} ${r2(p.x)} ${r2(p.y)})`,
        style: `cursor:${cursorFor(p.x - mx, p.y - my)}`,
      }),
    );
  });
  const tm = { x: (Q[0].x + Q[1].x) / 2, y: (Q[0].y + Q[1].y) / 2 },
    bm = { x: (Q[3].x + Q[2].x) / 2, y: (Q[3].y + Q[2].y) / 2 };
  let nx = tm.x - bm.x,
    ny = tm.y - bm.y,
    nl = Math.hypot(nx, ny);
  if (nl < 1e-6) {
    const a = ((ang - 90) * Math.PI) / 180;
    nx = Math.cos(a);
    ny = Math.sin(a);
    nl = 1;
  }
  nx /= nl;
  ny /= nl;
  const rx = tm.x + nx * 24 * u,
    ry = tm.y + ny * 24 * u;
  OV.append(svgEl('line', { x1: tm.x, y1: tm.y, x2: rx, y2: ry, class: 'ov-box' }));
  OV.append(svgEl('circle', { cx: rx, cy: ry, r: 5 * u, class: 'ov-h ov-rot', 'data-h': 'rot' }));
  OV.append(svgEl('circle', { cx: C.x, cy: C.y, r: 6 * u, class: 'ov-orgh', 'data-h': 'org' }));
  if (S.drag && S.drag.rot) {
    const t = svgEl('text', {
      x: rx + 10 * u,
      y: ry - 8 * u,
      class: 'ov-ang',
      'font-size': 11 * u,
      'stroke-width': 2.5 * u,
    });
    t.textContent = fmt(H.get(l, 'rot', S.time), 1) + '°';
    OV.append(t);
  }
  if (S.drag && S.drag.lbl && S.drag.lp) {
    const t = svgEl('text', {
      x: S.drag.lp.x + 14 * u,
      y: S.drag.lp.y - 12 * u,
      class: 'ov-ang',
      'font-size': 11 * u,
      'stroke-width': 2.5 * u,
    });
    t.textContent = S.drag.lbl;
    OV.append(t);
  }
}
export function drawNodes(l?, u?) {
  const M = localMatrix(l),
    d = H.get(l, 'd', S.time) || [],
    P = (x, y) => xfp(M, x, y);
  d.forEach((sp, i) =>
    sp.n.forEach((q, j) => {
      const A = P(q[0], q[1]),
        I = P(q[2], q[3]),
        O = P(q[4], q[5]);
      (
        [
          [I, 1],
          [O, 2],
        ] as any[]
      ).forEach(([p, part]) => {
        if (Math.hypot(p.x - A.x, p.y - A.y) > 0.01) {
          OV.append(svgEl('line', { x1: A.x, y1: A.y, x2: p.x, y2: p.y, class: 'ov-hl' }));
          OV.append(
            svgEl('circle', { cx: p.x, cy: p.y, r: 3.5 * u, class: 'ov-hd', 'data-node': `${i},${j},${part}` }),
          );
        }
      });
      const sel = S.node && S.node[0] === i && S.node[1] === j;
      OV.append(
        svgEl('rect', {
          x: A.x - 4 * u,
          y: A.y - 4 * u,
          width: 8 * u,
          height: 8 * u,
          class: 'ov-an' + (sel ? ' is-sel' : ''),
          'data-node': `${i},${j},0`,
        }),
      );
    }),
  );
}
export function drawPen(u?) {
  const n = S.pen.nodes;
  if (!n.length) return;
  OV.append(svgEl('path', { d: H.dstr([{ c: false, n }]), class: 'ov-pen' }));
  const l = n[n.length - 1],
    hv = S.pen.hover;
  if (hv && !S.drag) OV.append(svgEl('line', { x1: l[0], y1: l[1], x2: hv.x, y2: hv.y, class: 'ov-rub' }));
  n.forEach((q, j) => {
    if (q[4] !== q[0] || q[5] !== q[1])
      OV.append(svgEl('line', { x1: q[2], y1: q[3], x2: q[4], y2: q[5], class: 'ov-hl' }));
    OV.append(
      svgEl('rect', {
        x: q[0] - 4 * u,
        y: q[1] - 4 * u,
        width: 8 * u,
        height: 8 * u,
        class: 'ov-an' + (j === 0 && n.length > 1 ? ' is-sel' : ''),
      }),
    );
  });
}
