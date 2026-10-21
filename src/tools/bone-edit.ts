// SVGcinema — tools/bone-edit
// Edit bone tool: changes a rig's rest pose (joint, length, rest angle) without touching keyframes.
// Bind tool: click children (bones or layers), then their new parent bone.
import type { Layer, XY } from '../model/types';
import { H, byId, clone, esc, fmt, r2, r3, xfp } from '../core/constants';
import { beginEdit, select } from '../core/history';
import { S, doc, layerById } from '../core/state';
import { descendants, isHidden, isLocked, kids, pmOf } from '../model/tree';
import { drawOverlay, obbOf } from '../render/overlay';
import { frame } from '../render/stage';
import { bonePts, boneTipL, localMat } from './bones';
import { hitChain } from './stage-input';

/* ---------- shared math ---------- */

/** a layer's own matrix from its base values (the rest pose for bones) */
export function restMat(l: Layer): DOMMatrix {
  const c = H.comp(Object.assign({}, l, { t: {} }) as any, 0);
  return new DOMMatrix()
    .translate(c.x, c.y)
    .rotate(c.r)
    .skewX(c.kx || 0)
    .skewY(c.ky || 0)
    .rotate(c.ba || 0)
    .scale(c.sx, c.sy)
    .rotate(-(c.ba || 0))
    .translate(-c.ox, -c.oy);
}
const pt = (M: DOMMatrix, x: number, y: number) => xfp(M, x, y);
const near = (a: { x: number; y: number }, b: { x: number; y: number }, d: number) =>
  Math.hypot(a.x - b.x, a.y - b.y) <= d;
/** moves a layer by (dx, dy) in its parent's space: the base position and every position key */
function shiftPos(l: Layer, dx: number, dy: number) {
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return;
  l.b.pos = [r2(l.b.pos[0] + dx), r2(l.b.pos[1] + dy)];
  if (l.t.pos) l.t.pos.forEach(q => (q[1] = [r2(q[1][0] + dx), r2(q[1][1] + dy)]));
}
/** rotates a layer by `deg` around P (its parent's space): base and keyed position and rotation */
function rotateAbout(l: Layer, P: XY, deg: number) {
  if (Math.abs(deg) < 1e-9) return;
  const a = (deg * Math.PI) / 180,
    cs = Math.cos(a),
    sn = Math.sin(a),
    o = l.o || [0, 0],
    rp = (p: number[]) => {
      const x = p[0] + o[0] - P.x,
        y = p[1] + o[1] - P.y;
      return [r2(P.x + x * cs - y * sn - o[0]), r2(P.y + x * sn + y * cs - o[1])] as [number, number];
    };
  l.b.pos = rp(l.b.pos);
  if (l.t.pos) l.t.pos.forEach(q => (q[1] = rp(q[1])));
  l.b.rot = r2((l.b.rot || 0) + deg);
  if (l.t.rot) l.t.rot.forEach(q => (q[1] = r2(q[1] + deg)));
}
/** keeps the children of `l` where they are after `l`'s own matrix changed from `before` */
function keepKids(l: Layer, before: DOMMatrix, skip?: Set<string>) {
  const C = restMat(l).inverse().multiply(before);
  kids(l.id).forEach(c => {
    if (!skip || !skip.has(c.id)) shiftPos(c, C.e, C.f);
  });
}
/** the joint of bone `k` in its parent's space */
function jointIn(k: Layer) {
  return pt(restMat(k), k.geo.x, k.geo.y);
}
/** moves bone k's joint to P (its parent's space); its tip and its children stay where they are */
function moveJoint(k: Layer, P: XY) {
  const M0 = restMat(k),
    tl = boneTipL(k.geo),
    tipP = pt(M0, tl[0], tl[1]),
    o = [r2(P.x - k.b.pos[0]), r2(P.y - k.b.pos[1])];
  k.geo.x = o[0];
  k.geo.y = o[1];
  k.o = [o[0], o[1]];
  const M1 = restMat(k),
    t = pt(M1.inverse(), tipP.x, tipP.y);
  k.geo.len = r2(Math.hypot(t.x - o[0], t.y - o[1]));
  k.geo.ang = r2((Math.atan2(t.y - o[1], t.x - o[0]) * 180) / Math.PI);
  keepKids(k, M0);
}
/** child bones of `b` whose joint sits on the point `at` (b's own space) */
function bonesAt(b: Layer, at: XY, eps: number) {
  return kids(b.id).filter(c => c.type === 'bone' && near(jointIn(c), at, eps));
}

