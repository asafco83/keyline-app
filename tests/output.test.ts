// Golden test for what users get out of the app: the exported SVG markup and the embed snippets.
// Regenerate the fixture deliberately with:  UPDATE_FIXTURES=1 npx vitest run tests/output.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { setDoc, doc } from '../src/core/state';
import { sampleDoc } from '../src/model/sample';
import { buildExport } from '../src/export/build';
import { snippet } from '../src/export/snippets';
import { KLEngine } from '../src/runtime/engine';

const FIXTURE = resolve(process.cwd(), 'tests/fixtures/export-sample.json');
const FW = ['html', 'react', 'next', 'vue', 'angular', 'svelte', 'api'];
const CASES: Array<Record<string, any>> = [
  { mode: 'js', trigger: 'load' },
  { mode: 'js', trigger: 'hover', out: 'reverse' },
  { mode: 'js', trigger: 'click', out: 'pause' },
  { mode: 'js', trigger: 'scroll', out: 'restart' },
  { mode: 'js', trigger: 'api', ids: 'names' },
  { mode: 'css', trigger: 'load' },
  { mode: 'css', trigger: 'hover', out: 'start' },
  { mode: 'js', trigger: 'load', size: 'fixed', w: 320, h: 200 },
];

function generate() {
  const out: Record<string, string> = {};
  for (const c of CASES) {
    setDoc(sampleDoc());
    Object.assign(doc.ex, { prefix: 'kl', ids: 'gen', size: 'resp', out: 'pause' }, c);
    const key = Object.entries(c)
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    // the runtime is checked by its own tests; keep this fixture about markup, CSS and wiring
    out['svg:' + key] = buildExport(null).code.split(KLEngine.toString()).join('<KLEngine>');
    for (const fw of FW) out[`snippet:${fw}:${c.mode}`] = snippet(fw);
  }
  return out;
}

describe('export output', () => {
  const now = generate();
  if (process.env.UPDATE_FIXTURES || !existsSync(FIXTURE)) writeFileSync(FIXTURE, JSON.stringify(now, null, 1) + '\n');
  const golden = JSON.parse(readFileSync(FIXTURE, 'utf8'));

  it.each(Object.keys(golden))('%s matches the reference', k => {
    expect(now[k]).toBe(golden[k]);
  });

  it('snippets contain no TypeScript syntax from the editor source', () => {
    for (const [k, v] of Object.entries(now))
      if (k.startsWith('snippet:') && !k.startsWith('snippet:angular'))
        expect(v, k).not.toMatch(/\((\w+): (\w*Event|any|string|number)\)|\bas (HTML\w*|any)\b/);
  });
});
