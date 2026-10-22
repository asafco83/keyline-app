// SVGcinema — tools/pins
// Pin tool: click a path, image, text or group to add pins, drag a pin to bend it (keyed at the
// playhead), drag the ring of the selected pin to turn it, Alt+drag moves a pin at rest. Edit pins
// tool: moves pins at rest (the artwork shows its rest shape); a moved pin takes its motion with it.
// Paths bend through their own nodes; images, text and groups through a triangle mesh (model/mesh).
import type { Layer, PropKey, XY } from '../model/types';
import { H, byId, clone, esc, fmt, r2, r3, valueAt, xfp } from '../core/constants';
import { OV, svgEl } from '../core/dom';
import { beginEdit, setProp } from '../core/history';
import { S, layerById, selLayer } from '../core/state';
import { ellNodes, rectNodes } from '../geometry/nodes';
import { nextPinNumber } from '../model/pins';
import { meshable, pinnable } from '../model/mesh';
import { meshLines } from '../render/mesh';
import { meshOf } from '../render/markup';
import { isHidden, isLocked } from '../model/tree';
import { drawOverlay, gMatrix, localMatrix } from '../render/overlay';
import { frame } from '../render/stage';
import { hitChain } from './stage-input';

const RING = 22; // screen px: the rotation ring around the selected pin
export const isPinTool = (t: string) => t === 'pin' || t === 'pinedit';

/** a pin's current position (layer space): at rest with the Edit pins tool, else at the playhead */
function pinAt(l: Layer, n: number) {
  const p = l.pins.find(q => q.n === n);
  if (!p) return null;
  if (S.tool === 'pinedit') return [p.x, p.y];
  return valueAt(l, 'pin' + n, S.time) || [p.x, p.y];
}
function pinRot(l: Layer, n: number) {
  return S.tool === 'pinedit' ? 0 : valueAt(l, 'pinr' + n, S.time) || 0;
}
/** the layer whose pins are shown: the selected path, image, text or group */
function pinLayer(): Layer | null {
  const l = selLayer();
  return l && (l.type === 'path' || meshable(l)) && !isHidden(l) && byId('e-' + l.id + '-s') ? l : null;
}
/** a layer's pin space → document: a path's own coordinates, or the content space of a meshed layer */
export function pinMatrix(l: Layer): DOMMatrix {
  return meshable(l) ? gMatrix(l) : localMatrix(l);
}
const mtx = (M: DOMMatrix) => `matrix(${[M.a, M.b, M.c, M.d, M.e, M.f].map(v => r3(v)).join(',')})`;
/** is any pin away from its rest place or turned at the playhead */
function bent(l: Layer) {
  return (l.pins || []).some(p => {
    const c = pinAt(l, p.n);
    return Math.hypot(c[0] - p.x, c[1] - p.y) > 0.01 || Math.abs(pinRot(l, p.n)) > 0.01;
  });
}
function animated(l: Layer) {
  return (l.pins || []).some(p => ['pin' + p.n, 'pinr' + p.n].some(k => l.t[k] && l.t[k].length > 1));
}
/** the Pin tool's chip above the canvas */
export function pinChip(): string | null {
  const l = pinLayer();
  if (!l || !l.pins || !l.pins.length) return null;
  if (S.pinRing != null && l.pins.some(p => p.n === S.pinRing))
    return `<b>Pin ${S.pinRing}</b><span class="mu">· drag the ring to turn it</span>`;
  const n = l.pins.length,
    pins = `${n} ${n > 1 ? 'pins' : 'pin'}`,
    M = meshOf(l),
    kind = l.type === 'raw' ? 'artwork' : l.type,
    dot = animated(l) ? '<span class="dot key"></span>' : '';
  return M
    ? `${dot}<b>${esc(l.name)}</b><span class="mu">· ${kind} · mesh of ${M.t.length} triangles · ${pins}</span>`
    : `${dot}<b>${esc(l.name)}</b><span class="mu">· ${pins}</span>`;
}
/** the Pin tool: the chip names the pin whose ring is under the pointer */
export function pinHover(e: PointerEvent) {
  const t = e.target as any,
    r = t && t.closest && t.closest('[data-pinring]'),
    n = r ? +r.dataset.pinring : null;
  if (n !== S.pinRing) {
    S.pinRing = n;
    drawOverlay();
  }
}

