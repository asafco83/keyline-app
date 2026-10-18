// Keyline — export/images
import { $, byId, esc, fmt } from '../core/constants';
import { save } from '../core/history';
import { ASSETS, URLS, doc, randPre } from '../core/state';
import { buildExport } from './build';
import { syncExportUI } from './dialog';
import { exportPxScale, outDims, usedImageIds } from './size';
import { lastExport, renderSnippet, setLastExport } from './snippets';
import { blobToData } from '../io/assets';
import { toast } from '../io/open';
import { ancestors, isHidden } from '../model/tree';
import { localMat } from '../tools/bones';
import { kb } from '../ui/inspector';

export const ENC: any = {};
export function toBlobP(cv?, type?, q?) { return (new Promise<any>((r?)=>{ const t=setTimeout(()=>r(null),8000); try{ cv.toBlob((b?)=>{ clearTimeout(t); r(b); },type,q); }catch(e){ clearTimeout(t); r(null); } })); }
export let encP = null;
export function detectEnc() { return encP||(encP=Promise.race([detectEnc0(),new Promise<any>((r?)=>setTimeout(r,1500))]).then(()=>{ ENC.done=true; })); }
export async function detectEnc0() { if(ENC.done) return; const c=document.createElement('canvas'); c.width=c.height=2;
  for(const t of ['webp','avif']){ const b=await toBlobP(c,'image/'+t,.8); ENC[t]=!!b&&b.type==='image/'+t; } ENC.done=true; }
export function loadImg(src?) { return (new Promise<any>((res?,rej?)=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=()=>rej(new Error('decode')); im.src=src; })); }
export function drawScaled(img?, tw?, th?) {
  let src=img, sw=img.naturalWidth, sh=img.naturalHeight;
  while(sw/2>=tw*1.0001&&sh/2>=th){ const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(sw/2)); c.height=Math.max(1,Math.round(sh/2)); const x=c.getContext('2d'); x.imageSmoothingQuality='high'; x.drawImage(src,0,0,c.width,c.height); src=c; sw=c.width; sh=c.height; }
  const c=document.createElement('canvas'); c.width=tw; c.height=th; const x=c.getContext('2d'); x.imageSmoothingQuality='high'; x.drawImage(src,0,0,tw,th); return c;
}
export function hasAlpha(cv?) { const x=cv.getContext('2d'), w=cv.width, h=cv.height, step=Math.max(1,Math.floor(Math.sqrt(w*h/250000)));
  for(let y=0;y<h;y+=step){ const row=x.getImageData(0,y,w,1).data; for(let i=3;i<row.length;i+=4*step) if(row[i]<250) return true; } return false; }
export function worldMatAt(l?, t?) { let M=new DOMMatrix(); [...ancestors(l).reverse(),l].forEach((x?)=>{ M=M.multiply(localMat(x,t));
    if(x.xf){ const el=byId('e-'+x.id+'-s'), c=el&&el.transform&&el.transform.baseVal.consolidate(); if(c){ const m=c.matrix; M=M.multiply(new DOMMatrix([m.a,m.b,m.c,m.d,m.e,m.f])); } } }); return M; }
