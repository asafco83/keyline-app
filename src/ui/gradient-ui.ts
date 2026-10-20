// Keyline — ui/gradient-ui
// Fill / stroke paint editor: Solid, Linear or Radial. A gradient is
//   { g: 'lin' | 'rad', s: [[offset 0–1, colour], …], a: angle° (linear), cx, cy, r (radial, 0–1 of the box) }
// and animates like a colour (stops, angle, centre and radius blend between keyframes).
// The bar shows the gradient; drag a stop to move it, click the bar to add one, select a stop to
// change its colour, opacity and position.
import type { Layer, PropKey } from '../model/types';
import { H, clamp, clone, esc, fmt, r3, valueAt } from '../core/constants';
import { beginEdit, setProp } from '../core/history';
import { S } from '../core/state';
import { toHex } from './inspector';

export type Grad = { g: 'lin' | 'rad'; s: Array<[number, string]>; a?: number; cx?: number; cy?: number; r?: number };
type K = 'fill' | 'stk';
const sel: Record<K, number> = { fill: 0, stk: 0 };

export const isGrad = (v: any): v is Grad => !!H.isG(v);
function rgba(c: string) {
  return H.pc(c) || [0, 0, 0, 1];
}
function css(c: string) {
  const q = rgba(c);
  return `rgba(${Math.round(q[0])},${Math.round(q[1])},${Math.round(q[2])},${r3(q[3])})`;
}
function withAlpha(c: string, a: number) {
  const q = rgba(c);
  return a >= 0.999
    ? '#' + [0, 1, 2].map(i => Math.round(q[i]).toString(16).padStart(2, '0')).join('')
    : `rgba(${Math.round(q[0])},${Math.round(q[1])},${Math.round(q[2])},${r3(a)})`;
}
function barCSS(g: Grad) {
  return `linear-gradient(90deg, ${g.s.map(([o, c]) => `${css(c)} ${r3(o * 100)}%`).join(', ')})`;
}
/** colour of the gradient at offset o (for a new stop) */
function at(g: Grad, o: number) {
  const s = g.s;
  if (o <= s[0][0]) return s[0][1];
  for (let i = 0; i < s.length - 1; i++)
    if (o <= s[i + 1][0]) {
      const w = s[i + 1][0] - s[i][0],
        p = w > 0 ? (o - s[i][0]) / w : 0,
        A = rgba(s[i][1]),
        B = rgba(s[i + 1][1]),
        m = [0, 1, 2, 3].map(j => A[j] + (B[j] - A[j]) * p);
      return withAlpha(`rgb(${m[0]},${m[1]},${m[2]})`, m[3]);
    }
  return s[s.length - 1][1];
}
function cur(l: Layer, k: K): any {
  return valueAt(l, k, S.time);
}

/* ---------- markup ---------- */

