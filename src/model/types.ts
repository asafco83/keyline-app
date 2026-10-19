// Keyline — model/types
// The editor's document model. The runtime's EngineLayer is the exported subset of Layer.
import type { ShapeParams } from '../geometry/nodes';
import type { Ease, EngineSubPath, Keyframe } from '../runtime/engine';

export type { Ease, Keyframe };

export type Vec2 = [number, number];

/** Cubic path node: anchor x,y, in-handle x,y, out-handle x,y (6 numbers). */
export type PathNode = number[];
/** `c`: closed, `n`: nodes */
export type SubPath = EngineSubPath;
export type PathData = SubPath[];

export type LayerType = 'group' | 'rect' | 'ellipse' | 'path' | 'text' | 'image' | 'bone' | 'raw';

/** Animatable properties. `org` is stored on `Layer.o`, the rest on `Layer.b`. */
export type PropKey =
  | 'p0'
  | 'p1'
  | 'rad'
  | 'pos'
  | 'org'
  | 'rot'
  | 'scl'
  | 'skw'
  | 'op'
  | 'fill'
  | 'fo'
  | 'stk'
  | 'so'
  | 'sw'
  | 'draw'
  | 'dof'
  | 'd'
  /** filter parameter: fx.<filter id>.<param> */
  | `fx.${string}`;

/** Unanimated values. */
export interface BaseValues {
  pos: Vec2;
  rot: number;
  scl: Vec2;
  op: number;
  fill: string;
  stk: string;
  sw: number;
  draw: number;
  d?: PathData;
  /** skew x/y in degrees */
  skw?: Vec2;
  /** fill / stroke opacity 0–1 */
  fo?: number;
  so?: number;
  /** stroke dash offset */
  dof?: number;
  [extra: string]: any;
}

/** Animated tracks keyed by PropKey (string-indexed to match the runtime's EngineLayer). */
export type Tracks = Record<string, Keyframe[]>;

/**
 * Shape geometry. Which fields are present depends on `Layer.type`:
 * rect x,y,w,h,rx · ellipse cx,cy,rx,ry · text x,y,text,size,family,weight,anchor ·
 * image x,y,w,h,asset · bone x,y,len,ang · raw markup.
 */
export interface Geometry {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rx?: number;
  ry?: number;
  cx?: number;
  cy?: number;
  text?: string;
  size?: number;
  family?: string;
  weight?: string;
  anchor?: 'start' | 'middle' | 'end' | string;
  /** text: italic */
  italic?: boolean;
  /** text: CSS text-decoration lines, e.g. 'underline line-through' */
  deco?: string;
  /** text: letter spacing in px */
  ls?: number;
  /** text: keep the box width while typing and wrap lines at `ww` */
  wrap?: boolean;
  ww?: number;
  /** text: line height as a multiple of the font size */
  lh?: number;
  asset?: string;
  len?: number;
  ang?: number;
  markup?: string;
  [k: string]: any;
}

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  /** parent group or bone id */
  parent: string | null;
  geo: Geometry;
  b: BaseValues;
  t: Tracks;
  /** transform origin (layer space); null means the shape's own default */
  o: Vec2 | null;
  /** polygon / star drawn with the shape tools: its settings, so sides, points, ratio and corner
   *  radius stay editable. `sig` is the path it produced; once the path is edited by hand (or morphs)
   *  the settings no longer apply. */
  shape?: ShapeParams & { sig?: string };
  /** curved motion path */
  sm: boolean;
  /** orient along motion path */
  or: boolean;
  hid: boolean;
  lock: boolean;
  /** extra transform kept from imported SVG */
  xf: string;
  /** extra SVG attributes kept from import or tools */
  extra: Record<string, string>;
  /** filters, applied in order */
  fx?: Array<{ id: string; type: string }>;
  /** runtime map for animated filter parameters (derived from fx, see model/filters) */
  fa?: Record<string, [string, string]>;
  /** compositing: CSS mix-blend-mode and isolation */
  blend?: string;
  iso?: boolean;
  /** bones: IK pin */
  pin?: boolean;
  /** bones: rotation limit */
  lim?: boolean;
  lmin?: number;
  lmax?: number;
}

export interface EasingPreset {
  name: string;
  v: Ease;
}

