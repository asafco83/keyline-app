// SVGcinema — core/select-same
// Edit › Select same: selects every layer that shares a value with the selected one: its fill, stroke,
// stroke width, font or kind of layer. Values are compared as they are at the playhead. Hidden and
// locked layers are left out; layers inside groups count (as a Ctrl+click picks them).
import type { Layer } from '../model/types';
import { H } from './constants';
import { S, doc, selLayer } from './state';
import { selectMany } from './history';
import { isHidden, isLocked } from '../model/tree';
import { toast } from '../io/open';

export type SameKind = 'fill' | 'stk' | 'sw' | 'font' | 'type';

const PAINTED = ['rect', 'ellipse', 'path', 'text'];
const LABEL: Record<SameKind, string> = {
  fill: 'fill',
  stk: 'stroke',
  sw: 'stroke width',
  font: 'font',
  type: 'kind of layer',
};

/** a comparable form of a paint value: colours in lower case, gradients as JSON */
function paintKey(v: unknown) {
  if (v == null || v === 'none') return 'none';
  return typeof v === 'string' ? v.trim().toLowerCase() : JSON.stringify(v);
}
/** the value `kind` compares for this layer, or null when it doesn't apply to it */
export function sameKey(l: Layer, kind: SameKind): string | null {
  if (kind === 'type') return l.type === 'group' || l.type === 'bone' ? null : l.type;
  if (kind === 'font') return l.type === 'text' ? String(l.geo.family || '') : null;
  if (!PAINTED.includes(l.type)) return null;
  const c = H.comp(l, S.time);
  if (kind === 'sw') {
    if (paintKey(c.stk) === 'none') return null;
    return String(Math.round((c.sw || 0) * 100) / 100);
  }
  return paintKey(c[kind]);
}
/** which Select same commands apply to the selected layer */
export function sameKinds(l: Layer | null): SameKind[] {
  if (!l) return [];
  return (['fill', 'stk', 'sw', 'font', 'type'] as SameKind[]).filter(k => sameKey(l, k) != null);
}
export function selectSame(kind: SameKind) {
  const l = selLayer();
  const key = l && sameKey(l, kind);
  if (key == null) return false;
  const ids = doc.layers
    .filter(o => o !== l && !isHidden(o) && !isLocked(o) && sameKey(o, kind) === key)
    .map(o => o.id);
  selectMany([...ids, l.id]);
  toast(
    ids.length
      ? `Selected ${ids.length + 1} layers with the same ${LABEL[kind]}.`
      : `No other layer has the same ${LABEL[kind]}.`,
  );
  return true;
}
