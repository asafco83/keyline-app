// SVGcinema — tools/hand
import { zoomChanged } from '../ui/zoom-menu';
// Panning and zooming the work area: the Hand tool (H), Space-drag from any tool,
// middle-mouse drag, wheel to scroll, Ctrl/Cmd+wheel to zoom at the pointer.
import { clamp } from '../core/constants';
import { ART, WRAP } from '../core/dom';
import { S, doc } from '../core/state';
import { MAX_SCALE, MIN_SCALE, fit, fitScale, frame } from '../render/stage';
import { isHidden } from '../model/tree';

/** Keep at least this much of the artboard on screen (px). */
const KEEP = 48;
/** The translate currently applied to the artboard. */
const applied = { x: 0, y: 0 };

/** Where the artboard sits without the pan offset. */
function baseRect() {
  const r = ART.getBoundingClientRect();
  return { left: r.left - applied.x, top: r.top - applied.y, w: r.width, h: r.height };
}
function clampPan() {
  const wr = WRAP.getBoundingClientRect(),
    b = baseRect();
  if (!wr.width || !b.w) return;
  S.pan.x = clamp(S.pan.x, wr.left + KEEP - (b.left + b.w), wr.right - KEEP - b.left);
  S.pan.y = clamp(S.pan.y, wr.top + KEEP - (b.top + b.h), wr.bottom - KEEP - b.top);
}
export function applyPan() {
  if (!doc) return;
  clampPan();
  applied.x = S.pan.x;
  applied.y = S.pan.y;
  ART.style.transform = S.pan.x || S.pan.y ? `translate(${S.pan.x}px, ${S.pan.y}px)` : '';
  zoomChanged();
}
export function panBy(dx: number, dy: number) {
  S.pan.x += dx;
  S.pan.y += dy;
  applyPan();
  frame();
}
/** Zoom by `factor`, keeping the document point under (cx, cy) still. Defaults to the view centre. */
export function zoomAt(factor: number, cx?: number, cy?: number) {
  const wr = WRAP.getBoundingClientRect(),
    ar = ART.getBoundingClientRect(),
    px = cx == null ? wr.left + wr.width / 2 : cx,
    py = cy == null ? wr.top + wr.height / 2 : cy,
    dx = (px - ar.left) / S.scale,
    dy = (py - ar.top) / S.scale;
  const base = fitScale();
  S.zoom = clamp(S.zoom * factor, MIN_SCALE / base, MAX_SCALE / base);
  fit();
  const b = baseRect();
  S.pan.x = px - dx * S.scale - b.left;
  S.pan.y = py - dy * S.scale - b.top;
  applyPan();
  frame();
}
export function fitView() {
  S.zoom = 1;
  S.pan.x = S.pan.y = 0;
  fit();
  applyPan();
  frame();
}
/** Zoom to an absolute scale (1 = 100%), around the view centre. */
export function zoomTo(scale: number) {
  zoomAt(scale / S.scale);
}
export function isFitView() {
  return Math.abs(S.zoom - 1) < 1e-6 && !S.pan.x && !S.pan.y;
}
/** Visible selected layers, for Fit selection. */
export function fitSelectionTargets() {
  return [...S.selSet].filter(id => {
    const l = doc.layers.find(x => x.id === id);
    return l && !isHidden(l) && document.getElementById('e-' + id);
  });
}
/** Zoom and pan so the selected layers fill the work area. */
export function fitSelection() {
  const ids = fitSelectionTargets();
  if (!ids.length) return false;
  let L = Infinity,
    T = Infinity,
    R = -Infinity,
    B = -Infinity;
  ids.forEach(id => {
    const r = document.getElementById('e-' + id).getBoundingClientRect();
    if (!r.width && !r.height) return;
    L = Math.min(L, r.left);
    T = Math.min(T, r.top);
    R = Math.max(R, r.right);
    B = Math.max(B, r.bottom);
  });
  if (!isFinite(L)) return false;
  const wr = WRAP.getBoundingClientRect(),
    ar = ART.getBoundingClientRect(),
    s0 = S.scale,
    // the selection's box in document units
    x0 = (L - ar.left) / s0,
    y0 = (T - ar.top) / s0,
    bw = Math.max(1, (R - L) / s0),
    bh = Math.max(1, (B - T) / s0),
    target = clamp(Math.min((wr.width - 96) / bw, (wr.height - 96) / bh), MIN_SCALE, MAX_SCALE),
    base = fitScale();
  S.zoom = target / base;
  fit();
  const b = baseRect();
  // centre the selection in the work area
  S.pan.x = wr.left + wr.width / 2 - (x0 + bw / 2) * S.scale - b.left;
  S.pan.y = wr.top + wr.height / 2 - (y0 + bh / 2) * S.scale - b.top;
  applyPan();
  frame();
  return true;
}
/** Start a pan gesture from a pointerdown. */
export function panDrag(e: PointerEvent) {
  let x = e.clientX,
    y = e.clientY;
  WRAP.classList.add('panning');
  S.drag = {
    move(_p, ev) {
      panBy(ev.clientX - x, ev.clientY - y);
      x = ev.clientX;
      y = ev.clientY;
    },
    up() {
      WRAP.classList.remove('panning');
    },
  };
}
/** Space is held for a temporary hand tool (a tap still plays/pauses). */
export function setSpace(down: boolean) {
  S.spaceHeld = down;
  WRAP.classList.toggle('space', down);
}

export function init(): void {
  WRAP.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // pinch-zoom on trackpads arrives as ctrl+wheel with small deltas
        const f = Math.exp(-clamp(e.deltaY, -60, 60) * 0.01);
        zoomAt(f, e.clientX, e.clientY);
        return;
      }
      const k = e.deltaMode === 1 ? 16 : 1;
      if (e.shiftKey && !e.deltaX) panBy(-e.deltaY * k, 0);
      else panBy(-e.deltaX * k, -e.deltaY * k);
    },
    { passive: false },
  );
  // keep the artboard on screen when the window or panels change size
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => applyPan()).observe(WRAP);
}
