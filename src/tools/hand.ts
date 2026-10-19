// Keyline — tools/hand
// Panning and zooming the work area: the Hand tool (H), Space-drag from any tool,
// middle-mouse drag, wheel to scroll, Ctrl/Cmd+wheel to zoom at the pointer.
import { clamp } from '../core/constants';
import { ART, WRAP } from '../core/dom';
import { S, doc } from '../core/state';
import { fit, frame } from '../render/stage';

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
  S.zoom = clamp(S.zoom * factor, 0.1, 8);
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
