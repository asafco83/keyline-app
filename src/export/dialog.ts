// SVGcinema — export/dialog
import { facesFor, isLocalFamily, isRTL, webFont } from '../render/fonts';
import { $, fmt } from '../core/constants';
import { doc } from '../core/state';
import { syncSizeUI } from './size';
import { renderSnippet } from './snippets';

export const XTRIG = [
  ['load', 'On load'],
  ['hover', 'On mouse over'],
  ['click', 'On click'],
  ['scroll', 'On scroll into view'],
  ['api', 'Programmatic'],
];
export const XOUT = [
  ['pause', 'Pause'],
  ['reverse', 'Reverse back to start'],
  ['start', 'Jump to start'],
  ['restart', 'Restart'],
  ['none', 'Keep playing'],
];
export function setOpts(sel: HTMLSelectElement, list: string[][], val: string) {
  sel.innerHTML = list.map(o => `<option value="${o[0]}">${o[1]}</option>`).join('');
  sel.value = list.some(o => o[0] === val) ? val : list[0][0];
}
export function syncExportUI() {
  const ex = doc.ex,
    css = ex.mode === 'css';
  if (css && ['click', 'scroll', 'api'].includes(ex.trigger)) ex.trigger = 'load';
  $('#xMode')
    .querySelectorAll('button')
    .forEach((b: HTMLElement) => b.classList.toggle('on', b.dataset.v === ex.mode));
  $('#xSize')
    .querySelectorAll('button')
    .forEach((b: HTMLElement) => b.classList.toggle('on', b.dataset.v === (ex.size || 'resp')));
  syncSizeUI();
  const wf = doc.layers.filter(
      l => l.type === 'text' && !l.hid && (webFont(l.geo.family) || isLocalFamily(l.geo.family)),
    ),
    fm = ex.fonts === 'embed' ? 'embed' : 'outline';
  $('#xFontRow').hidden = !wf.length;
  $('#xFonts')
    .querySelectorAll('button')
    .forEach((b: HTMLElement) => b.classList.toggle('on', b.dataset.v === fm));
  const rtl = fm === 'outline' && wf.some(l => isRTL(l.geo.text));
  const missing = [
    ...new Set(wf.filter(l => isLocalFamily(l.geo.family) && !facesFor(l.geo).length).map(l => l.geo.family)),
  ];
  $('#xFontNote').hidden = !wf.length;
  $('#xFontNote').textContent =
    (fm === 'outline'
      ? 'Text is converted to shapes: it looks identical everywhere and needs no font download, but can’t be selected or read by screen readers.' +
        (rtl ? ' Right-to-left text is embedded instead, so it keeps its letter order.' : '')
      : 'The font files are embedded (only the alphabets your text uses). Text stays selectable; best for longer text.') +
    (missing.length
      ? ` ${missing.join(', ')} ${missing.length > 1 ? 'are fonts' : 'is a font'} on this computer that this page can't read yet: pick it again in the Font list (“Show fonts on this computer…”) to convert or embed it. Until then the SVG only names it, so it shows only where it's installed.`
      : '');
  $('#xIds')
    .querySelectorAll('button')
    .forEach((b: HTMLElement) => b.classList.toggle('on', b.dataset.v === (ex.ids || 'gen')));
  setOpts(
    $('#xTrig'),
    XTRIG.filter(o => !css || ['load', 'hover'].includes(o[0])),
    ex.trigger,
  );
  if (css && !['pause', 'start'].includes(ex.out)) ex.out = 'pause';
  setOpts(
    $('#xOut'),
    XOUT.filter(o => (css ? ['pause', 'start'].includes(o[0]) : ex.trigger === 'click' || o[0] !== 'restart')),
    ex.out,
  );
  if ($('#xOut').value !== ex.out) ex.out = $('#xOut').value;
  const showOut = css ? ex.trigger === 'hover' : ['hover', 'click', 'scroll'].includes(ex.trigger);
  $('#xOutRow').hidden = !showOut;
  $('#xOutLbl').textContent =
    ex.trigger === 'click' ? 'On second click' : ex.trigger === 'scroll' ? 'When scrolled away' : 'On mouse out';
  $('#xFpsRow').hidden = css;
  $('#xIt').value = String(doc.it || 0);
  $('#xDir').value = doc.dir || 'normal';
  $('#xFill').value = ex.fill || 'forwards';
  $('#xFps').value = String(ex.fps || 0);
  const sp = $('#xSpeed');
  if (sp !== document.activeElement) sp.value = fmt(ex.speed || 1);
  $('#xPre').value = ex.prefix;
  $('#xNote').innerHTML = !css
    ? 'The SVG carries a small built-in player that supports every animator and easing, including morph, curved paths and custom curves. Images are embedded in the file. Scripts run when the SVG is inline, or placed with <code>&lt;object&gt;</code> or <code>&lt;embed&gt;</code>; an <code>&lt;img&gt;</code> tag shows the first frame. The <b>Embed</b> tab has ready code for each framework.'
    : 'Pure CSS keyframes with no script, so it animates even inside <code>&lt;img&gt;</code> and as a CSS background. CSS can start on load or on hover only. On mouse out it can pause (and resume on the next hover) or jump to the start (and replay from the beginning on the next hover); reversing back needs the JavaScript export. Shape changes (morph) play with SMIL, so they work in every browser; with the hover trigger they use CSS <code>d: path()</code> instead, which Safari does not support.';
  renderSnippet();
}
