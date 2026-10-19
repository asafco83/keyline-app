// Keyline — model/filters
// Layer filters (Blur, Drop shadow). Each parameter is an animatable track keyed `fx.<filter id>.<param>`,
// stored like any other property in Layer.b / Layer.t. The runtime animates them through Layer.fa.
import type { Layer } from './types';

export interface FilterParam {
  key: string;
  label: string;
  /** SVG attribute on the filter primitive */
  attr: string;
  def: number | string;
  unit?: string;
  /** stored value ↔ shown value (e.g. opacity 0–1 shown as %) */
  scale?: number;
  min?: number;
}
export interface FilterDef {
  label: string;
  /** SVG filter primitive */
  el: string;
  params: FilterParam[];
}
export const FILTERS: Record<string, FilterDef> = {
  blur: {
    label: 'Blur',
    el: 'feGaussianBlur',
    params: [{ key: 'sd', label: 'Amount', attr: 'stdDeviation', def: 4, unit: 'px', min: 0 }],
  },
  shadow: {
    label: 'Drop shadow',
    el: 'feDropShadow',
    params: [
      { key: 'dx', label: 'X', attr: 'dx', def: 4, unit: 'px' },
      { key: 'dy', label: 'Y', attr: 'dy', def: 6, unit: 'px' },
      { key: 'sd', label: 'Blur', attr: 'stdDeviation', def: 6, unit: 'px', min: 0 },
      { key: 'col', label: 'Color', attr: 'flood-color', def: '#000000' },
      { key: 'op', label: 'Opacity', attr: 'flood-opacity', def: 0.35, unit: '%', scale: 100, min: 0 },
    ],
  },
};
export const fxKey = (id: string, param: string) => `fx.${id}.${param}`;
export function isFxKey(k: string) {
  return k.startsWith('fx.');
}
/** Parse `fx.<id>.<param>` into the filter and its parameter definition. */
export function fxOf(l: Layer, k: string) {
  const [, id, key] = k.split('.'),
    fx = (l.fx || []).find(f => f.id === id),
    def = fx && FILTERS[fx.type],
    param = def && def.params.find(p => p.key === key);
  return fx && param ? { fx, def, param } : null;
}
/** Every filter track key of a layer, in display order. */
export function fxKeys(l: Layer) {
  return (l.fx || []).flatMap(f => (FILTERS[f.type] ? FILTERS[f.type].params.map(p => fxKey(f.id, p.key)) : []));
}
/** Keep Layer.fa (the runtime's attribute map) in step with Layer.fx. */
export function syncFa(l: Layer) {
  const fa: Record<string, [string, string]> = {};
  (l.fx || []).forEach(f => {
    const def = FILTERS[f.type];
    if (def) def.params.forEach(p => (fa[fxKey(f.id, p.key)] = ['-' + f.id, p.attr]));
  });
  if (Object.keys(fa).length) l.fa = fa;
  else delete l.fa;
}
export function addFilter(l: Layer, type: string) {
  const def = FILTERS[type];
  if (!def) return null;
  const used = new Set((l.fx || []).map(f => f.id));
  let n = 1;
  while (used.has('f' + n)) n++;
  const fx = { id: 'f' + n, type };
  l.fx = [...(l.fx || []), fx];
  def.params.forEach(p => (l.b[fxKey(fx.id, p.key)] = p.def));
  syncFa(l);
  return fx;
}
export function removeFilter(l: Layer, id: string) {
  const fx = (l.fx || []).find(f => f.id === id);
  if (!fx) return;
  fxKeys({ ...l, fx: [fx] } as Layer).forEach(k => {
    delete l.b[k];
    delete l.t[k];
  });
  l.fx = l.fx.filter(f => f !== fx);
  if (!l.fx.length) delete l.fx;
  syncFa(l);
}
/** <filter> markup for a layer at time t, or '' when it has none. `get` reads a (possibly animated) value. */
export function filterSVG(l: Layer, pre: string, get: (k: string) => any) {
  if (!l.fx || !l.fx.length) return '';
  const id = pre + l.id;
  const prims = l.fx
    .map(f => {
      const def = FILTERS[f.type];
      if (!def) return '';
      const at = def.params
        .map(p => {
          const v = get(fxKey(f.id, p.key));
          return ` ${p.attr}="${v == null ? p.def : typeof v === 'number' ? Math.round(v * 1000) / 1000 : String(v).replace(/"/g, '&quot;')}"`;
        })
        .join('');
      return `<${def.el} id="${id}-${f.id}"${at}/>`;
    })
    .join('');
  return `<filter id="${id}-fx" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">${prims}</filter>`;
}
