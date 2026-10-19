# Keyline

A browser-based SVG animation editor. You draw or import artwork, animate it on a keyframe timeline, and export **one self-contained animated SVG**. The SVG plays with a small built-in JavaScript player or with pure CSS.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173 with hot reload
npm test           # unit tests (Vitest)
npm run typecheck  # TypeScript, no emit
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ locally
```

Requires Node 18 or newer (developed on Node 22).

## Project layout

```
index.html               App shell: panels, dialogs, menus (static markup)
src/
  main.ts                Entry point: loads CSS, then runs every module's init() in order
  styles/app.css         All styles and theme tokens (light and dark)

  runtime/engine.ts      The player that ships inside every exported SVG (typed, dependency-free)

  core/
    constants.ts         Helpers ($, byId, rounding, escaping), property tables, icons, tool list
    state.ts             Editor state: the open document, selection, assets, id counters
    dom.ts               References to the main DOM elements
    history.ts           Undo/redo snapshots, setProp/toggleKey, selection, tool switching
    keyframes.ts         Keyframe clipboard, reverse, distribute, nudge, context menu
    layer-ops.ts         Convert to path, morph into another shape
    playback.ts          Editor preview playback loop

  model/
    tree.ts              Layer hierarchy (groups, bones), parent matrices
    sample.ts            The sample scene

  geometry/
    nodes.ts             Path nodes, shape builders, splitting/equalizing for morphs
    parse-path.ts        SVG path-data parser (all commands including arcs)

  render/
    markup.ts            Layer → SVG markup (shared by the editor canvas and the exporter)
    stage.ts             Canvas render, fit, per-frame update
    overlay.ts           Selection box, handles, motion paths, nodes, pen preview

  tools/
    stage-input.ts       Canvas pointer handling
    bones.ts             Bone tool, forward kinematics, inverse kinematics (CCD)
    edit-tools.ts        Move/scale/rotate/origin drags, shape/text/pen creation, node editing

  ui/                    Panels and controls
    layers-panel.ts  timeline.ts  inspector.ts  easing.ts
    tools-rail.ts  topbar.ts  file-menu.ts  keyboard.ts

  io/                    Files
    assets.ts            Image import (incl. TIFF/HEIC conversion), IndexedDB, asset panel
    svg-import.ts        SVG → editable layers (keeps group hierarchy)
    zip.ts               Minimal zip writer/reader and the .klp builder
    save.ts  open.ts  guard.ts  file-state.ts   Save/Save as, open, unsaved-changes prompt

  export/
    build.ts             Builds the exported SVG (JS player or CSS keyframes)
    dialog.ts            Export dialog controls
    snippets.ts          Embed code for HTML, React, Next.js, Vue, Angular, Svelte
    size.ts              Output size (responsive/fixed, W/H/%)
    images.ts            Image optimization (resize for output size, format, quality)

  app/boot.ts            Startup: restore the last project, assets and file handle

tests/                   Vitest: runtime player and easing, zip container, path geometry, export output
```

## How the pieces fit

**The runtime is embedded by serialising a function.** `export/build.ts` writes `KLEngine.toString()` into each exported SVG.

- **Keep it self-contained.** `src/runtime/engine.ts` must not import anything or touch module scope.
- **The test guards this.** `tests/engine.test.ts` rebuilds the function from its source text and runs it.
- **The build target protects it.** Vite builds for ES2019, so the bundler never injects helper functions into it.

**Modules have no side effects on import.** Each module only defines functions and constants. Event listeners and other setup live in an exported `init()`, and `src/main.ts` calls the `init()` functions in a fixed order. This keeps the circular imports between UI modules safe.

**Shared mutable state uses setters.** ES module imports are read-only bindings, so replacing the open document goes through `setDoc()` and the canvas engine through `setEng()`. Other examples are `setIdc()`, `nextAid()` and `setLastExport()`. Reading `doc` anywhere always gives the current document.

**The editor canvas renders the exact SVG that gets exported.** `render/markup.ts` produces markup for both, and the canvas is animated by the same runtime that ships in the file. What you see while editing is what you get.

## The `.klp` project format

A `.klp` file is a standard zip archive:

| Entry                      | Contents                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `manifest.json`            | `format: "keyline-project"`, version, name, save time, canvas size, counts          |
| `project.json`             | The document: layers, keyframes, easing presets, export settings                    |
| `assets/index.json`        | One entry per asset: id, name, kind, MIME type, size in pixels and bytes, file path |
| `assets/<id>-<name>.<ext>` | Each image as its original file                                                     |

`project.json` references assets by id, so images are stored once.

## Typing

The document model lives in `src/model/types.ts`: `Doc`, `Layer`, `Geometry`, `BaseValues`, `Tracks`, `ExportSettings`, `Asset`, plus the transient `EditorState` (`S`) and `Drag`. The runtime's `EngineLayer` is the exported subset of `Layer`.

`tsconfig.json` is `strict`, including `noImplicitAny`, with two exceptions:

- `strictNullChecks` is off;
- `useUnknownInCatchVariables` is off.

Explicit `any` remains where the code works with the page directly: `$()` and `byId()` lookups, a few panel elements in `core/dom.ts`, and `e.target` in delegated event handlers. Typing those is the next step, before `strictNullChecks` is switched on.

Conventions:

- Drag gestures assign an object to `S.drag`. Its `move(p, e)` and `up(p, e)` get their types from `Drag`, so don't annotate them.
- Shared tables keyed by strings (`ICON`, `EXT_OF`, ...) are typed `Record<string, ...>`.
- Timers use `ReturnType<typeof setTimeout>`, so the code compiles with or without Node types.

## Tests

- `tests/engine.test.ts`: easing, interpolation, the player API, and that the player can be embedded.
- `tests/zip.test.ts`: the `.klp` container.
- `tests/geometry.test.ts`: path parsing and morph helpers.
- `tests/output.test.ts`: compares the exported SVG (JS and CSS modes, every trigger) and every embed snippet against `tests/fixtures/export-sample.json`. It also checks that no editor TypeScript syntax leaks into a snippet. After an intended change to the output, regenerate the reference with `UPDATE_FIXTURES=1 npx vitest run tests/output.test.ts` and review the diff.

## Deploying (GitHub Pages)

`.github/workflows/pages.yml` tests, builds and publishes `dist/` on every push to `master` (or on demand from the Actions tab).

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Pages on a private repository needs a paid GitHub plan; otherwise make the repository public.

The site is served at `https://<user>.github.io/<repo>/`. The Vite `base: './'` setting makes asset paths relative, so no extra configuration is needed.

## Toward a desktop app (Tauri)

The code is ready for a Tauri shell without changes. When it gets wrapped:

- **Files:** replace the browser file APIs in `io/save.ts` and `io/open.ts` with Tauri's dialog and fs plugins. This gives true overwrite-on-save, recent files and `.klp` file associations.
- **Image encoding:** add native encoders (mozjpeg, oxipng, ravif) behind the same `optimizeAsset` interface in `export/images.ts`.
- **Video and GIF export:** these become practical with native libraries.

## Browser support

Keyline targets current Chrome, Edge, Firefox and Safari.

- **Save overwriting the same file** needs the File System Access API (Chrome and Edge). Other browsers download a fresh copy.
- **AVIF export** appears only where the browser can encode it.
- **CSS-only morph** uses `d: path()`, which Safari does not support.