export function imageNeeds() {
  const k=exportPxScale()*(doc.ex.hi!==false?2:1), N=Math.max(24,Math.round(doc.dur*20)), ts=new Set<any>(); for(let i=0;i<=N;i++) ts.add(i/N*doc.dur);
  doc.layers.forEach((l?)=>Object.values<any>(l.t).forEach((tr?)=>tr.forEach((q?)=>ts.add(q[0]))));
  const need: any={};
  doc.layers.forEach((l?)=>{ if(l.type!=='image'||isHidden(l)||!ASSETS[l.geo.asset]) return; let mx=0,my=0;
    ts.forEach((t?)=>{ const M=worldMatAt(l,t); mx=Math.max(mx,Math.hypot(M.a,M.b)); my=Math.max(my,Math.hypot(M.c,M.d)); });
    const n=need[l.geo.asset]||(need[l.geo.asset]={w:0,h:0}); n.w=Math.max(n.w,l.geo.w*mx*k); n.h=Math.max(n.h,l.geo.h*my*k); });
  return need;
}
export const OPT = new Map<any, any>();
export function optimizeAsset(a?, need?, fmt?, q?) {
  const f=Math.min(1,Math.max(need.w/a.w,need.h/a.h)), tw=Math.max(1,Math.round(a.w*f)), th=Math.max(1,Math.round(a.h*f)), key=[a.id,tw,th,fmt,q].join('|');
  if(OPT.has(key)) return OPT.get(key);
  const pr=(async()=>{
    const orig={data:a.data,size:a.size,mime:a.mime,tw:a.w,th:a.h,orig:true};
    if(/gif|apng/.test(a.mime||'')) return Object.assign(orig,{note:'animated, kept as is'});
    let img; try{ img=await loadImg(URLS[a.id]||a.data); }catch(e){ return Object.assign(orig,{note:'could not be read'}); }
    const cv=drawScaled(img,tw,th), alpha=hasAlpha(cv);
    let types=fmt==='auto'?[ENC.avif&&'image/avif',ENC.webp&&'image/webp',alpha?'image/png':'image/jpeg']:fmt==='keep'?[a.mime]:['image/'+fmt];
    let note='';
    if(alpha&&types.includes('image/jpeg')){ types=types.filter((t?)=>t!=='image/jpeg'); if(!types.length) types=[ENC.webp?'image/webp':'image/png']; note='has transparency, so not JPEG'; }
    types=types.filter(Boolean);
    let best=null; for(const ty of types){ const b=await toBlobP(cv,ty,q/100); if(b&&b.type===ty&&(!best||b.size<best.size)) best=b; }
    if(!best) best=await toBlobP(cv,'image/png');
    if(!best||(a.size&&best.size>=a.size&&tw===a.w&&th===a.h)) return Object.assign(orig,{note:note||'already as small as it gets'});
    return {data:await blobToData(best),size:best.size,mime:best.type,tw,th,note};
  })();
  OPT.set(key,pr); return pr;
}
export async function prepImages() {
  const ids=usedImageIds(); if(!ids.length||doc.ex.opt===false) return null;
  await detectEnc(); const need=imageNeeds(), out: any={};
  for(const id of ids) out[id]=await optimizeAsset(ASSETS[id],need[id]||{w:ASSETS[id].w,h:ASSETS[id].h},doc.ex.fmt||'auto',doc.ex.q||82);
  return out;
}
export function fmtName(m?) { return ((m||'').replace('image/','').replace('x-icon','ico').replace('jpeg','jpg').toUpperCase()); }
export function renderImgList(imgs?) {
  const ids=usedImageIds(); if(!ids.length) return;
  const rows=ids.map((id?)=>{ const a=ASSETS[id], o=imgs&&imgs[id];
    return `<div><b>${esc(a.name)}</b><br>${a.w}×${a.h} ${fmtName(a.mime)} ${kb(a.size||0)}${o?` → <span class="ok">${o.tw}×${o.th} ${fmtName(o.mime)} ${kb(o.size||0)}</span>${o.note?` · ${esc(o.note)}`:''}`:''}</div>`; });
  $('#xImgList').innerHTML=rows.join('');
  const before=ids.reduce((s?,id?)=>s+(ASSETS[id].size||0),0), after=imgs?ids.reduce((s?,id?)=>s+(imgs[id].size||0),0):before;
  $('#xImgSum').textContent=imgs?`${ids.length} image${ids.length>1?'s':''}: ${kb(before)} → ${kb(after)} (sized for ${Math.round(exportPxScale()*doc.w)}px wide${doc.ex.hi!==false?' at 2×':''})`:`${ids.length} image${ids.length>1?'s':''}: ${kb(before)}`;
}
export let prevMode = 'fit';
export function sizePreview() {
  const box=$('#xprev'), svg=box.querySelector('svg'); if(!svg) return; const ex=doc.ex, fixed=ex.size==='fixed', [w,h]=outDims();
  const rw=fixed?w:(ex.maxW>0?ex.maxW:doc.w), rh=fixed?h:Math.round(rw*doc.h/doc.w), actual=prevMode==='actual';
  box.classList.add('actual');
  const s=actual?1:Math.min(1,(box.clientWidth-26)/rw,400/rh);
  svg.style.width=Math.round(rw*s)+'px'; svg.style.height=Math.round(rh*s)+'px';
  const pct=Math.round(s*100);
  $('#xPrevLbl').textContent=fixed?`${w} × ${h} px · shown at ${pct}%`:`Responsive · fills its container · ${rw} px wide shown at ${pct}%`;
  $('#xPrevZoom').querySelectorAll('button').forEach((b?)=>b.classList.toggle('on',b.dataset.v===prevMode));
}
export let expSeq = 0;
export let expPending = Promise.resolve();
export function expReady() { return (expPending); }
export function updateExport() { expPending=runExport(); return expPending; }
export async function runExport() {
  const seq=++expSeq;
  if(usedImageIds().length&&doc.ex.opt!==false) $('#xStats').innerHTML='<span>Optimizing images…</span>';
  let imgs=null; try{ imgs=await prepImages(); }catch(e){ imgs=null; }
  if(seq!==expSeq) return;
  const r=buildExport(imgs); setLastExport(r.code);
  const box=$('#xprev'), old=box.querySelector('svg'); if(old&&old.player) old.player.destruct();
  box.innerHTML=r.code;
  box.querySelectorAll('script').forEach((sc?)=>{ const n=document.createElement('script'); n.textContent=sc.textContent.replace('<![CDATA[','').replace(']]>',''); sc.remove(); document.body.appendChild(n); n.remove(); });
  sizePreview();
  $('#xCode').value=r.code.length>400000?r.code.slice(0,400000)+'\n… (code view truncated, the copy and download contain everything)':r.code;
  const [w,h]=outDims();
  $('#xStats').innerHTML=`<span>Size <b>${kb(new Blob([r.code]).size)}</b></span>${doc.ex.size==='fixed'?`<span>Output <b>${w}×${h}</b></span>`:''}<span>Layers <b>${doc.layers.filter((l?)=>!isHidden(l)).length}</b></span><span>Animated <b>${r.anim}</b></span><span>Animators <b>${r.tracks}</b></span>${r.images?`<span>Images <b>${r.images}</b></span>`:''}<span>Length <b>${fmt(doc.dur)}s</b></span>`;
  renderImgList(imgs);
}
export function slug(s?) { return (String(s||'animation').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'animation'); }
export async function saveFile(name?, data?, type?) {
  if((window as any).claude&&(window as any).claude.use){
    let dl=null; try{ dl=await (window as any).claude.use('downloads'); }catch(e){}
    if(dl){ try{ await dl.save({filename:name,data}); toast('Saved '+name); }catch(err){ if(err&&err.code==='declined') return; toast(err&&err.code==='rate_limited'?'A save is already waiting for your confirmation.':'Download is not available here. Use Copy code instead.'); } return; }
  }
  try{ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([data],{type})); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000); }
  catch(e){ toast('Download is not available here. Use Copy code instead.'); }
}

