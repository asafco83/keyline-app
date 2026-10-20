// SVGcinema — ui/layers-panel
import { syncLayerActions } from './animate-menu';
import type { Layer } from '../model/types';
import { $, H, ICON, NOFILL, TICON, clone, esc, r2, r3 } from '../core/constants';
import { LP } from '../core/dom';
import { beginEdit, select } from '../core/history';
import { makeMask, releaseMask } from '../core/masks';
import { S, doc, layerById, mkLayer, selLayer, uid } from '../core/state';
import { toast } from '../io/open';
import {
  ancestors,
  descendants,
  hasTracks,
  isAnim,
  isBox,
  kids,
  pidOf,
  pmOf,
  reparentKeep,
  selectedRoots,
  treeRows,
} from '../model/tree';
import { renderTimeline } from './timeline';

/** Badge on a mask / clip folder (the same shape as the Create mask button). */
const MASK_IC =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="12" cy="12" r="5" fill="currentColor" fill-opacity=".4"/></svg>';
/** The "clipped" hook shown before layers that a mask or clip folder applies to. */
const CLIP_IC =
  '<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 10.5H5V3"/><path d="M2.8 5.2L5 3l2.2 2.2"/></svg>';
export function renderLayers() {
  const rows = treeRows(null, 0, [], true);
  if (!rows.length)
    LP.innerHTML = `<p class="lp-empty">Layers appear here. Draw with the tools on the left, or drop SVG and image files onto the canvas.</p>`;
  else {
    // tree guides: for each row, which ancestor levels continue below it (a vertical dotted
    // line passes through), and whether the row itself is its parent's last child (an elbow)
    const nextAt: boolean[] = [];
    LP.innerHTML = rows
      .map(([l, d], i) => {
        const grp = isBox(l),
          n = grp ? kids(l.id).length : 0,
          open = S.lexp[l.id] !== false;
        let hasNext = false;
        for (let j = i + 1; j < rows.length && rows[j][1] >= d; j++)
          if (rows[j][1] === d) {
            hasNext = true;
            break;
          }
        nextAt[d] = hasNext;
        const par = l.parent ? layerById(l.parent) : null,
          clipped = !!(par && par.mask && !l.maskSrc),
          clipTip = par && par.mask === 'clip' ? 'Clipped by the Clip path folder' : 'Masked by the Masks folder';
        let guides = '';
        if (d > 0) {
          for (let m = 1; m < d; m++)
            if (nextAt[m]) guides += `<i class="lg v" style="left:${13 + (m - 1) * 18}px"></i>`;
          const x = 13 + (d - 1) * 18,
            end = 4 + d * 18 + (grp && n ? 3 : clipped ? 5 : 13);
          guides +=
            `<i class="lg ${hasNext ? 'v' : 'e'}" style="left:${x}px"></i>` +
            `<i class="lg h" style="left:${x}px;width:${end - x}px"></i>`;
        }
        const clip = clipped
          ? `<span class="lp-clip" title="${clipTip}" aria-label="${clipTip}">${CLIP_IC}</span>`
          : '';
        return `<div class="lp-row${S.selSet.has(l.id) ? ' sel' : ''}${l.hid ? ' hid' : ''}" draggable="true" tabindex="0" role="treeitem" aria-selected="${S.selSet.has(l.id)}" aria-level="${d + 1}" data-lid="${l.id}" style="padding-left:${4 + d * 18}px">${guides ? `<span class="lp-guides" aria-hidden="true">${guides}</span>` : ''}
      ${grp && n ? `<button class="tl-ic" data-la="exp" aria-label="${open ? 'Collapse' : 'Expand'} ${esc(l.name)}">${open ? ICON.down : ICON.right}</button>${clip}` : `<span class="lp-sp">${clip}</span>`}
      <span class="lp-ty" title="${l.type}">${TICON[l.type] || TICON.raw}</span><span class="lp-name" title="${esc(l.name)}">${esc(l.name)}</span>${l.mask ? `<span class="lp-mask" title="${l.mask === 'clip' ? 'Clip group: the Clip path folder clips the layers below it' : 'Mask group: the Masks folder masks the layers below it'}">${l.mask === 'clip' ? 'CLIP' : 'MASK'}</span>` : l.maskSrc ? '<span class="lp-mask ic" title="The layers in this folder are the mask">' + MASK_IC + '</span>' : ''}${l.link ? `<span class="lp-link" title="Links to ${esc(l.link.url)}">🔗</span>` : ''}
      <button class="tl-ic${l.hid ? '' : ' vis-hide'}" data-la="hid" aria-label="${l.hid ? 'Show' : 'Hide'} ${esc(l.name)}">${l.hid ? ICON.eyeoff : ICON.eye}</button>
      <button class="tl-ic${l.lock ? '' : ' vis-hide'}" data-la="lock" aria-label="${l.lock ? 'Unlock' : 'Lock'} ${esc(l.name)}">${l.lock ? ICON.lock : ICON.unlock}</button>
      ${hasTracks(l) ? '<i class="lp-anim" title="Has keyframes"></i>' : '<i class="lp-anim none" aria-hidden="true"></i>'}</div>`;
      })
      .join('');
  }
  const s = selLayer();
  syncLayerActions(s);
  const total = doc.layers.length;
  $('#lCount').textContent = S.selSet.size
    ? `${S.selSet.size} of ${total} selected`
    : `${total} layer${total === 1 ? '' : 's'}`;
}
export function renameInline(el: HTMLElement, l: Layer) {
  el.innerHTML = `<input id="rn-${l.id}" value="${esc(l.name)}" aria-label="Layer name">`;
  const inp = el.querySelector('input');
  inp.focus();
  inp.select();
  let done = false;
  const finish = (ok: boolean) => {
    if (done) return;
    done = true;
    if (ok && inp.value.trim() && inp.value.trim() !== l.name) {
      const ed = beginEdit();
      l.name = inp.value.trim();
      ed.end({ insp: true });
    } else {
      renderLayers();
      renderTimeline();
    }
  };
  inp.addEventListener('keydown', (ev: KeyboardEvent) => {
    ev.stopPropagation();
    if (ev.key === 'Enter') finish(true);
    if (ev.key === 'Escape') finish(false);
  });
  inp.addEventListener('blur', () => finish(true));
}
export let dragIds: string[] | null = null;
export function dropMode(r: HTMLElement, e: MouseEvent) {
  const tgt = layerById(r.dataset.lid);
  if (!tgt || !dragIds) return null;
  if (dragIds.some(id => id === tgt.id || ancestors(tgt).some(a => a.id === id))) return null;
  const rc = r.getBoundingClientRect(),
    y = (e.clientY - rc.top) / rc.height;
  return isBox(tgt) ? (y < 0.28 ? 'before' : y > 0.72 ? 'after' : 'into') : y < 0.5 ? 'before' : 'after';
}
export function clearDrop() {
  return LP.querySelectorAll('.d-before,.d-after,.d-into').forEach((x: HTMLElement) =>
    x.classList.remove('d-before', 'd-after', 'd-into'),
  );
}
export function moveLayers(ids: string[], tgt: Layer | null, mode: 'before' | 'after' | 'into' | 'root' | string) {
  const ls = ids.map(layerById).filter(Boolean);
  if (!ls.length) return;
  const ed = beginEdit();
  const newPid = mode === 'into' ? tgt.id : mode === 'root' ? null : pidOf(tgt),
    PM = pmOf(newPid);
  ls.forEach(l => {
    if (pidOf(l) !== newPid) reparentKeep(l, PM);
  });
  const order = mode === 'before' ? ls : ls.slice().reverse();
  order.forEach(l => {
    doc.layers.splice(doc.layers.indexOf(l), 1);
    l.parent = newPid;
    if (mode === 'into' || mode === 'root') doc.layers.push(l);
    else {
      const ti = doc.layers.indexOf(tgt);
      doc.layers.splice(mode === 'before' ? ti + 1 : ti, 0, l);
    }
  });
  if (mode === 'into') S.lexp[tgt.id] = true;
  ed.end({ insp: true });
}
export function groupSel() {
  const roots = selectedRoots(),
    ed = beginEdit();
  const cnt = doc.layers.filter(l => l.type === 'group').length + 1;
  const g = mkLayer('group', 'Group ' + cnt, {}, NOFILL);
  if (!roots.length) {
    doc.layers.push(g);
  } else {
    const pid = pidOf(selLayer() || roots[0]);
    g.parent = pid;
    const PM = pmOf(pid);
    const maxI = Math.max(...roots.map(l => doc.layers.indexOf(l)));
    doc.layers.splice(maxI + 1, 0, g);
    roots
      .slice()
      .reverse()
      .forEach(l => {
        if (pidOf(l) !== pid) reparentKeep(l, PM);
        l.parent = g.id;
      });
  }
  S.sel = g.id;
  S.selSet = new Set<any>([g.id]);
  S.lexp[g.id] = true;
  ed.end({ insp: true });
}
export function ungroup(g: Layer) {
  if (!g || g.type !== 'group') return;
  const ed = beginEdit();
  const ch = kids(g.id),
    PM = pmOf(pidOf(g)),
    anim = isAnim(g),
    gc = H.comp(g, S.time);
  ch.forEach(c => {
    reparentKeep(c, PM);
    if (!anim) {
      if (!(c.t.rot && c.t.rot.length)) c.b.rot = r2(c.b.rot + gc.r);
      if (!(c.t.scl && c.t.scl.length)) c.b.scl = [r3(c.b.scl[0] * gc.sx), r3(c.b.scl[1] * gc.sy)];
      if (!(c.t.op && c.t.op.length)) c.b.op = r3(c.b.op * gc.op);
    }
    c.parent = pidOf(g);
  });
  ch.forEach(c => doc.layers.splice(doc.layers.indexOf(c), 1));
  doc.layers.splice(doc.layers.indexOf(g), 1, ...ch);
  S.selSet = new Set<any>(ch.map(c => c.id));
  S.sel = ch.length ? ch[ch.length - 1].id : null;
  S.keys.clear();
  ed.end({ insp: true });
  if (anim || g.xf) toast('Ungrouped. The group’s own keyframes and transform were removed.');
}
export function deleteSel() {
  const roots = selectedRoots();
  if (!roots.length) return;
  const ed = beginEdit();
  roots.forEach(l => {
    [l, ...descendants(l)].forEach(x => {
      const i = doc.layers.indexOf(x);
      if (i >= 0) doc.layers.splice(i, 1);
    });
  });
  S.sel = null;
  S.selSet.clear();
  S.keys.clear();
  ed.end({ insp: true });
}
export function duplicate(l: Layer) {
  const ed = beginEdit(),
    list = [l, ...descendants(l)],
    map: Record<string, string> = {};
  const clones = list.map(x => {
    const c = clone(x);
    c.id = uid();
    map[x.id] = c.id;
    return c;
  });
  clones.forEach((c, i) => {
    if (i > 0) c.parent = map[list[i].parent] || c.parent;
  });
  const root = clones[0];
  root.name = l.name + ' copy';
  root.hid = false;
  if (root.t.pos && root.t.pos.length) root.t.pos.forEach(q => (q[1] = [q[1][0] + 16, q[1][1] + 16]));
  else root.b.pos = [root.b.pos[0] + 16, root.b.pos[1] + 16];
  doc.layers.splice(doc.layers.indexOf(l) + 1, 0, root);
  doc.layers.push(...clones.slice(1));
  S.sel = root.id;
  S.selSet = new Set<string>([root.id]);
  S.keys.clear();
  ed.end({ insp: true });
}
export function arrange(l: Layer, dir: number) {
  const sib = kids(pidOf(l)),
    i = sib.indexOf(l),
    j = i + dir;
  if (j < 0 || j >= sib.length) return;
  const ed = beginEdit();
  const a = doc.layers.indexOf(l),
    b = doc.layers.indexOf(sib[j]);
  doc.layers[a] = sib[j];
  doc.layers[b] = l;
  ed.end();
}

