// Keyline — ui/easing
import { $, EZFAM, H, clamp, clone, esc, fmt, r2, r3 } from '../core/constants';
import { beginEdit } from '../core/history';
import { S, doc } from '../core/state';
import { nrow } from './inspector';

export function easeLabel(e?) {
  if (Array.isArray(e)) return 'cubic-bezier(' + e.map(v => r3(v)).join(', ') + ')';
  const m = { linear: 'Linear', ease: 'Ease', in: 'Ease in', out: 'Ease out', inOut: 'Ease in-out', hold: 'Hold' };
  if (!e) return 'Ease';
  if (m[e]) return m[e];
  const q = /^(inOut|in|out)([A-Z]\w*)$/.exec(e);
  if (q) return q[2] + ' ' + { in: 'in', out: 'out', inOut: 'in-out' }[q[1]];
  return e;
}
export function easeDir(e?) {
  if (typeof e !== 'string') return S.ezDir;
  if (e === 'in' || e === 'out' || e === 'inOut') return e;
  const q = /^(inOut|in|out)[A-Z]/.exec(e);
  return q ? q[1] : S.ezDir;
}
export function easeFam(e?) {
  if (Array.isArray(e)) return 'custom';
  if (e === 'in' || e === 'out' || e === 'inOut') return 'Standard';
  const q = /^(?:inOut|in|out)([A-Z]\w*)$/.exec(e || '');
  return q ? q[1] : e || 'ease';
}
export function famName(f?, dir?) {
  return f === 'Standard' ? dir : dir + f;
}
export function bezOf(e?) {
  return Array.isArray(e) ? e : !e ? H.EZ.ease : e === 'linear' ? [0, 0, 1, 1] : H.EZ[e] || null;
}
export function sameEase(a?, b?) {
  return JSON.stringify(a || 'ease') === JSON.stringify(b || 'ease');
}
export function thumb(e?) {
  let d = '';
  for (let i = 0; i <= 40; i++) {
    const p = i / 40,
      v = clamp(H.ease(e, p), -0.45, 1.45);
    d += (i ? 'L' : 'M') + r2(3 + p * 34) + ' ' + r2(21 - v * 16);
  }
  return `<svg viewBox="0 -2 40 30" aria-hidden="true"><path d="${d}"/></svg>`;
}
export function EZX(x?) {
  return 20 + x * 200;
}
export function EZY(v?) {
  return 190 - (v + 0.5) * 90;
}
export function keyPanel() {
  const ks = [...S.keys],
    k0 = ks[0],
    cur = k0[2] || 'ease';
  S.ezDir = easeDir(cur);
  const allSame = ks.every(k => sameEase(k[2], cur)),
    dir = S.ezDir;
  const tile = (e, label, extra?) =>
    `<button class="ezb${allSame && sameEase(e, cur) ? ' on' : ''}" data-ez="${esc(JSON.stringify(e))}" title="${esc(easeLabel(e))}"${extra || ''}>${thumb(e)}<span>${esc(label)}</span></button>`;
  let grid = tile('linear', 'Linear') + tile('ease', 'Ease') + tile('hold', 'Hold');
  EZFAM.forEach(f => {
    grid += tile(famName(f, dir), f === 'Standard' ? 'Basic' : f);
  });
  const pre = doc.ezPresets || [];
  pre.forEach((p, i) => {
    grid += tile(p.v, p.name, ` data-ezp="${i}"`);
  });
  const isPreset = pre.some(p => sameEase(p.v, cur));
  if (Array.isArray(cur) && !isPreset)
    grid += `<button class="ezb on" data-ez="${esc(JSON.stringify(cur))}" title="${esc(easeLabel(cur))}">${thumb(cur)}<span>Custom</span></button>`;
  const lines =
    [0, 1].map(v => `<line class="gb" x1="20" x2="220" y1="${EZY(v)}" y2="${EZY(v)}"/>`).join('') +
    [0, 0.25, 0.5, 0.75, 1].map(x => `<line class="gl" x1="${EZX(x)}" x2="${EZX(x)}" y1="10" y2="190"/>`).join('');
  return `<section class="sec" id="kfsec"><h3>${ks.length > 1 ? `${ks.length} keyframes` : 'Keyframe'} <small>easing to the next key</small></h3>
    ${ks.length === 1 ? nrow('Time', `<label class="nf"><span>t</span><input id="kf-time" inputmode="decimal" value="${fmt(k0[0])}"><em>s</em></label>`) : ''}
    ${nrow(
      'Direction',
      `<div class="segc" id="ezDir" style="flex:1">${[
        ['in', 'In'],
        ['out', 'Out'],
        ['inOut', 'In-Out'],
      ]
        .map(d => `<button data-v="${d[0]}" class="${dir === d[0] ? 'on' : ''}">${d[1]}</button>`)
        .join('')}</div>`,
    )}
    <div class="ezfam" id="ezGrid">${grid}</div>
    <svg class="ezed" id="ezEd" viewBox="0 0 240 200" role="img" aria-label="Easing curve editor. Drag the two handles to make a custom curve.">${lines}
      <text x="24" y="${EZY(1) - 4}">1</text><text x="24" y="${EZY(0) + 12}">0</text><text x="${EZX(1) - 18}" y="${EZY(0) + 12}">time</text>
      <line class="arm" id="ezA0"/><line class="arm" id="ezA1"/><path class="cv" id="ezCurve"/>
      <circle class="end" cx="${EZX(0)}" cy="${EZY(0)}" r="3"/><circle class="end" cx="${EZX(1)}" cy="${EZY(1)}" r="3"/>
      <circle class="hd" id="ezH0" data-hd="0" r="7"/><circle class="hd" id="ezH1" data-hd="1" r="7"/></svg>
    <div class="ezrow">${['x1', 'y1', 'x2', 'y2'].map((n, i) => `<label class="nf"><span>${n}</span><input id="ez-${i}" data-ezv="${i}" inputmode="decimal"></label>`).join('')}</div>
    <input class="txt mono" id="ezCss" spellcheck="false" placeholder="Paste cubic-bezier(.17,.67,.83,.67)" aria-label="CSS cubic-bezier value">
    <p>Drag to move · Alt+drag to stretch · Ctrl+drag to copy · right-click for more.</p>
    <div class="btns">${Array.isArray(cur) && !isPreset ? '<button class="btn" data-act="ezsave">Save as preset</button>' : ''}
      ${isPreset ? '<button class="btn" data-act="ezdelp">Remove preset</button>' : ''}
      <button class="btn" data-act="ezall">Use on whole animator</button><button class="btn danger" data-act="kdel">Delete key${ks.length > 1 ? 's' : ''}</button></div></section>`;
}
export function drawEz() {
  const k0 = [...S.keys][0];
  if (!k0 || !$('#ezEd')) return;
  const e = k0[2] || 'ease',
    bz = bezOf(e);
  let d = '';
  for (let i = 0; i <= 100; i++) {
    const p = i / 100;
    d += (i ? 'L' : 'M') + r2(EZX(p)) + ' ' + r2(EZY(clamp(H.ease(e, p), -0.5, 1.5)));
  }
  $('#ezCurve').setAttribute('d', d);
  const b = bz || [0.25, 0.1, 0.25, 1],
    P1 = [EZX(b[0]), EZY(b[1])],
    P2 = [EZX(b[2]), EZY(b[3])];
  const A0 = $('#ezA0'),
    A1 = $('#ezA1'),
    H0 = $('#ezH0'),
    H1 = $('#ezH1');
  [
    ['x1', EZX(0)],
    ['y1', EZY(0)],
    ['x2', P1[0]],
    ['y2', P1[1]],
  ].forEach(([k, v]) => A0.setAttribute(k, v));
  [
    ['x1', EZX(1)],
    ['y1', EZY(1)],
    ['x2', P2[0]],
    ['y2', P2[1]],
  ].forEach(([k, v]) => A1.setAttribute(k, v));
  H0.setAttribute('cx', P1[0]);
  H0.setAttribute('cy', P1[1]);
  H1.setAttribute('cx', P2[0]);
  H1.setAttribute('cy', P2[1]);
  [A0, A1, H0, H1].forEach(x => x.classList.toggle('dim', !bz));
  for (let i = 0; i < 4; i++) {
    const inp = $('#ez-' + i);
    if (inp !== document.activeElement) inp.value = bz ? fmt(b[i], 3) : '';
  }
  const css = $('#ezCss');
  if (css !== document.activeElement) css.value = bz ? `cubic-bezier(${b.map(v => r3(v)).join(', ')})` : '';
}
export function applyEase(v?) {
  const ed = beginEdit();
  S.keys.forEach(k => (k[2] = clone(v)));
  ed.end({ insp: true });
}
export const CSSKW = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
};
export function parseBez(s?) {
  s = String(s || '')
    .trim()
    .toLowerCase();
  if (CSSKW[s]) return CSSKW[s].slice();
  const n = (s.match(/-?\d*\.?\d+(e-?\d+)?/g) || []).map(parseFloat);
  if (n.length !== 4 || !n.every(isFinite)) return null;
  n[0] = clamp(n[0], 0, 1);
  n[2] = clamp(n[2], 0, 1);
  n[1] = clamp(n[1], -2, 3);
  n[3] = clamp(n[3], -2, 3);
  return n.map(r3);
}
