<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/svgcinema-logo-white.svg" />
    <img src="public/brand/svgcinema-logo-black.svg" alt="SVGcinema" height="40" />
  </picture>
</h1>

(Formerly Keyline.)

A browser-based SVG animation editor. You draw or import artwork, animate it on a keyframe timeline, and export **one self-contained animated SVG**. The SVG plays with a small built-in JavaScript player or with pure CSS.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173 with hot reload
npm test           # unit tests (Vitest)
npm run typecheck  # TypeScript, no emit
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ locally
tests/browser/run.sh  # browser tests (Playwright for Python), see tests/browser/README.md
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
    filters.ts           Layer filters (blur, drop shadow) with animatable parameters
    pins.ts              Pin property keys and labels (Pin tool)
    sample.ts            The sample scene

  geometry/
    nodes.ts             Path nodes, shape builders, splitting/equalizing for morphs
    parse-path.ts        SVG path-data parser (all commands including arcs)

  render/
    markup.ts            Layer → SVG markup (shared by the editor canvas and the exporter)
    text-layout.ts       Text line breaking ("Keep width" wrapping) and measuring
    stage.ts             Canvas render, fit, per-frame update
    overlay.ts           Selection box, handles, motion paths, nodes, pen preview

  tools/
    stage-input.ts       Canvas pointer handling
    bones.ts             Bone tool, forward kinematics, inverse kinematics (CCD)
    pins.ts              Pin tool and Edit pins tool
    edit-tools.ts        Move/scale/rotate/origin drags, text creation, node editing
    pen.ts               Pen, add/remove node, pencil; path hit-testing
    shapes.ts            Ellipse, rectangle, polygon, star, line
    hand.ts              Pan and zoom (hand tool, Space, wheel)

  ui/                    Panels and controls
    layers-panel.ts  timeline.ts  inspector.ts  easing.ts
    tools-rail.ts (tool groups and flyouts)  theme.ts (light/dark)  topbar.ts  file-menu.ts  keyboard.ts
    props-panel.ts (inspector sections)  align.ts (align bar, Set motion path)

  io/                    Files
    assets.ts            Image import (incl. TIFF/HEIC conversion), IndexedDB, asset panel
    svg-import.ts        SVG → editable layers (keeps group hierarchy)
    zip.ts               Minimal zip writer/reader and the .SVGcinema builder
    save.ts  open.ts  guard.ts  file-state.ts   Save/Save as, open, unsaved-changes prompt

  export/
    build.ts             Builds the exported SVG (JS player or CSS keyframes)
    dialog.ts            Export dialog controls
    snippets.ts          Embed code for HTML, React, Next.js, Vue, Angular, Svelte
    size.ts              Output size (responsive/fixed, W/H/%)
    images.ts            Image optimization (resize for output size, format, quality)

  app/boot.ts            Startup: restore the last project, assets and file handle

