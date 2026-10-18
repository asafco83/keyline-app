// Keyline — tools/stage-input
import { H, clamp, clone, r2, xfp } from '../core/constants';
import { INSP, WRAP } from '../core/dom';
import { beginEdit, select, setProp, setTool } from '../core/history';
import { S, layerById } from '../core/state';
import { isLocked, parentMatrix } from '../model/tree';
import { docPt, drawOverlay } from '../render/overlay';
import { fit, frame } from '../render/stage';
import { boneCreate, fkDrag, ikDrag } from './bones';
import { createDrag, createText, finishPen, handleDrag, nodeDrag, penDown, toggleSmooth } from './edit-tools';

export function hitChain(target?) {
  const chain = [];
  let g = target.closest && target.closest('g[data-lid]');
  while (g) {
    chain.push(g.dataset.lid);
    g = g.parentElement && g.parentElement.closest('g[data-lid]');
  }
  return chain;
}
export function endDrag(e?) {
  if (S.drag) {
    const d = S.drag;
    S.drag = null;
    const p = (e.type === 'pointercancel' || (!e.clientX && !e.clientY)) && S.lastPt ? S.lastPt : docPt(e);
    if (d.up) d.up(p, e);
  }
}
export function moveDrag(l?, p0?) {
  const PMi = parentMatrix(l).inverse(),
    lp0 = xfp(PMi, p0.x, p0.y),
    start = clone(H.get(l, 'pos', S.time)),
    ed = beginEdit();
  let moved = false;
  S.drag = {
    move(p?, e?) {
      const lp = xfp(PMi, p.x, p.y);
      let dx = lp.x - lp0.x,
        dy = lp.y - lp0.y;
      if (!moved && Math.hypot(p.x - p0.x, p.y - p0.y) * S.scale < 3) return;
      moved = true;
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      setProp(l, 'pos', [r2(start[0] + dx), r2(start[1] + dy)]);
      frame();
    },
    up() {
      ed.end();
    },
  };
}

export function init(): void {
  WRAP.addEventListener('pointerdown', (e?) => {
    if (e.button !== 0) return;
    const p = docPt(e);
    try {
      WRAP.setPointerCapture(e.pointerId);
    } catch (_) {}
    const t = S.tool;
    if (t === 'pen') return penDown(p);
    if (t === 'rect' || t === 'ellipse' || t === 'star') return createDrag(t, p);
    if (t === 'text') return createText(p);
    if (t === 'bone') return boneCreate(p);
    const bn = (e.target as any).closest('[data-bone]');
    if (bn && t === 'select') {
      const b = layerById(bn.dataset.bone);
      if (b) {
        if (S.sel !== b.id || S.selSet.size > 1) select(b.id);
        if (!isLocked(b)) bn.dataset.part === 'tip' || e.altKey ? ikDrag(b, p) : fkDrag(b, p);
      }
      return;
    }
    const nd = (e.target as any).closest('[data-node]');
    if (nd) return nodeDrag(nd.dataset.node.split(',').map(Number), p);
    const h = (e.target as any).closest('[data-h]');
    if (h) return handleDrag(h.dataset.h, p);
    const chain = hitChain(e.target);
    if (chain.length) {
      const nb = chain.filter((c?) => {
        const x = layerById(c);
        return x && x.type !== 'bone';
      });
      let id =
        e.ctrlKey || e.metaKey ? chain[0] : S.sel && chain.includes(S.sel) ? S.sel : nb[nb.length - 1] || chain[0];
      if (t === 'node') {
        const pth = chain.find((c?) => {
          const x = layerById(c);
          return x && x.type === 'path';
        });
        if (pth) id = pth;
      }
      const l = layerById(id);
      if (l && !isLocked(l)) {
        if (e.shiftKey) {
          select(id, 'toggle');
          return;
        }
        if (S.sel !== id || S.selSet.size > 1) select(id);
        if (t === 'select') moveDrag(l, p);
        return;
      }
    }
    if (S.sel || S.selSet.size) {
      S.keys.clear();
      select(null);
    }
  });
  WRAP.addEventListener('pointermove', (e?) => {
    const p = docPt(e);
    S.lastPt = p;
    if (S.drag) S.drag.move(p, e);
    else if (S.pen) {
      S.pen.hover = p;
      drawOverlay();
    }
  });
  WRAP.addEventListener('pointerup', endDrag);
  WRAP.addEventListener('pointercancel', endDrag);
  WRAP.addEventListener('dblclick', (e?) => {
    if (S.tool === 'pen' && S.pen) {
      const n = S.pen.nodes;
      if (n.length > 1) {
        const a = n[n.length - 1],
          b = n[n.length - 2];
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) * S.scale < 4) n.pop();
      }
      finishPen(false);
      return;
    }
    const nd = (e.target as any).closest('[data-node]');
    if (nd && S.tool === 'node') {
      const [i, j, part] = nd.dataset.node.split(',').map(Number);
      if (part === 0) toggleSmooth(i, j);
      return;
    }
    const chain = hitChain(e.target),
      idx = chain.indexOf(S.sel);
    if (idx > 0) {
      select(chain[idx - 1]);
      return;
    }
    const l = layerById(chain[0]);
    if (l && l.id === S.sel && l.type === 'path' && S.tool === 'select') setTool('node');
    if (l && l.id === S.sel && l.type === 'text') {
      const ta = INSP.querySelector('[data-g="text"]');
      if (ta) {
        ta.focus();
        ta.select();
      }
    }
  });
  WRAP.addEventListener(
    'wheel',
    (e?) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      S.zoom = clamp(S.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), 0.1, 8);
      fit();
      frame();
    },
    { passive: false },
  );
}
