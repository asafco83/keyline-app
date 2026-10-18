// Keyline — ui/keyboard
import { $, H, clone, r2 } from '../core/constants';
import { beginEdit, deleteKeys, redo, select, setProp, setTime, setTool, undo } from '../core/history';
import { closeMenu, copyKeys, duplicateKeys, jumpKey, pasteKeys, selectAllKeys, shiftKeys } from '../core/keyframes';
import { togglePlay } from '../core/playback';
import { S, doc, selLayer } from '../core/state';
import { openExport } from '../export/build';
import { removeNodeAll } from '../geometry/nodes';
import { openFlow, toast } from '../io/open';
import { saveProject, saveProjectAs } from '../io/save';
import { isLocked } from '../model/tree';
import { finishPen } from '../tools/edit-tools';
import { applyEase } from './easing';
import { FM, closeFileMenu } from './file-menu';
import { renderInspector } from './inspector';
import { arrange, deleteSel, duplicate, groupSel, ungroup } from './layers-panel';
import { FRAME, MENU, renderTimeline } from './timeline';
import { closeModal } from './topbar';



export function init(): void {
  window.addEventListener('keydown',(e?)=>{
    const tg: any=e.target, typing=tg.closest&&tg.closest('input,textarea,select');
    if(e.key==='Escape'){ if(!MENU.hidden){ closeMenu(); return; } const m=[...(document.querySelectorAll as any)('.modal')].find((x?)=>!x.hidden); if(m){ closeModal(m); return; } }
    const modk=e.ctrlKey||e.metaKey, kk=(e.key||'').toLowerCase();
    if(modk&&kk==='s'){ e.preventDefault(); if(!$('#mSave').hidden) return; e.shiftKey?saveProjectAs():saveProject(); return; }
    if(modk&&kk==='o'){ e.preventDefault(); openFlow(); return; }
    if(modk&&kk==='e'&&!typing){ e.preventDefault(); openExport(); return; }
    if(modk&&kk==='i'&&!typing){ e.preventDefault(); $('#bImport').click(); return; }
    if(e.key==='Escape'&&!FM.hidden){ closeFileMenu(); return; }
    if(typing) return;
    if([...(document.querySelectorAll as any)('.modal')].some((x?)=>!x.hidden)) return;
    const mod=e.ctrlKey||e.metaKey, l=selLayer(), k=e.key;
    if(mod&&k.toLowerCase()==='z'){ e.preventDefault(); e.shiftKey?redo():undo(); return; }
    if(mod&&k.toLowerCase()==='y'){ e.preventDefault(); redo(); return; }
    if(mod&&k.toLowerCase()==='c'){ if(S.keys.size){ e.preventDefault(); copyKeys(); } return; }
    if(mod&&k.toLowerCase()==='v'){ if(S.clip&&S.clip.length){ e.preventDefault(); pasteKeys(); } return; }
    if(mod&&k.toLowerCase()==='a'){ e.preventDefault(); if(e.shiftKey){ S.keys.clear(); renderTimeline(); renderInspector(); } else selectAllKeys(); return; }
    if(k==='F9'){ e.preventDefault(); if(S.keys.size) applyEase(mod&&e.shiftKey?'out':e.shiftKey?'in':'inOut'); return; }
    if(mod&&k.toLowerCase()==='d'){ e.preventDefault(); if(S.keys.size) duplicateKeys(); else if(l) duplicate(l); return; }
    if(mod&&k.toLowerCase()==='g'){ e.preventDefault(); if(e.shiftKey) ungroup(l); else groupSel(); return; }
    if(mod&&(k===']'||k==='[')){ e.preventDefault(); if(l) arrange(l,k===']'?1:-1); return; }
    if(mod) return;
    if(k===' '){ e.preventDefault(); togglePlay(); return; }
    if(k==='Enter'&&S.pen){ finishPen(false); return; }
    if(k==='Escape'){ if(S.pen){ finishPen(false); return; } if(S.tool!=='select'){ setTool('select'); return; } if(S.keys.size){ S.keys.clear(); renderTimeline(); renderInspector(); return; } select(null); return; }
    if(k==='Delete'||k==='Backspace'){ e.preventDefault();
      if(S.keys.size) return deleteKeys();
      if(S.tool==='node'&&S.node&&l){ const ed=beginEdit(); if(!removeNodeAll(l,S.node[0],S.node[1])) toast('A path needs at least two nodes.'); S.node=null; ed.end({insp:true}); return; }
      deleteSel(); return; }
    if(k==='Home'){ setTime(0); return; }
    if(k==='End'){ setTime(doc.dur); return; }
    if(k.toLowerCase()==='j'||k.toLowerCase()==='k'){ jumpKey(k.toLowerCase()==='k'?1:-1); return; }
    if((k==='ArrowLeft'||k==='ArrowRight')&&S.keys.size){ e.preventDefault(); shiftKeys((k==='ArrowRight'?1:-1)*FRAME*(e.shiftKey?10:1)); return; }
    if(k===','||k==='.'){ setTime(S.time+(k==='.'?1:-1)/30); return; }
    if(k.startsWith('Arrow')&&l&&!isLocked(l)){ e.preventDefault(); const st=e.shiftKey?10:1, p=clone(H.get(l,'pos',S.time)); if(k==='ArrowLeft') p[0]-=st; if(k==='ArrowRight') p[0]+=st; if(k==='ArrowUp') p[1]-=st; if(k==='ArrowDown') p[1]+=st; const ed=beginEdit(); setProp(l,'pos',p.map(r2)); ed.end(); return; }
    const map={v:'select',a:'node',r:'rect',e:'ellipse',s:'star',p:'pen',t:'text',b:'bone'}; if(map[k.toLowerCase()]) setTool(map[k.toLowerCase()]);
  });
}