export function init(): void {
  LP.addEventListener('click', (e: MouseEvent) => {
    const r = (e.target as any).closest('.lp-row');
    if (!r) {
      if (e.target === LP) select(null);
      return;
    }
    const l = layerById(r.dataset.lid),
      a = (e.target as any).closest('[data-la]');
    if (a) {
      const k = a.dataset.la;
      if (k === 'exp') {
        S.lexp[l.id] = S.lexp[l.id] === false;
        renderLayers();
        return;
      }
      const ed = beginEdit();
      if (k === 'hid') {
        l.hid = !l.hid;
        if (l.hid) {
          S.selSet.delete(l.id);
          if (S.sel === l.id) S.sel = null;
        }
      } else l.lock = !l.lock;
      ed.end({ insp: true });
      return;
    }
    if ((e.target as any).closest('input')) return;
    select(l.id, e.shiftKey ? 'range' : e.ctrlKey || e.metaKey ? 'toggle' : undefined);
  });
  LP.addEventListener('keydown', (e: KeyboardEvent) => {
    const r = (e.target as any).closest('.lp-row');
    if (!r || (e.target as any).tagName === 'INPUT') return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      select(r.dataset.lid);
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      const nx = e.key === 'ArrowDown' ? r.nextElementSibling : r.previousElementSibling;
      if (nx && nx.dataset.lid) {
        select(nx.dataset.lid);
        const nr = LP.querySelector(`[data-lid="${nx.dataset.lid}"]`);
        if (nr) nr.focus();
      }
    }
  });
  LP.addEventListener('dblclick', (e: MouseEvent) => {
    const nm = (e.target as any).closest('.lp-name');
    if (nm) renameInline(nm, layerById(nm.closest('[data-lid]').dataset.lid));
  });
  LP.addEventListener('dragstart', (e: DragEvent) => {
    const r = (e.target as any).closest('.lp-row');
    if (!r) return;
    const id = r.dataset.lid;
    if (!S.selSet.has(id)) select(id);
    dragIds = selectedRoots().map(l => l.id);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/x-keyline-layer', id);
    } catch (_) {}
  });
  LP.addEventListener('dragover', (e: DragEvent) => {
    if (!dragIds) return;
    e.preventDefault();
    clearDrop();
    const r = (e.target as any).closest('.lp-row');
    if (!r) return;
    const m = dropMode(r, e);
    if (m) r.classList.add('d-' + m);
    else e.dataTransfer.dropEffect = 'none';
  });
  LP.addEventListener('dragleave', (e: DragEvent) => {
    if (e.target === LP) clearDrop();
  });
  LP.addEventListener('drop', (e: DragEvent) => {
    if (!dragIds) return;
    e.preventDefault();
    clearDrop();
    const r = (e.target as any).closest('.lp-row');
    // decide the drop position while dragIds is still set: dropMode() checks it
    const m = r ? dropMode(r, e) : 'root';
    const ids = dragIds;
    dragIds = null;
    if (m) moveLayers(ids, r ? layerById(r.dataset.lid) : null, m);
  });
  LP.addEventListener('dragend', () => {
    dragIds = null;
    clearDrop();
  });
  $('#lUp').addEventListener('click', () => selLayer() && arrange(selLayer(), 1));
  $('#lDown').addEventListener('click', () => selLayer() && arrange(selLayer(), -1));
  $('#lDup').addEventListener('click', () => selLayer() && duplicate(selLayer()));
  $('#lGroup').addEventListener('click', groupSel);
  $('#lUngroup').addEventListener('click', () => ungroup(selLayer()));
  $('#lMask').addEventListener('click', () => makeMask('mask'));
  $('#lUnmask').addEventListener('click', () => {
    const l = selLayer();
    if (l && l.mask) releaseMask(l);
  });
  $('#lDel').addEventListener('click', deleteSel);
  $('#sideTabs').addEventListener('click', (e: MouseEvent) => {
    const b = (e.target as any).closest('button');
    if (!b) return;
    S.tab = b.dataset.v;
    $('#sideTabs')
      .querySelectorAll('button')
      .forEach((x: HTMLElement) => x.classList.toggle('on', x === b));
    $('#paneLayers').hidden = S.tab !== 'layers';
    $('#paneAssets').hidden = S.tab !== 'assets';
  });
}
