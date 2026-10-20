// SVGcinema — ui/tools-rail
// The tool rail. Grouped tools share one button that shows the group's last-used tool;
// click it to use that tool, press and hold (or right-click, or press ↓ / → on the keyboard)
// to open a flyout with the whole group.
import { $, ICON, TOOLBAR, TOOL_INFO, groupOf, type ToolGroup } from '../core/constants';
import { setTool } from '../core/history';
import { S } from '../core/state';
import { fitView } from '../tools/hand';

const HOLD_MS = 320;
const STORE = 'svgcinema:toolGroup';

function tip(id: string) {
  const t = TOOL_INFO[id];
  return t.key ? `${t.label} (${t.key})` : t.label;
}
function toolBtn(id: string) {
  const on = S.tool === id;
  return `<button class="tool${on ? ' on' : ''}" data-tool="${id}" title="${tip(id)}" aria-label="${TOOL_INFO[id].label}" aria-pressed="${on}">${ICON[id]}${TOOL_INFO[id].key ? `<kbd>${TOOL_INFO[id].key}</kbd>` : ''}</button>`;
}
function groupBtn(g: ToolGroup) {
  if (g.items.includes(S.tool)) S.toolGroup[g.group] = S.tool;
  const id = S.toolGroup[g.group] || g.items[0],
    on = g.items.includes(S.tool),
    k = TOOL_INFO[id].key;
  return `<button class="tool grp${on ? ' on' : ''}" data-group="${g.group}" data-tool="${id}" title="${tip(id)} · hold for ${g.label.toLowerCase()}" aria-label="${TOOL_INFO[id].label}" aria-pressed="${on}" aria-haspopup="menu" aria-expanded="false">${ICON[id]}${k ? `<kbd>${k}</kbd>` : ''}<i class="tri" aria-hidden="true"></i></button>`;
}
export function renderTools() {
  $('#tools').innerHTML = TOOLBAR.map(e =>
    !e ? '<span class="sep"></span>' : typeof e === 'string' ? toolBtn(e) : groupBtn(e),
  ).join('');
  const fly = document.getElementById('toolfly');
  if (fly && !fly.hidden) closeFly();
}
/** Remember the last tool of each group across sessions. */
export function rememberGroups() {
  try {
    localStorage.setItem(STORE, JSON.stringify(S.toolGroup));
  } catch (_) {}
}
function restoreGroups() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (v && typeof v === 'object')
      for (const g in v) {
        const grp = TOOLBAR.find(e => e && typeof e !== 'string' && e.group === g) as ToolGroup;
        if (grp && grp.items.includes(v[g])) S.toolGroup[g] = v[g];
      }
  } catch (_) {}
}
export function pickTool(id: string) {
  const g = groupOf(id);
  if (g) {
    S.toolGroup[g.group] = id;
    rememberGroups();
  }
  setTool(id);
}

/* ---------- flyout ---------- */

let flyFor: HTMLElement | null = null;
function flyEl(): HTMLElement {
  let el = document.getElementById('toolfly');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toolfly';
    el.className = 'tool-fly';
    el.setAttribute('role', 'menu');
    el.hidden = true;
    document.body.appendChild(el);
    el.addEventListener('click', (e: MouseEvent) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tool]');
      if (b) choose(b.dataset.tool);
    });
    el.addEventListener('keydown', (e: KeyboardEvent) => {
      const items = [...el.querySelectorAll<HTMLElement>('[data-tool]')],
        i = items.indexOf(document.activeElement as HTMLElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
      } else if (e.key === 'Escape' || e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        const back = flyFor;
        closeFly();
        if (back) back.focus();
      } else if (e.key === 'Tab') closeFly();
    });
  }
  return el;
}
export function openFly(btn: HTMLElement) {
  const g = TOOLBAR.find(e => e && typeof e !== 'string' && e.group === btn.dataset.group) as ToolGroup;
  if (!g) return;
  const el = flyEl(),
    cur = S.toolGroup[g.group] || g.items[0];
  el.innerHTML = g.items
    .map(id => {
      const t = TOOL_INFO[id],
        on = id === cur;
      return `<button role="menuitemradio" aria-checked="${on}" class="tf-item${on ? ' on' : ''}" data-tool="${id}"><span class="ck" aria-hidden="true">${on ? '✓' : ''}</span>${ICON[id]}<span class="nm">${t.label}</span><kbd>${t.key || ''}</kbd></button>`;
    })
    .join('');
  el.setAttribute('aria-label', g.label);
  el.hidden = false;
  const r = btn.getBoundingClientRect(),
    rail = $('#tools').getBoundingClientRect(),
    horizontal = rail.width > rail.height,
    fr = el.getBoundingClientRect();
  let left = horizontal ? r.left : r.right + 6,
    top = horizontal ? r.bottom + 6 : r.top;
  left = Math.max(4, Math.min(left, innerWidth - fr.width - 4));
  top = Math.max(4, Math.min(top, innerHeight - fr.height - 4));
  el.style.left = left + 'px';
  el.style.top = top + 'px';
  flyFor = btn;
  btn.setAttribute('aria-expanded', 'true');
  (el.querySelector<HTMLElement>('.tf-item.on') || el.querySelector<HTMLElement>('.tf-item')).focus();
}
export function closeFly() {
  const el = document.getElementById('toolfly');
  if (el) el.hidden = true;
  if (flyFor) flyFor.setAttribute('aria-expanded', 'false');
  flyFor = null;
}
function choose(id: string) {
  closeFly();
  pickTool(id);
}

export function init(): void {
  restoreGroups();
  const rail = $('#tools');
  let hold: ReturnType<typeof setTimeout> | null = null,
    held = false;
  rail.addEventListener('pointerdown', (e: PointerEvent) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.grp');
    if (!b || e.button !== 0) return;
    held = false;
    hold = setTimeout(() => {
      hold = null;
      held = true;
      openFly(b);
    }, HOLD_MS);
  });
  const cancelHold = () => {
    if (hold) clearTimeout(hold);
    hold = null;
  };
  rail.addEventListener('pointerleave', cancelHold);
  // press-and-hold, then release over an item, picks it (as in Adobe apps)
  window.addEventListener('pointerup', (e: PointerEvent) => {
    cancelHold();
    if (!held) return;
    held = false;
    const it = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>(
      '#toolfly [data-tool]',
    );
    if (it) choose(it.dataset.tool);
  });
  let lastHand = 0;
  rail.addEventListener('click', (e: MouseEvent) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tool]');
    if (!b) return;
    // the rail re-renders on every pick, so detect the hand's double-click by timing
    if (b.dataset.tool === 'hand') {
      const now = performance.now();
      if (now - lastHand < 400) fitView();
      lastHand = now;
    }
    if (b.classList.contains('grp') && document.getElementById('toolfly')?.hidden === false && flyFor === b) return;
    pickTool(b.dataset.tool);
  });
  rail.addEventListener('contextmenu', (e: MouseEvent) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.grp');
    if (!b) return;
    e.preventDefault();
    cancelHold();
    openFly(b);
  });
  rail.addEventListener('keydown', (e: KeyboardEvent) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.grp');
    if (b && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) {
      e.preventDefault();
      openFly(b);
    }
  });
  document.addEventListener('pointerdown', (e: PointerEvent) => {
    const t = e.target as HTMLElement;
    if (!t.closest('#toolfly') && !t.closest('.grp')) closeFly();
  });
  window.addEventListener('blur', closeFly);
  window.addEventListener('resize', closeFly);
}
