// Keyline — core/constants
import type { Layer, PropKey } from '../model/types';
import { KLEngine } from '../runtime/engine';

export function $(s: string): any {
  return document.querySelector(s);
}
export function byId(id: string): any {
  return document['getElementById'](id);
}
export const NS = 'http://www.w3.org/2000/svg';
export function clone<T>(o: T): T {
  return o == null ? o : JSON.parse(JSON.stringify(o));
}
export function r2(n: number) {
  return Math.round(n * 100) / 100;
}
export function r3(n: number) {
  return Math.round(n * 1000) / 1000;
}
export function fmt(n: number, d = 2) {
  return n == null || !isFinite(n) ? '' : String(Math.round(n * Math.pow(10, d)) / Math.pow(10, d));
}
export function esc(s: unknown) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
export const H = KLEngine({ L: [] }, null);
export function xfp(M: DOMMatrixInit, x: number, y: number) {
  return new DOMPoint(x, y).matrixTransform(M);
}
export const PROPS: Record<PropKey, [label: string, kind: 'v' | 'n' | 'c' | 'm']> = {
  pos: ['Position', 'v'],
  org: ['Origin', 'v'],
  rot: ['Rotate', 'n'],
  scl: ['Scale', 'v'],
  op: ['Opacity', 'n'],
  fill: ['Fill', 'c'],
  stk: ['Stroke', 'c'],
  sw: ['Stroke width', 'n'],
  draw: ['Draw', 'n'],
  d: ['Morph', 'm'],
};
export const PORDER: PropKey[] = ['pos', 'org', 'rot', 'scl', 'op', 'fill', 'stk', 'sw', 'draw', 'd'];
export function baseOf(l: Layer, k: PropKey) {
  return k === 'org' ? l.o || [0, 0] : l.b[k];
}
export function setBase(l: Layer, k: PropKey, v: any) {
  if (k === 'org') l.o = v;
  else (l.b as Record<string, any>)[k] = v;
}
export const EZFAM = [
  'Standard',
  'Sine',
  'Quad',
  'Cubic',
  'Quart',
  'Quint',
  'Expo',
  'Circ',
  'Back',
  'Elastic',
  'Bounce',
];
export const FONTS = [
  ['system-ui, -apple-system, Segoe UI, sans-serif', 'Sans'],
  ['Georgia, Times New Roman, serif', 'Serif'],
  ['ui-monospace, Menlo, Consolas, monospace', 'Mono'],
  ['Impact, Arial Narrow, sans-serif', 'Condensed'],
];
export const SWATCH = ['#5B7CFA', '#F2B63D', '#2EC4A6', '#F25F5C', '#A07BFF', '#FF8A3D'];
export const KAPPA = 0.5523;
export const NOFILL: Record<'fill' | 'stk' | 'sw' | 'draw', null> = { fill: null, stk: null, sw: null, draw: null };
export function ic(p: string, s = 16) {
  return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}
