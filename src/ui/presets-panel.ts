// SVGcinema — ui/presets-panel
// The Presets window (Animate ▸ Presets…, or the main menu's Animate ▸ Presets…), matched to the
// "Animation presets" mockup: groups on the left, tiles on the right, Length / Stagger / Strength and
// Apply below. Hovering a tile (or the selected one) previews it on the timeline: its span is shaded on
// each layer, and keyframes it would replace are outlined in red. Double-click a tile to apply it at
// once. Filters play in JS exports only, so that group (and any preset a CSS export can't play) says so.
import { $, esc, fmt } from '../core/constants';
import { S, doc } from '../core/state';
import { undo } from '../core/history';
import {
  PRESETS,
  PRESET_GROUPS,
  type Preset,
  type PresetGroup,
  applyPreset,
  planPreset,
  presetById,
  presetJSOnly,
  presetTargets,
} from '../core/presets';
import { renderTimeline } from './timeline';
import { toast } from '../io/open';
import { animTargets } from './animate-menu';

let pop: HTMLElement | null = null,
  group: PresetGroup = 'enter',
  chosen: string | null = null,
  hover: string | null = null,
  query = '',
  len = 0.6,
  stagger = 0.1,
  strength = 100;

const ids = () => animTargets().map(l => l.id);
const usable = (p: Preset) => presetTargets(p, ids()).length > 0;
export function presetsOpen() {
  return !!pop;
}
function tile(p: Preset) {
  return `<button class="pr-tile${p.id === chosen ? ' on' : ''}" data-preset="${p.id}" aria-pressed="${p.id === chosen}" title="${esc(p.name)}${presetJSOnly(p) ? ' · plays in JS exports only' : ''}"><svg width="44" height="36" viewBox="0 0 44 36" aria-hidden="true">${p.icon}</svg><span>${esc(p.name)}</span>${presetJSOnly(p) ? '<em class="pr-js">JS</em>' : ''}</button>`;
}
function body() {
  const list = query
    ? PRESETS.filter(p => usable(p) && p.name.toLowerCase().includes(query.toLowerCase()))
    : PRESETS.filter(p => p.group === group && usable(p));
  return list.length
    ? list.map(tile).join('')
    : `<div class="pr-none">${query ? 'No presets match.' : 'None of these fit the selected layers.'}</div>`;
}
function nav() {
  return PRESET_GROUPS.map(([g, name]) => {
    const n = PRESETS.filter(p => p.group === g && usable(p)).length;
    if (!n) return '';
    const js = g === 'filter';
    return `${js ? '<hr>' : ''}<button class="pr-grp${g === group && !query ? ' on' : ''}" data-pgroup="${g}" aria-current="${g === group && !query}"><span>${name}${js ? '<small>JS export only</small>' : ''}</span><b>${n}</b></button>`;
  }).join('');
}
function head() {
  const ls = animTargets(),
    names =
      ls
        .slice(0, 3)
        .map(l => l.name)
        .join(', ') + (ls.length > 3 ? ` +${ls.length - 3}` : '');
  return `for ${esc(names)} · at the playhead ${fmt(S.time)}s`;
}
function refresh(all = true) {
  if (!pop) return;
  if (all) {
    pop.querySelector('#prNav').innerHTML = nav();
    pop.querySelector('#prSub').innerHTML = head();
  }
  pop.querySelector('#prTiles').innerHTML = body();
  const multi = animTargets().length > 1;
  (pop.querySelector('#prStagRow') as HTMLElement).hidden = !multi;
  (pop.querySelector('#prApply') as HTMLButtonElement).disabled = !chosen || !usable(presetById(chosen));
  note();
  preview();
}
function note() {
  const p = chosen && presetById(chosen),
    el = pop.querySelector('#prNote') as HTMLElement;
  if (!p) {
    el.textContent =
      'Pick a preset. It starts at the playhead; keyframes of the same properties inside its span are replaced.';
    return;
  }
  const plan = planPreset(p, S.time, len, stagger, ids());
  el.textContent =
    `${p.name}: ${fmt(S.time)}–${fmt(plan.spans.length ? plan.spans[plan.spans.length - 1].t1 : S.time + len)}s` +
    (plan.replaced.length
      ? ` · replaces ${plan.replaced.length} keyframe${plan.replaced.length > 1 ? 's' : ''}`
      : ' · replaces nothing') +
    (plan.dur > doc.dur + 1e-9 ? ` · lengthens the animation to ${fmt(plan.dur)}s` : '') +
    (presetJSOnly(p) ? ' · stays still in a CSS export' : '');
}
/** shade the span on the timeline and mark the keyframes that would be replaced */
function preview() {
  const id = hover || chosen,
    p = id && presetById(id);
  S.presetPv = p ? planPreset(p, S.time, len, stagger, ids()) : null;
  renderTimeline();
}
function readNum(sel: string, d: number, min: number, max: number) {
  const v = parseFloat((pop.querySelector(sel) as HTMLInputElement).value);
  return isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
}
function syncFields() {
  (pop.querySelector('#prLen') as HTMLInputElement).value = fmt(len);
  (pop.querySelector('#prStag') as HTMLInputElement).value = fmt(stagger);
  (pop.querySelector('#prStr') as HTMLInputElement).value = String(strength);
}
export function openPresets(anchor?: HTMLElement | null) {
  if (!animTargets().length) return toast('Select the layers to animate first.');
  closePresets();
  pop = document.createElement('div');
  pop.className = 'prpop';
  pop.id = 'presetPop';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Animation presets');
  pop.innerHTML = `<div class="pr-head"><b>Presets</b><span id="prSub"></span><span class="pr-gap"></span>
      <label class="pr-find"><svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><circle cx="6" cy="6" r="4"/><path d="M9 9l3 3"/></svg><input id="prFind" placeholder="Search presets" aria-label="Search presets" spellcheck="false" autocomplete="off"></label>
      <button class="pr-x" id="prClose" aria-label="Close"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6"/></svg></button></div>
    <div class="pr-main"><nav class="pr-nav" id="prNav" aria-label="Preset groups"></nav><div class="pr-tiles" id="prTiles" role="group" aria-label="Presets"></div></div>
    <div class="pr-foot">
      <label class="nf"><span>Length</span><input id="prLen" inputmode="decimal" aria-label="Length"><em>s</em></label>
      <label class="nf" id="prStagRow"><span>Stagger</span><input id="prStag" inputmode="decimal" aria-label="Stagger"><em>s</em></label>
      <label class="nf"><span>Strength</span><input id="prStr" inputmode="decimal" aria-label="Strength"><em>%</em></label>
      <span class="pr-note" id="prNote"></span>
      <button class="btn pri" id="prApply">Apply</button>
    </div>`;
  document.body.appendChild(pop);
  syncFields();
  refresh();
  place(anchor || ($('#lAnim') as HTMLElement));
  (pop.querySelector('#prFind') as HTMLElement).focus();
}
function place(anchor: HTMLElement) {
  const w = Math.min(712, innerWidth - 16),
    h = pop.getBoundingClientRect().height,
    r = anchor ? anchor.getBoundingClientRect() : { left: 8, top: innerHeight / 2 + h / 2 },
    left = Math.max(8, Math.min(r.left, innerWidth - w - 8)),
    top = Math.max(8, Math.min(r.top - h - 8, innerHeight - h - 8));
  Object.assign(pop.style, { width: w + 'px', left: left + 'px', top: top + 'px' });
}
export function closePresets() {
  if (pop) pop.remove();
  pop = null;
  hover = null;
  if (S.presetPv) {
    S.presetPv = null;
    renderTimeline();
  }
}
function apply(id: string) {
  const p = presetById(id);
  if (!p) return;
  len = readNum('#prLen', len, 0.05, 60);
  stagger = readNum('#prStag', stagger, 0, 10);
  strength = readNum('#prStr', strength, 0, 300);
  const sel = ids();
  closePresets();
  const r = applyPreset(p, S.time, len, sel.length > 1 ? stagger : 0, strength / 100, sel);
  if (!r) return toast('This preset doesn’t fit the selected layers.');
  toast(
    `${p.name} applied` +
      (r.replaced ? ` · Replaced ${r.replaced} keyframe${r.replaced > 1 ? 's' : ''}` : '') +
      (r.grew ? ' · animation lengthened' : ''),
    { label: 'Undo', run: () => undo() },
  );
}

