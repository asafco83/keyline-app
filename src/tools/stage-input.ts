// Keyline — tools/stage-input
import { gradHandleDrag } from './gradient-handles';
import { startTextEdit } from './text-edit';
import { panDrag } from './hand';
import type { Keyframe, Layer, XY } from '../model/types';
import { motionHandleDrag, segmentDrag, straighten } from './motion-path';
import { H, clamp, clone, r2, xfp } from '../core/constants';
import { INSP, WRAP } from '../core/dom';
import { beginEdit, select, setProp, setTool } from '../core/history';
import { S, layerById } from '../core/state';
import { isLocked, parentMatrix } from '../model/tree';
import { boxOf, docPt, drawOverlay, obbOf } from '../render/overlay';
import { clearSnap, selfAndKids, snapMove, snapPoint, snapTargets } from './snap';
import { guideDrag } from '../render/guides';
import { fit, frame } from '../render/stage';
import { boneCreate, fkDrag, ikDrag } from './bones';
import { createText, handleDrag, nodeDrag, toggleSmooth } from './edit-tools';
import { addNodeDown, convertDown, delNodeDown, finishPen, penDown, penHover, pencilDown } from './pen';
import { SHAPE_TOOLS, backToSelect, createDrag } from './shapes';

/** Position keyframes of `l` that are selected in the timeline. */
export function selectedPosKeys(l: Layer): Keyframe[] {
  return S.keys.size && l.t.pos ? l.t.pos.filter(q => S.keys.has(q)) : [];
}
export function insideBox(l: Layer, p: XY) {
  const q = obbOf(l);
  if (!q || q.length < 4) return false;
  // point in convex quad: same side of all four edges
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i],
      b = q[(i + 1) % 4],
      c = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (Math.abs(c) < 1e-9) continue;
    const sg = Math.sign(c);
    if (sign && sg !== sign) return false;
    sign = sg;
  }
  return true;
}
export function hitChain(target: any): string[] {
  const chain: string[] = [];
  let g = target.closest && target.closest('g[data-lid]');
  while (g) {
    chain.push(g.dataset.lid);
    g = g.parentElement && g.parentElement.closest('g[data-lid]');
  }
  return chain;
}
export function endDrag(e: PointerEvent) {
  if (S.drag) {
    const d = S.drag;
    S.drag = null;
    const p = (e.type === 'pointercancel' || (!e.clientX && !e.clientY)) && S.lastPt ? S.lastPt : docPt(e);
    if (d.up) d.up(p, e);
    if (S.snapLines) {
      S.snapLines = null;
      drawOverlay();
    }
  }
}
export function moveDrag(l: Layer, p0: XY) {
  const PMi = parentMatrix(l).inverse(),
    lp0 = xfp(PMi, p0.x, p0.y),
    start = clone(H.get(l, 'pos', S.time)),
    // position keyframes selected in the timeline move together (the whole motion path when all are)
    keys = selectedPosKeys(l),
    keyStart = keys.map(q => clone(q[1])),
    // snapping: the layer's box against everything else
    T = snapTargets(selfAndKids(l)),
    box0 = boxOf(l),
    ed = beginEdit();
  let moved = false;
  S.drag = {
    move(p, e) {
      let ddx = p.x - p0.x,
        ddy = p.y - p0.y;
      if (!moved && Math.hypot(ddx, ddy) * S.scale < 3) return;
      moved = true;
      if (e.shiftKey) {
        if (Math.abs(ddx) > Math.abs(ddy)) ddy = 0;
        else ddx = 0;
      }
      if (box0 && !e.ctrlKey && !e.metaKey) {
        const [sx, sy] = snapMove(box0, ddx, ddy, T);
        ddx = e.shiftKey && ddx === 0 ? 0 : sx;
        ddy = e.shiftKey && ddy === 0 ? 0 : sy;
      } else clearSnap();
      const lp = xfp(PMi, p0.x + ddx, p0.y + ddy),
        dx = lp.x - lp0.x,
        dy = lp.y - lp0.y;
      if (keys.length) keys.forEach((q, i) => (q[1] = [r2(keyStart[i][0] + dx), r2(keyStart[i][1] + dy)]));
      else setProp(l, 'pos', [r2(start[0] + dx), r2(start[1] + dy)]);
      frame();
    },
    up() {
      clearSnap();
      ed.end();
    },
  };
}

let lastSeg: { id: string; i: number; t: number } | null = null,
  lastText: { id: string; t: number; x: number; y: number } | null = null;
