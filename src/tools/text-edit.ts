// Keyline — tools/text-edit
// Typing text straight on the canvas. A <textarea> styled like the text is laid over it (same font,
// size, spacing, alignment, colour, transform) while the SVG text is hidden; every keystroke updates
// the layer, so the timeline, inspector and export follow live. Esc, Ctrl+Enter or clicking away ends it.
import type { Layer } from '../model/types';
import { H, byId } from '../core/constants';
import { beginEdit } from '../core/history';
import { S, layerById } from '../core/state';
import { familyCSS } from '../render/fonts';
import { anchorX, textLines, textWidth } from '../render/text-layout';
import { frame, renderStage } from '../render/stage';

let ta: HTMLTextAreaElement | null = null,
  edit: { end(o?: any): void } | null = null,
  editing: string | null = null;

export function textEditing() {
  return editing;
}
function layout(l: Layer) {
  const G = l.geo,
    size = G.size || 16,
    lh = (G.lh || 1.2) * size,
    lines = textLines(G),
    w = G.wrap && G.ww > 0 ? G.ww : Math.max(size * 0.6, ...lines.map(s => textWidth(s, G))) + size * 0.4,
    ax = anchorX(G),
    left = G.wrap && G.ww > 0 ? G.x : G.anchor === 'middle' ? ax - w / 2 : G.anchor === 'end' ? ax - w : ax,
    // the first baseline sits about 0.8em below the top of a line box
    top = G.y - size * 0.8 - (lh - size) / 2;
  return { size, lh, w, left, top, h: Math.max(1, lines.length) * lh };
}
function place(l: Layer) {
  const el = byId('e-' + l.id + '-s') as unknown as SVGGraphicsElement;
  if (!ta || !el) return;
  const G = l.geo,
    m = el.getScreenCTM(),
    L = layout(l),
    c = H.comp(l, S.time);
  Object.assign(ta.style, {
    transform: `matrix(${m.a},${m.b},${m.c},${m.d},${m.e},${m.f}) translate(${L.left}px,${L.top}px)`,
    width: L.w + 'px',
    height: L.h + 'px',
    font: `${G.italic ? 'italic ' : ''}${G.weight || 400} ${L.size}px/${L.lh}px ${familyCSS(G.family)}`,
    letterSpacing: (G.ls || 0) + 'px',
    textDecoration: G.deco || 'none',
    textAlign: G.anchor === 'middle' ? 'center' : G.anchor === 'end' ? 'right' : 'left',
    whiteSpace: G.wrap && G.ww > 0 ? 'pre-wrap' : 'pre',
    color: c.fill && c.fill !== 'none' ? c.fill : '#888',
    caretColor: c.fill && c.fill !== 'none' ? c.fill : '#888',
  });
}
/** Start typing into a text layer on the canvas. `selectAll` selects the current text (new layers). */
export function startTextEdit(l: Layer, selectAll?: boolean) {
  if (!l || l.type !== 'text') return;
  if (editing) endTextEdit();
  editing = l.id;
  edit = beginEdit();
  ta = document.createElement('textarea');
  ta.className = 'kl-tedit';
  ta.spellcheck = false;
  ta.setAttribute('aria-label', 'Text');
  ta.value = String(l.geo.text || '');
  document.body.appendChild(ta);
  renderStage();
  frame();
  place(l);
  ta.focus();
  if (selectAll) ta.select();
  else ta.setSelectionRange(ta.value.length, ta.value.length);
  ta.addEventListener('input', () => {
    const L = layerById(editing);
    if (!L) return endTextEdit();
    L.geo.text = ta.value;
    renderStage();
    frame();
    place(L);
    const it = document.getElementById('g-text') as HTMLTextAreaElement;
    if (it) it.value = ta.value;
  });
  ta.addEventListener('keydown', e => {
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      endTextEdit();
    }
    e.stopPropagation();
  });
  ta.addEventListener('blur', () => setTimeout(() => editing && document.activeElement !== ta && endTextEdit(), 0));
}
export function endTextEdit() {
  if (!editing) return;
  const l = layerById(editing);
  editing = null;
  if (ta) ta.remove();
  ta = null;
  if (l && !String(l.geo.text || '').trim()) l.geo.text = 'Text';
  const e = edit;
  edit = null;
  if (e) e.end({ insp: true });
  else renderStage();
}
/** Keep the editor on top of the text when the view moves (zoom, pan, playhead). */
export function followTextEdit() {
  const l = editing && layerById(editing);
  if (l) place(l);
}