tests/                   Vitest: runtime player and easing, zip container, path geometry, export output
site/                    The landing page (one self-contained index.html), see site/README.md
```

## How the pieces fit

**The runtime is embedded by serialising a function.** `export/build.ts` writes `CinEngine.toString()` into each exported SVG.

- **Keep it self-contained.** `src/runtime/engine.ts` must not import anything or touch module scope.
- **The test guards this.** `tests/engine.test.ts` rebuilds the function from its source text and runs it.
- **The build target protects it.** Vite builds for ES2019, so the bundler never injects helper functions into it.

**Modules have no side effects on import.** Each module only defines functions and constants. Event listeners and other setup live in an exported `init()`, and `src/main.ts` calls the `init()` functions in a fixed order. This keeps the circular imports between UI modules safe.

**Shared mutable state uses setters.** ES module imports are read-only bindings, so replacing the open document goes through `setDoc()` and the canvas engine through `setEng()`. Other examples are `setIdc()`, `nextAid()` and `setLastExport()`. Reading `doc` anywhere always gives the current document.

**The editor canvas renders the exact SVG that gets exported.** `render/markup.ts` produces markup for both, and the canvas is animated by the same runtime that ships in the file. What you see while editing is what you get.

## The sample scene

The editor opens with a sample scene (also under File → New → **Open sample scene**). It doubles as a tour of what SVGcinema can animate; select a layer to see how it's done:

- **Sky**: an animated linear gradient, night to dawn. **Night sky**: star shapes with an animated corner radius, a blink made of hold keyframes and an elastic pulse; the group fades out.
- **Sunrise**: a group rising as one. **Glow** has a radial gradient, an animated blur filter and screen blending; **Rays** spin and scale; the **Sun** changes colour.
- **Blob** morphs between shapes with a custom easing curve. **Comet** follows a curved motion path and turns along it; **Comet trail** shows travelling dashes (an animated dash offset).
- **Hills** is a clipping group: the drifting **Mist** only shows inside the hill silhouette (the **Clip path** folder).
- **Sprout** is a bone rig: three bones carry the stalk, leaves and flower, and sway with follow-through; the top bone squashes and stretches as it swings. The **Leaf** is pinned: one pin holds its base while the other flutters its tip.
- **Flag**: the **Pole** is a line whose end grows; the **Pennant** is a polygon with a gradient, a skew wave and an animated corner radius.
- **Landscape**: **Horizon** draws on with Trim path; **Signature** is a mask group whose gradient wipe reveals a line that links to this editor.
- **Title** slides and fades in with an animated drop shadow.

`tests/sample.test.ts` checks the scene keeps showing all of these.

## Tools

| Tool             | Key | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Select           | V   | Move, scale, rotate; Ctrl+click picks inside groups                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Edit nodes       | A   | Drag nodes and handles; double-click toggles smooth/corner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Pen group**    |     | Hold or right-click the button for the flyout                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Pen              | P   | Click = corner, drag = curve. While dragging: Alt breaks the handle, Shift snaps to 45°, Space moves the point. Click the first point to close; click the last point to drop its handle. Enter / Esc / Ctrl+click ends, Backspace removes the last point. On the selected path: hover a segment to add a node, a node to delete it, Alt+node to convert it, an open end to continue the path                                                                                                                                                                                |
| Add node         | +   | Click a segment of the selected path (rectangles and ellipses convert to paths)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Remove node      | −   | Click a node of the selected path                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Convert point    | ⇧C  | Click a point: corner. Drag a point: smooth handles (Shift 45°). Drag a handle: moves it alone (cusp). Drag a segment: reshapes the curve. With the Pen, Alt does the same on points and handles                                                                                                                                                                                                                                                                                                                                                                            |
| Pencil           | N   | Freehand; simplified and smoothed. End near the start to close                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Shapes group** |     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Ellipse          | O   | Shift = circle, Alt = from the centre                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Rectangle        | M   | Shift = square, Alt = from the centre                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Polygon          |     | Drag from the centre; ↑/↓ while dragging changes the sides; Shift keeps it upright                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Star             |     | As polygon; ↑/↓ changes the points                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Line             | L   | Shift = 45° steps, Alt = from the centre                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Text             | T   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Bone group**   |     | Hold or right-click the button for the flyout                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Bone tool        | B   | Drag to draw a bone; start on a bone tip to chain a child bone. New bones get a Rotate keyframe at 0 s holding the rest pose, so dragging a bone (or its tip, for IK) animates it. A bone's Scale works in the bone's own direction: W stretches along the bone, H across it                                                                                                                                                                                                                                                                                                |
| Edit bone        | E   | Edits the rest pose; keyframes stay as they are, and the bones show their rest pose while the tool is on (a _Rest pose_ chip says so). Drag a tip to change the bone's length and angle: bones chained on that tip follow it while their own tips stay put, and attached artwork doesn't move. Drag a joint to move it (a joint on its parent's tip moves that tip; Alt pulls the joint off it). Drag the bone to move it. Ctrl while dragging a tip turns the attached artwork with the bone. Shift snaps the angle to 15°; a tip snaps onto other bones' joints and tips  |
| Scale bone       | S   | Drag along a bone to scale it, keyed at the playhead (the drag makes the Scale track). The options bar at the top of the work area picks what a drag changes: _Length_ (W, along the bone), _Thickness_ (H, across it, drag sideways), _Linked_ (both), or _Squash & stretch_ (W up, H down: _Volume_ Area keeps W × H, Tube keeps W × H²). Tab while dragging switches the mode, Shift snaps to 10%. Child bones don't inherit a bone's scale unless their _Inherit scale_ is on: they follow the stretched tip without being stretched, in the editor and in both exports |
| Bind             |     | Click a bone or layer (Shift+click adds more), then click the bone it should hang on. It keeps its place on the canvas, and its keyframes keep their positions at their times. A bone dropped near the new parent's tip snaps onto it (Alt keeps the offset). Clicking empty canvas unbinds the picks (they move to the group that holds the rig). A bone can't go under itself or its children. Esc clears the picks                                                                                                                                                       |
| **Pin group**    |     | Hold or right-click the button for the flyout                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Pin tool         | W   | Click a path or shape to add a pin (rectangles and ellipses become paths). Drag a pin to bend the path, keyed at the playhead (the first drag makes the pin's track, starting from its rest place at 0 s). Drag the ring of the selected pin to turn it (Shift snaps to 15°). Alt+drag moves a pin at rest without bending. Delete removes the selected pin. A dashed dot shows where a moved pin sits at rest. Images, text and groups can't take pins yet                                                                                                                 |
| Edit pins        |     | Moves pins at rest: the path shows its rest shape (a _Rest pose_ chip says so), and a pin you drag takes its motion with it (its keys move by the same amount). Shift moves straight. Delete removes the selected pin                                                                                                                                                                                                                                                                                                                                                       |
| Hand             | H   | Drag to pan. Hold Space for the hand in any tool (a tap plays/pauses). Middle-drag pans, the wheel scrolls, Ctrl+wheel zooms at the pointer, double-click the hand to fit                                                                                                                                                                                                                                                                                                                                                                                                   |

Drawing tools stay active after each shape, as in Adobe apps. Press V or Esc to go back to Select.

**Zoom:** click the percentage at the bottom of the work area for a menu with a slider (2%–3200%), a typed value, _Fit selection_ (2), _Fit_ (1), _Zoom 100%_ (0), _Zoom in_ (Ctrl +) and _Zoom out_ (Ctrl −). The − / + buttons beside it step the zoom; Ctrl+wheel zooms at the pointer.

**Layers panel tree:** dotted lines join each group to its children, so nesting is easy to follow. Layers that a mask or clip folder applies to show a small hook before their icon (hover it for which folder), and the folder itself carries a mask badge.

**Layers panel actions** grey out when they don't apply:

- **The top bar**, left to right:
  - **Move layer up** (Ctrl+]) and **Move layer down** (Ctrl+[).
  - **Duplicate** (Ctrl+D).
  - **Ungroup** (Ctrl+Shift+G).
  - **Group** (Ctrl+G); with nothing selected it adds an empty group.
  - **Release mask**: on a selected mask or clipping group, puts its layers back.
  - **Create mask**: with two or more layers selected, the top one masks the others (as in the right-click menu).
  - **Delete**.
- **At the bottom:** the layer count ("1 of 9 selected") and, on the right, **Animate**, which opens a menu of the properties the selected layers can animate. Picking one adds a keyframe at the playhead. Shortcuts: Shift+P position, Shift+A origin, Shift+S scale, Shift+R rotate, Shift+X skew, Shift+O opacity, Shift+B stroke color, Shift+W stroke width, Shift+D trim end (draw on), Shift+F dash offset, Shift+M morph. Fill color, fill opacity and stroke opacity have no shortcut (Shift+C is the Convert Point tool).

**Light and dark theme:** the editor follows the system setting until you pick one with the half-circle button in the top bar, right of Keyboard shortcuts; the choice is remembered. Numbers use the UI font with tabular digits, so zeros stay open and columns still line up.

**Work area:** the artboard shows the project name and canvas size above its top-left corner. The **?** at the bottom left shows the current tool's tips on hover (or when focused); with rulers on it moves clear of the left ruler. The timeline shows the current time and the total length (`0:01.50 / 0:03.00`), and the playhead carries a time flag in the ruler.

**Inspector** (properties of the selected layer):

- **Header:** the layer's name (click to rename) and type.
- **Sections** open and close: click a section's heading (or its chevron). Closed sections stay closed for every layer and after a reload.
- **Keyframe toggles:** every animatable property has its own row and its own ◆, so colour and opacity, for example, animate separately. The ◆ shows three states, explained in the Transforms heading: a grey outline when the property isn't animated, amber with an amber label when it is, and filled amber when there is a keyframe at the playhead. Click it to add or remove the keyframe at the playhead.
- **Align bar** at the top: align left / centre / right / top / middle / bottom, distribute horizontally / vertically. One layer aligns to the canvas, several align to each other; distributing needs three or more. Below it, the boolean operations (union, subtract, intersect, exclude) for two or more shapes or paths; with fewer selected they grey out and a note says what they need.
- **Text:** content, position and measured size.
- **Shape settings** (at the top for these shapes): polygon _Sides_; star _Points_ and _Ratio_ (inner / outer radius); corner _Radius_ for rectangles, polygons and stars (capped so corners never overlap, and animatable: the runtime rebuilds the rounded path every frame); line _From_ / _To_, each keyable on its own so a line can grow or swing. Polygons and stars keep their settings until their nodes are edited by hand or they get Morph keyframes; then they are plain paths.
- **Transforms:** position, scale (with a keep-proportions link), skew X/Y, rotate as turns + degrees (with a _rotate along the motion path_ toggle when the layer has one), origin, anchor grid, flip.
- **Motion path:** _Set motion path_ makes the layer follow a path, rectangle or ellipse over the whole animation (one keyframe per point, timed for an even speed). On the canvas, drag a segment of the path to curve it, drag its handles to fine-tune, double-click a segment to straighten it. **Path node** (below it) edits the keyframe at the playhead, or the one before it: its type (straight, mirrored, asymmetric, disconnected) and position; ‹ › step between nodes. Alt-drag a handle to move it alone.
- **Text appearance:** font (basic stacks, 31 Google Fonts including Hebrew ones, and fonts on this computer — Chrome/Edge can list them after you allow it; elsewhere type a font name), style (weight × italic), bold / italic / underline / overline / strikethrough, size, letter spacing, alignment, line height, and **Keep width**: when on, the box keeps its width and lines break to fit it.
- **Fill & stroke:** each colour row has a swatch, an eyedropper and the value as text (a colour, `none`, or _Linear_ / _Radial_ for a gradient). Click the swatch to open the colour window. Its top row picks the type: _None_, _Solid_, _Linear_ or _Radial_.
  - **Colour:** saturation/brightness area, hue and opacity sliders, an eyedropper (in browsers that support it), and Hex / R G B / A fields. Changes show live; clicking outside or pressing Esc closes the window as one undo step.
  - **Gradient editor:** drag stops along the bar and click it to add one. The colour part edits the selected stop. A stop has a colour, opacity and position. Linear gradients have an angle; radial ones have a centre and radius.
  - **On the canvas:** while the window edits a gradient, the shape shows its handles. Linear: drag the start (hollow) or end (filled) point, or the bar to move both; Shift keeps 15° steps. Radial: drag the centre, the round handle for size and direction, and the square handle for the other radius (an ellipse).
  - **Animating:** gradients animate like colours, blending stops, angle, centre and radius, and even fading from a solid colour. In CSS-only exports, gradients animate their stop colours only.
  - **Other controls:** fill and stroke opacity, stroke width, and a swap button. The document background uses the same window (None or Solid).
- **Appearance:** _Trim path_ (Start / End / Offset %, all animatable) shows part of a stroke, for draw-on and travelling-dash effects. Also: paint order, blending, isolate, opacity slider, line ends, line join, miter limit, dash pattern, dash offset, path length. (To draw a line on, animate Trim End from 0% to 100%: Shift+D.)
- **Filters:** blur and drop shadow, reorderable, every parameter animatable (in JS export mode; CSS mode exports filters as static).

**Typing text:** double-click a text on the canvas (or click it with the Text tool) to type in place. The real text stays visible with all its styles while you type; the panel's text box updates the canvas live too. While typing, the box has a handle on each side: drag one to set the width (Keep width turns on and lines wrap). When the text is only selected, its handles scale it like any layer. Space types a space while you edit. Esc, Ctrl+Enter or clicking away finishes. With the Text tool, click for text that grows as you type, or drag to draw a box of fixed width whose lines wrap.

**Right-click menu** (on the canvas or in the Layers panel), modelled on SVGator's:

- **Copy / Paste:** Cut, Copy, Paste, Paste in place, Duplicate.
- **Layer commands:** Group, Ungroup, Delete, Center origin, Animate, Set motion path, Hyperlink, Convert to path, Export selection.
- **Masks:** Create clipping path, Create mask, Release mask.
- **Placement:** Align, Arrange, Lock, Rotate 90°, Flip horizontal / vertical.

Shortcuts: Ctrl X / C / V, Ctrl ⇧ V (paste in place), Ctrl ⇧ O (center origin), Ctrl ⇧ P (convert to path), Ctrl ⇧ E (export selection), Ctrl L (lock), Ctrl ⇧ ] / [ (bring to front / send to back). Ctrl C / V copy keyframes when keyframes are selected, and layers otherwise.

**Masks:** select two or more layers, then choose _Create mask_. The top layer goes into a _Masks_ folder inside a new _Mask group_, and the other layers show only where the mask is.

- Masks work by opacity, so soft and semi-transparent masks behave as expected.
- A _clipping path_ uses only the mask's shape.
- Mask layers stay normal layers: select them in the Layers panel to move, edit or animate them. A drag inside the selection box moves them even though they aren't drawn.

**Boolean operations** (second row of the align bar, or right-click ▸ Boolean): select two or more shapes or paths.

- _Union_ combines them.
- _Subtract_ cuts the upper ones out of the bottom one.
- _Intersect_ keeps only the overlap.
- _Exclude_ keeps where they don't overlap.

They're combined as they look at the playhead into one new path, which takes the bottom layer's place and style. Undo restores the originals.

**Posing a rig:** with _Key whole rig_ on (the default; it sits in the Bone section of the rig's top bone), dragging any bone (FK, IK or Scale bone) keys every bone of the rig at the playhead, so each pose is stored whole. The new keys hold the values the bones already had there, and the easing they split is split with them, so nothing else in the animation changes. Turn it off for overlapping action (only the bone you drag is keyed). Turning it on for a rig whose poses have keys on some bones only offers to _Add keys_: every bone gets a key at each of the rig's key times, again without changing the motion; turning it on and adding the keys is one undo step. In the timeline, the top bone has a **Pose** row with a diamond at every time any bone of the rig has a key: click one to select all of them, drag to retime the pose, Delete to remove it.

**Bending with pins:** each pin pulls the path's nodes (and their handles) with it, nearer nodes more than far ones; a pin can also turn, bending the path around it. A pin that doesn't move holds the path in place. The **Pins** section of the inspector has a button per pin; the rows below it edit the selected pin: _Position_ and _Rotation_, each with its own ◆, and _Reach_, how far every pin of the path pulls (100% by default). _Remove pin_ and _Remove all pins_ take them off (the path keeps its rest shape). In the timeline each pin has its own rows (_Pin 2_, _Pin 2 · Rotation_). Both exports bend the path: the JS player computes it, and the CSS export animates the path's shape with SMIL, as for morphs.

**Snapping, grid, rulers and guides** (the magnet and grid buttons in the canvas bar):

- **Snapping** (Alt+S turns it on or off) works while moving and drawing. It can snap to objects (the edges and centres of other layers and of the canvas), to points (path nodes), to guides, to the grid, and to whole pixels. Matches show as magenta lines, and holding Ctrl/Cmd skips snapping.
- **Grid:** a back grid sits behind the artwork and a front grid over it. The grid size is set in the grid menu.
- **Rulers** (Alt+R): drag from a ruler to make a guide.
- **Show bones** (Alt+B) shows or hides bones on the canvas.
- **Guides** (Alt+L shows or hides them): drag a guide to move it, or drop it on a ruler to remove it. _Clear guides_ removes them all.

The guides are saved with the project; the other view settings are remembered in this browser.

**Hyperlink:** gives a layer a link (web address, mailto:, tel: or #anchor) that opens in a new tab or the same one. Clicking the layer in the exported SVG follows it.

**Timeline length:** the timeline always fills its panel, past the end of the animation (that part is shaded). The white line marks the end: drag it to change the length (it snaps to 0.05s; Shift for 0.01s) and a tag shows the length while you drag. The Length box follows along, and typing in it still works. With the end line focused, ←/→ change the length by 0.1s (Shift: 1s).

**Freezing a track:** hover a property row in the timeline and click the snowflake, left of the property name. The track keeps its keyframes but stops using them: the property holds the value it had at the playhead, the row and its keyframes turn grey, no keyframes can be added, and exports leave it out. Editing the property meanwhile changes the held value. Click the snowflake again to unfreeze and go back to the keyframes.

**Moving keyframes:** with position keyframes selected in the timeline, dragging the layer or using the arrow keys on the canvas moves all of them together (select them all to move the whole motion path). Arrow keys pressed while working in the timeline still move the selected keyframes in time.

**Web fonts in exports:** Google Fonts are converted to outlines by default (no font download, identical everywhere, also inside `<img>`). _Embed font_ instead keeps live, selectable text and embeds only the alphabets the text uses, which is smaller for long text. Right-to-left text is always embedded so its letters keep their order. Fonts from this computer are converted or embedded the same way once the browser has shared them (embedding includes the whole font file); otherwise the SVG only names the font.

## The `.SVGcinema` project format

A `.SVGcinema` file is a standard zip archive:

| Entry                      | Contents                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `manifest.json`            | `format: "svgcinema-project"`, version, name, save time, canvas size, counts        |
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
- `tests/zip.test.ts`: the `.SVGcinema` container.
- `tests/geometry.test.ts`: path parsing and morph helpers.
- `tests/output.test.ts`: compares the exported SVG (JS and CSS modes, every trigger) and every embed snippet against `tests/fixtures/export-sample.json`. It also checks that no editor TypeScript syntax leaks into a snippet. After an intended change to the output, regenerate the reference with `UPDATE_FIXTURES=1 npx vitest run tests/output.test.ts` and review the diff.

## Deploying (GitHub Pages)

`.github/workflows/pages.yml` tests, builds and publishes `dist/` on every push to `master` (or on demand from the Actions tab).

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Pages on a private repository needs a paid GitHub plan; otherwise make the repository public.

The site is served at `https://<user>.github.io/<repo>/`. The Vite `base: './'` setting makes asset paths relative, so no extra configuration is needed.

