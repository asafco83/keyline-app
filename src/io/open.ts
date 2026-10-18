// Keyline — io/open
import { $, clamp } from '../core/constants';
import { redo, save, setTime, undo } from '../core/history';
import { togglePlay } from '../core/playback';
import { ASSETS, S, URLS, blankDoc, doc, setDoc, syncAidc } from '../core/state';
import { assetURL, blobToData, saveAssets } from './assets';
import { markClean, persistFile, updateFileInfo } from './file-state';
import { confirmDiscard } from './guard';
import { readZip } from './zip';
import { fit, frame } from '../render/stage';
import { docField } from '../ui/inspector';
import { renderTimeline } from '../ui/timeline';
import { resetView } from '../ui/topbar';

export function clearAssets() { Object.keys(ASSETS).forEach((id?)=>{ try{ URL.revokeObjectURL(URLS[id]); }catch(_){} delete URLS[id]; delete ASSETS[id]; }); }
export function applyProject(d?, assets?, file?) {
  S.loading=true;
  clearAssets(); Object.values<any>(assets||{}).forEach((a?)=>{ if(!a||!a.id) return; ASSETS[a.id]=a; try{ URLS[a.id]=assetURL(a); }catch(_){ URLS[a.id]=a.data; } });
  syncAidc(); saveAssets(); setDoc(normalizeDoc(d)); S.undo=[]; S.redo=[]; S.file=file; persistFile(); resetView(); S.loading=false; markClean();
}
export async function loadProjectFile(f?, handle?) {
  try{
    const buf=await f.arrayBuffer(), u8=new Uint8Array(buf);
    if(u8[0]===0x50&&u8[1]===0x4B){
      const z=await readZip(buf), man=JSON.parse((await z.text('manifest.json'))||'{}');
      if(man.format!=='keyline-project') throw new Error('it isn’t a Keyline project');
      const d=JSON.parse(await z.text('project.json')), idx=JSON.parse((await z.text('assets/index.json'))||'[]'), assets: any={}, dec=new TextDecoder();
      for(const a of idx){ const bytes=await z.get(a.file); if(!bytes) continue; const o=Object.assign({},a); delete o.file;
        if(a.kind==='svg'){ o.text=dec.decode(bytes); o.data='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(o.text); }
        else o.data=await blobToData(new Blob([bytes],{type:a.mime||'application/octet-stream'}));
        assets[a.id]=o; }
      applyProject(d,assets,{name:f.name,handle:handle||null});
      const missing=idx.length-Object.keys(assets).length;
      toast(`Opened ${f.name}${missing?` (${missing} image${missing>1?'s':''} missing)`:''}.`); return true;
    }
    const d=JSON.parse(new TextDecoder().decode(u8)), dd=d&&d.format==='keyline'?d.doc:d; if(!dd||!Array.isArray(dd.layers)) throw new Error('it isn’t a Keyline project');
    applyProject(dd,d.assets||{},null); S.dirty=true; updateFileInfo(); toast('Opened an older project file. Use Save to keep it as .klp.'); return true;
  }catch(e){ toast(`Couldn’t open ${f.name}: ${e&&e.message||'it isn’t a Keyline project'}.`); return false; }
}
export async function openFlow() {
  if(!(await confirmDiscard('Opening another project closes this one. Save your changes first?'))) return;
  if(typeof (window as any).showOpenFilePicker==='function'){
    try{ const [handle]=await (window as any).showOpenFilePicker({types:[{description:'Keyline project',accept:{'application/x-keyline-project':['.klp'],'application/zip':['.zip'],'application/json':['.json']}}],id:'keyline',multiple:false});
      const f=await handle.getFile(); await loadProjectFile(f,/\.klp$/i.test(f.name)?handle:null); return; }
    catch(e){ if(e&&e.name==='AbortError') return; }
  }
  $('#fProj').click();
}
export function openProject(t?) { loadProjectFile(new File([t],'project.json',{type:'application/json'}),null); }
export function normalizeDoc(d?): any {
  const o=Object.assign(blankDoc(d.w||640,d.h||400),d); o.ex=Object.assign(blankDoc(1,1).ex,d.ex||{}); o.ezPresets=d.ezPresets||[];
  const ids=new Set<any>(o.layers.map((l?)=>l.id));
  o.layers.forEach((l?)=>{ l.t=l.t||{}; l.b=Object.assign({pos:[0,0],rot:0,scl:[1,1],op:1},l.b||{}); l.extra=l.extra||{}; l.geo=l.geo||{}; if(!l.parent||!ids.has(l.parent)||l.parent===l.id) l.parent=null; });
  return o;
}
export let toastT = 0;
export function toast(m?) { const t=$('#toast'); t.textContent=m; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,3000); }

export function init(): void {
  $('#bOpen').addEventListener('click',openFlow);
  $('#fProj').addEventListener('change',(e?)=>{ const f=(e.target as any).files[0]; (e.target as any).value=''; if(f) loadProjectFile(f,null); });
  $('#bUndo').addEventListener('click',undo);
  $('#bRedo').addEventListener('click',redo);
  $('#bKeys').addEventListener('click',()=>{ $('#mKeys').hidden=false; });
  $('#pname').addEventListener('change',(e?)=>{ doc.name=(e.target as any).value.trim()||'Untitled animation'; save(); });
  $('#tPlay').addEventListener('click',togglePlay);
  $('#tStart').addEventListener('click',()=>{ setTime(0); });
  $('#tLoop').addEventListener('click',(e?)=>{ S.loop=!S.loop; e.currentTarget.classList.toggle('on',S.loop); });
  $('#tRec').addEventListener('click',(e?)=>{ S.autokey=!S.autokey; e.currentTarget.classList.toggle('on',S.autokey); frame(); toast(S.autokey?'Auto-key on: edits after 0s record keyframes.':'Auto-key off: edits change the static value unless the property already has keyframes.'); });
  $('#tDur').addEventListener('change',(e?)=>docField(e.target));
  $('#tZoom').addEventListener('input',(e?)=>{ S.pps=+(e.target as any).value; renderTimeline(); });
  $('#zIn').addEventListener('click',()=>{ S.zoom=clamp(S.zoom*1.25,0.1,8); fit(); frame(); });
  $('#zOut').addEventListener('click',()=>{ S.zoom=clamp(S.zoom/1.25,0.1,8); fit(); frame(); });
  $('#zFit').addEventListener('click',()=>{ S.zoom=1; fit(); frame(); });
  $('#zBones').addEventListener('click',(e?)=>{ S.showBones=!S.showBones; e.currentTarget.classList.toggle('on',S.showBones); frame(); });
}