export interface ExportSettings {
  mode: 'js' | 'css';
  trigger: 'load' | 'click' | 'hover' | 'scroll' | 'api';
  /** what happens on mouse out (hover trigger) */
  out: 'pause' | 'reverse' | 'restart' | 'start' | 'none' | string;
  size: 'resp' | 'fixed';
  ids: 'gen' | 'names';
  fill: 'forwards' | 'backwards' | 'none' | string;
  speed: number;
  fps: number;
  prefix: string;
  /** fixed output width/height */
  w: number;
  h: number;
  /** keep aspect ratio */
  lock: boolean;
  /** responsive: largest expected display width, for image sizing */
  maxW: number;
  /** image optimization */
  opt: boolean;
  fmt: 'auto' | 'keep' | 'png' | 'jpeg' | 'webp' | 'avif' | string;
  q: number;
  /** 2x images for high-DPI screens */
  hi: boolean;
  /** web fonts: converted to outlines (default) or embedded */
  fonts?: 'outline' | 'embed';
}

export interface Doc {
  name: string;
  w: number;
  h: number;
  vx: number;
  vy: number;
  /** background colour; empty means transparent */
  bg: string;
  /** background opacity 0–1 (default 1) */
  bgA?: number;
  /** seconds */
  dur: number;
  /** iterations, 0 = infinite */
  it: number;
  dir: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse' | string;
  /** <defs> markup kept from imported SVG */
  defs: string;
  layers: Layer[];
  ezPresets: EasingPreset[];
  ex: ExportSettings;
}

export interface Asset {
  id: string;
  kind: 'image' | 'svg';
  name: string;
  mime: string;
  /** data URL (raster) */
  data?: string;
  /** source text (svg) */
  text?: string;
  w: number;
  h: number;
  /** bytes */
  size: number;
  [k: string]: any;
}

/** Copied keyframe, relative to the earliest copied key. */
export interface ClipKey {
  lid: string;
  k: PropKey;
  dt: number;
  v: any;
  e: Ease;
}

export interface OpenFile {
  name: string;
  /** File System Access handle when the browser supports overwriting */
  handle?: FileSystemFileHandle | null;
}

export type Tool = 'select' | 'node' | 'rect' | 'ellipse' | 'path' | 'pen' | 'text' | 'bone' | string;

export interface XY {
  x: number;
  y: number;
}

/** An active pointer gesture on the canvas: `move` on every pointermove, `up` on release. */
export interface Drag {
  move?(p: XY, e: PointerEvent): void;
  up?(p: XY, e: PointerEvent): void;
  /** live label drawn next to the pointer */
  lbl?: string;
  /** where to draw the label */
  lp?: XY;
  rot?: any;
  /** keys pressed during the gesture (e.g. ↑/↓ for polygon sides); return true if handled */
  key?(k: string, e: KeyboardEvent): boolean;
}

/** Transient editor state (not saved with the project). */
export interface EditorState {
  /** primary selected layer id */
  sel: string | null;
  selSet: Set<string>;
  tool: Tool;
  /** playhead, seconds */
  time: number;
  /** playback time while previewing */
  ptime: number;
  playing: boolean;
  loop: boolean;
  /** timeline pixels per second */
  pps: number;
  zoom: number;
  /** canvas px per document unit */
  scale: number;
  /** expanded rows in the timeline / layers panel, by layer id */
  exp: Record<string, boolean>;
  lexp: Record<string, boolean>;
  /** selected keyframes (references into Layer.t tracks) */
  keys: Set<Keyframe>;
  /** where arrow keys act (last area clicked) */
  kbArea?: 'stage' | 'timeline';
  /** selected path node [subpath, node] */
  node: [number, number] | null;
  undo: string[];
  redo: string[];
  /** active pointer gesture */
  drag: Drag | null;
  /** pen tool in progress */
  pen: any;
  last: number;
  /** open colour edit transaction */
  colorEd: { end(o?: any): void } | null;
  swatch: number;
  lockAR: boolean;
  /** inspector: show the free font-name field */
  fontCustom?: boolean;
  /** keep scale proportions in the inspector */
  sclLock?: boolean;
  ezDir: string;
  tab: string;
  snap: boolean;
  clip: ClipKey[] | null;
  showBones: boolean;
  boneDraft: any;
  file?: OpenFile | null;
  dirty?: boolean;
  loading?: boolean;
  saveAll?: boolean;
  pickPlace?: boolean;
  lastPt?: XY;
  /** work-area pan offset in screen px */
  pan: XY;
  /** Space held: temporary hand tool */
  spaceHeld?: boolean;
  /** the Space press was used for panning or a tool, so releasing it doesn't toggle playback */
  spaceUsed?: boolean;
  /** last tool used in each toolbar group */
  toolGroup: Record<string, string>;
  polySides: number;
  starPoints: number;
  /** inner/outer radius for new stars */
  starRatio?: number;
  /** pencil stroke in progress (document coordinates) */
  pencil?: XY[] | null;
  /** what the pen would do under the pointer (for the overlay) */
  penHint?: { kind: string; x: number; y: number } | null;
}