export const ICON: Record<string, string> = {
  bone: ic('<circle cx="6" cy="18" r="2.5"/><path d="M8 16L18 6M8 16l2.5-6.5L18 6l-6.5 2.5z"/>'),
  select: ic('<path d="M5 3.5l13 6.2-5.6 1.7-1.9 5.8z"/><path d="M12.4 11.4l5 5"/>'),
  node: ic(
    '<path d="M5 19C8 9 16 15 19 5"/><rect x="3" y="17" width="4" height="4" rx=".5"/><rect x="17" y="3" width="4" height="4" rx=".5"/>',
  ),
  rect: ic('<rect x="4" y="5" width="16" height="14" rx="1.5"/>'),
  ellipse: ic('<circle cx="12" cy="12" r="8"/>'),
  star: ic('<path d="M12 3.5l2.6 5.6 6.1.7-4.5 4.1 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.1 6.1-.7z"/>'),
  pen: ic('<path d="M12 21l-6-8 6-10 6 10z"/><circle cx="12" cy="13" r="1.6"/>'),
  addnode: ic(
    '<path d="M10 21l-5-7.5 5-9.5 5 9.5z"/><circle cx="10" cy="13.5" r="1.4"/><path d="M19 3.5v6M16 6.5h6"/>',
  ),
  delnode: ic('<path d="M10 21l-5-7.5 5-9.5 5 9.5z"/><circle cx="10" cy="13.5" r="1.4"/><path d="M16 6.5h6"/>'),
  pencil: ic(
    '<path d="M4 20l1.2-4.4L16.5 4.3a2 2 0 012.8 0l.4.4a2 2 0 010 2.8L8.4 18.8z"/><path d="M14.5 6.3l3.2 3.2"/>',
  ),
  polygon: ic('<path d="M12 3.5l8.1 5.9-3.1 9.6H7L3.9 9.4z"/>'),
  line: ic('<path d="M5 19L19 5"/>'),
  hand: ic(
    '<path d="M8 13V6a1.5 1.5 0 013 0v5M11 10.5V4.5a1.5 1.5 0 013 0V11M14 10.5V6a1.5 1.5 0 013 0v7.5c0 4-2.6 6.5-6 6.5h-.6c-2 0-3.4-.9-4.6-2.5L3.7 14.2a1.5 1.5 0 012.3-1.9L8 14.5"/>',
  ),
  text: ic('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'),
  play: ic('<path d="M7.5 4.8v14.4L19 12z" fill="currentColor"/>'),
  pause: ic('<path d="M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z" fill="currentColor" stroke="none"/>'),
  start: ic('<path d="M6 5v14M19 5.5L9 12l10 6.5z"/>'),
  loop: ic('<path d="M4 11V9a3 3 0 013-3h12l-3-3M20 13v2a3 3 0 01-3 3H5l3 3"/>'),
  eye: ic('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>'),
  eyeoff: ic(
    '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" opacity=".45"/><path d="M4 4l16 16"/>',
  ),
  lock: ic('<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 018 0v3"/>'),
  unlock: ic(
    '<rect x="5" y="11" width="14" height="9" rx="1.5" opacity=".45"/><path d="M8 11V8a4 4 0 017.6-1.7" opacity=".45"/>',
  ),
  right: ic('<path d="M9 6l6 6-6 6"/>'),
  down: ic('<path d="M6 9l6 6 6-6"/>'),
  undo: ic('<path d="M8 6l-4 4 4 4"/><path d="M4 10h10.5a5 5 0 010 10H11"/>'),
  redo: ic('<path d="M16 6l4 4-4 4"/><path d="M20 10H9.5a5 5 0 000 10H13"/>'),
  x: ic('<path d="M6 6l12 12M18 6L6 18"/>'),
  trash: ic('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
};
export const TICON: Record<string, string> = {
  group: ic('<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>', 14),
  rect: ic('<rect x="4" y="5" width="16" height="14" rx="1.5"/>', 14),
  ellipse: ic('<circle cx="12" cy="12" r="8"/>', 14),
  path: ic('<path d="M4 18C8 6 16 18 20 6"/>', 14),
  text: ic('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>', 14),
  image: ic(
    '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
    14,
  ),
  raw: ic('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/>', 14),
  bone: ic('<circle cx="6" cy="18" r="2.5"/><path d="M8 16L18 6M8 16l2.5-6.5L18 6l-6.5 2.5z"/>', 14),
};
/** Every tool: label and its shortcut (shown in the UI; `keys` are the keys that select it). */
export const TOOL_INFO: Record<string, { label: string; key?: string; keys?: string[] }> = {
  select: { label: 'Select & transform', key: 'V', keys: ['v'] },
  node: { label: 'Edit path nodes', key: 'A', keys: ['a'] },
  pen: { label: 'Pen tool', key: 'P', keys: ['p'] },
  addnode: { label: 'Add node tool', key: '+', keys: ['+', '='] },
  delnode: { label: 'Remove node tool', key: '-', keys: ['-', '_'] },
  pencil: { label: 'Pencil tool', key: 'N', keys: ['n'] },
  ellipse: { label: 'Ellipse', key: 'O', keys: ['o'] },
  rect: { label: 'Rectangle', key: 'M', keys: ['m'] },
  polygon: { label: 'Polygon' },
  star: { label: 'Star' },
  line: { label: 'Line', key: 'L', keys: ['l'] },
  text: { label: 'Text', key: 'T', keys: ['t'] },
  bone: { label: 'Bone', key: 'B', keys: ['b'] },
  hand: { label: 'Hand (hold Space)', key: 'H', keys: ['h'] },
};
export interface ToolGroup {
  group: string;
  label: string;
  items: string[];
}
/** The tool rail, top to bottom. `null` is a separator. */
export const TOOLBAR: Array<string | ToolGroup | null> = [
  'select',
  'node',
  null,
  { group: 'pen', label: 'Pen tools', items: ['pen', 'addnode', 'delnode', 'pencil'] },
  { group: 'shapes', label: 'Shape tools', items: ['ellipse', 'rect', 'polygon', 'star', 'line'] },
  'text',
  null,
  'bone',
  null,
  'hand',
];
export function groupOf(tool: string): ToolGroup | null {
  for (const e of TOOLBAR) if (e && typeof e !== 'string' && e.items.includes(tool)) return e;
  return null;
}
export const HINTS: Record<string, string> = {
  select: 'Drag to move · corners scale · top dot rotates · Ctrl+click picks inside groups',
  node: 'Drag nodes and handles · double-click a node for smooth/corner · Del removes a node',
  pen: 'Click: corner · drag: curve (Alt breaks the handle, Shift 45°, Space moves the point) · click the first point to close · Enter/Esc ends · on a selected path: hover to add, delete or continue',
  addnode: 'Click a segment of the selected path to add a node',
  delnode: 'Click a node of the selected path to remove it',
  pencil: 'Drag to draw freehand · end near the start to close the shape',
  ellipse: 'Drag to draw · Shift for a circle · Alt from the center',
  rect: 'Drag to draw · Shift for a square · Alt from the center',
  polygon: 'Drag out from the center · ↑/↓ while dragging changes the sides · Shift keeps it upright',
  star: 'Drag out from the center · ↑/↓ while dragging changes the points · Shift keeps it upright',
  line: 'Drag to draw a line · Shift snaps to 45° · Alt from the center',
  text: 'Click on the canvas to place text',
  bone: 'Drag to draw a bone · start on a bone tip to chain a child bone · Esc to finish',
  hand: 'Drag to pan · wheel scrolls · Ctrl+wheel zooms · double-click the hand to fit · hold Space for the hand in any tool',
};
