# Keyline — notes for Claude

Keyline is a browser SVG animation editor modelled on SVGator. You draw or import artwork, animate
properties on a timeline, and export one self-contained animated `.svg` (a JS player inside it, or
pure CSS). Live site: https://asafco83.github.io/keyline-app/ (GitHub Pages, deployed from `master`).

`README.md` is the user-facing feature list; keep it up to date with every feature.
`featureSuggestions.md` lists features that are planned but not built yet.

## How we work (the owner's workflow)

For every feature or fix:

1. Branch from `master` (`feat/…`, `fix/…`, `chore/…`) and implement.
2. Run the checks:
   - `npx prettier --write src tests` (CI fails on formatting), `npx tsc --noEmit -p .`, `npx vitest run`
   - the browser tests: `tests/browser/run.sh` (see below); add or update a browser test for the change.
3. Update `README.md` when behaviour changes.
4. Commit, push, open a PR with `gh api repos/asafco83/keyline-app/pulls …`, wait for CI to pass, then
   merge with `merge_method=merge`.
5. Wait for the "Deploy to GitHub Pages" run for the merge commit, then check the live site.
   On the live site **only inspect** (load it, check the new code/UI is there); never change the
   owner's project there (it lives in that browser's storage).
6. Report back briefly: what changed, what was tested, anything left open.

Commit messages end with the attribution lines the session asks for (Co-Authored-By / session URL).
PR bodies end with the "Generated with Claude Code" line and the session URL.

## The owner's UI preferences

- If a control doesn't apply, **hide it**. Exception: the layer action buttons (Layers panel) grey out.
- Ask questions when a request is ambiguous; propose a recommendation with the question.
- Reference images are often SVGator screenshots: match the behaviour, keep Keyline's own look.
- Keyboard shortcuts must not clash: check `src/ui/keyboard.ts` and `src/ui/view-menu.ts` first.

## Stack and layout

Vite 5 + TypeScript (strict), no framework (DOM strings + event delegation). Vitest + happy-dom for
unit tests. `paper` (booleans, lazy-loaded) and `opentype.js` (text to outlines) are the only runtime deps.

- `src/runtime/engine.ts` — **KLEngine**, the animation runtime. It is self-contained (no imports)
  because it is serialised into the exported SVG; the editor also uses it (`H` in `core/constants`).
  Write it in plain ES5-style code (`var`, `function`), like the rest of the file.
- `src/model/` — data types (`types.ts`), layer tree, filters, fonts, sample document.
- `src/core/` — state (`S` UI state, `doc` document), history (`beginEdit()` → `ed.end({insp:true})`
  is one undo step), keyframes, masks, booleans, view prefs.
- `src/render/` — stage (renders the document with the engine), overlay (selection handles, drawn
  in document coordinates into `#overlay`), markup (SVG strings), guides/rulers, text layout, fonts.
- `src/tools/` — canvas interaction: `stage-input.ts` routes pointer events (handles use `data-*`
  attributes like `data-h`, `data-node`, `data-gh`, `data-mh`); a drag is `S.drag = {move, up}`.
- `src/ui/` — panels and menus: `inspector.ts` + `props-panel.ts` (right panel), `timeline.ts`,
  `layers-panel.ts`, `layer-menu.ts` (right-click), `color-picker.ts` (the colour window), …
- `src/export/build.ts` — export (JS or CSS mode), `dialog.ts` the Export dialog.
- `src/io/` — open/save `.klp` projects (zip), SVG import, assets.

## Data model essentials

- A layer has base values `layer.b` and tracks `layer.t`: `t[prop] = [[time, value, ease, curve?, nodeType?], …]`.
- `setProp(l, k, v)` adds/updates a keyframe **only if that property already has a track**; otherwise it
  sets the base value. (There is no auto-key button.) Frozen tracks move to `layer.ft`.
- Paint values: a colour string, `'none'`, or a gradient
  `{g:'lin'|'rad', s:[[offset 0–1, colour]…], a?, p?:[x1,y1,x2,y2], cx?, cy?, r?, ra?, rr?}` in the
  shape's bounding-box units. Engine helpers: `isG`, `mixG`, `gAttrs`, `linP`, `paint`.
- Trim path: props `ts`, `te`, `to` (%), drawn with `pathLength=100` and `trimDash()`.
- CSS export can't animate everything (e.g. gradients only animate stop colours/opacity there); the JS
  export animates everything.

## Tests

- **Unit:** `npx vitest run` (`tests/*.test.ts`). `tests/output.test.ts` compares the export of a
  sample against `tests/fixtures/export-sample.json`: new options must keep default output identical.
  Regenerate deliberately with `UPDATE_FIXTURES=1 npx vitest run tests/output.test.ts`.
- **Browser:** `tests/browser/*.py` (Playwright for Python + Chromium). `tests/browser/run.sh` runs
  them all (or `run.sh color-picker gradient-handles` for some). Each prints a JSON report and a final
  `FAILS [...]` line. Feature tests drive a dev server on port 5199 and import modules directly
  (`await import('/src/core/state.ts')`); `smoke.py` clicks through the whole editor on a production build.
- **Pitfall:** after editing source files, restart the dev server before browser tests (`run.sh`
  does this). A long-running Vite server can hand dynamic imports duplicate module instances, and then
  `st.doc` is undefined in tests.
- **Pitfall:** clicking the exact centre of a selected shape hits the origin handle; tests grab shapes
  off-centre.
