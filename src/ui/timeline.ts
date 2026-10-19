// Keyline — ui/timeline
import type { Keyframe, Layer, PropKey } from '../model/types';
import { $, ICON, PORDER, PROPS, clamp, clone, esc, fmt, r3 } from '../core/constants';
import { TLB, TLS } from '../core/dom';
import { beginEdit, setTime } from '../core/history';
import { closeMenu } from '../core/keyframes';
import { S, doc, layerById, sortTrack } from '../core/state';
import { ancestors, isAnim, isHidden, treeRows } from '../model/tree';
import { frame } from '../render/stage';
import { easeLabel } from './easing';
import { renderInspector } from './inspector';
import { renderLayers } from './layers-panel';

export function tln() {
  return parseFloat(getComputedStyle(TLB).getPropertyValue('--tln')) || 214;
}
export function ticks(W?) {
  const pps = S.pps,
    minor = pps >= 260 ? 0.1 : pps >= 110 ? 0.25 : 0.5,
    major = pps >= 60 ? 1 : 2;
  let h = '';
  for (let t = 0; t <= doc.dur + 1e-6; t = r3(t + minor)) {
    const mj = Math.abs(t / major - Math.round(t / major)) < 1e-6;
    h += `<div class="tk${mj ? ' mj' : ''}" style="left:${t * pps}px">${mj ? `<b>${fmt(t, 1)}s</b>` : ''}</div>`;
  }
  return h + `<div class="tl-end" style="left:${W}px"></div>`;
}
export function renderTimeline() {
  const W = doc.dur * S.pps,
    LW = W + 48,
    list = treeRows()
      .map(r => r[0])
      .filter(isAnim);
  let h = `<div class="tl-row tl-ruler"><div class="tl-name">Animated layers</div><div class="tl-lane" id="ruler" style="width:${LW}px">${ticks(W)}</div></div>`;
  if (!list.length)
    h += `<div class="tl-empty">Layers with keyframes appear here. Select a layer, move the playhead, then change it with Auto-key on, or click ◆ beside a property in the inspector.</div>`;
  for (const l of list) {
    const tracks = PORDER.filter(k => l.t[k] && l.t[k].length),
      ex = S.exp[l.id] !== false;
    const times = [...new Set<any>(tracks.flatMap(k => l.t[k].map(q => q[0])))],
      par = l.parent && layerById(l.parent);
    h += `<div class="tl-row tl-layer${S.selSet.has(l.id) ? ' sel' : ''}${isHidden(l) ? ' hid' : ''}" data-lid="${l.id}">
      <div class="tl-name"><button class="tl-ic" data-act="exp" aria-label="${ex ? 'Hide' : 'Show'} animators">${ex ? ICON.down : ICON.right}</button>
      ${
        par
          ? `<span class="tl-path" title="${esc(
              ancestors(l)
                .reverse()
                .map(a => a.name)
                .join(' › '),
            )}">${esc(par.name)} ›</span>`
          : ''
      }
      <span class="tl-lname" data-act="sel" title="Double-click to rename">${esc(l.name)}</span><span class="tl-type">${l.type}</span></div>
      <div class="tl-lane" data-act="lane" style="width:${LW}px"><div class="tl-bar" style="width:${W}px"></div>${times
        .map(t => {
          const kat = tracks.flatMap(k => l.t[k].filter(q => Math.abs(q[0] - t) < 0.004));
          return `<button class="sdot${kat.length && kat.every(q => S.keys.has(q)) ? ' sel' : ''}" data-lid="${l.id}" data-t="${t}" style="left:${t * S.pps}px" aria-label="All ${esc(l.name)} keyframes at ${fmt(t)}s" title="${fmt(t)}s · all keyframes"></button>`;
        })
        .join('')}</div></div>`;
    if (ex)
      for (const k of tracks) {
        const tr = l.t[k];
        let segs = '',
          keys = '';
        for (let i = 0; i < tr.length; i++) {
          const q = tr[i],
            nx = tr[i + 1];
          if (nx && JSON.stringify(q[1]) !== JSON.stringify(nx[1]))
            segs += `<i class="seg${q[2] === 'hold' ? ' hold' : ''}" data-lid="${l.id}" data-prop="${k}" data-i="${i}" style="left:${q[0] * S.pps}px;width:${(nx[0] - q[0]) * S.pps}px" title="${esc(easeLabel(q[2]))} · click to edit easing"></i>`;
          keys += `<button class="kf${S.keys.has(q) ? ' sel' : ''}${q[2] === 'hold' ? ' hold' : ''}" data-lid="${l.id}" data-prop="${k}" data-i="${i}" style="left:${q[0] * S.pps}px" aria-label="${PROPS[k][0]} keyframe at ${fmt(q[0])}s" title="${PROPS[k][0]} · ${fmt(q[0])}s · ${esc(easeLabel(q[2]))}"></button>`;
        }
        h += `<div class="tl-row tl-prop" data-lid="${l.id}" data-prop="${k}"><div class="tl-name"><span class="tl-pname">${PROPS[k][0]}</span>
        <button class="kb" data-act="key" aria-label="Add or remove ${PROPS[k][0]} keyframe at playhead"></button>
        <button class="tl-ic tl-x" data-act="rmtrack" aria-label="Remove ${PROPS[k][0]} animation">${ICON.x}</button></div>
        <div class="tl-lane" data-act="lane" style="width:${LW}px">${segs}${keys}</div></div>`;
      }
  }
  TLB.innerHTML = h + '<div class="tl-ph" id="playhead"></div>';
  TLB.querySelectorAll('.kf,.seg').forEach(el => {
    const l = layerById(el.dataset.lid);
    el._k = l.t[el.dataset.prop][+el.dataset.i];
  });
  TLB.querySelectorAll('.sdot').forEach(el => {
    const l = layerById(el.dataset.lid),
      t = +el.dataset.t;
    el._ks = Object.values<any>(l.t).flatMap(tr => tr.filter(q => Math.abs(q[0] - t) < 0.004));
  });
  updatePlayhead();
}
export function updatePlayhead() {
  const ph = $('#playhead');
  if (!ph) return;
  const x = tln() + S.time * S.pps;
  ph.style.left = x + 'px';
  ph.style.visibility = x - TLS.scrollLeft < tln() - 1 ? 'hidden' : 'visible';
  TLB.querySelectorAll('.tl-prop').forEach(r => {
    const l = layerById(r.dataset.lid),
      tr = l && l.t[r.dataset.prop];
    const b = r.querySelector('.kb');
    if (b && tr) {
      b.classList.add('has');
      b.classList.toggle(
        'on',
        tr.some(q => Math.abs(q[0] - S.time) < 0.005),
      );
    }
  });
  if (S.playing) {
    const vx = x - TLS.scrollLeft;
    if (vx > TLS.clientWidth - 30) TLS.scrollLeft = x - tln() - 20;
    else if (vx < tln()) TLS.scrollLeft = Math.max(0, x - tln() - 20);
  }
}
export function laneTime(e?, lane?) {
  const r = lane.getBoundingClientRect();
  return clamp((e.clientX - r.left) / S.pps, 0, doc.dur);
}
export function dragWin(move?, up?) {
  const mv = e => move(e),
    u = e => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', u);
      window.removeEventListener('pointercancel', u);
      if (up) up(e);
    };
  window.addEventListener('pointermove', mv);
  window.addEventListener('pointerup', u);
  window.addEventListener('pointercancel', u);
}
export function selectKeyLayer(id?) {
  if (S.sel !== id) {
    S.sel = id;
    S.selSet = new Set<any>([id]);
    S.node = null;
  }
}
export interface KeyOwner {
  l: Layer;
  k: PropKey;
  tr: Keyframe[];
}
export function keyOwners(): Map<Keyframe, KeyOwner> {
  const m = new Map<Keyframe, KeyOwner>();
  doc.layers.forEach(l => {
    for (const k in l.t) (l.t[k] || []).forEach(q => m.set(q, { l, k: k as PropKey, tr: l.t[k] }));
  });
  return m;
}
export const FRAME = 1 / 30;
export function snapT(t?, excl?) {
  let best = null,
    bd = 7 / S.pps;
  const cand = [S.time, 0, doc.dur];
  doc.layers.forEach(l => {
    for (const k in l.t)
      l.t[k].forEach(q => {
        if (!excl.has(q)) cand.push(q[0]);
      });
  });
  cand.forEach(c => {
    const d = Math.abs(c - t);
    if (d < bd) {
      bd = d;
      best = c;
    }
  });
  return best != null ? best : Math.round(t * 20) / 20;
}
export const TIP = $('#tltip');
export const MARQ = $('#tlmarq');
export const MENU: any = $('#ctxmenu');
export function showTip(ev?, txt?) {
  TIP.textContent = txt;
  TIP.hidden = false;
  TIP.style.left = Math.min(ev.clientX + 14, innerWidth - 200) + 'px';
  TIP.style.top = Math.max(4, ev.clientY - 32) + 'px';
}
export function resolveCollisions() {
  doc.layers.forEach(l => {
    for (const k in l.t) {
      const tr = l.t[k];
      sortTrack(tr);
      for (let i = tr.length - 1; i > 0; i--) {
        if (Math.abs(tr[i][0] - tr[i - 1][0]) < 0.004) {
          const drop = S.keys.has(tr[i]) && !S.keys.has(tr[i - 1]) ? i - 1 : i;
          S.keys.delete(tr[drop]);
          tr.splice(drop, 1);
        }
      }
    }
  });
}
export function keyDrag(e?, grab?) {
  const x0 = e.clientX,
    dupMode = e.ctrlKey || e.metaKey,
    ed = beginEdit();
  let moved = false,
    items = null,
    g = grab,
    gT0 = grab[0],
    tMin = 0,
    tMax = 0,
    anchor = 0;
  dragWin(
    ev => {
      const dx = ev.clientX - x0;
      if (!moved) {
        if (Math.abs(dx) < 3) return;
        moved = true;
        if (dupMode) {
          const ow = keyOwners(),
            ns = new Set<any>();
          [...S.keys].forEach(q => {
            const o = ow.get(q);
            if (!o) return;
            const c = clone(q);
            o.tr.push(c);
            ns.add(c);
            if (q === g) g = c;
          });
          S.keys = ns;
          renderTimeline();
        }
        items = [...S.keys].map(q => ({ q, t0: q[0] }));
        const ts = items.map(i => i.t0);
        tMin = Math.min(...ts);
        tMax = Math.max(...ts);
        gT0 = g[0];
        anchor = Math.abs(gT0 - tMin) < 1e-6 && tMax > tMin ? tMax : tMin;
      }
      const snap = S.snap !== ev.shiftKey;
      let tg = gT0 + dx / S.pps;
      tg = snap ? snapT(tg, S.keys) : Math.round(tg * 100) / 100;
      if (ev.altKey && tMax > tMin && Math.abs(gT0 - anchor) > 1e-6) {
        let f = (tg - anchor) / (gT0 - anchor);
        if (!isFinite(f)) f = 1;
        f = Math.max(0.02, f);
        items.forEach(i => {
          i.q[0] = r3(clamp(anchor + (i.t0 - anchor) * f, 0, doc.dur));
        });
        showTip(ev, `Stretch ×${f.toFixed(2)} · span ${fmt((tMax - tMin) * f)}s`);
      } else {
        const d = clamp(tg - gT0, -tMin, doc.dur - tMax);
        items.forEach(i => {
          i.q[0] = r3(i.t0 + d);
        });
        showTip(
          ev,
          `${fmt(g[0])}s  ${d >= 0 ? '+' : '−'}${fmt(Math.abs(d))}s${dupMode ? ' · copy' : ''}${snap ? '' : ' · free'}`,
        );
      }
      TLB.querySelectorAll('.kf').forEach(el => {
        el.style.left = el._k[0] * S.pps + 'px';
      });
      doc.layers.forEach(L => Object.values<any>(L.t).forEach(sortTrack));
      frame();
    },
    () => {
      TIP.hidden = true;
      if (moved) resolveCollisions();
      else {
        S.time = g[0];
        S.ptime = S.time;
      }
      doc.layers.forEach(L => Object.values<any>(L.t).forEach(sortTrack));
      ed.end({ insp: true });
    },
  );
}
export function marquee(e?, lane?) {
  const x0 = e.clientX,
    y0 = e.clientY,
    add = e.shiftKey || e.ctrlKey || e.metaKey,
    base = new Set<any>(add ? S.keys : []);
  let moved = false;
  const hit = (el, L, T, R, B) => {
    const r = el.getBoundingClientRect();
    return r.right >= L && r.left <= R && r.bottom >= T && r.top <= B;
  };
  dragWin(
    ev => {
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
      moved = true;
      const L = Math.min(x0, ev.clientX),
        T = Math.min(y0, ev.clientY),
        R = Math.max(x0, ev.clientX),
        B = Math.max(y0, ev.clientY);
      Object.assign(MARQ.style, { left: L + 'px', top: T + 'px', width: R - L + 'px', height: B - T + 'px' });
      MARQ.hidden = false;
      const sel = new Set<any>(base);
      TLB.querySelectorAll('.kf').forEach(el => {
        if (hit(el, L, T, R, B)) sel.add(el._k);
      });
      TLB.querySelectorAll('.sdot').forEach(el => {
        if (hit(el, L, T, R, B)) el._ks.forEach(q => sel.add(q));
      });
      S.keys = sel;
      TLB.querySelectorAll('.kf').forEach(el => el.classList.toggle('sel', sel.has(el._k)));
      TLB.querySelectorAll('.sdot').forEach(el =>
        el.classList.toggle('sel', el._ks.length > 0 && el._ks.every(q => sel.has(q))),
      );
      showTip(ev, `${sel.size} keyframe${sel.size === 1 ? '' : 's'}`);
    },
    ev => {
      MARQ.hidden = true;
      TIP.hidden = true;
      if (!moved) {
        if (!add) S.keys.clear();
        const row = lane.closest('[data-lid]');
        if (row) selectKeyLayer(row.dataset.lid);
        S.time = clamp(r3(laneTime(ev, lane)), 0, doc.dur);
        S.ptime = S.time;
      } else {
        const ow = keyOwners(),
          first = [...S.keys][0];
        if (first && ow.get(first)) selectKeyLayer(ow.get(first).l.id);
      }
      renderLayers();
      renderTimeline();
      renderInspector();
      frame();
    },
  );
}

export function init(): void {
  TLS.addEventListener('scroll', () => updatePlayhead());
  TLB.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    closeMenu();
    const seg = (e.target as any).closest('.seg');
    if (seg) {
      e.preventDefault();
      if (!(e.shiftKey || e.ctrlKey || e.metaKey)) S.keys.clear();
      S.keys.add(seg._k);
      selectKeyLayer(seg.dataset.lid);
      renderLayers();
      renderTimeline();
      renderInspector();
      frame();
      return;
    }
    const kf = (e.target as any).closest('.kf, .sdot');
    if (kf) {
      e.preventDefault();
      const ks = kf._ks || [kf._k],
        allIn = ks.length > 0 && ks.every(q => S.keys.has(q));
      if (e.shiftKey) {
        ks.forEach(q => (allIn ? S.keys.delete(q) : S.keys.add(q)));
      } else if (!allIn) {
        if (!(e.ctrlKey || e.metaKey)) S.keys.clear();
        ks.forEach(q => S.keys.add(q));
      }
      selectKeyLayer(kf.dataset.lid);
      TLB.querySelectorAll('.kf').forEach(el => el.classList.toggle('sel', S.keys.has(el._k)));
      if (!S.keys.size || (e.shiftKey && allIn)) {
        renderTimeline();
        renderInspector();
        frame();
        return;
      }
      keyDrag(e, S.keys.has(ks[0]) ? ks[0] : [...S.keys][0]);
      return;
    }
    const ruler = (e.target as any).closest('#ruler');
    if (ruler) {
      e.preventDefault();
      setTime(laneTime(e, ruler));
      dragWin(ev => setTime(laneTime(ev, ruler)));
      return;
    }
    const lane = (e.target as any).closest('[data-act="lane"]');
    if (lane) {
      e.preventDefault();
      marquee(e, lane);
    }
  });
}