export function init(): void {
  WRAP.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    const p = docPt(e);
    try {
      WRAP.setPointerCapture(e.pointerId);
    } catch (_) {}
    const t = S.tool;
    if (e.button === 1 || t === 'hand' || (S.spaceHeld && !S.drag)) {
      e.preventDefault();
      if (S.spaceHeld) S.spaceUsed = true;
      return panDrag(e);
    }
    if (t === 'pen') return penDown(p, e);
    if (t === 'addnode') return addNodeDown(p, e, hitChain(e.target));
    if (t === 'delnode') return delNodeDown(p, e, hitChain(e.target));
    if (t === 'convert') return convertDown(p, e, hitChain(e.target));
    if (t === 'pencil') return pencilDown(p);
    if (SHAPE_TOOLS.includes(t)) {
      createDrag(t, snapPoint(p, snapTargets()));
      if (S.drag) S.drag.snapPt = true;
      return;
    }
    if (t === 'text') {
      // clicking an existing text with the Text tool edits it
      const hit = hitChain(e.target)
        .map(id => layerById(id))
        .find(x => x && x.type === 'text' && !isLocked(x));
      if (hit) {
        select(hit.id);
        backToSelect();
        e.preventDefault();
        return startTextEdit(hit);
      }
      return createText(p);
    }
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
    const gd = (e.target as any).closest('[data-guide]');
    if (gd && t === 'select') {
      const [ax, i] = gd.dataset.guide.split(':');
      e.preventDefault();
      return guideDrag(ax, +i, e);
    }
    const gh = (e.target as any).closest('[data-gh]');
    if (gh && gradHandleDrag(gh.dataset.gh, p)) {
      e.preventDefault(); // no text selection / native drag while dragging handles
      return;
    }
    const h = (e.target as any).closest('[data-h]');
    if (h && (h.dataset.h === 'tbe' || h.dataset.h === 'tbw')) {
      e.preventDefault(); // keep typing after resizing the box
      return handleDrag(h.dataset.h, p);
    }
    if (h) return handleDrag(h.dataset.h, p);
    const mh = (e.target as any).closest('[data-mh]'),
      ms = (e.target as any).closest('[data-mseg]'),
      sl = S.sel && layerById(S.sel);
    if (sl && mh) {
      const [i, w] = mh.dataset.mh.split(',').map(Number);
      return motionHandleDrag(sl, i, w, p);
    }
    if (sl && ms) {
      // the overlay is redrawn after each press, so a double-click is detected by timing
      const i = +ms.dataset.mseg,
        now = Date.now();
      if (lastSeg && lastSeg.i === i && lastSeg.id === sl.id && now - lastSeg.t < 400) {
        lastSeg = null;
        return straighten(sl, i);
      }
      lastSeg = { id: sl.id, i, t: now };
      return segmentDrag(sl, i, p);
    }
    const chain = hitChain(e.target);
    if (chain.length) {
      const nb = chain.filter(c => {
        const x = layerById(c);
        return x && x.type !== 'bone';
      });
      let id =
        e.ctrlKey || e.metaKey ? chain[0] : S.sel && chain.includes(S.sel) ? S.sel : nb[nb.length - 1] || chain[0];
      if (t === 'node') {
        const pth = chain.find(c => {
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
        // double-click on a text starts typing (detected by timing: the canvas is redrawn after a press)
        const now = Date.now();
        if (
          t === 'select' &&
          l.type === 'text' &&
          lastText &&
          lastText.id === id &&
          now - lastText.t < 400 &&
          Math.hypot(e.clientX - lastText.x, e.clientY - lastText.y) < 5
        ) {
          lastText = null;
          e.preventDefault(); // keep the focus in the text editor
          return startTextEdit(l);
        }
        lastText = { id, t: now, x: e.clientX, y: e.clientY };
        if (t === 'select') moveDrag(l, p);
        return;
      }
    }
    // inside the selected layer's box (also for layers that aren't drawn, like masks): move it
    const cur = S.sel && layerById(S.sel);
    if (cur && t === 'select' && !isLocked(cur) && insideBox(cur, p)) return moveDrag(cur, p);
    if (S.sel || S.selSet.size) {
      S.keys.clear();
      select(null);
    }
  });
  WRAP.addEventListener('pointermove', (e: PointerEvent) => {
    let p: XY = docPt(e);
    S.lastPt = p;
    // drags that place points (drawing, nodes, handles) snap the pointer; Ctrl/Cmd skips snapping
    if (S.drag && S.drag.snapPt && !e.ctrlKey && !e.metaKey) {
      const d = S.drag as any;
      d._T = d._T || snapTargets(S.drag.snapPt);
      p = snapPoint(p, d._T);
    }
    if (S.drag) S.drag.move && S.drag.move(p, e);
    else penHover(p, e);
  });
  // Alt changes what the pen would do (convert anchor), so refresh its cursor without a move
  const altCursor = (e: KeyboardEvent) => {
    if (e.key === 'Alt' && S.lastPt && !S.drag) penHover(S.lastPt, e);
  };
  window.addEventListener('keydown', altCursor);
  window.addEventListener('keyup', altCursor);
  WRAP.addEventListener('pointerleave', () => {
    if (S.penHint) {
      S.penHint = null;
      drawOverlay();
    }
  });
  WRAP.addEventListener('pointerup', endDrag);
  WRAP.addEventListener('pointercancel', endDrag);
  WRAP.addEventListener('dblclick', (e: MouseEvent) => {
    if (S.tool === 'pen' && S.pen) {
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
    if (l && l.id === S.sel && l.type === 'text' && !isLocked(l)) startTextEdit(l);
  });
}
