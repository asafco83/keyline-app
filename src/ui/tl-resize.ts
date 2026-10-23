// SVGcinema — ui/tl-resize
// The timeline's height: drag its top edge up or down. The smallest height shows just the controls and
// the time ruler (no layer rows); the largest leaves a strip of the work area. Remembered between visits;
// double-click the edge (or Home on it) to go back to the default height. ↑/↓ on the focused edge
// nudge it by 16px (Shift: 64px).
import { drawRulers } from '../render/guides';

export const TL_KEY = 'svgcinema:tlH';
export const TL_DEFAULT = 288;
/** the work area keeps at least this much height (its ruler and a strip of canvas) */
export const STAGE_MIN = 120;
const ROW = 27; // the time ruler's height, used before the timeline has rendered

const app = () => document.getElementById('app') as HTMLElement;
const tl = () => document.querySelector('.panel.tl') as HTMLElement;

/** the height range the timeline can take in the current window */
export function tlRange(): [number, number] {
  const t = tl(),
    ctrl = t && (t.querySelector('.tl-ctrl') as HTMLElement),
    ruler = t && (t.querySelector('.tl-ruler') as HTMLElement);
  const min =
    (ctrl ? ctrl.offsetHeight : 44) +
    (ruler ? ruler.offsetHeight : ROW) +
    // the top border and the horizontal scrollbar, if there is one
    1 +
    (() => {
      const sc = t && (t.querySelector('.tl-scroll') as HTMLElement);
      return sc ? Math.max(0, sc.offsetHeight - sc.clientHeight) : 0;
    })();
  const top = document.querySelector('.top') as HTMLElement,
    h = app() ? app().clientHeight : window.innerHeight,
    max = h - (top ? top.offsetHeight : 52) - STAGE_MIN;
  return [Math.round(min), Math.round(Math.max(min, max))];
}
export function tlHeight(): number {
  const t = tl();
  return t ? Math.round(t.getBoundingClientRect().height) : TL_DEFAULT;
}
/** sets the timeline's height (clamped to the range); `save` remembers it */
export function setTlHeight(h: number, save = true): number {
  const [lo, hi] = tlRange(),
    v = Math.round(Math.min(hi, Math.max(lo, h)));
  app().style.setProperty('--tl-h', v + 'px');
  if (save)
    try {
      localStorage.setItem(TL_KEY, String(v));
    } catch (_) {}
  const g = document.getElementById('tlGrip');
  if (g) {
    g.setAttribute('aria-valuenow', String(v));
    g.setAttribute('aria-valuemin', String(lo));
    g.setAttribute('aria-valuemax', String(hi));
  }
  drawRulers();
  return v;
}
function saved(): number {
  try {
    const v = parseFloat(localStorage.getItem(TL_KEY) || '');
    return isFinite(v) && v > 0 ? v : TL_DEFAULT;
  } catch (_) {
    return TL_DEFAULT;
  }
}

export function initTlResize(): void {
  const t = tl();
  if (!t) return;
  const g = document.createElement('div');
  g.className = 'tl-grip';
  g.id = 'tlGrip';
  g.tabIndex = 0;
  g.setAttribute('role', 'separator');
  g.setAttribute('aria-orientation', 'horizontal');
  g.setAttribute('aria-label', 'Timeline height');
  g.title = 'Drag to resize the timeline · double-click for the default height';
  t.prepend(g);
  // the saved height, once the timeline has laid out (its row heights set the minimum)
  app().style.setProperty('--tl-h', saved() + 'px');
  requestAnimationFrame(() => setTlHeight(saved(), false));

  g.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const y0 = e.clientY,
      h0 = tlHeight();
    g.setPointerCapture(e.pointerId);
    g.classList.add('on');
    document.body.classList.add('tl-resizing');
    const move = (ev: PointerEvent) => setTlHeight(h0 - (ev.clientY - y0));
    const up = () => {
      g.removeEventListener('pointermove', move);
      g.removeEventListener('pointerup', up);
      g.removeEventListener('pointercancel', up);
      g.classList.remove('on');
      document.body.classList.remove('tl-resizing');
    };
    g.addEventListener('pointermove', move);
    g.addEventListener('pointerup', up);
    g.addEventListener('pointercancel', up);
  });
  g.addEventListener('dblclick', () => setTlHeight(TL_DEFAULT));
  g.addEventListener('keydown', (e: KeyboardEvent) => {
    const d = e.shiftKey ? 64 : 16;
    let v: number | null = null;
    if (e.key === 'ArrowUp') v = tlHeight() + d;
    else if (e.key === 'ArrowDown') v = tlHeight() - d;
    else if (e.key === 'Home') v = TL_DEFAULT;
    else if (e.key === 'PageUp') v = tlRange()[1];
    else if (e.key === 'PageDown') v = tlRange()[0];
    if (v == null) return;
    e.preventDefault();
    e.stopPropagation();
    setTlHeight(v);
  });
  // a smaller window can't keep a tall timeline: clamp it (without forgetting the chosen height)
  window.addEventListener('resize', () => setTlHeight(saved(), false));
}
