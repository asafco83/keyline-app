// SVGcinema — ui/scrub
// Drag the label at the left of any number field (the "X" in "X 162") left or right to change its
// value: one unit per pixel (Shift ×10, Alt ×0.1). The inspector scrubs its own animatable fields
// live (inspector.ts, `data-scrub`); this covers every other number field (shape geometry, text,
// document, timeline length, colour stops, export…) by typing into the field and sending the same
// input/change events typing would, so each field keeps its own rules. A whole drag is one undo step.
import { S, doc } from '../core/state';
import { fmt } from '../core/constants';

/** pixels-to-value steps for fields whose unit is small */
const STEP: Record<string, number> = {
  'g-lh': 0.01,
  'g-ls': 0.1,
  tDur: 0.05,
  'd-dur': 0.05,
  'kf-time': 0.01,
  'ez-0': 0.01,
  'ez-1': 0.01,
  'ez-2': 0.01,
  'ez-3': 0.01,
  xSpeed: 0.05,
};

/** the label a scrub starts from, and its field */
export function scrubTarget(t: EventTarget | null): { lab: HTMLElement; inp: HTMLInputElement } | null {
  const lab = t && (t as any).closest ? ((t as Element).closest('.nf > span') as HTMLElement) : null;
  if (!lab) return null;
  const inp = lab.parentElement.querySelector('input') as HTMLInputElement | null;
  if (!inp || inp.disabled || inp.readOnly || inp.type === 'range' || inp.type === 'checkbox') return null;
  // only number fields: they ask for a numeric keyboard, or hold a number
  const mode = inp.getAttribute('inputmode');
  if (mode !== 'decimal' && mode !== 'numeric' && !isFinite(parseFloat(inp.value))) return null;
  return { lab, inp };
}
/** finds the field again after a panel re-rendered it */
function locator(inp: HTMLInputElement): () => HTMLInputElement | null {
  if (inp.id) return () => document.getElementById(inp.id) as HTMLInputElement | null;
  const sel =
    'input' +
    [...inp.attributes]
      .filter(a => a.name.startsWith('data-'))
      .map(a => `[${a.name}="${CSS.escape(a.value)}"]`)
      .join('');
  return () => (inp.isConnected ? inp : (document.querySelector(sel) as HTMLInputElement | null));
}
export function scrubStep(lab: HTMLElement, inp: HTMLInputElement) {
  return +lab.dataset.scrubStep || STEP[inp.id] || 1;
}

export function initScrub(): void {
  // after a drag on a label (here or in the inspector), its click must not focus the field; a plain
  // click still does, as a label click would
  let down: { x: number; y: number } | null = null;
  document.addEventListener(
    'pointerdown',
    (e: PointerEvent) => {
      down =
        (e.target as any).closest && (e.target as Element).closest('.nf > span')
          ? { x: e.clientX, y: e.clientY }
          : null;
    },
    true,
  );
  document.addEventListener(
    'click',
    (e: MouseEvent) => {
      const d = down;
      down = null;
      if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 2) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true,
  );
  document.addEventListener('pointerdown', (e: PointerEvent) => {
    // the inspector's own animatable fields are scrubbed there (it prevents the default)
    if (e.button !== 0 || e.defaultPrevented) return;
    const hit = scrubTarget(e.target);
    if (!hit) return;
    e.preventDefault();
    const { lab, inp } = hit,
      find = locator(inp),
      numeric = inp.getAttribute('inputmode') === 'numeric',
      step = scrubStep(lab, inp),
      start = parseFloat(inp.value) || parseFloat(inp.placeholder) || 0,
      x0 = e.clientX,
      // the field's own handlers may each make an undo step: the drag keeps just one
      undo0 = S.undo.slice(),
      snap0 = JSON.stringify(doc);
    let raf = 0,
      last: PointerEvent | null = null,
      moved = false;
    const apply = () => {
      raf = 0;
      const ev = last,
        el = find();
      if (!ev || !el) return;
      const k = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1;
      let v = start + (ev.clientX - x0) * step * k;
      v = numeric ? Math.round(v) : Math.round(v / (step * k)) * (step * k);
      const s = fmt(v);
      if (el.value === s) return;
      moved = true;
      el.value = s;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const move = (ev: PointerEvent) => {
      last = ev;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (raf) {
        cancelAnimationFrame(raf);
        apply();
      }
      document.body.classList.remove('scrubbing');
      if (!moved) return;
      if (doc && JSON.stringify(doc) !== snap0) {
        S.undo = undo0;
        S.undo.push(snap0);
        if (S.undo.length > 150) S.undo.shift();
        S.redo = [];
      }
    };
    document.body.classList.add('scrubbing');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
}
