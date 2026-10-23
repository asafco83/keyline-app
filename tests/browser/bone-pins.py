import asyncio, sys, json, math
from playwright.async_api import async_playwright
import os
OUT=os.environ.get('CIN_OUT','/tmp/svgcinema-shots/'); os.makedirs(OUT, exist_ok=True)
# Pins bound to bones (Pin tool › Bind to bones): pins at the bones' joints that follow the rig, mixed
# with ordinary pins; unbinding, the chip and Pins section, and both exports.
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(); await pg.set_viewport_size({'width':1440,'height':1000})
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto((sys.argv[1] if len(sys.argv)>1 else 'http://localhost:5199/')); await pg.wait_for_timeout(2500)
        await pg.evaluate("async()=>{ window.st=await import('/src/core/state.ts'); window.hi=await import('/src/core/history.ts'); window.D=await import('/src/core/dom.ts'); window.B=await import('/src/export/build.ts'); window.SG=await import('/src/render/stage.ts'); window.NO=await import('/src/geometry/nodes.ts'); window.BO=await import('/src/tools/bones.ts'); window.K=await import('/src/core/constants.ts')}")
        ev=pg.evaluate; R={}; F=[]
        def check(n,c,i=None):
            R[n]=('ok' if c else 'FAIL')+('' if i is None else f' {i}')
            if not c: F.append(n)
        await ev("window.scr=(x,y)=>{const M=D.CONTENT.getScreenCTM();return [M.a*x+M.c*y+M.e, M.b*x+M.d*y+M.f]}")
        # a vine beside the Sprout's stalk (not part of the rig), on top of the scene
        # no grow-in, so the rig is at rest before its sway starts (1.2 s)
        await ev("(()=>{const g=st.doc.layers.find(l=>l.name==='Sprout');delete g.t.scl;SG.renderAll()})()")
        vid=await ev("""(()=>{const l=st.mkLayer('path','Vine',{},{fill:'#2EC4A6',d:NO.rectNodes({x:600,y:212,w:8,h:88})});st.doc.layers.push(l);hi.select(l.id);SG.renderAll();return l.id})()""")
        L=f"st.layerById('{vid}')"
        ID={}
        for n in ['Stem','Stem 2','Stem 3']: ID[n]=await ev(f"st.doc.layers.find(l=>l.name==='{n}').id")
        dattr=lambda: ev(f"document.getElementById('e-{vid}-s').getAttribute('d')")
        await ev("hi.setTime(1.5)"); await pg.wait_for_timeout(100)
        await pg.keyboard.press('w'); await pg.wait_for_timeout(150)
        check('Bind to bones in the Pin tool options', await ev("(()=>{const b=document.querySelector('#boneOpts [data-pbind]');return !!b && !document.getElementById('boneOpts').hidden && /Bind to bones/.test(b.textContent)})()"))
        await pg.click('#boneOpts [data-pbind]'); await pg.wait_for_timeout(150)
        check('binding: bones shown, chip explains', await ev("st.S.pinBind") and await ev("document.querySelectorAll('#overlay [data-bone]').length")>=3 and 'Bind to bones' in await ev("document.getElementById('boneChip').textContent"))
        async def clickBone(n):
            q=await ev(f"(()=>{{const p=BO.bonePts(st.layerById('{ID[n]}'));return scr(p.J.x*0.45+p.T.x*0.55,p.J.y*0.45+p.T.y*0.55)}})()")
            await pg.mouse.click(q[0],q[1]); await pg.wait_for_timeout(150)
        for n in ['Stem','Stem 2','Stem 3']: await clickBone(n)
        pins=json.loads(await ev(f"JSON.stringify({L}.pins)"))
        check('a click on a bone adds a pin bound to it', [q.get('bone') for q in pins]==[ID['Stem'],ID['Stem 2'],ID['Stem 3']], pins)
        j=await ev(f"(()=>{{const b=st.layerById('{ID['Stem 2']}');return [b.geo.x,b.geo.y]}})()")
        check('the pin sits at the bone\'s joint', abs(pins[1]['x']-j[0])<0.6 and abs(pins[1]['y']-j[1])<0.6, (pins[1],j))
        check('bound bones highlighted', await ev("document.querySelectorAll('#overlay .ov-bone.is-sel').length")==3)
        await clickBone('Stem 2')
        check('clicking a bound bone again unbinds it', await ev(f"{L}.pins.map(p=>p.n).join(',')")=='1,3')
        await clickBone('Stem 2')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(120)
        check('Esc ends binding, the Pin tool stays', not await ev("st.S.pinBind") and await ev("st.S.tool")=='pin')
        chip=await ev("document.getElementById('boneChip').textContent")
        check('chip counts pins on bones', '3 pins · 3 on bones' in chip, chip)
        check('bound pins drawn with a ring', await ev("document.querySelectorAll('#overlay .ov-pinbound:not(.is-other)').length")==3)
        # ---- the rig bends the vine
        await ev("hi.setTime(1.1)"); await pg.wait_for_timeout(80); d15=await dattr()
        rest=await ev(f"(()=>{{const was=K.H.restPins(true);const d=K.H.dstr(K.H.comp({L},1.1).d);K.H.restPins(was);return d}})()")
        check('before the sway the vine is at rest', d15==rest)
        await ev("hi.setTime(1.95)"); await pg.wait_for_timeout(80)
        check('the sway bends the vine', await dattr()!=rest)
        # the pin bound to the top bone is where that bone's joint is now
        st3=json.loads(await ev(f"JSON.stringify(K.H.pinAt({L},{L}.pins.find(p=>p.bone==='{ID['Stem 3']}'),1.95))"))
        jw=await ev(f"(()=>{{const b=st.layerById('{ID['Stem 3']}'),M=D.CONTENT.getScreenCTM().inverse().multiply(document.getElementById('e-'+b.id).getScreenCTM()),q=new DOMPoint(b.geo.x,b.geo.y).matrixTransform(M);return [q.x,q.y]}})()")
        check('a bound pin follows its bone\'s joint', abs(st3[2]-jw[0])<0.3 and abs(st3[3]-jw[1])<0.3 and abs(st3[4])>2, (st3,jw))
        await pg.screenshot(path=OUT+'bone-pins.png')
        # ---- a bound pin can be picked and deleted, not dragged; the Pins section names its bone
        c=await ev("(()=>{const e=document.querySelector('[data-pin=\"3\"]').getBoundingClientRect();return [e.x+e.width/2,e.y+e.height/2]})()")
        await pg.mouse.move(*c); await pg.mouse.down(); await pg.mouse.move(c[0]+30,c[1],steps=4); await pg.mouse.up(); await pg.wait_for_timeout(150)
        check('a bound pin isn\'t dragged', await ev(f"!{L}.t.pin3") and await ev("st.S.pinSel")==3)
        bone=await ev("(()=>{const e=document.querySelector('.pin-bone');return e&&e.textContent})()")
        check('Pins section names the bone', bone=='Stem 3' and await ev("document.querySelectorAll('.pin-chip.bound').length")==3, bone)
        # ---- ordinary pins mix with bound ones
        await ev("hi.setTime(1.95)")
        mid=await ev(f"(()=>{{const r=document.getElementById('e-{vid}-s').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height*0.6]}})()")
        await pg.mouse.click(*mid); await pg.wait_for_timeout(150)
        check('an ordinary pin joins them', await ev(f"{L}.pins.length")==4 and await ev(f"!{L}.pins[3].bone"))
        # ---- exports agree at 1.95 s
        await ev("hi.setTime(1.95)"); ed=await ev(f"(()=>{{const b=document.getElementById('e-{vid}-s').getBBox();return [b.x,b.y,b.width,b.height]}})()")
        await ev("st.doc.ex.mode='js'; st.doc.ex.trigger='load'"); js=await ev("B.buildExport(null).code")
        await ev("st.doc.ex.mode='css'"); css=await ev("B.buildExport(null).code"); await ev("st.doc.ex.mode='js'")
        check('JS export carries the binding', f'"bone":"{ID["Stem 3"]}"' in js)
        async def probe(code, mode, t):
            q=await b.new_page(); await q.set_viewport_size({'width':1440,'height':1000})
            await q.set_content('<!doctype html><html><body style="margin:0">'+code+'</body></html>'); await q.wait_for_timeout(300)
            if mode=='js': await q.evaluate(f"document.querySelector('svg').player.pause().seekTo({t*1000})")
            else: await q.evaluate(f"(()=>{{const s=document.querySelector('svg');s.pauseAnimations();s.setCurrentTime({t});document.getAnimations().forEach(a=>{{a.pause();a.currentTime={t*1000}}})}})()")
            await q.wait_for_timeout(80)
            r=await q.evaluate(f"(()=>{{const P=document.querySelector('svg').id.replace(/svg$/,''),b=document.getElementById(P+'{vid}-s').getBBox();return [b.x,b.y,b.width,b.height]}})()")
            await q.close(); return r
        rj=await probe(js,'js',1.95); rc=await probe(css,'css',1.95)
        check('JS export matches the editor', all(abs(x-y)<0.6 for x,y in zip(rj,ed)), (rj,ed))
        check('CSS export matches the JS export', all(abs(x-y)<0.8 for x,y in zip(rj,rc)), (rj,rc))
        # ---- Delete removes a bound pin
        await ev("st.S.pinSel=1; st.S.keys.clear(); SG.frame()")
        await pg.keyboard.press('Delete'); await pg.wait_for_timeout(150)
        left=await ev(f"{L}.pins.map(p=>p.n)")
        check('Delete removes a bound pin', len(left)==3 and 1 not in left, left)
        R['errors']=errs; check('no page errors', not errs, errs)
        print(json.dumps(R,indent=1)); print('FAILS',F); await b.close()
asyncio.run(main())
