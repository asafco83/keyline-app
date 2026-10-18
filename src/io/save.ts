// Keyline — io/save
import { $ } from '../core/constants';
import { ASSETS, S, doc } from '../core/state';
import { slug } from '../export/images';
import { markClean, persistFile } from './file-state';
import { toast } from './open';
import { buildKLP, usedAssetIds } from './zip';
import { kb } from '../ui/inspector';

export const KLP_TYPES = [{description:'Keyline project',accept:{'application/x-keyline-project':['.klp']}}];
export function canPick() { return (typeof (window as any).showSaveFilePicker==='function'); }
export async function writeHandle(handle?, blob?) {
  if(handle.queryPermission&&(await handle.queryPermission({mode:'readwrite'}))!=='granted'){ if(!handle.requestPermission||(await handle.requestPermission({mode:'readwrite'}))!=='granted') throw Object.assign(new Error('permission'),{name:'NotAllowedError'}); }
  const w=await handle.createWritable(); await w.write(blob); await w.close();
}
export async function downloadKLP(name?, blob?) {
  if((window as any).claude&&(window as any).claude.use){ let dl=null; try{ dl=await (window as any).claude.use('downloads'); }catch(e){}
    if(dl){ try{ await dl.save({filename:name+'.klp',data:blob}); return name+'.klp'; }
      catch(err){ if(err&&err.code==='declined') return null;
        if(err&&(err.code==='rejected_extension'||err.code==='extension_not_enabled')){ try{ await dl.save({filename:name+'.klp.zip',data:blob}); toast('This viewer can only download .zip files, so it was saved as '+name+'.klp.zip. Keyline opens it as it is.'); return name+'.klp.zip'; }catch(e2){ if(e2&&e2.code==='declined') return null; } }
        toast('Saving files is not available here.'); return null; } } }
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name+'.klp'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),5000); return name+'.klp';
}
export async function saveProject() {
  if(!S.file||!S.file.name) return saveProjectAs();
  const blob=await buildKLP(S.saveAll!==false);
  if(S.file.handle){ try{ await writeHandle(S.file.handle,blob); markClean(); toast('Saved '+S.file.name); return true; }
    catch(e){ if(e&&e.name==='AbortError') return false; toast('Couldn’t write to '+S.file.name+'. Choose where to save it.'); return saveProjectAs(); } }
  const name=S.file.name.replace(/\.klp(\.zip)?$/i,'');
  const got=await downloadKLP(name,blob); if(got){ S.file={name:got,handle:null}; persistFile(); markClean(); toast('Downloaded '+got+'. Browsers can’t overwrite downloads, so this is a fresh copy.'); return true; }
  return false;
}
export let saveResolve = null;
export function saveProjectAs() {
  return new Promise<any>((res?)=>{ saveResolve=res;
    const all=Object.keys(ASSETS).length, used=usedAssetIds(), unused=Object.keys(ASSETS).filter((id?)=>!used.has(id)), size=(ids?)=>ids.reduce((s?,id?)=>s+(ASSETS[id].size||0),0);
    $('#sName').value=(S.file&&S.file.name?S.file.name.replace(/\.klp(\.zip)?$/i,''):slug(doc.name));
    $('#sAll').checked=S.saveAll!==false; $('#sAll').closest('label').hidden=!unused.length;
    $('#sStats').innerHTML=`<span>Layers <b>${doc.layers.length}</b></span><span>Assets <b>${all}</b>${all?` · ${kb(size(Object.keys(ASSETS)))}`:''}</span>${unused.length?`<span>Unused <b>${unused.length}</b></span>`:''}`;
    $('#sNote').innerHTML='A .klp file holds the whole project: layers, keyframes, easing presets, export settings and every image, so it opens exactly as you left it. '+(canPick()?'Next you’ll choose where to save it. After that, Save overwrites the same file.':'It goes to your downloads folder.');
    $('#mSave').hidden=false; setTimeout(()=>{ $('#sName').focus(); $('#sName').select(); },0); });
}
export function endSave(v?) { $('#mSave').hidden=true; const r=saveResolve; saveResolve=null; if(r) r(v); }

export function init(): void {
  $('#mSave').addEventListener('click',(e?)=>{ if((e.target as any).id==='mSave'||(e.target as any).closest('[data-close]')) endSave(false); },true);
  $('#sName').addEventListener('keydown',(e?)=>{ if(e.key==='Enter') $('#sGo').click(); });
  $('#sGo').addEventListener('click',async()=>{
    const name=($('#sName').value.trim()||slug(doc.name)).replace(/\.klp(\.zip)?$/i,'').replace(/[\\/:*?"<>|]+/g,'-');
    S.saveAll=$('#sAll').checked; const blob=await buildKLP(S.saveAll);
    if(canPick()){ try{ const handle=await (window as any).showSaveFilePicker({suggestedName:name+'.klp',types:KLP_TYPES,id:'keyline'});
        await writeHandle(handle,blob); S.file={name:handle.name,handle}; persistFile(); markClean(); toast('Saved '+handle.name); endSave(true); return; }
      catch(e){ if(e&&e.name==='AbortError') return; /* sandboxed or blocked: fall back to download */ } }
    const got=await downloadKLP(name,blob);
    if(got){ S.file={name:got,handle:null}; persistFile(); markClean(); toast('Saved '+got+' to your downloads.'); endSave(true); } else endSave(false);
  });
  $('#bSave').addEventListener('click',()=>saveProject());
  $('#bSaveAs').addEventListener('click',()=>saveProjectAs());
}
