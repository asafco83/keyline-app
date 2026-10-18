// Keyline — app/boot
import { $, HINTS, ICON, ic } from '../core/constants';
import { WRAP } from '../core/dom';
import { loop, updatePlayBtn } from '../core/playback';
import { ASSETS, S, URLS, doc, setDoc, syncAidc, syncIdc } from '../core/state';
import { IDB, assetURL } from '../io/assets';
import { updateFileInfo } from '../io/file-state';
import { normalizeDoc } from '../io/open';
import { sampleDoc } from '../model/sample';
import { fit, frame, renderAll } from '../render/stage';
import { BM } from '../ui/file-menu';
import { fitTimeline } from '../ui/topbar';

export async function boot() {
  $('#bUndo').innerHTML=ICON.undo; $('#bRedo').innerHTML=ICON.redo; $('#tStart').innerHTML=ICON.start; $('#tLoop').innerHTML=ICON.loop; $('#lDel').innerHTML=ICON.trash; BM.innerHTML=ic('<path d="M4 7h16M4 12h16M4 17h16"/>',18); updatePlayBtn();
  try{ S.dirty=localStorage.getItem('keyline:dirty')==='1'; }catch(e){}
  try{ const fi=await Promise.race([IDB.get('file'),new Promise<any>((r?)=>setTimeout(()=>r(null),1200))]); if(fi&&fi.name) S.file=fi; }catch(e){}
  let saved=null; try{ saved=localStorage.getItem('keyline:doc'); }catch(e){}
  if(saved){ try{ setDoc(normalizeDoc(JSON.parse(saved))); }catch(e){ setDoc(null); } }
  if(!doc) setDoc(sampleDoc());
  try{ const a=await Promise.race([IDB.get('assets'),new Promise<any>((r?)=>setTimeout(()=>r(null),1500))]); if(a) Object.values<any>(a).forEach((x?)=>{ if(x&&x.id){ ASSETS[x.id]=x; try{ URLS[x.id]=assetURL(x); }catch(_){ URLS[x.id]=x.data; } } }); }catch(e){}
  syncAidc(); syncIdc(); $('#pname').value=doc.name; $('#hint').textContent=HINTS.select; WRAP.className='t-select';
  S.loading=true; fitTimeline(); renderAll(); S.loading=false; updateFileInfo();
  new ResizeObserver(()=>{ fit(); frame(); }).observe(WRAP);
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>frame());
  requestAnimationFrame((t?)=>{ S.last=t; loop(t); });
}

export function init(): void {
  boot();
}