export function init(): void {
  document.addEventListener('click', (e: MouseEvent) => {
    if (!pop) return;
    const t = e.target as Element;
    if (!pop.contains(t)) return;
    if (t.closest('#prClose')) return closePresets();
    if (t.closest('#prApply')) return chosen && apply(chosen);
    const g = t.closest('[data-pgroup]') as HTMLElement;
    if (g) {
      group = g.dataset.pgroup as PresetGroup;
      query = '';
      (pop.querySelector('#prFind') as HTMLInputElement).value = '';
      return refresh();
    }
    const tl = t.closest('[data-preset]') as HTMLElement;
    if (tl) {
      const p = presetById(tl.dataset.preset);
      if (chosen !== p.id) len = p.dur;
      chosen = p.id;
      syncFields();
      refresh(false);
      if (e.detail >= 2) apply(p.id);
    }
  });
  document.addEventListener('mouseover', (e: MouseEvent) => {
    if (!pop) return;
    const tl = (e.target as Element).closest && ((e.target as Element).closest('[data-preset]') as HTMLElement);
    const id = tl && pop.contains(tl) ? tl.dataset.preset : null;
    if (id !== hover) {
      hover = id;
      preview();
    }
  });
  document.addEventListener('input', (e: Event) => {
    if (!pop || !pop.contains(e.target as Node)) return;
    const t = e.target as HTMLInputElement;
    if (t.id === 'prFind') {
      query = t.value.trim();
      pop.querySelector('#prNav').innerHTML = nav();
      pop.querySelector('#prTiles').innerHTML = body();
      return;
    }
    if (t.id === 'prLen') len = readNum('#prLen', len, 0.05, 60);
    if (t.id === 'prStag') stagger = readNum('#prStag', stagger, 0, 10);
    if (t.id === 'prStr') strength = readNum('#prStr', strength, 0, 300);
    note();
    preview();
  });
  document.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (!pop) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closePresets();
      } else if (
        e.key === 'Enter' &&
        pop.contains(e.target as Node) &&
        chosen &&
        !(e.target as Element).closest('button')
      ) {
        e.preventDefault();
        apply(chosen);
      }
    },
    true,
  );
  document.addEventListener(
    'pointerdown',
    (e: PointerEvent) => {
      const t = e.target as Element;
      if (pop && !pop.contains(t) && !t.closest('#tlscroll')) closePresets();
    },
    true,
  );
  addEventListener('resize', () => pop && closePresets());
}
