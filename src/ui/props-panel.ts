// Keyline — ui/props-panel
// The SVGator-style property sections of the inspector: Transforms, Text, Text appearance, Fill & stroke,
// Appearance (compositing, line style, dashes) and Filters. Fields follow the inspector's conventions:
//   data-f="prop[:index[:multiplier]]"  animatable value (keyframe button = data-kb)
//   data-g="field"                      geometry (rect/ellipse/text…)
//   data-x="attr"                       static SVG attribute stored in Layer.extra
//   data-ly="field"                     layer setting (blend, iso)
//   data-tx="…" / data-act="…"          buttons
import type { Layer, PropKey } from '../model/types';
import { FONTS, ICON, byId, esc, fmt, ic, r2, valueAt } from '../core/constants';
import { INSP } from '../core/dom';
import { beginEdit, setProp } from '../core/history';
import { S } from '../core/state';
import { WEB_FONTS } from '../model/font-catalog';
import { pickWeight, webFont } from '../render/fonts';
import { FILTERS, addFilter, fxKey, removeFilter, syncFa } from '../model/filters';
import { H9 } from '../tools/edit-tools';
import { colf, krow, nrow, num } from './inspector';

const PAINTED = ['rect', 'ellipse', 'path', 'text'];
const I = {
  link: ic('<path d="M9 15l6-6M10 6.5l1.5-1.5a4 4 0 015.7 5.7L15.7 12M8.3 12l-1.5 1.5a4 4 0 005.7 5.7L14 17.5"/>'),
  pick: ic('<path d="M14.5 4.5l5 5M17 7l-9.5 9.5L5 19l2.5-2.5L17 7z"/><path d="M13 5.5l5.5 5.5"/>'),
  swap: ic('<path d="M7 4v13M4 14l3 3 3-3M17 20V7M14 10l3-3 3 3"/>'),
  alignL: ic('<path d="M4 5h16M4 10h10M4 15h16M4 20h10"/>'),
  alignC: ic('<path d="M4 5h16M7 10h10M4 15h16M7 20h10"/>'),
  alignR: ic('<path d="M4 5h16M10 10h10M4 15h16M10 20h10"/>'),
  keepW: ic('<path d="M4 5v14M20 5v14M7 12h10M10 9l-3 3 3 3M14 9l3 3-3 3"/>'),
  capButt: ic('<path d="M4 12h12" stroke-width="5" stroke-linecap="butt"/><path d="M16 6v12" stroke-width="1"/>'),
  capRound: ic('<path d="M4 12h10" stroke-width="5" stroke-linecap="round"/><path d="M16 6v12" stroke-width="1"/>'),
  capSquare: ic('<path d="M4 12h10" stroke-width="5" stroke-linecap="square"/><path d="M16 6v12" stroke-width="1"/>'),
  joinMiter: ic('<path d="M5 19V5h14" stroke-width="4" stroke-linejoin="miter" stroke-linecap="butt"/>'),
  joinRound: ic('<path d="M5 19V5h14" stroke-width="4" stroke-linejoin="round" stroke-linecap="butt"/>'),
  joinBevel: ic('<path d="M5 19V5h14" stroke-width="4" stroke-linejoin="bevel" stroke-linecap="butt"/>'),
  orient: ic('<path d="M4 19c2-8 7-12 14-13"/><path d="M14 3.5l4.5 2.5-2.5 4.5"/><circle cx="4" cy="19" r="1.5"/>'),
  up: ic('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  down: ic('<path d="M12 5v14M6 13l6 6 6-6"/>'),
};
const STYLES: Array<[string, string]> = [
  ['100', 'Thin'],
  ['200', 'Extra light'],
  ['300', 'Light'],
  ['400', 'Regular'],
  ['500', 'Medium'],
  ['600', 'Semibold'],
  ['700', 'Bold'],
  ['800', 'Extra bold'],
  ['900', 'Black'],
];
const BLENDS = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
];
const ORDERS: Array<[string, string]> = [
  ['', 'Fill, Stroke, Markers'],
  ['stroke', 'Stroke, Fill, Markers'],
  ['fill markers', 'Fill, Markers, Stroke'],
  ['markers', 'Markers, Fill, Stroke'],
  ['stroke markers', 'Stroke, Markers, Fill'],
  ['markers stroke', 'Markers, Stroke, Fill'],
];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');
const tbtn = (attr: string, val: string, on: boolean, icon: string, label: string) =>
  `<button class="btn ib tg${on ? ' on' : ''}" data-tx="${attr}" data-v="${val}" aria-pressed="${on}" title="${label}" aria-label="${label}">${icon}</button>`;
