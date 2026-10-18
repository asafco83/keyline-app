// Keyline — render/markup
import { H, esc, r3 } from '../core/constants';
import { isBox, kids } from '../model/tree';

export function attrs(o?) { let s=''; for(const k in o){ const v=o[k]; if(v==null||v==='') continue; s+=` ${k}="${esc(v)}"`; } return s; }
export function tfStr(c?) { return `translate(${r3(c.x)},${r3(c.y)}) rotate(${r3(c.r)}) scale(${r3(c.sx)},${r3(c.sy)}) translate(${r3(-c.ox)},${r3(-c.oy)})`; }
export function layerSVG(l?, ctx?, c?, children?) {
  const id=ctx.pre+l.id, G=l.geo;
  const a=Object.assign({},l.extra||{}); a.id=id+'-s'; if(l.xf) a.transform=l.xf;
  if(c.fill!=null) a.fill=c.fill;
  if(c.stk!=null) a.stroke=c.stk;
  if(c.sw!=null&&(c.sw>0||(l.t.sw&&l.t.sw.length))) a['stroke-width']=r3(c.sw);
  if(c.draw!=null&&(c.draw<100||(l.t.draw&&l.t.draw.length))){ a.pathLength=100; a['stroke-dasharray']='100 100'; a['stroke-dashoffset']=r3(100-c.draw); }
  let inner;
  if(l.type==='rect'){ Object.assign(a,{x:G.x,y:G.y,width:G.w,height:G.h}); if(G.rx) a.rx=G.rx; inner=`<rect${attrs(a)}/>`; }
  else if(l.type==='ellipse'){ Object.assign(a,{cx:G.cx,cy:G.cy,rx:G.rx,ry:G.ry}); inner=`<ellipse${attrs(a)}/>`; }
  else if(l.type==='path'){ a.d=H.dstr(c.d); inner=`<path${attrs(a)}/>`; }
  else if(l.type==='text'){ Object.assign(a,{x:G.x,y:G.y,'font-size':G.size,'font-family':G.family,'font-weight':G.weight,'text-anchor':G.anchor}); inner=`<text${attrs(a)}>${esc(G.text)}</text>`; }
  else if(l.type==='image'){ Object.assign(a,{x:G.x,y:G.y,width:G.w,height:G.h});
    if(ctx.editor){ a.href=ctx.href(G.asset); a.preserveAspectRatio='none'; inner=`<image${attrs(a)}/>`; }
    else { const sym=ctx.useImg(G.asset); inner=sym?`<use${attrs(Object.assign(a,{href:'#'+sym}))}/>`:''; } }
  else if(isBox(l)) inner=`<g${attrs(a)}>${children||''}</g>`;
  else inner=`<g${attrs(a)}>${G.markup||''}</g>`;
  return `<g id="${id}" transform="${tfStr(c)}" opacity="${r3(c.op)}"${ctx.editor?` data-lid="${l.id}"`:''}>${inner}</g>`;
}
export function markup(list?, pid?, ctx?) { return kids(pid,list).filter((l?)=>!l.hid).map((l?)=>layerSVG(l,ctx,H.comp(l,ctx.t),isBox(l)?markup(list,l.id,ctx):'')).join(''); }
