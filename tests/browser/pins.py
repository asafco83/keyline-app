import asyncio, sys, json, math
from playwright.async_api import async_playwright
import os
OUT=os.environ.get('CIN_OUT','/tmp/svgcinema-shots/'); os.makedirs(OUT, exist_ok=True)
# Step 5: the Pin tools on a path: adding pins, dragging (keyed at the playhead), Alt / Edit pins rest
# moves (motion kept), the rotation ring, Delete, the Pins section, Reach, and both exports.
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(); await pg.set_viewport_size({'width':1440,'height':1000})
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto((sys.argv[1] if len(sys.argv)>1 else 'http://localhost:5199/')); await pg.wait_for_timeout(2500)
        await pg.evaluate("async()=>{ window.st=await import('/src/core/state.ts'); window.hi=await import('/src/core/history.ts'); window.D=await import('/src/core/dom.ts'); window.B=await import('/src/export/build.ts'); window.K=await import('/src/core/constants.ts'); window.SG=await import('/src/render/stage.ts'); window.NO=await import('/src/geometry/nodes.ts')}")
        ev=pg.evaluate; R={}; F=[]
        def check(n,c,i=None):
            R[n]=('ok' if c else 'FAIL')+('' if i is None else f' {i}')
            if not c: F.append(n)
        # a long bar to bend, on top of the scene
        tid=await ev("""(()=>{const l=st.mkLayer('path','Tail',{},{fill:'#A07BFF',d:NO.rectNodes({x:150,y:150,w:260,h:30})});st.doc.layers.push(l);hi.select(l.id);SG.renderAll();return l.id})()""")
        L=f"st.layerById('{tid}')"
        await ev("window.scr=(x,y)=>{const M=D.CONTENT.getScreenCTM();return [M.a*x+M.c*y+M.e, M.b*x+M.d*y+M.f]}")
        box=lambda: ev(f"(()=>{{const b=document.getElementById('e-{tid}-s').getBBox();return [b.x,b.y,b.width,b.height]}})()")
        dattr=lambda: ev(f"document.getElementById('e-{tid}-s').getAttribute('d')")
        pinscr=lambda n: ev(f"(()=>{{const e=document.querySelector('[data-pin=\"{n}\"]').getBoundingClientRect();return [e.x+e.width/2,e.y+e.height/2]}})()")
        async def drag(a,c,mod=None):
            if mod: await pg.keyboard.down(mod)
            await pg.mouse.move(a[0],a[1]); await pg.mouse.down(); await pg.mouse.move((a[0]+c[0])/2,(a[1]+c[1])/2,steps=3); await pg.mouse.move(c[0],c[1],steps=3); await pg.mouse.up()
            if mod: await pg.keyboard.up(mod)
            await pg.wait_for_timeout(150)

        # ---- the flyout and W
        await pg.click('#tools [data-group="pins"]', button='right'); await pg.wait_for_timeout(200)
        items=await ev("[...document.querySelectorAll('#toolfly .tf-item')].map(b=>b.dataset.tool+':'+b.querySelector('kbd').textContent)")
        check('Pin tools flyout', items==['pin:W','pinedit:'], items)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(80)
        await pg.keyboard.press('w'); await pg.wait_for_timeout(120)
        check('W picks the Pin tool', await ev("st.S.tool")=='pin')

        # ---- three pins
        for x in [160,280,400]:
            s=await ev(f"scr({x},165)"); await pg.mouse.click(s[0],s[1]); await pg.wait_for_timeout(120)
        check('click adds pins', await ev(f"{L}.pins.map(p=>p.n).join(',')")=='1,2,3' and await ev("st.S.pinSel")==3)
        check('Pins section with a button per pin', await ev("[...document.querySelectorAll('.pin-chip')].map(b=>b.textContent+(b.classList.contains('on')?'*':'')).join(' ')")=='1 2 3*')
        rest0=await box(); d0=await dattr()

        # ---- drag pin 3 at 1 s: keyed from 0 s to the playhead
        await ev("hi.setTime(1)"); await pg.wait_for_timeout(100)
        c=await pinscr(3); await drag(c,[c[0],c[1]-60])
        tr=json.loads(await ev(f"JSON.stringify({L}.t.pin3)"))
        check('drag keys the pin from 0 s to the playhead', tr and len(tr)==2 and tr[0][0]==0 and tr[1][0]==1 and tr[1][1][1]<tr[0][1][1]-30, tr)
        bent=await box()
        check('the path bends', bent[1]<rest0[1]-20, (rest0,bent))
        await ev("hi.setTime(0)"); await pg.wait_for_timeout(80)
        check('at 0 s it is straight', await dattr()==d0)
        await ev("hi.setTime(1)"); await pg.wait_for_timeout(80)
        await pg.screenshot(path=OUT+'pins-bend.png')

        # ---- the ring turns the selected pin
        k=await ev("(()=>{const e=document.querySelector('[data-pinring]').getBoundingClientRect();return [e.x+e.width/2,e.y+e.height/2]})()")
        c=await pinscr(3)
        await drag(k,[c[0]-(k[1]-c[1]), c[1]+(k[0]-c[0])])
        rt=json.loads(await ev(f"JSON.stringify({L}.t.pinr3||null)"))
        check('ring keys the rotation', rt and len(rt)==2 and abs(rt[1][1])>30, rt)

        # ---- Alt+drag moves pin 1 at rest: its keys (none) and the straight shape at 0 s stay
        p1=await ev(f"JSON.stringify({L}.pins[0])"); c=await pinscr(1)
        await drag(c,[c[0]+30,c[1]],'Alt')
        p1b=json.loads(await ev(f"JSON.stringify({L}.pins[0])"))
        check('Alt+drag moves the pin at rest', abs(p1b['x']-json.loads(p1)['x'])>15 and not await ev(f"!!{L}.t.pin1"), (p1,p1b))
        await ev("hi.setTime(0)"); await pg.wait_for_timeout(80)
        check('still straight at rest', await dattr()==d0)
        await ev("hi.setTime(1)"); await pg.wait_for_timeout(80)
        await pg.screenshot(path=OUT+'pins-insp.png', clip={'x':1144,'y':52,'width':296,'height':940})
        await pg.screenshot(path=OUT+'pins-timeline.png', clip={'x':0,'y':700,'width':1440,'height':300})

        # ---- Edit pins: rest shape shown, a moved pin takes its motion with it
        await pg.click('#tools [data-group="pins"]', button='right'); await pg.wait_for_timeout(150)
        await pg.click('#toolfly [data-tool="pinedit"]'); await pg.wait_for_timeout(150)
        check('Edit pins shows the rest shape', await dattr()==d0)
        check('Rest pose chip', await ev("!document.getElementById('boneChip').hidden && /pins move with their motion/.test(document.getElementById('boneChip').textContent)"))
        await pg.screenshot(path=OUT+'pins-edit.png')
        tr0=json.loads(await ev(f"JSON.stringify({L}.t.pin3)")); c=await pinscr(3)
        await drag(c,[c[0]-24,c[1]])
        tr1=json.loads(await ev(f"JSON.stringify({L}.t.pin3)"))
        dx=[b_[1][0]-a_[1][0] for a_,b_ in zip(tr0,tr1)]
        check('its keys move by the same amount', len(dx)==2 and abs(dx[0]-dx[1])<0.02 and dx[0]<-10, dx)
        check('the rest shape is unchanged', await dattr()==d0)
        await pg.keyboard.press('w'); await pg.wait_for_timeout(120)
        check('back in the Pin tool it bends again', await dattr()!=d0)

        # ---- exports agree at 1 s (JS player, CSS with SMIL, the editor)
        await ev("hi.setTime(1)"); ed=await box()
        await ev("st.doc.ex.mode='js'; st.doc.ex.trigger='load'"); js=await ev("B.buildExport(null).code")
        await ev("st.doc.ex.mode='css'"); css=await ev("B.buildExport(null).code"); await ev("st.doc.ex.mode='js'")
        check('JS export carries the pins', '"pins":[' in js)
        check('CSS export bends the path with SMIL', f'xlink:href="#cin-{tid}-s" attributeName="d"' in css or 'attributeName="d"' in css)
        async def probe(code, mode, t):
            q=await b.new_page(); await q.set_viewport_size({'width':1440,'height':1000})
            await q.set_content('<!doctype html><html><body style="margin:0">'+code+'</body></html>'); await q.wait_for_timeout(300)
            if mode=='js': await q.evaluate(f"document.querySelector('svg').player.pause().seekTo({t*1000})")
            else: await q.evaluate(f"(()=>{{const s=document.querySelector('svg');s.pauseAnimations();s.setCurrentTime({t});document.getAnimations().forEach(a=>{{a.pause();a.currentTime={t*1000}}})}})()")
            await q.wait_for_timeout(80)
            r=await q.evaluate(f"(()=>{{const P=document.querySelector('svg').id.replace(/svg$/,''),b=document.getElementById(P+'{tid}-s').getBBox();return [b.x,b.y,b.width,b.height]}})()")
            await q.close(); return r
        rj=await probe(js,'js',1); rc=await probe(css,'css',1)
        check('JS export matches the editor', all(abs(x-y)<0.6 for x,y in zip(rj,ed)), (rj,ed))
        check('CSS export matches the JS export', all(abs(x-y)<0.6 for x,y in zip(rj,rc)), (rj,rc))

        # ---- Reach, Delete
        await ev("(()=>{const r=document.getElementById('pinReach');r.value='300';r.dispatchEvent(new Event('input',{bubbles:true}));r.dispatchEvent(new Event('change',{bubbles:true}))})()"); await pg.wait_for_timeout(120)
        check('Reach changes how far pins pull', await ev(f"{L}.reach")==300 and await box()!=ed)
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(150)
        check('one undo for the Reach drag', await ev(f"{L}.reach==null"))
        await ev(f"(()=>{{st.S.pinSel=2;SG.frame()}})()")
        await pg.keyboard.press('Delete'); await pg.wait_for_timeout(150)
        check('Delete removes the selected pin', await ev(f"{L}.pins.map(p=>p.n).join(',')")=='1,3' and await ev(f"!!st.layerById('{tid}')"))
        # ---- text is not pinned (yet)
        t=await ev("(()=>{const l=st.doc.layers.find(l=>l.name==='Title');const r=document.getElementById('e-'+l.id+'-s').getBoundingClientRect();return [r.x+r.width*0.3,r.y+r.height/2,l.id]})()")
        await pg.mouse.click(t[0],t[1]); await pg.wait_for_timeout(150)
        check('text gets no pins yet', await ev(f"!st.layerById('{t[2]}').pins"))
        R['errors']=errs; check('no page errors', not errs, errs)
        print(json.dumps(R,indent=1)); print('FAILS',F); await b.close()
asyncio.run(main())