export function init(): void {
  $('#xPrevZoom').addEventListener('click',(e?)=>{ const b=(e.target as any).closest('button'); if(!b) return; prevMode=b.dataset.v; sizePreview(); });
  $('#xMode').addEventListener('click',(e?)=>{ const b=(e.target as any).closest('button'); if(!b) return; doc.ex.mode=b.dataset.v; save(); syncExportUI(); updateExport(); });
  $('#xSize').addEventListener('click',(e?)=>{ const b=(e.target as any).closest('button'); if(!b) return; doc.ex.size=b.dataset.v; save(); syncExportUI(); updateExport(); });
  $('#xTrig').addEventListener('change',(e?)=>{ doc.ex.trigger=(e.target as any).value; save(); syncExportUI(); updateExport(); });
  $('#xIt').addEventListener('change',(e?)=>{ doc.it=parseInt((e.target as any).value)||0; save(); updateExport(); });
  $('#xDir').addEventListener('change',(e?)=>{ doc.dir=(e.target as any).value; save(); updateExport(); });
  $('#xIt').addEventListener('change',()=>renderSnippet());
  $('#xPre').addEventListener('change',(e?)=>{ doc.ex.prefix=(e.target as any).value.trim()||randPre(); save(); syncExportUI(); updateExport(); });
  $('#xCopy').addEventListener('click',async()=>{
    await expReady(); const ta=$('#xCode');
    try{ navigator.clipboard.writeText(lastExport).then(()=>toast('SVG code copied.'),()=>{ ta.closest('details').open=true; ta.select(); toast('Press Ctrl+C to copy the selected code.'); }); }
    catch(e){ ta.closest('details').open=true; ta.select(); toast('Press Ctrl+C to copy the selected code.'); }
  });
  $('#xDl').addEventListener('click',async()=>{ await expReady(); saveFile(slug(doc.name)+'.svg',lastExport,'image/svg+xml'); });
}
