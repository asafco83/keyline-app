// Keyline — core/state
import { SWATCH } from './constants';

export let doc;
export let eng;
export function setDoc(d?) {
  doc = d;
}
export function setEng(e?) {
  eng = e;
}
export const ASSETS: any = {};
export const URLS: any = {};
export const S: any = {
  sel: null,
  selSet: new Set<any>(),
  tool: 'select',
  time: 0,
  ptime: 0,
  playing: false,
  loop: true,
  autokey: true,
  pps: 140,
  zoom: 1,
  scale: 1,
  exp: {},
  lexp: {},
  keys: new Set<any>(),
  node: null,
  undo: [],
  redo: [],
  drag: null,
  pen: null,
  last: 0,
  colorEd: null,
  swatch: 0,
  lockAR: true,
  ezDir: 'inOut',
  tab: 'layers',
  snap: true,
  clip: null,
  showBones: true,
  boneDraft: null,
};
export let idc = 0;
export let aidc = 0;
export function setIdc(v?) {
  idc = v;
}
export function nextAid() {
  return 'a' + ++aidc;
}
export function uid() {
  return 'l' + ++idc;
}
export function syncIdc() {
  idc = doc.layers.reduce((m?, l?) => Math.max(m, parseInt(String(l.id).slice(1)) || 0), 0);
}
export function syncAidc() {
  aidc = Object.keys(ASSETS).reduce((m?, k?) => Math.max(m, parseInt(k.slice(1)) || 0), 0);
}
export function layerById(id?) {
  return doc && doc.layers.find((l?) => l.id === id);
}
export function selLayer() {
  return S.sel ? layerById(S.sel) : null;
}
export function nextColor() {
  return SWATCH[S.swatch++ % SWATCH.length];
}
export function randPre() {
  return 'kl' + Math.random().toString(36).slice(2, 6);
}
export function blankDoc(w?, h?): any {
  return {
    name: 'Untitled animation',
    w,
    h,
    vx: 0,
    vy: 0,
    bg: '#FFFFFF',
    dur: 3,
    it: 0,
    dir: 'normal',
    defs: '',
    layers: [],
    ezPresets: [],
    ex: {
      mode: 'js',
      trigger: 'load',
      out: 'pause',
      size: 'resp',
      ids: 'gen',
      fill: 'forwards',
      speed: 1,
      fps: 0,
      prefix: randPre(),
      w: 0,
      h: 0,
      lock: true,
      maxW: 0,
      opt: true,
      fmt: 'auto',
      q: 82,
      hi: true,
    },
  };
}
export function mkLayer(type?, name?, geo?, b?): any {
  return {
    id: uid(),
    name,
    type,
    parent: null,
    geo: geo || {},
    b: Object.assign(
      { pos: [0, 0], rot: 0, scl: [1, 1], op: 1, fill: '#5B7CFA', stk: 'none', sw: 0, draw: 100 },
      b || {},
    ),
    t: {},
    o: null,
    sm: false,
    or: false,
    hid: false,
    lock: false,
    xf: '',
    extra: {},
  };
}
export function sortTrack(tr?) {
  tr.sort((a?, b?) => a[0] - b[0]);
}
