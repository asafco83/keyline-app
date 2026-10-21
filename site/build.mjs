// SVGcinema — landing page build
// Fills site/src/page.html with the logo, the exported sample scene and the embed snippets, and writes
// one self-contained site/index.html. Usage:
//   node site/build.mjs                      # editor links point to ./editor/
//   node site/build.mjs --editor=https://…   # editor links point somewhere else
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = p => readFileSync(join(here, p), 'utf8');
const arg = process.argv.find(a => a.startsWith('--editor='));
const editor = arg ? arg.slice('--editor='.length) : 'editor/';
const out = (process.argv.find(a => a.startsWith('--out=')) || '--out=index.html').slice('--out='.length);

// The logo comes from the brand file: the letters of "SVG", the film-strip squares (animated on load) and "cinema".
const brand = read('../public/brand/svgcinema-logo-white.svg');
let perf = 0;
const logo = [...brand.matchAll(/<path d="([^"]+)" class="(cls-\d)"\/>/g)]
  .map(([, d, cls]) => {
    const t = d.split(' ');
    const isPerf = cls === 'cls-1' && (d.match(/L/g) || []).length === 3 && +t[0].slice(1) > 31 && +t[1] < 1;
    if (isPerf) return `<path class="lg-p" style="--i:${perf++}" d="${d}"/>`;
    return `<path class="${cls === 'cls-2' ? 'lg-a' : 'lg-b'}" d="${d}"/>`;
  })
  .join('');

const hero = read('src/hero.svg').trim();
const snippets = JSON.stringify(JSON.parse(read('src/snippets.json'))).replace(/<\//g, '<\\/');

let body = read('src/page.html')
  .replaceAll('{{LOGO}}', logo)
  .replaceAll('{{HERO_SVG}}', hero)
  .replaceAll('{{SNIPS}}', snippets)
  .replaceAll('{{EDITOR_URL}}', editor);

// page.html holds the head content followed by the body; split them at the first body element
body = body.replace(/<meta name="claude:viewport-fit-sides"[^>]*>\s*/, '');
const cut = body.indexOf('<header class="top">');
if (cut < 0) throw new Error('page.html: body start not found');
const html =
  '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8" />\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />\n' +
  body.slice(0, cut).trim() +
  '\n</head>\n<body>\n' +
  body.slice(cut).trim() +
  '\n</body>\n</html>\n';

writeFileSync(join(here, out), html);
console.log(`site/${out}: ${(html.length / 1024).toFixed(1)} KB, editor links → ${editor}`);
