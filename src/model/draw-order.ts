// SVGcinema — model/draw-order
// A rig's own draw order (set on its top bone, like Spine's draw order): the artwork attached to the
// rig's bones is drawn in the order of a list instead of by nesting, so a far arm can sit behind the
// torso while it stays the torso's child. The artwork is drawn flat at the rig's place in the stack,
// each piece inside a wrapper that carries the bones' transforms down to its bone.
import type { Layer } from './types';

const childrenOf = (id: string, list: Layer[]) => list.filter(l => (l.parent || null) === id);
const byIdIn = (id: string | null | undefined, list: Layer[]) => (id ? list.find(l => l.id === id) : undefined);
/** the top bone of the rig a bone belongs to */
export function rigTop(b: Layer, list: Layer[]): Layer {
  let r = b,
    p = byIdIn(b.parent, list),
    g = 0;
  while (p && p.type === 'bone' && g++ < 100) {
    r = p;
    p = byIdIn(p.parent, list);
  }
  return r;
}
/** a rig's artwork, in the order nesting draws it (back to front): the layers attached to its bones */
export function rigArtwork(top: Layer, list: Layer[]): Layer[] {
  const out: Layer[] = [],
    walk = (b: Layer) =>
      childrenOf(b.id, list).forEach(c => {
        if (c.type === 'bone') walk(c);
        else out.push(c);
      });
  walk(top);
  return out;
}
/** the rig's own draw order (back to front), or null when it draws by nesting. Artwork missing from
 *  the stored list (attached later) goes in front, in nesting order. */
export function drawOrder(top: Layer, list: Layer[]): Layer[] | null {
  if (!top || top.type !== 'bone' || !top.dord) return null;
  const art = rigArtwork(top, list),
    known = top.dord.map(id => art.find(l => l.id === id)).filter(Boolean) as Layer[];
  return known.concat(art.filter(l => !known.includes(l)));
}
/** a bone whose attached artwork is drawn by its rig's own draw order (not inside the bone) */
export function ownOrderBone(b: Layer, list: Layer[]) {
  return !!b && b.type === 'bone' && !!rigTop(b, list).dord;
}