/* ---------- overlay ---------- */

export function drawPins(u: number) {
  if (!isPinTool(S.tool)) return;
  const l = pinLayer();
  if (!l || !l.pins || !l.pins.length) return;
  if (S.pinSel != null && !l.pins.some(p => p.n === S.pinSel)) S.pinSel = null;
  const M = pinMatrix(l);
  // the mesh, as it bends
  const tris = meshLines(l);
  if (tris.length) {
    const seen = new Set<string>();
    let d = '';
    tris.forEach(T =>
      T.forEach((a, i) => {
        const b = T[(i + 1) % 3],
          k = [a, b]
            .map(q => q.map(v => v.toFixed(2)).join(','))
            .sort()
            .join(' ');
        if (seen.has(k)) return;
        seen.add(k);
        d += `M${r2(a[0])} ${r2(a[1])}L${r2(b[0])} ${r2(b[1])}`;
      }),
    );
    OV.append(svgEl('path', { d, transform: mtx(M), class: 'ov-mesh' }));
  }
  // the artwork at rest, while it is bent
  if (S.tool === 'pin' && bent(l)) {
    if (meshOf(l)) {
      const s = byId('e-' + l.id + '-s') as unknown as SVGGraphicsElement;
      try {
        const b = s.getBBox(),
          Q = gMatrix(l).inverse().multiply(localMatrix(l)),
          q = [
            [b.x, b.y],
            [b.x + b.width, b.y],
            [b.x + b.width, b.y + b.height],
            [b.x, b.y + b.height],
          ].map(([x, y]) => xfp(Q, x, y));
        OV.append(
          svgEl('path', {
            d: 'M' + q.map(p => `${r2(p.x)} ${r2(p.y)}`).join('L') + 'Z',
            transform: mtx(M),
            class: 'ov-pinout',
          }),
        );
      } catch (_) {
        /* not measurable */
      }
    } else {
      const was = H.restPins(true),
        d = H.comp(l, S.time).d;
      H.restPins(was);
      if (d) OV.append(svgEl('path', { d: H.dstr(d), transform: mtx(M), class: 'ov-pinout' }));
    }
  }
  l.pins.forEach(p => {
    const c = pinAt(l, p.n),
      P = xfp(M, c[0], c[1]),
      R = xfp(M, p.x, p.y),
      sel = S.pinSel === p.n;
    if (S.tool === 'pin' && Math.hypot(P.x - R.x, P.y - R.y) > 0.5 / S.scale) {
      // where the pin sits at rest
      OV.append(svgEl('line', { x1: R.x, y1: R.y, x2: P.x, y2: P.y, class: 'ov-pinrest' }));
      OV.append(svgEl('circle', { cx: R.x, cy: R.y, r: 4 * u, class: 'ov-pinrest' }));
    }
    if (sel && S.tool === 'pin') {
      const a = (pinRot(l, p.n) * Math.PI) / 180,
        kx = P.x + RING * u * Math.cos(a),
        ky = P.y + RING * u * Math.sin(a);
      OV.append(svgEl('circle', { cx: P.x, cy: P.y, r: RING * u, class: 'ov-pinring' }));
      OV.append(svgEl('line', { x1: P.x, y1: P.y, x2: kx, y2: ky, class: 'ov-pinarm' }));
      OV.append(svgEl('circle', { cx: kx, cy: ky, r: 4.5 * u, class: 'ov-pinknob', 'data-pinring': p.n }));
    }
    if (sel) OV.append(svgEl('circle', { cx: P.x, cy: P.y, r: 6 * u, class: 'ov-pin is-sel', 'data-pin': p.n }));
    else {
      OV.append(svgEl('circle', { cx: P.x, cy: P.y, r: 5.5 * u, class: 'ov-pin', 'data-pin': p.n }));
      OV.append(svgEl('circle', { cx: P.x, cy: P.y, r: 1.8 * u, class: 'ov-pindot' }));
    }
  });
  if (S.drag && S.drag.lbl && S.drag.lp && S.drag.pin) {
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

/* ---------- editing ---------- */

/** a track for a pin property, made on its first drag: it starts from where the pin was at 0 s, so
 *  the drag animates from there to the playhead */
function ensureTrack(l: Layer, k: string) {
  if (l.t[k] && l.t[k].length) return;
  const v = clone(valueAt(l, k, S.time));
  l.t[k] =
    S.time > 0.0005
      ? [
          [0, clone(v), 'ease'],
          [r3(S.time), v, 'ease'],
        ]
      : [[0, v, 'ease']];
}
/** moves pin n at rest by (dx, dy): its keyed positions move with it, so its motion is kept */
function moveRest(l: Layer, n: number, dx: number, dy: number) {
  const p = l.pins.find(q => q.n === n),
    k = 'pin' + n;
  p.x = r2(p.x + dx);
  p.y = r2(p.y + dy);
  if (l.t[k]) l.t[k].forEach(q => (q[1] = [r2(q[1][0] + dx), r2(q[1][1] + dy)]));
  if (l.ft && l.ft[k]) l.ft[k].forEach(q => (q[1] = [r2(q[1][0] + dx), r2(q[1][1] + dy)]));
  const b = l.b as Record<string, any>;
  if (b[k]) b[k] = [r2(b[k][0] + dx), r2(b[k][1] + dy)];
}
export function removePin(l: Layer, n: number) {
  const ed = beginEdit();
  l.pins = l.pins.filter(p => p.n !== n);
  ['pin' + n, 'pinr' + n].forEach(k => {
    delete l.t[k];
    if (l.ft) delete l.ft[k];
    delete (l.b as Record<string, any>)[k];
  });
  if (!l.pins.length) {
    delete l.pins;
    delete l.reach;
    delete l.mesh;
  }
  if (S.pinSel === n) S.pinSel = null;
  ed.end({ insp: true });
}
export function removeAllPins(l: Layer) {
  const ed = beginEdit();
  (l.pins || []).forEach(p =>
    ['pin' + p.n, 'pinr' + p.n].forEach(k => {
      delete l.t[k];
      if (l.ft) delete l.ft[k];
      delete (l.b as Record<string, any>)[k];
    }),
  );
  delete l.pins;
  delete l.reach;
  delete l.mesh;
  S.pinSel = null;
  ed.end({ insp: true });
}
/** Delete / Backspace with a pin selected in the pin tools */
export function deleteSelectedPin() {
  if (!isPinTool(S.tool) || S.pinSel == null) return false;
  const l = pinLayer();
  if (!l || !l.pins || !l.pins.some(p => p.n === S.pinSel)) return false;
  removePin(l, S.pinSel);
  return true;
}
function addPin(l: Layer, p: XY) {
  const ed = beginEdit();
  // rectangles and ellipses become paths first (pins bend a path through its nodes)
  if (l.type === 'rect' || l.type === 'ellipse') {
    l.b.d = l.type === 'rect' ? rectNodes(l.geo) : ellNodes(l.geo);
    l.type = 'path';
    l.geo = {};
  }
  if (S.sel !== l.id || S.selSet.size > 1) {
    S.sel = l.id;
    S.selSet = new Set<any>([l.id]);
  }
  const M = pinMatrix(l).inverse(),
    q = xfp(M, p.x, p.y),
    n = nextPinNumber(l);
  l.pins = [...(l.pins || []), { n, x: r2(q.x), y: r2(q.y) }];
  S.pinSel = n;
  ed.end({ insp: true });
}
export function pinsDown(e: PointerEvent, p0: XY) {
  const t = e.target as any,
    ring = t.closest && t.closest('[data-pinring]'),
    pe = t.closest && t.closest('[data-pin]'),
    l = pinLayer();
  if ((ring || pe) && l && !isLocked(l)) {
    const n = +(ring || pe).dataset[ring ? 'pinring' : 'pin'];
    S.pinSel = n;
    return ring ? rotateDrag(l, n, p0) : pinDrag(l, n, p0, S.tool === 'pinedit' || e.altKey);
  }
  if (S.tool === 'pinedit') {
    S.pinSel = null;
    drawOverlay();
    return;
  }
  // the Pin tool: a click on artwork adds a pin there. As with Select, a click picks the outermost
  // layer (Ctrl/Cmd picks inside groups), and the selected layer keeps the pins it is getting.
  const chain = hitChain(e.target)
      .map(id => layerById(id))
      .filter(x => x && pinnable(x)),
    sel = selLayer(),
    hit = sel && chain.includes(sel) ? sel : e.ctrlKey || e.metaKey ? chain[0] : chain[chain.length - 1];
  if (!hit) {
    S.pinSel = null;
    drawOverlay();
    return;
  }
  if (isLocked(hit)) return;
  addPin(hit, p0);
}
function pinDrag(l: Layer, n: number, p0: XY, rest: boolean) {
  const M = pinMatrix(l),
    Mi = M.inverse(),
    k = ('pin' + n) as PropKey,
    q0 = xfp(Mi, p0.x, p0.y),
    start = clone(pinAt(l, n)),
    ed = beginEdit();
  let moved = false,
    last = [0, 0];
  S.drag = {
    pin: true,
    move(p: XY, ev: PointerEvent) {
      if (!moved && Math.hypot(p.x - p0.x, p.y - p0.y) * S.scale < 3) return;
      const q = xfp(Mi, p.x, p.y);
      let dx = q.x - q0.x,
        dy = q.y - q0.y;
      if (ev.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      if (!moved && !rest) ensureTrack(l, k);
      moved = true;
      if (rest) {
        moveRest(l, n, dx - last[0], dy - last[1]);
        last = [dx, dy];
        S.drag.lbl = `Pin ${n} · rest moved`;
      } else {
        setProp(l, k, [r2(start[0] + dx), r2(start[1] + dy)]);
        S.drag.lbl = `Pin ${n} · key at ${fmt(S.time, 2)}s`;
      }
      S.drag.lp = p;
      frame();
    },
    up() {
      ed.end({ insp: true });
    },
  };
  drawOverlay();
}
function rotateDrag(l: Layer, n: number, p0: XY) {
  const M = pinMatrix(l),
    c = pinAt(l, n),
    C = xfp(M, c[0], c[1]),
    a0 = Math.atan2(p0.y - C.y, p0.x - C.x),
    r0 = pinRot(l, n),
    k = ('pinr' + n) as PropKey,
    ed = beginEdit();
  let moved = false;
  S.drag = {
    pin: true,
    move(p: XY, ev: PointerEvent) {
      if (!moved && Math.hypot(p.x - p0.x, p.y - p0.y) * S.scale < 3) return;
      if (!moved) ensureTrack(l, k);
      moved = true;
      let r = r0 + ((Math.atan2(p.y - C.y, p.x - C.x) - a0) * 180) / Math.PI;
      if (ev.shiftKey) r = Math.round(r / 15) * 15;
      setProp(l, k, r2(r));
      S.drag.lbl = `∠ ${fmt(r, 0).replace('-', '−')}°`;
      S.drag.lp = p;
      frame();
    },
    up() {
      ed.end({ insp: true });
    },
  };
  drawOverlay();
}
