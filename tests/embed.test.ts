// The editable project inside an export: off by default, and read back exactly.
import { describe, it, expect } from 'vitest';
import { setDoc, doc, setIdc } from '../src/core/state';
import { sampleDoc } from '../src/model/sample';
import { buildExport } from '../src/export/build';
import { parseSVG } from '../src/io/svg-import';
import { readEmbedded, renumber } from '../src/io/embed';

describe('project inside the export', () => {
  it('is not there unless asked for', () => {
    setDoc(sampleDoc());
    expect(buildExport(null).code).not.toContain('svgcinema-project');
  });
  it('comes back as the same project', () => {
    setDoc(sampleDoc());
    doc.ex.proj = true;
    doc.layers[0].name = 'Sky & <night> "a" ]]>';
    const code = buildExport(null).code;
    expect(code).toContain('<metadata><svgcinema-project');
    const e = readEmbedded(parseSVG(code)!)!;
    expect(e.doc.layers).toEqual(JSON.parse(JSON.stringify(doc.layers)));
    expect([e.doc.name, e.doc.dur, e.doc.w, e.doc.h, e.doc.ex.proj]).toEqual([doc.name, doc.dur, doc.w, doc.h, true]);
  });
  it('gives added layers new ids, with every reference following', () => {
    setDoc(sampleDoc());
    setIdc(1000);
    let n = 0;
    const out = renumber(doc.layers, () => 'n' + ++n, {});
    const ids = new Set(out.map(l => l.id));
    expect(ids.size).toBe(doc.layers.length);
    out.forEach(l => {
      if (l.parent) expect(ids.has(l.parent)).toBe(true);
      (l.pins || []).forEach(p => p.bone && expect(ids.has(p.bone)).toBe(true));
      (l.dord || []).forEach(id => expect(ids.has(id)).toBe(true));
    });
  });
});
