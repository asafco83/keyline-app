// Keyline — ui/inspector
import { $, EZFAM, FONTS, H, PROPS, byId, clamp, clone, esc, fmt, r2, r3, xfp } from '../core/constants';
import { INSP } from '../core/dom';
import { beginEdit, deleteKeys, setProp, setTool, toggleKey } from '../core/history';
import { convertToPath, morphTo } from '../core/layer-ops';
import { ASSETS, S, doc, layerById, selLayer, sortTrack } from '../core/state';
import { subdivideAll } from '../geometry/nodes';
import { toast } from '../io/open';
import { descendants, kids } from '../model/tree';
import { fit, frame, renderStage } from '../render/stage';
import { addChildBone, boneTipL, shiftChildBones } from '../tools/bones';
import { H9, setAnchor } from '../tools/edit-tools';
import { applyEase, bezOf, drawEz, easeFam, famName, keyPanel, parseBez, sameEase } from './easing';
import { arrange, deleteSel, duplicate, groupSel, moveLayers, ungroup } from './layers-panel';
import { dragWin } from './timeline';

export function num(f?, lab?, unit?) { return (`<label class="nf"><span data-scrub="${f}">${lab}</span><input id="i-${f.replace(/:/g,'_')}" data-f="${f}" inputmode="decimal" spellcheck="false" aria-label="${lab}">${unit?`<em>${unit}</em>`:''}</label>`); }
export function gnum(g?, lab?, unit?) { return (`<label class="nf"><span>${lab}</span><input id="g-${g}" data-g="${g}" inputmode="decimal" spellcheck="false" aria-label="${lab}">${unit?`<em>${unit}</em>`:''}</label>`); }
export function colf(f?) { return (`<div class="cf"><input type="color" data-f="${f}" data-col id="c-${f}" aria-label="Pick color"><input class="txt mono" data-f="${f}" id="t-${f}" spellcheck="false" aria-label="Color value"></div>`); }
export function krow(k?, label?, body?) { return (`<div class="row"><button class="kb" data-kb="${k}" aria-label="Keyframe ${label}" title="Add / remove keyframe at playhead"></button><span class="rl">${label}</span><div class="rf">${body}</div></div>`); }
export function nrow(label?, body?) { return (`<div class="row nk"><span class="rl">${label}</span><div class="rf">${body}</div></div>`); }
export function kb(n?) { return (n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB'); }
export function renderInspector() {
  const l=selLayer();
  if(!l){ INSP.innerHTML=docPanel(); refreshDocFields(); return; }
  let h='';
  if(S.selSet.size>1) h+=`<section class="sec"><h3>${S.selSet.size} layers selected</h3><div class="btns"><button class="btn" data-act="grp">Group them</button><button class="btn danger" data-act="delsel">Delete all</button></div><p>The fields below edit “${esc(l.name)}”.</p></section>`;
  h+=`<section class="sec"><h3>Layer <span class="chip">${l.type}</span></h3>${nrow('Name',`<input class="txt" id="ln" data-name value="${esc(l.name)}" spellcheck="false">`)}</section>`;
  if(S.keys.size) h+=keyPanel();
  h+=`<section class="sec"><h3>Transform <small>◆ adds a keyframe</small></h3>
    ${krow('pos','Position',num('pos:0','X')+num('pos:1','Y'))}
    ${krow('rot','Rotate',num('rot','↻','°'))}
    ${krow('scl','Scale',num('scl:0:100','W','%')+num('scl:1:100','H','%'))}
    ${krow('op','Opacity',num('op::100','α','%'))}
    ${l.type==='bone'?'':`    ${krow('org','Origin',num('org:0','X')+num('org:1','Y')+`<button class="btn ib" data-act="center" title="Center origin on the shape" aria-label="Center origin">◎</button>`)}
    ${nrow('Anchor',`<div class="anchor" role="group" aria-label="Move origin to a point of the box">${H9.map(([u,v])=>`<button data-anchor="${u},${v}" aria-label="Origin at ${['left','center','right'][u*2]} ${['top','middle','bottom'][v*2]}" title="Origin at ${['left','center','right'][u*2]} ${['top','middle','bottom'][v*2]}"></button>`).join('')}</div><div class="btns" style="margin-left:auto"><button class="btn" data-act="flipx" title="Mirror horizontally around the origin">Flip H</button><button class="btn" data-act="flipy" title="Mirror vertically around the origin">Flip V</button></div>`)}
    <p>Drag the origin on the canvas to move it (Shift snaps to the box). Scale handles: Shift keeps proportions, Alt scales from the center, Ctrl scales around the origin, drag past the edge to mirror.</p>`}</section>`;
  if(l.t.pos&&l.t.pos.length>1) h+=`<section class="sec"><h3>Motion path</h3>
    <label class="check"><input type="checkbox" data-flag="sm" id="fl-sm" ${l.sm?'checked':''}> Curved path through keyframes</label>
    <label class="check"><input type="checkbox" data-flag="or" id="fl-or" ${l.or?'checked':''}> Rotate along the path</label></section>`;
  if(['rect','ellipse','path','text'].includes(l.type)){
    h+=`<section class="sec"><h3>Appearance</h3>${krow('fill','Fill',colf('fill'))}${krow('stk','Stroke',colf('stk'))}${krow('sw','Stroke width',num('sw','W','px'))}`;
    if(l.type!=='text') h+=krow('draw','Draw',num('draw','◐','%'))+`<p>Draw animates the stroke from 0% to 100% for a self-drawing line. Give the layer a stroke first.</p>`;
    h+=`</section>`;
  }
  const G=l.geo;
  if(l.type==='group'){ const n=kids(l.id).length; h+=`<section class="sec"><h3>Group <small>${n} layer${n===1?'':'s'} inside</small></h3><p>Keyframes on a group move, turn, scale or fade everything inside it together. Layers inside keep their own keyframes.</p><div class="btns"><button class="btn" data-act="ungroup">Ungroup</button></div></section>`; }
  if(l.type==='raw') h+=`<section class="sec"><h3>Imported element</h3><p>This element animates with position, rotation, scale and opacity. Its own styling is kept as imported.</p></section>`;
  if(l.type==='image'){ const a=ASSETS[G.asset];
    h+=`<section class="sec"><h3>Image <span class="chip">${a?esc((a.mime||'').replace('image/','').replace('x-icon','ico')):'missing'}</span></h3>
      ${a?`<p>${esc(a.name)} · ${a.w}×${a.h}px · ${kb(a.size||0)}</p>`:'<p>The image file for this layer is missing. Add it again from the Assets tab.</p>'}
      ${nrow('Position',gnum('x','X')+gnum('y','Y'))}${nrow('Size',gnum('w','W')+gnum('h','H'))}
      <label class="check"><input type="checkbox" id="lockAR" ${S.lockAR?'checked':''}> Keep proportions</label>
      ${a?'<div class="btns"><button class="btn" data-act="natural">Original size</button></div>':''}</section>`; }
  if(l.type==='rect') h+=`<section class="sec"><h3>Rectangle</h3>${nrow('Position',gnum('x','X')+gnum('y','Y'))}${nrow('Size',gnum('w','W')+gnum('h','H'))}${nrow('Corner',gnum('rx','R'))}<div class="btns"><button class="btn" data-act="topath">Convert to path</button></div></section>`;
  if(l.type==='ellipse') h+=`<section class="sec"><h3>Ellipse</h3>${nrow('Center',gnum('cx','X')+gnum('cy','Y'))}${nrow('Radius',gnum('rx','X')+gnum('ry','Y'))}<div class="btns"><button class="btn" data-act="topath">Convert to path</button></div></section>`;
  if(l.type==='text'){ const fams=FONTS.some((f?)=>f[0]===G.family)?FONTS:FONTS.concat([[G.family,G.family.split(',')[0]]]);
    h+=`<section class="sec"><h3>Text</h3><textarea class="ta" data-g="text" id="g-text" rows="2" aria-label="Text">${esc(G.text)}</textarea>
    ${nrow('Font',`<select class="sel" data-g="family" id="g-family">${fams.map((f?)=>`<option value="${esc(f[0])}"${f[0]===G.family?' selected':''}>${esc(f[1])}</option>`).join('')}</select>`)}
    ${nrow('Size',gnum('size','pt')+`<select class="sel" data-g="weight" id="g-weight">${['300','400','500','600','700','800'].map((w?)=>`<option${String(G.weight)===w?' selected':''}>${w}</option>`).join('')}</select>`)}
    ${nrow('Align',`<select class="sel" data-g="anchor" id="g-anchor">${[['start','Left'],['middle','Center'],['end','Right']].map((a?)=>`<option value="${a[0]}"${G.anchor===a[0]?' selected':''}>${a[1]}</option>`).join('')}</select>`)}
    ${nrow('Position',gnum('x','X')+gnum('y','Y'))}</section>`; }
  if(l.type==='path'){ const others=doc.layers.filter((o?)=>o!==l&&['path','rect','ellipse'].includes(o.type));
    const cnt=(H.get(l,'d',S.time)||[]).reduce((s?,p?)=>s+p.n.length,0);
    h+=`<section class="sec"><h3>Path & morph <small>${cnt} nodes</small></h3>
      ${krow('d','Morph',`<button class="btn" data-act="nodes" style="flex:1">${S.tool==='node'?'Done editing':'Edit nodes'}</button>`)}
      <p>Add a Morph keyframe, move the playhead, then edit nodes. The shape blends between keyframes.</p>
      ${nrow('Morph into',`<select class="sel" id="morphTo" aria-label="Morph into another shape"><option value="">Choose a shape…</option>${others.map((o?)=>`<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select>`)}
      <div class="btns"><button class="btn" data-act="subdiv">Add nodes (subdivide)</button></div></section>`; }
  if(l.type==='bone'){ const n=kids(l.id).length;
    h+=`<section class="sec"><h3>Bone <small>${n} attached</small></h3>${nrow('Length',gnum('len','L'))}${nrow('Rest angle',gnum('ang','∠','°'))}
      <label class="check"><input type="checkbox" data-flag="pin" id="fl-pin" ${l.pin?'checked':''}> Pin: IK stops at this bone</label>
      <label class="check"><input type="checkbox" data-flag="lim" id="fl-lim" ${l.lim?'checked':''}> Limit rotation</label>
      ${l.lim?nrow('Range',`<label class="nf"><span>min</span><input id="bl-min" data-bl="lmin" inputmode="decimal" value="${fmt(l.lmin!=null?l.lmin:-90)}"><em>°</em></label><label class="nf"><span>max</span><input id="bl-max" data-bl="lmax" inputmode="decimal" value="${fmt(l.lmax!=null?l.lmax:90)}"><em>°</em></label>`):''}
      <div class="btns"><button class="btn" data-act="childbone">Add child bone</button></div>
      <p>Drag a bone to rotate it (forward kinematics). Drag its tip, or Alt+drag the bone, to pull the chain into place (inverse kinematics). Attach artwork by dragging layers onto the bone in the Layers panel, or with “Attach to bone” on the layer.</p></section>`; }
  else { const bones=doc.layers.filter((b?)=>b.type==='bone'&&!descendants(l).includes(b));
    if(bones.length){ const pb=l.parent&&layerById(l.parent), cur=pb&&pb.type==='bone'?pb.id:'';
      h+=`<section class="sec"><h3>Rig</h3>${nrow('Attach to bone',`<select class="sel" id="attachBone"><option value="">Not attached</option>${bones.map((b?)=>`<option value="${b.id}"${b.id===cur?' selected':''}>${esc(b.name)}</option>`).join('')}</select>`)}</section>`; } }
  h+=`<section class="sec"><h3>Arrange</h3><div class="btns"><button class="btn" data-act="fwd">Bring forward</button><button class="btn" data-act="back">Send backward</button><button class="btn" data-act="dup">Duplicate</button><button class="btn danger" data-act="del">Delete</button></div></section>`;
  INSP.innerHTML=h; refreshInspector(true); drawEz();
}
export function docPanel() {
  return `<section class="sec"><h3>Document</h3>
    ${nrow('Canvas',`<label class="nf"><span>W</span><input id="d-w" data-doc="w" inputmode="numeric"></label><label class="nf"><span>H</span><input id="d-h" data-doc="h" inputmode="numeric"></label>`)}
    ${nrow('Background',`<div class="cf"><input type="color" id="d-bgc" data-doc="bg" aria-label="Background color"><input class="txt mono" id="d-bg" data-doc="bg" placeholder="none" spellcheck="false" aria-label="Background value"></div>`)}
    ${nrow('Length',`<label class="nf"><span>t</span><input id="d-dur" data-doc="dur" inputmode="decimal"><em>s</em></label>`)}
    ${nrow('Repeat',`<select class="sel" id="d-it" data-doc="it"><option value="0">Loop forever</option><option value="1">Play once</option><option value="2">2 times</option><option value="3">3 times</option><option value="5">5 times</option></select>`)}
    ${nrow('Direction',`<select class="sel" id="d-dir" data-doc="dir"><option value="normal">Normal</option><option value="alternate">Alternate</option><option value="reverse">Reverse</option><option value="alternate-reverse">Reverse, then alternate</option></select>`)}</section>
    <section class="sec"><h3>How to animate</h3><ol class="tip">
      <li><b>Bring in artwork.</b> Draw, paste Figma's “Copy as SVG”, or drop SVG and image files on the canvas.</li>
      <li><b>Organize layers.</b> Group and nest them in the Layers panel by dragging.</li>
      <li><b>Move the playhead</b> and change a layer. With Auto-key on, a keyframe is recorded and the layer joins the timeline.</li>
      <li><b>Shape the timing.</b> Click a keyframe or the line between two keyframes to pick an easing or draw a custom curve.</li>
      <li><b>Export</b> one animated .svg with a built-in player or pure CSS. Images are embedded inside it.</li></ol></section>`;
}
export function refreshDocFields() {
  const set=(id?,v?)=>{ const e=byId(id); if(e&&e!==document.activeElement) e.value=v; };
  set('d-w',doc.w); set('d-h',doc.h); set('d-bg',doc.bg||''); set('d-bgc',toHex(doc.bg)||'#ffffff'); set('d-dur',fmt(doc.dur)); set('d-it',String(doc.it||0)); set('d-dir',doc.dir);
  set('tDur',fmt(doc.dur));
}
export function refreshInspector(full?) {
  const td=$('#tDur'); if(td!==document.activeElement) td.value=fmt(doc.dur);
  const l=selLayer(); if(!l) return;
  INSP.querySelectorAll('[data-f]').forEach((inp?)=>{ if(inp===document.activeElement) return;
    const [k,i,m]=inp.dataset.f.split(':'); let v=H.get(l,k,S.time); if(i!==undefined&&i!=='') v=v?v[+i]:0;
    if(PROPS[k][1]==='c'){ if(inp.type==='color') inp.value=toHex(v)||'#000000'; else inp.value=v==null?'':v; }
    else inp.value=fmt(m?v*+m:v); });
  INSP.querySelectorAll('[data-kb]').forEach((b?)=>{ const tr=l.t[b.dataset.kb], has=!!(tr&&tr.length); b.classList.toggle('has',has); b.classList.toggle('on',has&&tr.some((q?)=>Math.abs(q[0]-S.time)<0.005)); });
  if(full) INSP.querySelectorAll('input[data-g]').forEach((inp?)=>{ inp.value=fmt(l.geo[inp.dataset.g]); });
  INSP.querySelectorAll('[data-o]').forEach((inp?)=>{ if(full||inp!==document.activeElement) inp.value=fmt((l.o||[0,0])[+inp.dataset.o]); });
  const ab=INSP.querySelectorAll('[data-anchor]'); if(ab.length){ const g=byId('e-'+l.id); let bb=null; try{ bb=g&&g.getBBox(); }catch(e){}
    ab.forEach((btn?)=>{ const [u,v]=btn.dataset.anchor.split(',').map(Number); btn.classList.toggle('on',!!bb&&!!l.o&&Math.abs(bb.x+bb.width*u-H.get(l,'org',S.time)[0])<0.6&&Math.abs(bb.y+bb.height*v-H.get(l,'org',S.time)[1])<0.6); }); }
}
export function toHex(c?) {
  if(typeof c!=='string') return null; c=c.trim();
  let m=/^#([0-9a-f]{3})$/i.exec(c); if(m) return '#'+m[1].replace(/./g,'$&$&').toLowerCase();
  m=/^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(c); if(m) return '#'+m[1].toLowerCase();
  m=/^rgba?\(([^)]+)\)$/.exec(c); if(m){ const a=m[1].split(/[\s,\/]+/).map(parseFloat); return '#'+a.slice(0,3).map((v?)=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join(''); }
  const named={white:'#ffffff',black:'#000000',red:'#ff0000',blue:'#0000ff',green:'#008000',yellow:'#ffff00',orange:'#ffa500',gray:'#808080',grey:'#808080'}; return named[c.toLowerCase()]||null;
}
export function parseField(l?, inp?) {
  const [k,i,m]=inp.dataset.f.split(':'); const kind=PROPS[k][1]; let v;
  if(kind==='c'){ v=inp.value.trim()||'none'; }
  else { v=parseFloat(inp.value); if(!isFinite(v)) return null; if(m) v/=+m; if(k==='op') v=clamp(v,0,1); if(k==='draw') v=clamp(v,0,100); if(k==='sw') v=Math.max(0,v); v=r3(v); }
  if(i!==undefined&&i!==''){ const cur=clone(H.get(l,k,S.time)); cur[+i]=v; v=cur; }
  return [k,v];
}
export function setField(l?, k?, v?) { return (k==='org'?reOrigin(l,v):setProp(l,k,v)); }
export function reOrigin(l?, o?) {
  const old=H.get(l,'org',S.time)||[0,0], c=H.comp(l,S.time), rad=c.r*Math.PI/180, d0=o[0]-old[0], d1=o[1]-old[1];
  const mx=c.sx*d0, my=c.sy*d1, rx=mx*Math.cos(rad)-my*Math.sin(rad), ry=mx*Math.sin(rad)+my*Math.cos(rad);
  const fix=[rx-d0, ry-d1], shift=(v?)=>[r2(v[0]+fix[0]),r2(v[1]+fix[1])];
  if(l.t.org&&l.t.org.length){ setProp(l,'org',[r2(o[0]),r2(o[1])]); setProp(l,'pos',shift(H.get(l,'pos',S.time))); return; }
  if(l.t.pos&&l.t.pos.length) l.t.pos.forEach((q?)=>q[1]=shift(q[1])); else l.b.pos=shift(l.b.pos);
  l.o=[r2(o[0]),r2(o[1])];
}
export function docField(t?) {
  const k=t.dataset.doc, ed=beginEdit();
  if(k==='w'||k==='h'){ const v=parseInt(t.value); if(v>0) doc[k]=Math.min(8000,v); }
  else if(k==='dur'){ const v=parseFloat(t.value); if(v>0){ doc.dur=r3(clamp(v,0.1,600)); S.time=Math.min(S.time,doc.dur); } }
  else if(k==='bg'){ const v=t.value.trim(); doc.bg=(!v||v==='none'||v==='transparent')?'':v; }
  else if(k==='it') doc.it=parseInt(t.value)||0;
  else if(k==='dir') doc.dir=t.value;
  ed.end(); refreshDocFields(); if(k==='w'||k==='h') fit();
}

export function init(): void {
  INSP.addEventListener('input',(e?)=>{
    const t=e.target, l=selLayer();
    if(t.dataset.col!==undefined&&l){ if(!S.colorEd) S.colorEd=beginEdit(); const r=parseField(l,t); if(r){ setProp(l,r[0],r[1]); frame(); } }
    if(t.id==='d-bgc'){ if(!S.colorEd) S.colorEd=beginEdit(); doc.bg=t.value; renderStage(); frame(); }
  });
  INSP.addEventListener('change',(e?)=>{
    const t=e.target, l=selLayer();
    if(S.colorEd&&(t.dataset.col!==undefined||t.id==='d-bgc')){ const ed=S.colorEd; S.colorEd=null; ed.end(); return; }
    if(t.dataset.doc!==undefined) return docField(t);
    if(!l) return;
    if(t.dataset.f){ const r=parseField(l,t); if(!r){ refreshInspector(); return; } const ed=beginEdit(); setField(l,r[0],r[1]); ed.end(); return; }
    if(t.dataset.g){ const g=t.dataset.g, ed=beginEdit();
      if(['text','family','weight','anchor'].includes(g)) l.geo[g]=t.value;
      else { const v=parseFloat(t.value); if(!isFinite(v)){ refreshInspector(true); return; }
        const nv=['w','h','rx','ry','size'].includes(g)?Math.max(0,v):v;
        if(l.type==='image'&&S.lockAR&&(g==='w'||g==='h')&&l.geo.w&&l.geo.h){ const ratio=l.geo.h/l.geo.w; if(g==='w') l.geo.h=r2(nv*ratio); else l.geo.w=r2(nv/ratio); }
        const oldTip=l.type==='bone'?boneTipL(l.geo):null; l.geo[g]=g==='len'?Math.max(1,nv):nv; if(oldTip) shiftChildBones(l,oldTip); }
      ed.end(); refreshInspector(true); return; }
    if(t.dataset.o!==undefined){ const v=parseFloat(t.value); if(!isFinite(v)) return; const ed=beginEdit(); const o=(l.o||[0,0]).slice(); o[+t.dataset.o]=v; reOrigin(l,o); ed.end(); return; }
    if(t.dataset.name!==undefined){ if(!t.value.trim()) return; const ed=beginEdit(); l.name=t.value.trim(); ed.end(); return; }
    if(t.dataset.flag){ const ed=beginEdit(); l[t.dataset.flag]=t.checked; if(t.dataset.flag==='lim'&&t.checked){ if(l.lmin==null) l.lmin=-90; if(l.lmax==null) l.lmax=90; } ed.end({insp:true}); return; }
    if(t.dataset.bl){ const v=parseFloat(t.value); if(!isFinite(v)) return; const ed=beginEdit(); l[t.dataset.bl]=v; if(l.lmin>l.lmax){ const x=l.lmin; l.lmin=l.lmax; l.lmax=x; } ed.end({insp:true}); return; }
    if(t.id==='attachBone'){ if(t.value) moveLayers([l.id],layerById(t.value),'into'); else moveLayers([l.id],null,'root'); return; }
    if(t.id==='lockAR'){ S.lockAR=t.checked; return; }
    if(t.dataset.ezv!==undefined){ const k0=[...S.keys][0]; if(!k0) return; const b=(bezOf(k0[2])||[.25,.1,.25,1]).slice(); const v=parseFloat(t.value); if(!isFinite(v)){ drawEz(); return; } const i=+t.dataset.ezv; b[i]=(i%2===0)?clamp(v,0,1):clamp(v,-2,3); applyEase(b.map(r3)); return; }
    if(t.id==='ezCss'){ const b=parseBez(t.value); if(!b){ toast('Use the form cubic-bezier(x1, y1, x2, y2).'); drawEz(); return; } applyEase(b); return; }
    if(t.id==='kf-time'){ const v=parseFloat(t.value); if(!isFinite(v)) return; const ed=beginEdit(); const k=[...S.keys][0]; k[0]=r3(clamp(v,0,doc.dur)); doc.layers.forEach((L?)=>Object.values<any>(L.t).forEach(sortTrack)); S.time=k[0]; ed.end({insp:true}); return; }
    if(t.id==='morphTo'&&t.value){ const tg=layerById(t.value); if(tg) morphTo(l,tg); }
  });
  INSP.addEventListener('click',(e?)=>{
    const kbt=(e.target as any).closest('[data-kb]'), l=selLayer(); if(kbt&&l) return toggleKey(l,kbt.dataset.kb);
    const ez=(e.target as any).closest('[data-ez]'); if(ez){ applyEase(JSON.parse(ez.dataset.ez)); return; }
    const dirB=(e.target as any).closest('#ezDir button'); if(dirB){ S.ezDir=dirB.dataset.v; const k0=[...S.keys][0], fam=easeFam(k0&&k0[2]);
      if(EZFAM.includes(fam)) applyEase(famName(fam,S.ezDir)); else { const sec=$('#kfsec'); if(sec){ sec.outerHTML=keyPanel(); drawEz(); } } return; }
    const an=(e.target as any).closest('[data-anchor]'); if(an&&l){ const [u,v]=an.dataset.anchor.split(',').map(Number); setAnchor(l,u,v); return; }
    const b=(e.target as any).closest('[data-act]'); if(!b||!l) return; const a=b.dataset.act;
    if(a==='flipx'||a==='flipy'){ const s=clone(H.get(l,'scl',S.time)), ed=beginEdit(); s[a==='flipx'?0:1]*=-1; setProp(l,'scl',s); ed.end(); return; }
    if(a==='center'){ const g=byId('e-'+l.id); if(!g) return; const ed=beginEdit(); const bb=g.getBBox(); reOrigin(l,[bb.x+bb.width/2,bb.y+bb.height/2]); ed.end(); }
    else if(a==='topath') convertToPath(l);
    else if(a==='childbone') addChildBone(l);
    else if(a==='nodes'){ setTool(S.tool==='node'?'select':'node'); renderInspector(); }
    else if(a==='subdiv'){ const ed=beginEdit(); subdivideAll(l); ed.end({insp:true}); }
    else if(a==='fwd'||a==='back') arrange(l,a==='fwd'?1:-1);
    else if(a==='dup') duplicate(l);
    else if(a==='del'){ S.selSet=new Set<any>([l.id]); deleteSel(); }
    else if(a==='delsel') deleteSel();
    else if(a==='grp') groupSel();
    else if(a==='ungroup') ungroup(l);
    else if(a==='natural'){ const as=ASSETS[l.geo.asset]; if(!as) return; const ed=beginEdit(); l.geo.w=as.w; l.geo.h=as.h; l.o=null; ed.end(); refreshInspector(true); }
    else if(a==='kdel') deleteKeys();
    else if(a==='ezsave'){ const k0=[...S.keys][0]; if(!k0||!Array.isArray(k0[2])) return; const ed=beginEdit(); doc.ezPresets=doc.ezPresets||[]; doc.ezPresets.push({name:'Custom '+(doc.ezPresets.length+1),v:clone(k0[2])}); ed.end({insp:true}); toast('Saved as an easing preset for this project.'); }
    else if(a==='ezdelp'){ const k0=[...S.keys][0]; const ed=beginEdit(); doc.ezPresets=(doc.ezPresets||[]).filter((p?)=>!sameEase(p.v,k0[2])); ed.end({insp:true}); }
    else if(a==='ezall'){ const k0=[...S.keys][0]; if(!k0) return; const ed=beginEdit(); doc.layers.forEach((L?)=>Object.values<any>(L.t).forEach((tr?)=>{ if(tr.some((q?)=>S.keys.has(q))) tr.forEach((q?)=>q[2]=clone(k0[2])); })); ed.end({insp:true}); toast('Easing applied to every keyframe in this animator.'); }
  });
  INSP.addEventListener('pointerdown',(e?)=>{
    const hd=(e.target as any).closest('[data-hd]');
    if(hd&&S.keys.size){ e.preventDefault(); const idx=+hd.dataset.hd, svg=$('#ezEd'), k0=[...S.keys][0], base=(bezOf(k0[2])||[.25,.1,.25,1]).slice(), ed=beginEdit();
      dragWin((ev?)=>{ const p=xfp(svg.getScreenCTM().inverse(),ev.clientX,ev.clientY); base[idx*2]=r2(clamp((p.x-20)/200,0,1)); base[idx*2+1]=r2(clamp((190-p.y)/90-.5,-.5,1.5)); S.keys.forEach((k?)=>k[2]=base.slice()); drawEz(); frame(); },
        ()=>ed.end({insp:true})); return; }
    const sc=(e.target as any).closest('[data-scrub]'); const l=selLayer(); if(!sc||!l) return;
    e.preventDefault(); const f=sc.dataset.scrub, inp=sc.parentElement.querySelector('input'), [k]=f.split(':');
    const step={pos:1,org:1,rot:1,scl:.5,op:.5,sw:.1,draw:.5}[k]||1, start=parseFloat(inp.value)||0, x0=e.clientX, ed=beginEdit();
    dragWin((ev?)=>{ inp.value=fmt(start+(ev.clientX-x0)*step*(ev.shiftKey?10:1)); const r=parseField(l,inp); if(r){ setField(l,r[0],r[1]); frame(); } }, ()=>ed.end());
  });
}
