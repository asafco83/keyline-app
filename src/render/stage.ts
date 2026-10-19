// Keyline — render/stage
import type { Layer } from '../model/types';
import { $, byId, r2 } from '../core/constants';
import { ART, CONTENT, STAGE, WRAP } from '../core/dom';
import { ASSETS, S, URLS, doc, eng, setEng } from '../core/state';
import { renderAssets } from '../io/assets';
import { ancestors, isBox, visibleLayers } from '../model/tree';
import { markup } from './markup';
import { drawOverlay } from './overlay';
import { KLEngine } from '../runtime/engine';
import { refreshInspector, renderInspector } from '../ui/inspector';
import { renderLayers } from '../ui/layers-panel';
import { renderTimeline, updatePlayhead } from '../ui/timeline';
import { renderTools } from '../ui/tools-rail';

export function renderStage() {
  STAGE.setAttribute('viewBox', `${doc.vx || 0} ${doc.vy || 0} ${doc.w} ${doc.h}`);
  $('#docdefs').innerHTML = doc.defs || '';
  const bg = $('#bgrect');
  bg.setAttribute('x', doc.vx || 0);
  bg.setAttribute('y', doc.vy || 0);
  bg.setAttribute('width', doc.w);
  bg.setAttribute('height', doc.h);
  bg.setAttribute('fill', doc.bg || 'none');
  const ab = $('#abrect');
  ab.setAttribute('x', doc.vx || 0);
  ab.setAttribute('y', doc.vy || 0);
  ab.setAttribute('width', doc.w);
  ab.setAttribute('height', doc.h);
  ART.classList.toggle('clear', !doc.bg);
  CONTENT.innerHTML = markup(doc.layers, null, {
    pre: 'e-',
    editor: true,
    t: S.time,
    href: (id: string) => URLS[id] || (ASSETS[id] && ASSETS[id].data) || '',
  });
  const vis = visibleLayers();
  setEng(KLEngine({ p: 'e-', L: vis, dur: doc.dur }, CONTENT));
  const measure = (l: Layer) => {
    const g = byId('e-' + l.id);
    if (!g) return;
    try {
      const b = g.getBBox();
      l.o = [r2(b.x + b.width / 2), r2(b.y + b.height / 2)];
    } catch (e) {
      l.o = [0, 0];
    }
  };
  vis.forEach(l => {
    if (!l.o && !isBox(l)) measure(l);
  });
  const groups = vis.filter(l => !l.o && isBox(l)).sort((a, b) => ancestors(b).length - ancestors(a).length);
  if (groups.length) {
    eng.apply(S.time);
    groups.forEach(g => {
      measure(g);
      eng.apply(S.time);
    });
  }
  fit();
}
export function fit() {
  const r = WRAP.getBoundingClientRect();
  if (!r.width) return;
  const base = Math.min((r.width - 64) / doc.w, (r.height - 64) / doc.h);
  S.scale = Math.max(0.05, base * S.zoom);
  ART.style.width = doc.w * S.scale + 'px';
  ART.style.height = doc.h * S.scale + 'px';
  $('#zVal').textContent = Math.round(S.scale * 100) + '%';
}
export function frame() {
  if (eng) eng.apply(S.time);
  drawOverlay();
  updatePlayhead();
  refreshInspector();
  $('#tc').textContent = tc(S.time);
  const rec = S.autokey && S.time > 0.004;
  ART.classList.toggle('rec', rec);
  $('#recBadge').hidden = !rec;
}
export function tc(t: number) {
  return `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
}
export function renderAll() {
  renderStage();
  renderLayers();
  renderAssets();
  renderTimeline();
  renderInspector();
  renderTools();
  frame();
}
