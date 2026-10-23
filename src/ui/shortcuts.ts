// SVGcinema — ui/shortcuts
// The Keyboard shortcuts window (F1, or the keyboard button in the top bar): tabs for Common, Selection
// & layers, Tools, Timeline and View, and a search box across all of them. Tool keys come from
// TOOL_INFO and the Animate keys from ANIM_GROUPS, so the list follows the real bindings. On a Mac,
// Ctrl shows as ⌘ and Alt as ⌥.
import { $, TOOL_INFO, esc } from '../core/constants';
import { keyLabel } from '../core/keys';
import { ANIM_GROUPS } from './animate-menu';

/** One way to press it: keys, with plain words for mouse parts ('drag', 'click'…) */
type Combo = string[];
type Row = [label: string, combos: Combo[]];
interface Tab {
  id: string;
  label: string;
  rows: Row[];
}
/** "Ctrl Shift Z" → keys; a trailing lower-case phrase ("+ drag", "double-click a lane") is one part */
const c = (s: string): Combo => {
  const t = s.split(' '),
    out: string[] = [];
  for (let i = 0; i < t.length; i++) {
    const w = t[i],
      phrase = /^[a-z]/.test(w) || (w === '+' && i + 1 < t.length && /^[a-z]/.test(t[i + 1]));
    if (phrase) {
      out.push(t.slice(i).join(' '));
      break;
    }
    out.push(w);
  }
  return out;
};
const r = (label: string, ...combos: string[]): Row => [label, combos.map(c)];

function tabs(): Tab[] {
  const tools: Row[] = Object.values(TOOL_INFO)
    .filter(t => t.key)
    .map(t => r(t.label.replace(/ \(hold Space\)$/, ''), t.key.replace('⇧', 'Shift ')));
  const anim: Row[] = ANIM_GROUPS.flat()
    .filter(([, , k]) => k)
    .map(([, label, k]) => r(`Animate ${label.replace(/ \(.*\)$/, '').toLowerCase()}`, `Shift ${k}`));
  return [
    {
      id: 'common',
      label: 'Common',
      rows: [
        r('Undo', 'Ctrl Z'),
        r('Redo', 'Ctrl Shift Z', 'Ctrl Y'),
        r('Save project', 'Ctrl S'),
        r('Save project as', 'Ctrl Shift S'),
        r('Open', 'Ctrl O'),
        r('Import files', 'Ctrl I'),
        r('Export SVG', 'Ctrl E'),
        r('Export the selected layers', 'Ctrl Shift E'),
        r('Cut', 'Ctrl X'),
        r('Copy', 'Ctrl C'),
        r('Paste', 'Ctrl V'),
        r('Paste in place', 'Ctrl Shift V'),
        r('Duplicate', 'Ctrl D'),
        r('Duplicate by dragging', 'Alt + drag'),
        r('Delete', 'Del'),
        r('Close a menu or dialog · back to Select', 'Esc'),
        r('Keyboard shortcuts', 'F1'),
      ],
    },
    {
      id: 'layers',
      label: 'Selection & layers',
      rows: [
        r('Select all layers', 'Ctrl A'),
        r('Deselect all', 'Ctrl Shift A'),
        r('Add to or remove from the selection', 'Shift + click'),
        r('Select a layer inside a group', 'Ctrl + click'),
        r('Select with a marquee', 'drag on empty canvas'),
        r('Add or remove with a marquee', 'Shift + drag on empty canvas'),
        r('Group', 'Ctrl G'),
        r('Ungroup', 'Ctrl Shift G'),
        r('Hide or show the selection', 'Ctrl H'),
        r('Lock or unlock the selection', 'Ctrl L'),
        r('Center the origin', 'Ctrl Shift O'),
        r('Convert to path', 'Ctrl Shift P'),
        r('Bring forward', 'Ctrl ↑', 'Ctrl ]'),
        r('Bring to front', 'Ctrl Shift ↑', 'Ctrl Shift ]'),
        r('Send backward', 'Ctrl ↓', 'Ctrl ['),
        r('Send to back', 'Ctrl Shift ↓', 'Ctrl Shift ['),
        r('Nudge 1px', '← ↑ → ↓'),
        r('Nudge 10px', 'Shift ← ↑ → ↓'),
        r('Constrain a move · keep proportions · rotate in 15° steps', 'Shift + drag'),
        r('Scale from the centre', 'Alt + drag a handle'),
        r('Scale around the origin (past the edge mirrors)', 'Ctrl + drag a handle'),
        r('Move the origin (Shift snaps to corners and edges)', 'drag the origin'),
        r('Pick the fill colour from the screen', 'I'),
        r('Pick the stroke colour from the screen', 'Alt I'),
      ],
    },
    {
      id: 'tools',
      label: 'Tools',
      rows: [
        ...tools,
        r('Pen: corner · curve', 'click', 'drag'),
        r('Pen: break the handle', 'Alt + drag'),
        r('Pen: move the point being placed', 'Space + drag'),
        r('Pen: finish the path', 'Enter', 'Esc'),
        r('Pen: remove the last point', 'Del'),
        r('Edit nodes: smooth ↔ corner', 'double-click a node'),
        r('Shapes: square, circle, 45° lines', 'Shift + drag'),
        r('Shapes: draw from the centre', 'Alt + drag'),
        r('Polygon and star: more or fewer sides', '↑ ↓ while drawing'),
        r('Bone: turn one bone (FK)', 'drag a bone'),
        r('Bone: pose the chain (IK)', 'drag the tip', 'Alt + drag a bone'),
        r('Pin: move a pin at rest', 'Alt + drag a pin'),
        r('Pin: remove the selected pin', 'Del'),
        r('Hand from any tool', 'Space + drag'),
      ],
    },
    {
      id: 'timeline',
      label: 'Timeline',
      rows: [
        r('Play / pause', 'Space'),
        r('Stop and go to the start', 'Shift Space', 'Home'),
        r('Go to the end', 'End'),
        r('Previous · next frame', ',', '.'),
        r('Previous · next keyframe', 'J', 'K'),
        r('Zoom the timeline', 'Ctrl + scroll'),
        r('Select all keyframes (in the timeline)', 'Ctrl A'),
        r('Cut · copy keyframes', 'Ctrl X', 'Ctrl C'),
        r('Paste keyframes at the playhead', 'Ctrl V'),
        r('Duplicate keyframes', 'Ctrl D'),
        r('Delete keyframes', 'Del'),
        r('Move keyframes one frame (Shift: 10)', '← →'),
        r('Box-select keyframes (Shift or Ctrl adds)', 'drag an empty lane'),
        r('Add or remove a keyframe from the selection', 'Shift + click'),
        r('Stretch the selection from its other end', 'Alt + drag a key'),
        r('Copy keyframes while dragging', 'Ctrl + drag a key'),
        r('Add a keyframe', 'double-click a lane'),
        r('Ease in-out · ease in · ease out', 'F9', 'Shift F9', 'Ctrl Shift F9'),
        ...anim,
      ],
    },
    {
      id: 'view',
      label: 'View',
      rows: [
        r('Zoom to 100%', '0'),
        r('Zoom to fit', '1'),
        r('Zoom to the selection', '2'),
        r('Zoom in · out', 'Ctrl +', 'Ctrl -'),
        r('Zoom at the pointer', 'Ctrl + scroll'),
        r('Pan', 'Space + drag', 'middle-drag', 'scroll'),
        r('Close or open all inspector sections', '/'),
        r('Snapping on or off', 'Alt S'),
        r('Rulers', 'Alt R'),
        r('Guides', 'Alt L'),
        r('Front grid', 'Alt G'),
        r('Bones', 'Alt B'),
      ],
    },
  ];
}

