// Keyline — export/size
import { $, clamp, fmt, ic } from '../core/constants';
import { save } from '../core/history';
import { ASSETS, doc } from '../core/state';
import { setOpts } from './dialog';
import { ENC, updateExport } from './images';
import { renderSnippet } from './snippets';
import { isHidden } from '../model/tree';

export function outDims() {
  const ex = doc.ex;
  if (ex.size !== 'fixed') return [doc.w, doc.h];
  return [Math.max(1, Math.round(ex.w || doc.w)), Math.max(1, Math.round(ex.h || doc.h))];
}
export function exportPxScale() {
  const ex = doc.ex;
  if (ex.size === 'fixed') {
    const [w, h] = outDims();
    return Math.min(w / doc.w, h / doc.h);
  }
  return (ex.maxW > 0 ? ex.maxW : doc.w) / doc.w;
}
export const LINK_ON = ic(
  '<path d="M9 15l6-6M10 6.5l1.5-1.5a4 4 0 015.7 5.7L15.7 12M8.3 12l-1.5 1.5a4 4 0 005.7 5.7L14 17.5"/>',
);
export const LINK_OFF = ic(
  '<path d="M10 6.5l1.5-1.5a4 4 0 015.7 5.7L15.7 12M8.3 12l-1.5 1.5a4 4 0 005.7 5.7L14 17.5M4 4l16 16" opacity=".8"/>',
);
export function usedImageIds() {
  return [
    ...new Set<any>(
      doc.layers.filter(l => l.type === 'image' && !isHidden(l) && ASSETS[l.geo.asset]).map(l => l.geo.asset),
    ),
  ];
}
export function syncSizeUI() {
  const ex = doc.ex,
    fixed = ex.size === 'fixed',
    [w, h] = outDims(),
    hasImg = usedImageIds().length > 0,
    set = (id, v) => {
      const e = $('#' + id);
      if (e !== document.activeElement) e.value = v;
    };
  $('#xDimRow').hidden = !fixed;
  $('#xPctRow').hidden = !fixed;
  $('#xMaxRow').hidden = fixed || !hasImg;
  set('xW', w);
  set('xH', h);
  set('xPct', fmt((w / doc.w) * 100, 1));
  set('xMaxW', ex.maxW > 0 ? ex.maxW : doc.w);
  const lk = $('#xLink');
  lk.innerHTML = ex.lock !== false ? LINK_ON : LINK_OFF;
  lk.classList.toggle('on', ex.lock !== false);
  lk.setAttribute('aria-pressed', String(ex.lock !== false));
  const anyImg = Object.values<any>(ASSETS).some(a => a.kind === 'image');
  $('#xImgGrp').hidden = !hasImg && !anyImg;
  $('#xImgNone').hidden = hasImg;
  ['xOptRow', 'xFmtRow', 'xQRow', 'xHiRow', 'xImgDet'].forEach(id => {
    const e = $('#' + id);
    if (e && !hasImg) e.hidden = true;
  });
  if (hasImg) {
    $('#xOptRow').hidden = false;
    $('#xOpt').checked = ex.opt !== false;
    const on = ex.opt !== false;
    setOpts(
      $('#xFmt'),
      [
        ['auto', 'Smallest file (automatic)'],
        ENC.webp && ['webp', 'WebP'],
        ENC.avif && ['avif', 'AVIF'],
        ['jpeg', 'JPEG (no transparency)'],
        ['png', 'PNG (lossless)'],
        ['keep', 'Keep original format'],
      ].filter(Boolean),
      ex.fmt || 'auto',
    );
    if ($('#xFmt').value !== ex.fmt) ex.fmt = $('#xFmt').value;
    $('#xFmtRow').hidden = !on;
    $('#xHiRow').hidden = !on;
    $('#xImgDet').hidden = !on;
    $('#xQRow').hidden = !on || ex.fmt === 'png';
    $('#xQ').value = ex.q || 82;
    $('#xQv').textContent = (ex.q || 82) + '%';
    $('#xHi').checked = ex.hi !== false;
  }
}
export function setDims(w?, h?) {
  const ex = doc.ex;
  ex.w = clamp(Math.round(w) || doc.w, 1, 20000);
  ex.h = clamp(Math.round(h) || doc.h, 1, 20000);
  save();
  syncSizeUI();
  renderSnippet();
  updateExport();
}
export let dimT = 0;

export function init(): void {
  $('#xW').addEventListener('change', e => {
    const v = parseFloat((e.target as any).value);
    if (!(v > 0)) return syncSizeUI();
    const [, h] = outDims();
    setDims(v, doc.ex.lock !== false ? (v * doc.h) / doc.w : h);
  });
  $('#xH').addEventListener('change', e => {
    const v = parseFloat((e.target as any).value);
    if (!(v > 0)) return syncSizeUI();
    const [w] = outDims();
    setDims(doc.ex.lock !== false ? (v * doc.w) / doc.h : w, v);
  });
  $('#xPct').addEventListener('change', e => {
    const v = parseFloat((e.target as any).value);
    if (!(v > 0)) return syncSizeUI();
    setDims((doc.w * v) / 100, (doc.h * v) / 100);
  });
  $('#xPreset').addEventListener('change', e => {
    const v = parseFloat((e.target as any).value);
    (e.target as any).value = '';
    if (v > 0) setDims((doc.w * v) / 100, (doc.h * v) / 100);
  });
  $('#xLink').addEventListener('click', () => {
    const ex = doc.ex;
    ex.lock = ex.lock === false;
    if (ex.lock) {
      const [w] = outDims();
      setDims(w, (w * doc.h) / doc.w);
    } else {
      save();
      syncSizeUI();
    }
  });
  ['xW', 'xH', 'xPct', 'xMaxW'].forEach(id =>
    $('#' + id).addEventListener('input', e => {
      clearTimeout(dimT);
      dimT = setTimeout(() => (e.target as any).dispatchEvent(new Event('change')), 450);
    }),
  );
  $('#xMaxW').addEventListener('change', e => {
    const v = parseFloat((e.target as any).value);
    doc.ex.maxW = v > 0 ? Math.round(clamp(v, 16, 20000)) : 0;
    save();
    syncSizeUI();
    updateExport();
  });
  $('#xOpt').addEventListener('change', e => {
    doc.ex.opt = (e.target as any).checked;
    save();
    syncSizeUI();
    updateExport();
  });
  $('#xFmt').addEventListener('change', e => {
    doc.ex.fmt = (e.target as any).value;
    save();
    syncSizeUI();
    updateExport();
  });
  $('#xQ').addEventListener('input', e => {
    $('#xQv').textContent = (e.target as any).value + '%';
  });
  $('#xQ').addEventListener('change', e => {
    doc.ex.q = parseInt((e.target as any).value) || 82;
    save();
    updateExport();
  });
  $('#xHi').addEventListener('change', e => {
    doc.ex.hi = (e.target as any).checked;
    save();
    updateExport();
  });
}
