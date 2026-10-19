// Keyline — model/types
// The editor's document model. The runtime's EngineLayer is the exported subset of Layer.
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
export type PropKey = 'pos' | 'org' | 'rot' | 'scl' | 'op' | 'fill' | 'stk' | 'sw' | 'draw' | 'd';

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
}

export interface Doc {
  name: string;
  w: number;
  h: number;
  vx: number;
  vy: number;
  bg: string;
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
  autokey: boolean;
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
}