/* ---------- rest pose view and the status chip ---------- */

/** While the Edit bone tool is on, bones show their rest pose (base values) instead of the playhead's. */
export function restPoseView() {
  if (S.tool !== 'boneedit') return;
  doc.layers.forEach(l => {
    if (l.type !== 'bone' || isHidden(l)) return;
    const g = byId('e-' + l.id);
    if (g) g.setAttribute('transform', restMat(l).toString());
  });
}
export function boneChips() {
  const chip = document.getElementById('boneChip'),
    tip = document.getElementById('bindTip');
  if (!chip || !tip) return;
  if (S.tool === 'boneedit') {
    chip.innerHTML = '<span class="dot"></span><b>Rest pose</b><span class="mu">· keys unchanged</span>';
    chip.hidden = false;
  } else if (S.tool === 'bonebind' && S.bindPick.length) {
    const n = S.bindPick.length;
    chip.innerHTML = `<b>${n} ${n > 1 ? 'children' : 'child'} picked</b><span class="mu">· click ${n > 1 ? 'their' : 'its'} parent bone · Esc cancels</span>`;
    chip.hidden = false;
  } else chip.hidden = true;
  const hv = S.tool === 'bonebind' && S.bindPick.length && S.bindHover && layerById(S.bindHover);
  if (hv && S.bindScreen) {
    const first = layerById(S.bindPick[0]),
      more = S.bindPick.length > 1 ? ` +${S.bindPick.length - 1}` : '',
      bad = !bindable(S.bindPick, hv);
    tip.innerHTML = bad
      ? '<span class="mu">Can’t bind to itself or a child</span>'
      : `<span class="mu">Bind</span><b>${esc(first ? first.name : '')}${more}</b><span class="mu">to</span><b>${esc(hv.name)}</b>`;
    tip.hidden = false;
    // beside the pointer, flipped to its left near the right edge of the work area
    const host = (tip.offsetParent as HTMLElement) || document.body,
      r = host.getBoundingClientRect(),
      w = tip.offsetWidth;
    let x = S.bindScreen.x - r.left + 16;
    if (x + w > r.width - 8) x = S.bindScreen.x - r.left - 16 - w;
    tip.style.transform = `translate(${Math.round(Math.max(8, x))}px, ${Math.round(S.bindScreen.y - r.top - 12)}px)`;
  } else tip.hidden = true;
}

/* ---------- Edit bone tool ---------- */