const sel = (attrs: string, opts: Array<[string, string]>, cur: string) =>
  `<select class="sel" ${attrs}>${opts.map(([v, t]) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;

/* ---------- Transforms ---------- */

function rotField(part: 'turn' | 'deg') {
  return `<label class="nf"><span data-scrub="rot"${part === 'turn' ? ' data-scrub-step="0.02"' : ''}>${part === 'turn' ? '⟳' : '∠'}</span><input id="rot-${part}" data-f="rot" data-rt="${part}" inputmode="decimal" spellcheck="false" aria-label="Rotate ${part === 'turn' ? 'turns' : 'degrees'}"><em>${part === 'turn' ? 'turn' : 'deg'}</em></label>`;
}
export function transformSection(l: Layer) {
  const bone = l.type === 'bone',
    onPath = !!(l.t.pos && l.t.pos.length > 1);
  return `<section class="sec"><h3>Transforms <small>◆ adds a keyframe</small></h3>
    ${krow('pos', 'Position', num('pos:0', 'X') + num('pos:1', 'Y'))}
    ${krow('scl', 'Scale', num('scl:0:100', 'W', '%') + num('scl:1:100', 'H', '%') + `<button class="btn ib tg${S.sclLock ? ' on' : ''}" data-act="scllock" aria-pressed="${!!S.sclLock}" title="Keep proportions" aria-label="Keep proportions">${I.link}</button>`)}
    ${bone ? '' : krow('skw', 'Skew', num('skw:0', 'X', '°') + num('skw:1', 'Y', '°'))}
    ${krow('rot', 'Rotate', rotField('turn') + rotField('deg') + (onPath ? `<button class="btn ib tg${l.or ? ' on' : ''}" data-act="orient" aria-pressed="${!!l.or}" title="Rotate along the motion path" aria-label="Rotate along the motion path">${I.orient}</button>` : ''))}
    ${bone ? '' : krow('org', 'Origin', num('org:0', 'X') + num('org:1', 'Y') + `<button class="btn ib" data-act="center" title="Center origin on the shape" aria-label="Center origin">◎</button>`)}
    ${
      bone
        ? ''
        : `${nrow('Anchor', `<div class="anchor" role="group" aria-label="Move origin to a point of the box">${H9.map(([u, v]) => `<button data-anchor="${u},${v}" aria-label="Origin at ${['left', 'center', 'right'][u * 2]} ${['top', 'middle', 'bottom'][v * 2]}" title="Origin at ${['left', 'center', 'right'][u * 2]} ${['top', 'middle', 'bottom'][v * 2]}"></button>`).join('')}</div><div class="btns" style="margin-left:auto"><button class="btn" data-act="flipx" title="Mirror horizontally around the origin">Flip H</button><button class="btn" data-act="flipy" title="Mirror vertically around the origin">Flip V</button></div>`)}`
    }</section>`;
}

/* ---------- Text ---------- */

export function textSection(l: Layer) {
  const G = l.geo;
  return `<section class="sec"><h3>Text</h3><textarea class="ta" data-g="text" id="g-text" rows="${Math.min(6, Math.max(2, String(G.text || '').split('\n').length))}" aria-label="Text">${esc(G.text)}</textarea>
    ${nrow('Position', `<label class="nf"><span>X</span><input id="g-x" data-g="x" inputmode="decimal" aria-label="X"></label><label class="nf"><span>Y</span><input id="g-y" data-g="y" inputmode="decimal" aria-label="Y"></label>`)}
    ${nrow('Size', `<label class="nf ro"><span>W</span><input id="bb-w" data-bb="w" readonly tabindex="-1" aria-label="Width"></label><label class="nf ro"><span>H</span><input id="bb-h" data-bb="h" readonly tabindex="-1" aria-label="Height"></label>`)}
  </section>`;
}
export function textAppearanceSection(l: Layer) {
  const G = l.geo,
    wf = webFont(G.family),
    known = !!wf || FONTS.some(f => f[0] === G.family),
    w = String(G.weight || '400'),
    deco = String(G.deco || '').split(/\s+/),
    has = (d: string) => deco.includes(d);
  // only the weights and styles the chosen web font has
  const styleOpts: Array<[string, string]> = STYLES.filter(([v]) => !wf || wf.weights.includes(+v)).flatMap(
    ([v, n]): Array<[string, string]> =>
      !wf || wf.italic
        ? [
            [v + '|0', n],
            [v + '|1', n === 'Regular' ? 'Italic' : n + ' italic'],
          ]
        : [[v + '|0', n]],
  );
  const opt = (v: string, t: string) =>
    `<option value="${esc(v)}"${v === G.family ? ' selected' : ''}>${esc(t)}</option>`;
  const fontSel = `<select class="sel" data-g="family" id="g-family" aria-label="Font">
      <optgroup label="System fonts">${FONTS.map(f => opt(f[0], f[1])).join('')}${known ? '' : opt(G.family, String(G.family).split(',')[0])}</optgroup>
      <optgroup label="Google Fonts">${WEB_FONTS.map(f => opt(f.family, f.family)).join('')}</optgroup></select>`;
  return `<section class="sec"><h3>Text appearance</h3>
    ${nrow('Font', fontSel)}
    ${nrow('Style', sel('data-tx-sel="style" id="tx-style" aria-label="Style"', styleOpts, w + '|' + (G.italic ? 1 : 0)))}
    <div class="row nk"><span class="rl"></span><div class="rf tx-tg">
      ${tbtn('bold', '', +w >= 600, '<b>B</b>', 'Bold')}${tbtn('italic', '', !!G.italic, '<i>I</i>', 'Italic')}${tbtn('deco', 'underline', has('underline'), '<u>U</u>', 'Underline')}${tbtn('deco', 'overline', has('overline'), '<span style="text-decoration:overline">O</span>', 'Overline')}${tbtn('deco', 'line-through', has('line-through'), '<s>S</s>', 'Strikethrough')}
    </div></div>
    ${nrow('Size', `<label class="nf"><span>pt</span><input id="g-size" data-g="size" inputmode="decimal" aria-label="Font size"></label><label class="nf"><span>↔</span><input id="g-ls" data-g="ls" inputmode="decimal" aria-label="Letter spacing"><em>px</em></label>`)}
    ${nrow('Align', `<div class="btns tight">${tbtn('anchor', 'start', (G.anchor || 'start') === 'start', I.alignL, 'Align left')}${tbtn('anchor', 'middle', G.anchor === 'middle', I.alignC, 'Align center')}${tbtn('anchor', 'end', G.anchor === 'end', I.alignR, 'Align right')}</div>`)}
    ${nrow('Box width', `${tbtn('wrap', '', !!G.wrap, I.keepW, 'Keep width while typing (wrap lines)')}<label class="nf${G.wrap ? '' : ' ro'}" title="${G.wrap ? 'Lines break to stay inside this width' : 'Turn on Keep width to fix the box width'}"><span>W</span><input id="g-ww" data-g="ww" inputmode="decimal" aria-label="Box width"${G.wrap ? '' : ' disabled'}><em>px</em></label>`)}
    ${String(G.text || '').includes('\n') || G.wrap ? nrow('Line height', `<label class="nf"><span>×</span><input id="g-lh" data-g="lh" inputmode="decimal" aria-label="Line height"></label>`) : ''}
  </section>`;
}

/* ---------- Fill & stroke ---------- */

function picker(k: string) {
  return typeof (window as any).EyeDropper === 'function'
    ? `<button class="btn ib" data-act="pick" data-k="${k}" title="Pick a colour from the screen" aria-label="Pick a colour from the screen">${I.pick}</button>`
    : '';
}
export function paintSection(l: Layer) {
  if (!PAINTED.includes(l.type)) return '';
  return `<section class="sec"><h3>Fill & stroke <button class="btn ib h3b" data-act="swap" title="Swap fill and stroke" aria-label="Swap fill and stroke">${I.swap}</button></h3>
    ${krow('fill', 'Fill', colf('fill') + picker('fill'))}
    ${krow('fo', 'Opacity', num('fo::100', 'α', '%'))}
    ${krow('stk', 'Stroke', colf('stk') + picker('stk'))}
    ${krow('so', 'Opacity', num('so::100', 'α', '%'))}
    ${krow('sw', 'Width', num('sw', 'W', 'px'))}
  </section>`;
}

/* ---------- Appearance ---------- */

export function appearanceSection(l: Layer) {
  const painted = PAINTED.includes(l.type),
    X = l.extra || {},
    lc = X['stroke-linecap'] || 'butt',
    join = X['stroke-linejoin'] || 'miter';
  let h = `<section class="sec"><h3>Appearance</h3><div class="sub">Compositing</div>`;
  if (painted)
    h += nrow(
      'Order',
      sel('data-x="paint-order" id="x-order" aria-label="Paint order"', ORDERS, X['paint-order'] || ''),
    );
  h += nrow(
    'Blending',
    sel(
      'data-ly="blend" id="ly-blend" aria-label="Blending"',
      BLENDS.map(b => [b, cap(b)]),
      l.blend || 'normal',
    ) +
      `<label class="check inl"><input type="checkbox" data-ly="iso" id="ly-iso" ${l.iso ? 'checked' : ''}> Isolate</label>`,
  );
  h += krow(
    'op',
    'Opacity',
    `<input type="range" class="rng" id="op-range" data-range="op" min="0" max="100" step="1" aria-label="Opacity">` +
      num('op::100', 'α', '%'),
  );
  if (painted) {
    h += `<div class="sub">Stroke style</div>`;
    h += nrow(
      'Line ends',
      `<div class="btns tight">${tbtn('x:stroke-linecap', 'butt', lc === 'butt', I.capButt, 'Butt ends')}${tbtn('x:stroke-linecap', 'round', lc === 'round', I.capRound, 'Round ends')}${tbtn('x:stroke-linecap', 'square', lc === 'square', I.capSquare, 'Square ends')}</div>`,
    );
    h += nrow(
      'Line join',
      `<div class="btns tight">${tbtn('x:stroke-linejoin', 'miter', join === 'miter', I.joinMiter, 'Miter join')}${tbtn('x:stroke-linejoin', 'round', join === 'round', I.joinRound, 'Round join')}${tbtn('x:stroke-linejoin', 'bevel', join === 'bevel', I.joinBevel, 'Bevel join')}</div>`,
    );
    if (join === 'miter')
      h += nrow(
        'Miter limit',
        `<label class="nf" title="How far a sharp corner may stick out before it is cut flat, as a multiple of the stroke width"><span>×</span><input data-x="stroke-miterlimit" id="x-miter" inputmode="decimal" value="${esc(X['stroke-miterlimit'] || '4')}" aria-label="Miter limit"></label>`,
      );
    h += nrow(
      'Dashes',
      `<input class="txt mono" data-x="stroke-dasharray" id="x-dash" spellcheck="false" placeholder="dash, gap, dash, gap, …" value="${esc(X['stroke-dasharray'] || '')}" aria-label="Dash pattern">`,
    );
    h += krow('dof', 'Dash offset', num('dof', '⇥', 'px'));
    h += nrow(
      'Length',
      `<label class="nf"><span>L</span><input data-x="pathLength" id="x-plen" inputmode="decimal" placeholder="auto" value="${esc(X.pathLength || '')}" aria-label="Path length for dashes"></label>`,
    );
    if (l.type !== 'text')
      h +=
        krow('draw', 'Draw', num('draw', '◐', '%')) +
        `<p>Draw animates the stroke from 0% to 100% for a self-drawing line. While Draw is below 100% it replaces the dash pattern.</p>`;
  }
  return h + `</section>`;
}

/* ---------- Filters ---------- */

export function filtersSection(l: Layer) {
  if (l.type === 'bone') return '';
  const list = l.fx || [];
  let h = `<section class="sec"><h3>Filters</h3><div class="row nk"><span class="rl"></span><div class="rf">${sel(
    'data-fxadd id="fx-add" aria-label="Add filter"',
    [['', '+ Add filter…'], ...Object.entries(FILTERS).map(([k, d]) => [k, d.label] as [string, string])],
    '',
  )}</div></div>`;
  if (!list.length) h += `<p class="muted">No filters</p>`;
  else h += `<p>Filter animation plays in JavaScript exports. CSS exports keep the filters but can't animate them.</p>`;
  list.forEach((f, i) => {
    const def = FILTERS[f.type];
    if (!def) return;
    h += `<div class="fx-head"><b>${def.label}</b><span class="sp"></span>
      <button class="btn ib" data-act="fxmove" data-fx="${f.id}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move ${def.label} up" title="Move up">${I.up}</button>
      <button class="btn ib" data-act="fxmove" data-fx="${f.id}" data-d="1" ${i === list.length - 1 ? 'disabled' : ''} aria-label="Move ${def.label} down" title="Move down">${I.down}</button>
      <button class="btn ib" data-act="fxdel" data-fx="${f.id}" aria-label="Remove ${def.label}" title="Remove">${ICON.trash}</button></div>`;
    def.params.forEach(p => {
      const k = fxKey(f.id, p.key);
      h += krow(
        k,
        p.label,
        typeof p.def === 'string' ? colf(k) : num(k + (p.scale ? '::' + p.scale : ''), p.label[0], p.unit),
      );
    });
  });
  return h + `</section>`;
}

