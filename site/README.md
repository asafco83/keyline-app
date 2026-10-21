# SVGcinema landing page

The public website for SVGcinema: what the editor does, and the way into it. It is one self-contained page,
`site/index.html`, with no build tools or runtime dependencies beyond Google Fonts. The editor is expected in an
`editor/` folder next to it.

## Files

| File                | What it is                                                                 |
| ------------------- | -------------------------------------------------------------------------- |
| `src/page.html`     | The page source: styles, markup and script, with `{{…}}` placeholders      |
| `src/hero.svg`      | The editor's sample scene, exported from SVGcinema, that plays in the hero |
| `src/snippets.json` | The embed code shown in the Export section, as the export dialog writes it |
| `build.mjs`         | Fills in the placeholders and writes `index.html`                          |
| `index.html`        | The built page (generated, do not edit)                                    |

The logo is read from `public/brand/svgcinema-logo-white.svg` at build time, so a new logo shows up on the next build.

## Build

```bash
node site/build.mjs                                            # editor links → editor/
node site/build.mjs --editor=https://example.com/app/          # editor links → anywhere else
```

`npx prettier --write site` formats the sources; `index.html` and `hero.svg` are generated, so `.prettierignore`
skips them.

## Deploying

Put `site/index.html` at the root of the site and the editor build (`dist/` from `npm run build`) in an `editor/`
folder beside it. The editor builds with relative paths (`base: './'`), so it works from a subfolder unchanged.
Both live on the same origin, so the page and the editor share the light/dark choice
(`localStorage['svgcinema:theme']`).

Every "Open the editor" link opens the editor in a new tab, so the landing page stays open behind it.

## What's on the page

- **Hero:** a copy of the editor window. `hero.svg` is inlined and its own player runs it; the timeline under it
  lists the scene's real layers and keyframe times (`TRACKS` in the page script) and scrubs the player with
  `seekTo()`.
- **What it animates:** eight small looping demos (morph, motion path, trim path, bones, gradients, masks, easing,
  filters). They pause while off screen.
- **How it works:** draw, animate, export, scrubbed by scrolling.
- **Images:** importing and the export dialog's image optimization, with a working copy of its image panel. It
  draws a test photo and compresses it with the visitor's own browser encoders, the same ones the editor uses.
- **Export:** JS player vs. pure CSS, and the embed code for each framework.
- **Tools, Free, final call to action.** Pressing a tool key while the Tools section is in view lights up that key.

Motion is turned off for visitors who ask for reduced motion.

## Updating the exported content

When the sample scene or the export output changes, refresh `src/hero.svg` and `src/snippets.json` from the editor
(dev server, in the browser console):

```js
const st = await import('/src/core/state.ts');
const build = await import('/src/export/build.ts');
const snip = await import('/src/export/snippets.ts');
Object.assign(st.doc.ex, { mode: 'js', trigger: 'load', size: 'responsive', prefix: 'hero' });
copy(build.buildExport(null).code); // → src/hero.svg
st.doc.ex.prefix = 'cin';
const out = {};
for (const fw of ['html', 'react', 'vue', 'svelte', 'angular', 'api']) out[fw] = snip.snippet(fw);
st.doc.ex.mode = 'css';
out.css = snip.snippet('html');
copy(JSON.stringify(out, null, 1)); // → src/snippets.json
```

Keep the `hero` prefix: the page script finds the player at `#hero-svg`. If the scene's keyframes change, update
`TRACKS` in `src/page.html` to match, and the file sizes quoted in the Export section.