/** The paint row for fill or stroke: type buttons, then a colour field or the gradient editor. */
export function paintRow(l: Layer, k: K, label: string, colorField: string) {
  const v = cur(l, k),
    g = isGrad(v) ? v : null,
    type = g ? g.g : 'solid',
    seg = (t: string, name: string, icon: string) =>
      `<button class="btn ib tg${type === t ? ' on' : ''}" data-gtype="${k}:${t}" aria-pressed="${type === t}" title="${name}" aria-label="${label}: ${name}">${icon}</button>`;
  const types = `<div class="btns tight g-types">${seg('solid', 'Solid colour', '<span class="g-ic g-solid"></span>')}${seg('lin', 'Linear gradient', '<span class="g-ic g-lin"></span>')}${seg('rad', 'Radial gradient', '<span class="g-ic g-rad"></span>')}</div>`;
  let h = `<div class="row g-row" data-gk="${k}" data-gmode="${type}"><button class="kb" data-kb="${k}" aria-label="Keyframe ${label}" title="Add / remove keyframe at playhead"></button><span class="rl">${label}</span><div class="rf">${g ? types : colorField + types}</div></div>`;
  if (!g) return h;
  const i = Math.min(sel[k], g.s.length - 1),
    st = g.s[i],
    q = rgba(st[1]);
  h += `<div class="g-ed" data-gk="${k}">
    <div class="g-bar" data-gbar="${k}" style="background:${barCSS(g)}" title="Click to add a stop; drag a stop to move it">${g.s
      .map(
        ([o, c], j) =>
          `<button class="g-stop${j === i ? ' sel' : ''}" data-gstop="${k}:${j}" style="left:${r3(o * 100)}%;--c:${css(c)}" aria-label="Stop ${j + 1} at ${fmt(o * 100)}%"></button>`,
      )
      .join('')}</div>
    <div class="row nk"><span class="rl">Stop ${i + 1}</span><div class="rf">
      <div class="cf"><span class="swt${q[3] <= 0 ? ' none' : ''}"><input type="color" data-gcol="${k}" value="${toHex(st[1]) || '#000000'}" aria-label="Stop colour"${q[3] <= 0 ? ' style="opacity:0"' : q[3] < 1 ? ` style="opacity:${Math.max(0.15, q[3])}"` : ''}></span><input class="txt mono" data-gtxt="${k}" value="${esc(st[1])}" spellcheck="false" aria-label="Stop colour value"></div>
      <label class="nf g-num"><span>α</span><input data-galpha="${k}" inputmode="decimal" value="${fmt(q[3] * 100)}" aria-label="Stop opacity"><em>%</em></label>
    </div></div>
    <div class="row nk"><span class="rl">Position</span><div class="rf">
      <label class="nf"><span>@</span><input data-goff="${k}" inputmode="decimal" value="${fmt(st[0] * 100)}" aria-label="Stop position"><em>%</em></label>
      <button class="btn ib" data-gdel="${k}" ${g.s.length > 2 ? '' : 'disabled'} title="Remove this stop" aria-label="Remove stop">−</button>
    </div></div>
    ${
      g.g === 'lin'
        ? `<div class="row nk"><span class="rl">Angle</span><div class="rf"><label class="nf"><span>∠</span><input data-gp="${k}:a" inputmode="decimal" value="${fmt(g.a == null ? 90 : g.a)}" aria-label="Gradient angle"><em>°</em></label></div></div>`
        : `<div class="row nk"><span class="rl">Center</span><div class="rf"><label class="nf"><span>X</span><input data-gp="${k}:cx" inputmode="decimal" value="${fmt((g.cx == null ? 0.5 : g.cx) * 100)}" aria-label="Center X"><em>%</em></label><label class="nf"><span>Y</span><input data-gp="${k}:cy" inputmode="decimal" value="${fmt((g.cy == null ? 0.5 : g.cy) * 100)}" aria-label="Center Y"><em>%</em></label></div></div>
           <div class="row nk"><span class="rl">Radius</span><div class="rf"><label class="nf"><span>R</span><input data-gp="${k}:r" inputmode="decimal" value="${fmt((g.r == null ? 0.5 : g.r) * 100)}" aria-label="Radius"><em>%</em></label></div></div>`
    }
  </div>`;
  return h;
}

/* ---------- editing ---------- */

