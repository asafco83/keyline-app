// SVGcinema — render/stage
import { bgPaint } from '../model/background';
import type { Layer } from '../model/types';
import { $, H, byId, r2 } from '../core/constants';
import { ART, CONTENT, STAGE, WRAP } from '../core/dom';
import { ASSETS, S, URLS, doc, eng, setEng } from '../core/state';
import { renderAssets } from '../io/assets';
import { ancestors, isBox, visibleLayers } from '../model/tree';
import { markup } from './markup';
import { drawOverlay } from './overlay';
import { CinEngine } from '../runtime/engine';
import { refreshInspector, renderInspector } from '../ui/inspector';
import { renderLayers } from '../ui/layers-panel';
import { renderTimeline, updatePlayhead } from '../ui/timeline';
import { renderTools } from '../ui/tools-rail';
import { restPoseView } from '../tools/bone-edit';

export function renderStage() {
  STAGE.setAttribute('viewBox', `${doc.vx || 0} ${doc.vy || 0} ${doc.w} ${doc.h}`);
  $('#docdefs').innerHTML = doc.defs || '';
  const bg = $('#bgrect');
  bg.setAttribute('x', doc.vx || 0);
  bg.setAttribute('y', doc.vy || 0);
  bg.setAttribute('width', doc.w);
  bg.setAttribute('height', doc.h);
  const paint = bgPaint(doc);
  bg.setAttribute('fill', paint.alpha > 0 ? paint.color : 'none');
  if (paint.alpha > 0 && paint.alpha < 1) bg.setAttribute('fill-opacity', String(paint.alpha));
  else bg.removeAttribute('fill-opacity');
  const ab = $('#abrect');
  ab.setAttribute('x', doc.vx || 0);
  ab.setAttribute('y', doc.vy || 0);
  ab.setAttribute('width', doc.w);
  ab.setAttribute('height', doc.h);
  ART.classList.toggle('clear', paint.alpha < 1);
  pinRestView();
  CONTENT.innerHTML = markup(doc.layers, null, {
    pre: 'e-',
    editor: true,
    t: S.time,
    href: (id: string) => URLS[id] || (ASSETS[id] && ASSETS[id].data) || '',
  });
  const vis = visibleLayers();
  setEng(CinEngine({ p: 'e-', L: vis, dur: doc.dur }, CONTENT));
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
/** Zoom limits for the work area (screen px per document unit). */
export const MIN_SCALE = 0.02,
  MAX_SCALE = 32;
/** The scale at which the whole artboard fits the work area. */
export function fitScale() {
  const r = WRAP.getBoundingClientRect();
  return Math.max(1e-3, Math.min((r.width - 64) / doc.w, (r.height - 64) / doc.h));
}
export function fit() {
  const r = WRAP.getBoundingClientRect();
  if (!r.width) return;
  S.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fitScale() * S.zoom));
  ART.style.width = doc.w * S.scale + 'px';
  ART.style.height = doc.h * S.scale + 'px';
  ART.style.marginLeft = (-doc.w * S.scale) / 2 + 'px';
  ART.style.marginTop = (-doc.h * S.scale) / 2 + 'px';
  $('#zValT').textContent = Math.round(S.scale * 100) + '%';
  artLabel();
}
/** The project name and canvas size shown above the artboard. */
export function artLabel(name: string = doc.name) {
  $('#abName').textContent = name || 'Untitled animation';
  $('#abSize').textContent = `${r2(doc.w)} × ${r2(doc.h)}`;
}
/** the Edit pins and Edit nodes tools show pinned paths unbent (their rest shape) */
export function pinRestView() {
  const on = S.tool === 'pinedit' || S.tool === 'node';
  H.restPins(on);
  if (eng) eng.restPins(on);
}
export function frame() {
  pinRestView();
  if (eng) eng.apply(S.time);
  restPoseView();
  drawOverlay();
  updatePlayhead();
  refreshInspector();
  $('#tc').textContent = tc(S.time);
  $('#tcTot').textContent = '/ ' + tc(doc.dur);
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
