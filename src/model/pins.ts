// SVGcinema — model/pins
// Pins bend a path: each pin has a rest position (in the layer's own space) and two animatable
// properties, `pin<n>` (where it is) and `pinr<n>` (how far it has turned, degrees).
import type { Layer, PinDef } from './types';

const PIN_KEY = /^pin(r?)(\d+)$/;
export function isPinKey(k: string) {
  return PIN_KEY.test(k);
}
export function pinOfKey(l: Layer, k: string): PinDef | null {
  const m = PIN_KEY.exec(k);
  if (!m || !l.pins) return null;
  return l.pins.find(p => p.n === +m[2]) || null;
}
export function isPinRot(k: string) {
  const m = PIN_KEY.exec(k);
  return !!(m && m[1]);
}
/** a layer's pin properties, in pin order: position, then rotation */
export function pinKeys(l: Layer): string[] {
  return (l.pins || []).flatMap(p => ['pin' + p.n, 'pinr' + p.n]);
}
export function pinLabel(k: string) {
  const m = PIN_KEY.exec(k);
  return m ? `Pin ${m[2]}${m[1] ? ' · Rotation' : ''}` : k;
}
/** the value a pin property has without keyframes: its own base value, else where the pin rests */
export function pinBase(l: Layer, k: string) {
  const p = pinOfKey(l, k);
  if (!p) return undefined;
  const v = (l.b as Record<string, any>)[k];
  if (v != null) return v;
  return isPinRot(k) ? 0 : [p.x, p.y];
}
export function nextPinNumber(l: Layer) {
  return (l.pins || []).reduce((m, p) => Math.max(m, p.n), 0) + 1;
}