function apply(l: Layer, k: K, g: any) {
  setProp(l, k as PropKey, g);
}
function edit(l: Layer, k: K, fn: (g: Grad) => void, live?: boolean) {
  const v = cur(l, k);
  if (!isGrad(v)) return;
  const g = clone(v) as Grad;
  fn(g);
  g.s.sort((a, b) => a[0] - b[0]);
  if (live) {
    if (!S.colorEd) S.colorEd = beginEdit();
    apply(l, k, g);
    return;
  }
  const ed = S.colorEd || beginEdit();
  S.colorEd = null;
  apply(l, k, g);
  ed.end({ insp: true });
}
function setType(l: Layer, k: K, t: string) {
  const v = cur(l, k),
    ed = beginEdit();
  if (t === 'solid') apply(l, k, isGrad(v) ? v.s[0][1] : v);
  else if (isGrad(v)) apply(l, k, { ...clone(v), g: t });
  else {
    const c = typeof v === 'string' && v !== 'none' ? v : k === 'fill' ? '#5B7CFA' : '#1A2030';
    apply(
      l,
      k,
      t === 'lin'
        ? {
            g: 'lin',
            a: 90,
            s: [
              [0, c],
              [1, withAlpha(c, 0)],
            ],
          }
        : {
            g: 'rad',
            cx: 0.5,
            cy: 0.5,
            r: 0.5,
            s: [
              [0, c],
              [1, withAlpha(c, 0)],
            ],
          },
    );
    sel[k] = 0;
    if (k === 'stk' && !(valueAt(l, 'sw', S.time) > 0)) setProp(l, 'sw', 4);
  }
  ed.end({ insp: true });
}
/** Clicks in the paint rows. Returns true when handled. */
export function gradClick(e: MouseEvent, l: Layer) {
  const t = e.target as HTMLElement,
    ty = t.closest('[data-gtype]') as HTMLElement;
  if (ty) {
    const [k, v] = ty.dataset.gtype.split(':');
    setType(l, k as K, v);
    return true;
  }
  const del = t.closest('[data-gdel]') as HTMLElement;
  if (del) {
    const k = del.dataset.gdel as K;
    edit(l, k, g => {
      if (g.s.length > 2) g.s.splice(Math.min(sel[k], g.s.length - 1), 1);
    });
    sel[k] = Math.max(0, sel[k] - 1);
    return true;
  }
  return false;
}
/** Dragging stops / clicking the bar. Returns true when handled. */
export function gradPointer(e: PointerEvent, l: Layer) {
  const t = e.target as HTMLElement,
    stop = t.closest('[data-gstop]') as HTMLElement,
    bar = t.closest('[data-gbar]') as HTMLElement;
  if (!stop && !bar) return false;
  e.preventDefault();
  const k = (stop ? stop.dataset.gstop.split(':')[0] : bar.dataset.gbar) as K,
    barEl = (bar || stop.parentElement) as HTMLElement,
    rect = barEl.getBoundingClientRect(),
    off = (x: number) => r3(clamp((x - rect.left) / rect.width, 0, 1));
  let idx: number;
  if (stop) idx = +stop.dataset.gstop.split(':')[1];
  else {
    // a new stop where the bar was clicked, in the colour the gradient has there
    const o = off(e.clientX),
      v = cur(l, k) as Grad;
    if (!isGrad(v)) return true;
    const g = clone(v) as Grad;
    g.s.push([o, at(v, o)]);
    g.s.sort((a, b) => a[0] - b[0]);
    idx = g.s.findIndex(s => s[0] === o);
    if (!S.colorEd) S.colorEd = beginEdit();
    apply(l, k, g);
  }
  sel[k] = idx;
  let moved = false;
  const mv = (ev: PointerEvent) => {
    moved = true;
    const o = off(ev.clientX);
    edit(
      l,
      k,
      g => {
        const s = g.s[idx];
        s[0] = o;
        g.s.sort((a, b) => a[0] - b[0]);
        idx = g.s.indexOf(s);
        sel[k] = idx;
      },
      true,
    );
    // move the marker and the bar without rebuilding the panel
    const gv = cur(l, k) as Grad;
    if (isGrad(gv)) {
      barEl.style.background = barCSS(gv);
      (barEl.querySelectorAll('.g-stop') as NodeListOf<HTMLElement>).forEach((b, j) => {
        if (gv.s[j]) {
          b.style.left = r3(gv.s[j][0] * 100) + '%';
          b.style.setProperty('--c', css(gv.s[j][1]));
          b.classList.toggle('sel', j === idx);
        }
      });
    }
  };
  const up = () => {
    window.removeEventListener('pointermove', mv);
    window.removeEventListener('pointerup', up);
    const ed = S.colorEd;
    S.colorEd = null;
    if (ed) ed.end({ insp: true });
    else if (!moved) {
      // just selecting a stop
      const ed2 = beginEdit();
      ed2.end({ insp: true });
    }
  };
  window.addEventListener('pointermove', mv);
  window.addEventListener('pointerup', up);
  return true;
}
/** Live colour picking (input) and committed edits (change). Returns true when handled. */
export function gradInput(t: HTMLInputElement, l: Layer, live: boolean) {
  const d = t.dataset;
  if (d.gcol) {
    const k = d.gcol as K;
    edit(
      l,
      k,
      g => {
        const s = g.s[Math.min(sel[k], g.s.length - 1)];
        s[1] = withAlpha(t.value, rgba(s[1])[3]);
      },
      live,
    );
    return true;
  }
  if (live) return false;
  if (d.gtxt) {
    const k = d.gtxt as K,
      ok = H.pc(t.value.trim()) || /^[a-z]+$/i.test(t.value.trim());
    if (ok)
      edit(l, k, g => {
        g.s[Math.min(sel[k], g.s.length - 1)][1] = t.value.trim();
      });
    return true;
  }
  if (d.galpha) {
    const k = d.galpha as K,
      v = parseFloat(t.value);
    if (isFinite(v))
      edit(l, k, g => {
        const s = g.s[Math.min(sel[k], g.s.length - 1)];
        s[1] = withAlpha(s[1], clamp(v, 0, 100) / 100);
      });
    return true;
  }
  if (d.goff) {
    const k = d.goff as K,
      v = parseFloat(t.value);
    if (isFinite(v))
      edit(l, k, g => {
        const s = g.s[Math.min(sel[k], g.s.length - 1)];
        s[0] = r3(clamp(v, 0, 100) / 100);
        g.s.sort((a, b) => a[0] - b[0]);
        sel[k] = g.s.indexOf(s);
      });
    return true;
  }
  if (d.gp) {
    const [k, p] = d.gp.split(':'),
      v = parseFloat(t.value);
    if (isFinite(v))
      edit(l, k as K, g => {
        if (p === 'a') g.a = r3(v);
        else (g as any)[p] = r3(clamp(v, p === 'r' ? 1 : -100, p === 'r' ? 300 : 200) / 100);
      });
    return true;
  }
  return false;
}
/** The panel must be rebuilt when the playhead moves between a solid colour and a gradient. */
export function gradStale(l: Layer) {
  for (const k of ['fill', 'stk'] as K[]) {
    const row = document.querySelector(`.g-row[data-gk="${k}"]`) as HTMLElement;
    if (!row) continue;
    const v = cur(l, k),
      mode = isGrad(v) ? v.g : 'solid';
    if (row.dataset.gmode !== mode) return true;
  }
  return false;
}