export function boneEditDown(e: PointerEvent, p: XY) {
  const bn = (e.target as any).closest && (e.target as any).closest('[data-bone]');
  let b = bn && layerById(bn.dataset.bone),
    part: string = (bn && bn.dataset.part) || 'body';
  if (!b || b.type !== 'bone') return;
  // a joint that sits on its parent's tip is the parent's tip too: grabbing it edits the parent
  // (Alt grabs the joint itself, to pull it off the tip)
  const up0 = b.parent && layerById(b.parent),
    upTip = up0 && up0.type === 'bone' ? boneTipL(up0.geo) : null;
  if (part === 'joint' && !e.altKey && upTip && near(jointIn(b), { x: upTip[0], y: upTip[1] }, 0.6)) {
    b = up0;
    part = 'tip';
  }
  if (S.sel !== b.id || S.selSet.size > 1) select(b.id);
  if (isLocked(b)) return;
  const pid = b.parent,
    par = pid && layerById(pid),
    PM = DOMMatrix.fromMatrix(pmOf(pid)),
    PMi = PM.inverse(),
    u = 1 / S.scale;
  // every move starts again from the state at press, so nothing drifts
  const snap = doc.layers.map(l => [l, clone({ geo: l.geo, b: l.b, t: l.t, o: l.o })] as const),
    restore = () =>
      snap.forEach(([l, s]) => {
        l.geo = clone(s.geo);
        l.b = clone(s.b);
        l.t = clone(s.t);
        l.o = clone(s.o);
      });
  // other bones' joints and tips, for snapping a dragged tip onto them
  const targets: DOMPoint[] = [];
  doc.layers.forEach(o => {
    if (o.type !== 'bone' || o === b || isHidden(o)) return;
    const bp = bonePts(o);
    if (bp) targets.push(bp.J, bp.T);
  });
  const ed = beginEdit();
  let moved = false;
  S.drag = {
    move(q: XY, ev: PointerEvent) {
      if (!moved && Math.hypot(q.x - p.x, q.y - p.y) * S.scale < 3) return;
      moved = true;
      restore();
      S.drag.lbl = '';
      if (part === 'tip') tipDrag(b, q, ev);
      else if (part === 'joint') {
        const P = pt(PMi, q.x, q.y);
        jointDrag(b, P);
      } else {
        const a = pt(PMi, p.x, p.y),
          c = pt(PMi, q.x, q.y);
        bodyDrag(b, c.x - a.x, c.y - a.y);
      }
      S.drag.lp = q;
      frame();
    },
    up() {
      ed.end({ insp: true });
    },
  };
  function tipDrag(bone: Layer, q: XY, ev: PointerEvent) {
    const M = PM.multiply(restMat(bone)),
      Mi = M.inverse(),
      hit = targets.find(t => near(t, q, 8 * u));
    const L = pt(Mi, hit ? hit.x : q.x, hit ? hit.y : q.y);
    const G = bone.geo,
      J = { x: G.x, y: G.y },
      old = boneTipL(G);
    let ang = (Math.atan2(L.y - J.y, L.x - J.x) * 180) / Math.PI;
    const len = Math.max(1, Math.hypot(L.x - J.x, L.y - J.y));
    if (ev.shiftKey) ang = Math.round(ang / 15) * 15;
    const dAng = ang - G.ang,
      atTip = bonesAt(bone, { x: old[0], y: old[1] }, 0.6);
    G.len = r2(len);
    G.ang = r2(ang);
    const nt = boneTipL(G);
    if (ev.ctrlKey || ev.metaKey) {
      // carry everything attached: it turns with the bone, and bones on the tip ride along
      kids(bone.id).forEach(c => rotateAbout(c, J, dAng));
      atTip.forEach(c => {
        const j = jointIn(c);
        shiftPos(c, nt[0] - j.x, nt[1] - j.y);
      });
    } else atTip.forEach(c => moveJoint(c, { x: nt[0], y: nt[1] }));
    S.drag.lbl = `L ${fmt(len, 0)} · ∠ ${fmt(ang, 0).replace('-', '−')}°`;
  }
  function jointDrag(bone: Layer, P: XY) {
    // the joint moves; the bone's tip and everything attached stay where they are
    moveJoint(bone, P);
  }
  function bodyDrag(bone: Layer, dx: number, dy: number) {
    // the whole bone moves (joint and tip); what is attached stays, bones on its tip follow the tip
    const M0 = restMat(bone),
      old = boneTipL(bone.geo),
      atTip = bonesAt(bone, { x: old[0], y: old[1] }, 0.6),
      j = jointIn(bone),
      o = [r2(j.x + dx - bone.b.pos[0]), r2(j.y + dy - bone.b.pos[1])];
    bone.geo.x = o[0];
    bone.geo.y = o[1];
    bone.o = [o[0], o[1]];
    keepKids(bone, M0);
    const nt = boneTipL(bone.geo);
    atTip.forEach(c => moveJoint(c, { x: nt[0], y: nt[1] }));
  }
  drawOverlay();
}

