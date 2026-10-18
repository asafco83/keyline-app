// Keyline — export/build
import { $, H, clone, esc, r3 } from '../core/constants';
import { togglePlay } from '../core/playback';
import { ASSETS, S, doc } from '../core/state';
import { syncExportUI } from './dialog';
import { detectEnc, updateExport } from './images';
import { outDims, syncSizeUI } from './size';
import { markup } from '../render/markup';
import { KLEngine } from '../runtime/engine';

export function roundV(v?) {
  if (typeof v === 'number') return r3(v);
  if (Array.isArray(v)) return v.map(roundV);
  if (v && typeof v === 'object' && v.n) return { c: v.c, n: v.n.map((q?) => q.map(r3)) };
  return v;
}
export function cssTf(c?) {
  return `translate(${r3(c.x)}px,${r3(c.y)}px) rotate(${r3(c.r)}deg) scale(${r3(c.sx)},${r3(c.sy)}) translate(${r3(-c.ox)}px,${r3(-c.oy)}px)`;
}
export function kfBlock(name?, stops?, N?) {
  const keep = stops.map((s?, i?) => i === 0 || i === N || s !== stops[i - 1] || s !== stops[i + 1]);
  return `@keyframes ${name}{` + stops.map((s?, i?) => (keep[i] ? `${r3((i / N) * 100)}%{${s}}` : '')).join('') + '}';
}
export function cssFor(anim?, pre?, svgId?) {
  const N = Math.max(2, Math.round(doc.dur * 30)),
    it = doc.it > 0 ? doc.it : 'infinite',
    dir = ['alternate', 'reverse', 'alternate-reverse'].includes(doc.dir) ? doc.dir : 'normal',
    spd = doc.ex.speed > 0 ? doc.ex.speed : 1,
    run = `${r3(doc.dur / spd)}s linear ${it} ${dir} ${doc.ex.fill === 'backwards' ? 'backwards' : 'both'}`;
  let css = '';
  anim.forEach((l?) => {
    const id = pre + l.id,
      T = l.t,
      fr = [];
    for (let i = 0; i <= N; i++) fr.push(H.comp(l, (i / N) * doc.dur));
    const gt = !!(T.pos || T.rot || T.scl || T.org),
      go = !!T.op;
    if (gt || go)
      css +=
        kfBlock(
          id + '-g',
          fr.map((c?) => (gt ? `transform:${cssTf(c)};` : '') + (go ? `opacity:${r3(c.op)}` : '')),
          N,
        ) + `#${id}{transform-box:view-box;transform-origin:0 0;animation:${id}-g ${run}}`;
    const sk = ['fill', 'stk', 'sw', 'draw', 'd'].filter((k?) => T[k]);
    if (sk.length)
      css +=
        kfBlock(
          id + '-s',
          fr.map((c?) =>
            sk
              .map((k?) =>
                k === 'fill'
                  ? `fill:${c.fill}`
                  : k === 'stk'
                    ? `stroke:${c.stk}`
                    : k === 'sw'
                      ? `stroke-width:${r3(c.sw)}px`
                      : k === 'draw'
                        ? `stroke-dashoffset:${r3(100 - c.draw)}`
                        : `d:path("${H.dstr(c.d)}")`,
              )
              .join(';'),
          ),
          N,
        ) + `#${id}-s{animation:${id}-s ${run}}`;
  });
  if (doc.ex.trigger === 'hover')
    css +=
      doc.ex.out === 'start'
        ? `#${svgId}:not(:hover) *{animation:none!important}`
        : `#${svgId}:not(:hover) *{animation-play-state:paused!important}`;
  return css;
}
export function triggerJS(t?, out?, base?) {
  const pre =
    'P._cleanup=[];function L(t,e,f){t.addEventListener(e,f);P._cleanup.push(function(){t.removeEventListener(e,f);});}' +
    `function fwd(){if(P.direction!==${base}||P.isRollingBack)P.set("direction",${base});P.play();}` +
    `function out(){var a=${JSON.stringify(out || 'pause')};if(a==="pause")P.pause();else if(a==="reverse")P.rollback();else if(a==="start")P.stop();else if(a==="restart")P.restart();}`;
  if (t === 'hover') return pre + 'L(s,"mouseenter",fwd);L(s,"mouseleave",out);';
  if (t === 'click')
    return (
      pre +
      `s.style.cursor="pointer";L(s,"click",function(){if(P.isPlaying&&!P.isRollingBack){if(${JSON.stringify(out)}!=="none")out();}else fwd();});`
    );
  if (t === 'scroll')
    return (
      pre +
      `if("IntersectionObserver" in window){var io=new IntersectionObserver(function(e){if(e[0].isIntersecting)fwd();else if(${JSON.stringify(out)}!=="none"&&(P.isPlaying||P.currentTime>0))out();},{threshold:.35});io.observe(s);P._cleanup.push(function(){io.disconnect();});}else P.play();`
    );
  if (t === 'api') return pre;
  return pre + 'P.play();';
}
export function idMapFor(prep?) {
  const map: any = {},
    used = new Set<any>();
  prep.forEach((l?) => {
    let b =
      String(l.name || 'layer')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'layer';
    if (!/^[a-z]/.test(b)) b = 'l-' + b;
    let id = b,
      n = 2;
    while (used.has(id)) id = b + '-' + n++;
    used.add(id);
    map[l.id] = id;
  });
  return map;
}
export function buildExport(imgs?) {
  const ex = doc.ex,
    pre =
      (String(ex.prefix || 'kl')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .replace(/^[^a-z]+/, '') || 'kl') + '-',
    svgId = pre + 'svg';
  if (ex.mode === 'css' && (ex.trigger === 'click' || ex.trigger === 'scroll' || ex.trigger === 'api'))
    ex.trigger = 'load';
  const prep = doc.layers.map((l?) => {
    const c = clone(l);
    for (const k in c.t) {
      if (!c.t[k].length) {
        delete c.t[k];
        continue;
      }
      c.t[k] = c.t[k].map((q?) => [r3(q[0]), roundV(q[1]), q[2]]);
    }
    return c;
  });
  if (ex.ids === 'names') {
    const m = idMapFor(prep);
    prep.forEach((l?) => {
      l.id = m[l.id];
      if (l.parent) l.parent = m[l.parent];
    });
  }
  const byId: any = {};
  prep.forEach((l?) => (byId[l.id] = l));
  const hiddenUp = (l?) => {
    let p = l,
      g = 0;
    while (p && g++ < 100) {
      if (p.hid) return true;
      p = p.parent && byId[p.parent];
    }
    return false;
  };
  const anim = prep.filter((l?) => !hiddenUp(l) && Object.keys(l.t).length);
  const used: any = {};
  const ctx = {
    pre,
    editor: false,
    t: 0,
    useImg: (id?) => {
      if (!ASSETS[id]) return null;
      used[id] = 1;
      return pre + 'img-' + id;
    },
  };
  const body = markup(prep, null, ctx);
  const syms = Object.keys(used)
    .map((id?) => {
      const a = ASSETS[id];
      return `<symbol id="${pre}img-${id}" viewBox="0 0 ${a.w} ${a.h}" preserveAspectRatio="none"><image href="${imgs && imgs[id] ? imgs[id].data : a.data}" width="${a.w}" height="${a.h}" preserveAspectRatio="none"/></symbol>`;
    })
    .join('');
  const [OW, OH] = outDims(),
    size = ex.size === 'fixed' ? `width="${OW}" height="${OH}"` : 'width="100%"';
  let out = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" id="${svgId}" viewBox="${doc.vx || 0} ${doc.vy || 0} ${doc.w} ${doc.h}" ${size} shape-rendering="geometricPrecision" text-rendering="geometricPrecision">`;
  out += `<title>${esc(doc.name)}</title>`;
  if (doc.defs || syms) out += `<defs>${doc.defs || ''}${syms}</defs>`;
  if (doc.bg)
    out += `<rect x="${doc.vx || 0}" y="${doc.vy || 0}" width="${doc.w}" height="${doc.h}" fill="${esc(doc.bg)}"/>`;
  out += body;
  if (anim.length) {
    if (ex.mode === 'css') out += `<style>${cssFor(anim, pre, svgId)}</style>`;
    else {
      const data = {
        p: pre,
        dur: doc.dur,
        it: doc.it || 0,
        dir: doc.dir,
        speed: doc.ex.speed > 0 ? doc.ex.speed : 1,
        fps: doc.ex.fps || 0,
        fill: doc.ex.fill === 'backwards' ? -1 : 1,
        L: anim.map((l?) => {
          const b = {
            pos: l.b.pos,
            rot: l.b.rot,
            scl: l.b.scl,
            op: l.b.op,
            fill: null,
            stk: null,
            sw: null,
            draw: null,
          };
          const o: any = { id: l.id, o: l.o || [0, 0], b, t: l.t };
          if (l.sm) o.sm = 1;
          if (l.or) o.or = 1;
          return o;
        }),
      };
      out += `<script><![CDATA[\n(function(){var KLEngine=${KLEngine.toString()};\nvar s=document.getElementById(${JSON.stringify(svgId)});if(!s)return;var P=KLEngine(${JSON.stringify(data)},s);s.player=s.svgatorPlayer=P;P.stop();${triggerJS(ex.trigger, ex.out, /reverse/.test(doc.dir) ? -1 : 1)}})();\n]]><\/script>`;
    }
  }
  return {
    code: out + '</svg>',
    svgId,
    anim: anim.length,
    tracks: anim.reduce((s?, l?) => s + Object.keys(l.t).length, 0),
    images: Object.keys(used).length,
  };
}
export function openExport() {
  if (S.playing) togglePlay();
  syncExportUI();
  $('#mExport').hidden = false;
  detectEnc().then(() => {
    syncSizeUI();
    updateExport();
  });
}