function keyHTML(k: string) {
  return /^[a-z]/.test(k) || k.startsWith('+ ')
    ? `<span class="sk-w">${esc(k)}</span>`
    : `<kbd>${esc(keyLabel(k))}</kbd>`;
}
function comboHTML(cb: Combo) {
  return `<span class="sk-combo">${cb.map(keyHTML).join('')}</span>`;
}
function rowHTML([label, combos]: Row) {
  return `<div class="sk-row"><span class="sk-l">${esc(label)}</span><span class="sk-keys">${combos.map(comboHTML).join('<span class="sk-or">or</span>')}</span></div>`;
}

let cur = 'common';
function render(q = '') {
  const body = $('#skBody') as HTMLElement,
    all = tabs(),
    s = q.trim().toLowerCase();
  document.querySelectorAll<HTMLElement>('#skTabs [role=tab]').forEach(b => {
    const on = !s && b.dataset.tab === cur;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on || (!!s && b.dataset.tab === cur) ? 0 : -1;
  });
  if (s) {
    const hits = all.flatMap(t =>
      t.rows
        .filter(([l, cbs]) => (l + ' ' + cbs.map(cb => cb.join(' ')).join(' ')).toLowerCase().includes(s))
        .map(row => ({ t, row })),
    );
    body.innerHTML = hits.length
      ? `<div class="sk-grid">${hits.map(h => rowHTML(h.row)).join('')}</div>`
      : `<p class="sk-none">No shortcut matches “${esc(q.trim())}”.</p>`;
    return;
  }
  const t = all.find(x => x.id === cur) || all[0];
  body.innerHTML = `<div class="sk-grid">${t.rows.map(rowHTML).join('')}</div>`;
}
export function openShortcuts() {
  const m = $('#mKeys') as HTMLElement;
  if (!m.hidden) return;
  const f = $('#skFind') as HTMLInputElement;
  f.value = '';
  render();
  m.hidden = false;
  f.focus();
}
/** the list as data, for tests */
export const shortcutTabs = tabs;

export function initShortcuts(): void {
  const m = $('#mKeys') as HTMLElement;
  if (!m) return;
  ($('#skTabs') as HTMLElement).innerHTML = tabs()
    .map(
      t =>
        `<button type="button" role="tab" id="sk-${t.id}" data-tab="${t.id}" aria-controls="skBody" aria-selected="${t.id === cur}">${esc(t.label)}</button>`,
    )
    .join('');
  const list = $('#skTabs') as HTMLElement,
    f = $('#skFind') as HTMLInputElement;
  list.addEventListener('click', (e: MouseEvent) => {
    const b = (e.target as Element).closest('[role=tab]') as HTMLElement;
    if (!b) return;
    cur = b.dataset.tab;
    f.value = '';
    render();
  });
  list.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const ids = tabs().map(t => t.id),
      i = ids.indexOf(cur);
    cur = ids[(i + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length];
    f.value = '';
    render();
    ($('#sk-' + cur) as HTMLElement).focus();
  });
  f.addEventListener('input', () => render(f.value));
  f.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && f.value) {
      e.stopPropagation();
      f.value = '';
      render();
    }
  });
  $('#bKeys').addEventListener('click', openShortcuts);
}