/* ---------- Bind tool ---------- */

/** the bones a layer is drawn in (its parents up to the first non-bone) — `null` is the canvas */
function rigHolder(l: Layer): string | null {
  let p = l.parent && layerById(l.parent);
  while (p && p.type === 'bone') p = p.parent && layerById(p.parent);
  return p ? p.id : null;
}
export function bindable(picks: string[], bone: Layer) {
  return picks.every(id => {
    const k = layerById(id);
    return k && k !== bone && !descendants(k).includes(bone);
  });
}
/** the world matrix of a parent (`null` = the canvas) at time t, from the layers' own transforms */
function worldOf(pid: string | null, t: number): DOMMatrix {
  const chain: Layer[] = [];
  let p = pid && layerById(pid),
    g = 0;
  while (p && g++ < 100) {
    chain.unshift(p);
    p = p.parent && layerById(p.parent);
  }
  return chain.reduce((M, l) => M.multiply(localMat(l, t)), new DOMMatrix());
}
/** moves `l` under `newPid`, keeping where it is on the canvas — at every key time of its position,
 *  rotation and scale, so an animated child keeps its motion at its keys */
export function reparentWorld(l: Layer, newPid: string | null) {
  const oldPid = l.parent || null;
  if (oldPid === newPid) return;
  const D = (t: number) => worldOf(newPid, t).inverse().multiply(worldOf(oldPid, t)),
    rotOf = (M: DOMMatrix) => (Math.atan2(M.b, M.a) * 180) / Math.PI,
    sclOf = (M: DOMMatrix) => Math.sqrt(Math.abs(M.a * M.d - M.b * M.c)) || 1,
    o = l.o || [0, 0],
    mapPos = (M: DOMMatrix, p: number[]) => {
      const n = pt(M, p[0] + o[0], p[1] + o[1]);
      return [r2(n.x - o[0]), r2(n.y - o[1])] as [number, number];
    },
    Dn = D(S.time);
  if (l.t.pos && l.t.pos.length) l.t.pos.forEach(q => (q[1] = mapPos(D(q[0]), q[1])));
  l.b.pos = mapPos(Dn, l.b.pos);
  if (l.t.rot && l.t.rot.length) l.t.rot.forEach(q => (q[1] = r2(q[1] + rotOf(D(q[0])))));
  l.b.rot = r2((l.b.rot || 0) + rotOf(Dn));
  const s = sclOf(Dn);
  if (Math.abs(s - 1) > 1e-4) {
    if (l.t.scl && l.t.scl.length)
      l.t.scl.forEach(q => {
        const k = sclOf(D(q[0]));
        q[1] = [r3(q[1][0] * k), r3(q[1][1] * k)];
      });
    l.b.scl = [r3(l.b.scl[0] * s), r3(l.b.scl[1] * s)];
  }
  doc.layers.splice(doc.layers.indexOf(l), 1);
  l.parent = newPid;
  doc.layers.push(l);
}
function pickAt(e: PointerEvent): Layer | null {
  const bn = (e.target as any).closest && (e.target as any).closest('[data-bone]');
  if (bn) return layerById(bn.dataset.bone) || null;
  const chain = hitChain(e.target);
  if (!chain.length) return null;
  if (e.ctrlKey || e.metaKey) return layerById(chain[0]) || null;
  // the outermost layer below a bone (artwork attached to a bone), else the outermost layer
  const bi = chain.findIndex(id => {
      const x = layerById(id);
      return x && x.type === 'bone';
    }),
    c = bi < 0 ? chain : chain.slice(0, bi);
  return (c.length && layerById(c[c.length - 1])) || null;
}
function setPicks(ids: string[]) {
  S.bindPick = ids;
  if (!ids.length) select(null);
  else {
    select(ids[0]);
    ids.slice(1).forEach(id => select(id, 'toggle'));
  }
}
export function bindDown(e: PointerEvent) {
  const hit = pickAt(e);
  if (hit && isLocked(hit)) return;
  const picks = S.bindPick.filter(id => layerById(id));
  if (e.shiftKey) {
    if (hit) setPicks(picks.includes(hit.id) ? picks.filter(id => id !== hit.id) : [...picks, hit.id]);
    return;
  }
  if (!picks.length) {
    if (hit) setPicks([hit.id]);
    return;
  }
  if (hit && hit.type === 'bone') {
    if (!bindable(picks, hit)) return;
    bindTo(picks, hit, e.altKey);
    return;
  }
  if (hit) {
    setPicks([hit.id]);
    return;
  }
  unbind(picks);
}
function bindTo(picks: string[], bone: Layer, keepOffset: boolean) {
  const ed = beginEdit(),
    u = 1 / S.scale;
  picks.forEach(id => {
    const k = layerById(id);
    if (!k) return;
    reparentWorld(k, bone.id);
    if (k.type !== 'bone' || keepOffset) return;
    // a bone dropped near the parent's tip snaps onto it (a connected chain)
    const tl = boneTipL(bone.geo),
      W = worldOf(bone.id, S.time),
      j = pt(localMat(k, S.time), k.geo.x, k.geo.y),
      jw = pt(W, j.x, j.y),
      tw = pt(W, tl[0], tl[1]);
    if (near(jw, tw, 10 * u)) shiftPos(k, tl[0] - j.x, tl[1] - j.y);
  });
  S.lexp[bone.id] = true;
  S.bindPick = [];
  S.bindHover = null;
  ed.end({ insp: true });
  select(null);
}
function unbind(picks: string[]) {
  const ed = beginEdit();
  picks.forEach(id => {
    const k = layerById(id);
    if (!k || !k.parent || layerById(k.parent)?.type !== 'bone') return;
    reparentWorld(k, rigHolder(k));
  });
  S.bindPick = [];
  ed.end({ insp: true });
  select(null);
}
/** pointer moves with the Bind tool: the bone under the pointer and the line from the picks */
export function bindHover(e: PointerEvent, p: XY) {
  if (S.tool !== 'bonebind') return;
  const bn = (e.target as any).closest && (e.target as any).closest('[data-bone]');
  S.bindHover = bn ? bn.dataset.bone : null;
  S.bindPt = p;
  S.bindScreen = { x: e.clientX, y: e.clientY };
  if (S.bindPick.length) drawOverlay();
  else boneChips();
}
export function cancelBind() {
  if (S.tool !== 'bonebind' || !S.bindPick.length) return false;
  setPicks([]);
  drawOverlay();
  return true;
}
/** overlay for the Bind tool: a dashed line from each picked layer to the pointer */
export function drawBindLines(OVappend: (el: Element) => void, mk: (tag: string, a: any) => Element) {
  if (S.tool !== 'bonebind' || !S.bindPick.length || !S.bindPt) return;
  S.bindPick.forEach(id => {
    const k = layerById(id);
    if (!k) return;
    let a: { x: number; y: number } | null = null;
    if (k.type === 'bone') {
      const bp = bonePts(k);
      a = bp && bp.J;
    } else {
      const q = obbOf(k);
      if (q) a = { x: (q[0].x + q[2].x) / 2, y: (q[0].y + q[2].y) / 2 };
    }
    if (a) OVappend(mk('line', { x1: a.x, y1: a.y, x2: S.bindPt.x, y2: S.bindPt.y, class: 'ov-bind' }));
  });
}