/* ---------- refresh and events ---------- */

/** Values the generic refresh can't fill: rotate turns/degrees, the measured size, the opacity slider. */
export function refreshProps(l: Layer) {
  const rot = valueAt(l, 'rot', S.time) || 0,
    turns = Math.trunc(rot / 360),
    deg = Math.round((rot - turns * 360) * 1000) / 1000;
  const t = byId('rot-turn'),
    d = byId('rot-deg');
  if (t && t !== document.activeElement) t.value = String(turns);
  if (d && d !== document.activeElement) d.value = fmt(deg);
  const rg = byId('op-range');
  if (rg && rg !== document.activeElement) rg.value = String(Math.round((valueAt(l, 'op', S.time) ?? 1) * 100));
  const bw = byId('bb-w');
  if (bw) {
    let bb = null;
    try {
      bb = byId('e-' + l.id).getBBox();
    } catch (_) {}
    bw.value = bb ? fmt(bb.width) : '';
    byId('bb-h').value = bb ? fmt(bb.height) : '';
  }
  const ww = byId('g-ww');
  if (ww && !l.geo.wrap) ww.value = byId('bb-w') ? byId('bb-w').value : '';
}
/** Rotation from the two fields. */
export function rotFromFields() {
  const t = parseFloat(byId('rot-turn').value) || 0,
    d = parseFloat(byId('rot-deg').value) || 0;
  return t * 360 + d;
}
function setExtra(l: Layer, attr: string, v: string) {
  l.extra = Object.assign({}, l.extra || {});
  if (v === '' || v == null) delete l.extra[attr];
  else l.extra[attr] = v;
}
/** Swap fill and stroke (colours, opacities and their keyframes). */
function swapPaint(l: Layer) {
  const sw = (a: string, b: string) => {
    const x = l.b[a];
    l.b[a] = l.b[b];
    l.b[b] = x;
    const ta = l.t[a],
      tb = l.t[b];
    if (tb) l.t[a] = tb;
    else delete l.t[a];
    if (ta) l.t[b] = ta;
    else delete l.t[b];
  };
  sw('fill', 'stk');
  sw('fo', 'so');
  ['fo', 'so'].forEach(k => l.b[k] == null && delete l.b[k]);
  if (l.b.stk && l.b.stk !== 'none' && !(l.b.sw > 0) && !(l.t.sw && l.t.sw.length)) l.b.sw = 2;
}
/** Handle a button in these sections. Returns true when handled. */
export function propsClick(a: string, b: HTMLElement, l: Layer) {
  if (a === 'orient') {
    const ed = beginEdit();
    l.or = !l.or;
    if (!l.or) delete l.or;
    ed.end({ insp: true });
    return true;
  }
  if (a === 'scllock') {
    S.sclLock = !S.sclLock;
    b.classList.toggle('on', S.sclLock);
    b.setAttribute('aria-pressed', String(S.sclLock));
    return true;
  }
  if (a === 'swap') {
    const ed = beginEdit();
    swapPaint(l);
    ed.end({ insp: true });
    return true;
  }
  if (a === 'pick') {
    const k = b.dataset.k as PropKey;
    new (window as any).EyeDropper()
      .open()
      .then((r: { sRGBHex: string }) => {
        const ed = beginEdit();
        setProp(l, k, r.sRGBHex);
        ed.end({ insp: true });
      })
      .catch(() => {});
    return true;
  }
  if (a === 'fxdel' || a === 'fxmove') {
    const ed = beginEdit();
    if (a === 'fxdel') removeFilter(l, b.dataset.fx);
    else {
      const i = l.fx.findIndex(f => f.id === b.dataset.fx),
        j = i + +b.dataset.d;
      if (i >= 0 && j >= 0 && j < l.fx.length) {
        const fx = l.fx.slice();
        [fx[i], fx[j]] = [fx[j], fx[i]];
        l.fx = fx;
        syncFa(l);
      }
    }
    ed.end({ insp: true });
    return true;
  }
  return false;
}
/** Toggle buttons (data-tx). */
export function propsToggle(b: HTMLElement, l: Layer) {
  const k = b.dataset.tx,
    v = b.dataset.v,
    G = l.geo,
    ed = beginEdit();
  if (k === 'bold') {
    const wf = webFont(G.family),
      want = +String(G.weight || 400) >= 600 ? 400 : 700;
    G.weight = String(wf ? pickWeight(wf, want) : want);
  } else if (k === 'italic') G.italic = !G.italic;
  else if (k === 'deco') {
    const set = new Set(
      String(G.deco || '')
        .split(/\s+/)
        .filter(Boolean),
    );
    set.has(v) ? set.delete(v) : set.add(v);
    G.deco = [...set].join(' ');
    if (!G.deco) delete G.deco;
  } else if (k === 'anchor') G.anchor = v;
  else if (k === 'wrap') {
    // keep the text where it is: with a fixed box the anchor sits inside the box, not at x
    const shift = (on: boolean) => (G.anchor === 'middle' ? G.ww / 2 : G.anchor === 'end' ? G.ww : 0) * (on ? 1 : -1);
    if (!G.wrap) {
      let w = 0;
      try {
        w = (byId('e-' + l.id + '-s') as any).getBBox().width;
      } catch (_) {}
      if (!(G.ww > 0)) G.ww = Math.max(20, Math.ceil(w || (G.size || 16) * 8) + 1);
      G.x = r2(G.x - shift(true));
      G.wrap = true;
    } else {
      G.x = r2(G.x - shift(false));
      G.wrap = false;
    }
  } else if (k.startsWith('x:')) setExtra(l, k.slice(2), v);
  ed.end({ insp: true });
}
/** Change events in these sections. Returns true when handled. */
export function propsChange(t: HTMLInputElement | HTMLSelectElement, l: Layer) {
  if (t.dataset.txSel === 'style') {
    const [w, it] = t.value.split('|'),
      ed = beginEdit();
    l.geo.weight = w;
    l.geo.italic = it === '1';
    ed.end({ insp: true });
    return true;
  }
  if (t.dataset.x !== undefined) {
    const ed = beginEdit();
    let v = t.value.trim();
    if (t.dataset.x === 'stroke-miterlimit' || t.dataset.x === 'pathLength') {
      const n = parseFloat(v);
      v = isFinite(n) && n > 0 ? String(n) : '';
    }
    if (t.dataset.x === 'stroke-dasharray')
      v = v
        .replace(/[^\d.,\s]/g, '')
        .replace(/\s*,\s*/g, ', ')
        .trim();
    setExtra(l, t.dataset.x, v);
    ed.end({ insp: true });
    return true;
  }
  if (t.dataset.ly !== undefined) {
    const ed = beginEdit();
    if (t.dataset.ly === 'iso') l.iso = (t as HTMLInputElement).checked || undefined;
    else l.blend = t.value === 'normal' ? undefined : t.value;
    if (!l.iso) delete l.iso;
    if (!l.blend) delete l.blend;
    ed.end({ insp: true });
    return true;
  }
  if (t.dataset.fxadd !== undefined) {
    if (!t.value) return true;
    const ed = beginEdit();
    addFilter(l, t.value);
    ed.end({ insp: true });
    return true;
  }
  return false;
}
/** The opacity slider, live while dragging. */
export function propsInput(t: HTMLInputElement, l: Layer) {
  if (t.dataset.range !== 'op') return false;
  if (!S.colorEd) S.colorEd = beginEdit();
  setProp(l, 'op', Math.round(+t.value) / 100);
  const n = INSP.querySelector('[data-f="op::100"]') as HTMLInputElement;
  if (n) n.value = t.value;
  return true;
}