**Landing page:** `site/` holds the SVGcinema website that introduces the editor and links into it. `node site/build.mjs` builds `site/index.html`, which expects the editor in an `editor/` folder beside it. The Pages workflow does not publish it yet. See [`site/README.md`](site/README.md).

## Toward a desktop app (Tauri)

The code is ready for a Tauri shell without changes. When it gets wrapped:

- **Files:** replace the browser file APIs in `io/save.ts` and `io/open.ts` with Tauri's dialog and fs plugins. This gives true overwrite-on-save, recent files and `.SVGcinema` file associations.
- **Image encoding:** add native encoders (mozjpeg, oxipng, ravif) behind the same `optimizeAsset` interface in `export/images.ts`.
- **Video and GIF export:** these become practical with native libraries.

## Browser support

SVGcinema targets current Chrome, Edge, Firefox and Safari.

- **Save overwriting the same file** needs the File System Access API (Chrome and Edge). Other browsers download a fresh copy.
- **AVIF export** appears only where the browser can encode it.
- **Shape animation in CSS-only exports** (morphs, animated line ends, polygon / star corner radius) is written as SMIL `<animate>`, because Safari doesn't support the CSS `d: path()` property. With the hover trigger it stays `d: path()` (CSS pauses it on mouse out, which SMIL ignores), so in Safari those shapes don't move.

## License

SVGcinema is proprietary software: © 2026 asafco83, all rights reserved. You may use the app to make animations, and the files you export are yours to use for anything, including commercial work. The source code may not be copied, changed or redistributed without permission. See [LICENSE](LICENSE) for the full terms.
