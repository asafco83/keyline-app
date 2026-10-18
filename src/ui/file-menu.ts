// Keyline — ui/file-menu
import { $ } from '../core/constants';
import { openExport } from '../export/build';

export const FM = $('#fileMenu');
export const BM = $('#bMenu');
export function openFileMenu() { const r=BM.getBoundingClientRect(); FM.hidden=false; FM.style.left=Math.max(4,r.left)+'px'; FM.style.top=(r.bottom+6)+'px'; BM.setAttribute('aria-expanded','true'); const f=FM.querySelector('button'); if(f) f.focus(); }
export function closeFileMenu() { FM.hidden=true; BM.setAttribute('aria-expanded','false'); }

export function init(): void {
  BM.addEventListener('click',(e?)=>{ e.stopPropagation(); FM.hidden?openFileMenu():closeFileMenu(); });
  FM.addEventListener('click',(e?)=>{ if((e.target as any).closest('button')) closeFileMenu(); });
  FM.addEventListener('keydown',(e?)=>{ const bs=[...FM.querySelectorAll('button')], i=bs.indexOf(document.activeElement);
    if(e.key==='ArrowDown'){ e.preventDefault(); (bs[i+1]||bs[0]).focus(); } if(e.key==='ArrowUp'){ e.preventDefault(); (bs[i-1]||bs[bs.length-1]).focus(); } if(e.key==='Escape'){ e.stopPropagation(); closeFileMenu(); BM.focus(); } });
  document.addEventListener('pointerdown',(e?)=>{ if(!FM.hidden&&!FM.contains(e.target)&&e.target!==BM&&!BM.contains(e.target)) closeFileMenu(); });
  $('#bExport2').addEventListener('click',openExport);
}
