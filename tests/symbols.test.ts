import { describe, it, expect } from 'vitest';
import { blankDoc, doc, mkLayer, setDoc, S } from '../src/core/state';
import { NOFILL } from '../src/core/constants';
import {
  addInstance,
  contentSig,
  deleteSymbol,
  detach,
  instancesOf,
  makeSymbol,
  setOffset,
  syncSymbols,
} from '../src/core/symbols';
import { descendants } from '../src/model/tree';
import { buildExport, symbolUses } from '../src/export/build';

function scene() {
  const d = blankDoc(400, 300);
  d.dur = 2;
  setDoc(d);
  const g = mkLayer('group', 'Star', {}, NOFILL),
    a = mkLayer('rect', 'Body', { x: 0, y: 0, w: 20, h: 20 }, { fill: '#f00', stk: 'none', sw: 0 }),
    b = mkLayer('ellipse', 'Dot', { cx: 10, cy: 10, rx: 3, ry: 3 }, { fill: '#fff', stk: 'none', sw: 0 });
  a.parent = g.id;
  b.parent = g.id;
  a.t.rot = [
    [0, 0, 'ease'],
    [1, 90, 'ease'],
  ];
  doc.layers.push(g, a, b);
  const id = makeSymbol(g);
  return { g, a, b, id };
}
const kids = (l: any) => descendants(l);

describe('symbols', () => {
  it('a new instance copies the contents with fresh ids', () => {
    const { g, id } = scene();
    const i2 = addInstance(id);
    expect(instancesOf(id).length).toBe(2);
    expect(kids(i2).map(l => l.name)).toEqual(['Body', 'Dot']);
    expect(kids(i2).some(l => kids(g).some(o => o.id === l.id))).toBe(false);
    expect(contentSig(i2)).toBe(contentSig(g));
  });
  it('an edit in one instance reaches the others', () => {
    const { g, id } = scene();
    const i2 = addInstance(id);
    kids(i2)[0].b.fill = '#00f';
    expect(syncSymbols()).toBe(true);
    expect(kids(g)[0].b.fill).toBe('#00f');
    expect(syncSymbols()).toBe(false);
  });
  it('the instance being edited wins', () => {
    const { g, id } = scene();
    const i2 = addInstance(id);
    kids(g)[1].b.fill = '#111';
    kids(i2)[1].b.fill = '#222';
    syncSymbols(i2.id);
    expect(kids(g)[1].b.fill).toBe('#222');
  });
  it('keeps each instance’s own transform and time offset', () => {
    const { g, id } = scene();
    const i2 = addInstance(id);
    i2.b.pos = [100, 50];
    setOffset(i2, 0.5);
    expect(kids(i2)[0].t.rot.map(q => q[0])).toEqual([0.5, 1.5]);
    expect(syncSymbols()).toBe(false);
    kids(g)[0].t.rot[1][1] = 180;
    syncSymbols();
    expect(kids(i2)[0].t.rot.map(q => [q[0], q[1]])).toEqual([
      [0.5, 0],
      [1.5, 180],
    ]);
    expect(i2.b.pos).toEqual([100, 50]);
  });
  it('detach and delete leave plain groups', () => {
    const { g, id } = scene();
    const i2 = addInstance(id);
    detach(i2);
    expect(i2.sym).toBeUndefined();
    deleteSymbol(id);
    expect(g.sym).toBeUndefined();
    expect(doc.symbols[id]).toBeUndefined();
  });
  it('the JS export writes later instances as <use>, the CSS export in full', () => {
    const { g, id } = scene();
    const i2 = addInstance(id),
      i3 = addInstance(id);
    setOffset(i3, 0.3);
    S.time = 0;
    expect(symbolUses(doc.layers)).toEqual({ [i2.id]: g.id });
    Object.assign(doc.ex, { mode: 'js', prefix: 'cin', ids: 'gen' });
    const js = buildExport(null).code;
    expect(js).toContain(`<use href="#cin-${g.id}-s"/>`);
    expect((js.match(/id="cin-[^"]+-s"/g) || []).length).toBeLessThan((doc.layers.length + 0) * 1 + 1);
    doc.ex.mode = 'css';
    const css = buildExport(null).code;
    expect(css).not.toContain('<use href="#cin-');
  });
});
