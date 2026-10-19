// Ratchet for the gradual move to `noImplicitAny`.
// TypeScript can't enable a flag per folder, so this runs the whole project with the flag on
// and fails only on errors inside the folders listed below. Add a folder once it is clean.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const STRICT = ['src/runtime/', 'src/geometry/', 'src/model/', 'src/core/'];

const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
const run = spawnSync(process.execPath, [tsc, '--noEmit', '--noImplicitAny', '--pretty', 'false'], {
  encoding: 'utf8',
});
const errors = (run.stdout + run.stderr).split(/\r?\n/).filter(l => /error TS\d+/.test(l));
const norm = l => l.replace(/\\/g, '/');
const inStrict = errors.filter(l => STRICT.some(d => norm(l).startsWith(d)));

const left = {};
for (const l of errors) {
  if (inStrict.includes(l)) continue;
  const dir = norm(l).split('(')[0].split('/').slice(0, 2).join('/');
  left[dir] = (left[dir] || 0) + 1;
}

if (inStrict.length) {
  console.error(inStrict.join('\n'));
  console.error(`\n${inStrict.length} implicit-any error(s) in strict folders: ${STRICT.join(', ')}`);
  process.exit(1);
}
console.log(`Strict folders clean: ${STRICT.join(', ')}`);
const rest = Object.entries(left).sort((a, b) => b[1] - a[1]);
if (rest.length) console.log('Still to migrate: ' + rest.map(([d, n]) => `${d} ${n}`).join(', '));
