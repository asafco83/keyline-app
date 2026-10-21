import asyncio, sys, json, math
from playwright.async_api import async_playwright
import os
OUT=os.environ.get('CIN_OUT','/tmp/svgcinema-shots/'); os.makedirs(OUT, exist_ok=True)
# Bones step 2: the bone flyout (Bone, Edit bone, Bind), the Edit bone tool (rest pose: tip, joint, body
# drags with compensation, Alt, Ctrl, keys untouched) and the Bind tool (pick, bind, guard, unbind, Esc).
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(); await pg.set_viewport_size({'width':1440,'height':1000})
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto((sys.argv[1] if len(sys.argv)>1 else 'http://localhost:5199/')); await pg.wait_for_timeout(2500)
        await pg.evaluate("async()=>{ window.st=await import('/src/core/state.ts'); window.hi=await import('/src/core/history.ts'); window.BO=await import('/src/tools/bones.ts'); window.D=await import('/src/core/dom.ts');}")
        ev=pg.evaluate; R={}; F=[]
        def check(n,c,i=None):
            R[n]=('ok' if c else 'FAIL')+('' if i is None else f' {i}')
            if not c: F.append(n)
        ID={}
        for n in ['Stem','Stem 2','Stem 3','Leaf','Sprout']: ID[n]=await ev(f"st.doc.layers.find(l=>l.name==='{n}').id")
        L=lambda n: f"st.layerById('{ID[n]}')"
        # doc point -> screen point, bone joint/tip in doc and screen
        await ev("window.scr=(x,y)=>{const M=D.CONTENT.getScreenCTM();return [M.a*x+M.c*y+M.e, M.b*x+M.d*y+M.f]}")
        bp=lambda n: ev(f"(()=>{{const q=BO.bonePts({L(n)});return {{J:[q.J.x,q.J.y],T:[q.T.x,q.T.y],j:scr(q.J.x,q.J.y),t:scr(q.T.x,q.T.y)}}}})()")
        bbox=lambda n: ev(f"(()=>{{const r=document.getElementById('e-{ID[n]}-s').getBoundingClientRect();return [r.x,r.y,r.width,r.height]}})()")
        same=lambda a,c,e=0.6: all(abs(x-y)<=e for x,y in zip(a,c))
        keys=lambda: ev("JSON.stringify(st.doc.layers.filter(l=>l.type==='bone').map(l=>l.t))")
        async def drag(a,c,mod=None):
            if mod: await pg.keyboard.down(mod)
            await pg.mouse.move(a[0],a[1]); await pg.mouse.down(); await pg.mouse.move((a[0]+c[0])/2,(a[1]+c[1])/2,steps=3); await pg.mouse.move(c[0],c[1],steps=3); await pg.mouse.up()
            if mod: await pg.keyboard.up(mod)
            await pg.wait_for_timeout(120)

        # ---- flyout
        await ev("hi.setTime(1.9)"); await pg.wait_for_timeout(100)
        await pg.click('#tools [data-group="bones"]', button='right'); await pg.wait_for_timeout(200)
        items=await ev("[...document.querySelectorAll('#toolfly .tf-item')].map(b=>[b.dataset.tool,b.querySelector('.nm').textContent,b.querySelector('kbd').textContent,!!b.querySelector('svg.bic')])")
        check('flyout: Bone, Edit bone, Scale bone, Bind with the new icons', items==[['bone','Bone tool','B',True],['boneedit','Edit bone tool','E',True],['bonescale','Scale bone tool','S',True],['bonebind','Bind tool','',True]], items)
        await pg.screenshot(path=OUT+'bone-flyout.png', clip={'x':0,'y':180,'width':320,'height':200})
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(100)
        await ev("hi.select(null)")
        await pg.keyboard.press('e'); await pg.wait_for_timeout(150)
        check('E picks the Edit bone tool', await ev("st.S.tool")=='boneedit')
        check('rail shows the Edit bone icon', await ev("!!document.querySelector('#tools [data-group=\"bones\"] svg.bic-w')"))

        # ---- rest pose view
        rot19=await ev(f"(()=>{{const m=document.getElementById('e-{ID['Stem 2']}').transform.baseVal.consolidate().matrix;return Math.atan2(m.b,m.a)*180/Math.PI}})()")
        check('bones show the rest pose', abs(rot19)<0.01, rot19)
        check('Rest pose chip', await ev("!document.getElementById('boneChip').hidden && /Rest pose/.test(document.getElementById('boneChip').textContent)"))
        await pg.screenshot(path=OUT+'bone-edit-rest.png')

        # ---- tip drag: Stem 2 gets longer and turns; Stem 3's tip and the Leaf stay; no keys change
        k0=await keys(); s2=await bp('Stem 2'); s3=await bp('Stem 3'); leaf0=await bbox('Leaf'); g0=await ev(f"JSON.stringify({L('Stem 2')}.geo)")
        await drag(s2['t'],[s2['t'][0]+30,s2['t'][1]+12])
        s2b=await bp('Stem 2'); s3b=await bp('Stem 3')
        check('tip drag changes length and angle', await ev(f"JSON.stringify({L('Stem 2')}.geo)")!=g0, await ev(f"{L('Stem 2')}.geo"))
        check('child bone follows the tip, its own tip stays', same(s3b['J'],s2b['T']) and same(s3b['T'],s3['T']), (s3b, s2b['T'], s3['T']))
        check('artwork stays put', same(await bbox('Leaf'),leaf0), (await bbox('Leaf'), leaf0))
        check('no keyframes change', await keys()==k0)
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(150)
        check('undo restores the rest pose', await ev(f"JSON.stringify({L('Stem 2')}.geo)")==g0)

        # ---- joint drag on the parent's tip: the parent's tip moves with it; Alt pulls it off
        s2=await bp('Stem 2'); s3=await bp('Stem 3'); g2=await ev(f"JSON.stringify({L('Stem 2')}.geo)")
        await drag(s3['j'],[s3['j'][0]+18,s3['j'][1]+4])
        s2b=await bp('Stem 2'); s3b=await bp('Stem 3')
        check('joint drag drags the parent tip along', same(s2b['T'],s3b['J']) and not same(s2b['T'],s2['T'],2), (s2b['T'],s3b['J']))
        check('joint drag keeps the bone tip', same(s3b['T'],s3['T']), (s3b['T'],s3['T']))
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(150)
        s3=await bp('Stem 3')
        await drag(s3['j'],[s3['j'][0]+18,s3['j'][1]+4],'Alt')
        check('Alt+joint drag leaves the parent alone', await ev(f"JSON.stringify({L('Stem 2')}.geo)")==g2)
        s3b=await bp('Stem 3')
        check('Alt+joint drag moves the joint off the tip', not same(s3b['J'],s3['J'],2))
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(150)

        # ---- Ctrl: the artwork turns with the bone
        s2=await bp('Stem 2'); leaf0=await bbox('Leaf'); rot0=await ev(f"{L('Leaf')}.b.rot")
        await drag(s2['t'],[s2['t'][0]+26,s2['t'][1]+14],'Control')
        check('Ctrl carries the artwork', abs(await ev(f"{L('Leaf')}.b.rot")-rot0)>3 and not same(await bbox('Leaf'),leaf0,1), (rot0, await ev(f"{L('Leaf')}.b.rot")))
        s2b=await bp('Stem 2'); s3b=await bp('Stem 3')
        check('Ctrl: the child bone rides on the tip', same(s3b['J'],s2b['T']))
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(150)

        # ---- body drag: the bone moves, its artwork stays, its tip child follows
        s3=await bp('Stem 3'); s2=await bp('Stem 2'); stalk=await bbox('Stem 2')
        mid=[(s2['j'][0]*0.6+s2['t'][0]*0.4),(s2['j'][1]*0.6+s2['t'][1]*0.4)]
        leaf0=await bbox('Leaf')
        await drag(mid,[mid[0]+20,mid[1]])
        s2b=await bp('Stem 2'); s3b=await bp('Stem 3')
        check('body drag moves the whole bone', abs((s2b['J'][0]-s2['J'][0])-(s2b['T'][0]-s2['T'][0]))<0.6 and abs(s2b['J'][0]-s2['J'][0])>3, (s2['J'],s2b['J']))
        check('body drag keeps artwork and child tip', same(await bbox('Leaf'),leaf0) and same(s3b['T'],s3['T']) and same(s3b['J'],s2b['T']))
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(150)

        # ---- back to Select: the playhead pose returns
        await pg.keyboard.press('v'); await pg.wait_for_timeout(150)
        r=await ev(f"(()=>{{const m=document.getElementById('e-{ID['Stem']}').transform.baseVal.consolidate().matrix;return Math.atan2(m.b,m.a)*180/Math.PI}})()")
        check('Select shows the animated pose again', abs(r)>0.5, (r, await ev("[st.S.time, st.S.tool]")))
        check('chip hidden outside the bone tools', await ev("document.getElementById('boneChip').hidden"))

        # ---- Bind: Leaf (on Stem 2) to Stem 3, at a time Stem 3 isn't squashed (a stretched parent
        # stretches what hangs on it)
        await ev("hi.setTime(1.3)"); await pg.wait_for_timeout(100)
        await pg.click('#tools [data-group="bones"]', button='right'); await pg.wait_for_timeout(150)
        await pg.click('#toolfly [data-tool="bonebind"]'); await pg.wait_for_timeout(150)
        check('Bind tool on, nothing picked', await ev("st.S.tool==='bonebind' && st.S.bindPick.length===0"))
        lb=await bbox('Leaf'); lc=[lb[0]+lb[2]*0.3, lb[1]+lb[3]*0.5]
        await pg.mouse.click(lc[0],lc[1]); await pg.wait_for_timeout(120)
        check('click picks the artwork', await ev(f"JSON.stringify(st.S.bindPick)")==json.dumps([ID['Leaf']]).replace(' ',''), await ev("st.S.bindPick"))
        check('chip: 1 child picked', await ev("/1 child picked/.test(document.getElementById('boneChip').textContent)"))
        s3=await bp('Stem 3'); m3=[(s3['j'][0]+s3['t'][0])/2,(s3['j'][1]+s3['t'][1])/2]
        await pg.mouse.move(m3[0]-1,m3[1]); await pg.mouse.move(m3[0],m3[1]); await pg.wait_for_timeout(120)
        tip=await ev("(()=>{const t=document.getElementById('bindTip');return t.hidden?null:t.textContent})()")
        check('pointer tip names the bind', tip is not None and 'Leaf' in tip and 'Stem 3' in tip, tip)
        await pg.screenshot(path=OUT+'bone-bind.png')
        before=await bbox('Leaf')
        await pg.mouse.click(m3[0],m3[1]); await pg.wait_for_timeout(200)
        check('Leaf now hangs on Stem 3', await ev(f"{L('Leaf')}.parent")==ID['Stem 3'])
        check('binding keeps it in place', same(await bbox('Leaf'),before,0.8), (await bbox('Leaf'),before))
        # guard: a bone can't go under its own child
        s2=await bp('Stem 2'); m2=[(s2['j'][0]*0.5+s2['t'][0]*0.5),(s2['j'][1]*0.5+s2['t'][1]*0.5)]
        await pg.mouse.click(m2[0],m2[1]); await pg.wait_for_timeout(120)
        s3=await bp('Stem 3'); m3=[(s3['j'][0]+s3['t'][0])/2,(s3['j'][1]+s3['t'][1])/2]
        await pg.mouse.click(m3[0],m3[1]); await pg.wait_for_timeout(150)
        check("can't bind a bone to its child", await ev(f"{L('Stem 2')}.parent")==ID['Stem'])
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(100)
        check('Esc clears the picks, keeps the tool', await ev("st.S.bindPick.length===0 && st.S.tool==='bonebind'"))
        # unbind: pick the Leaf, click empty canvas
        lb=await bbox('Leaf'); lc=[lb[0]+lb[2]*0.3, lb[1]+lb[3]*0.5]
        await pg.mouse.click(lc[0],lc[1]); await pg.wait_for_timeout(120)
        before=await bbox('Leaf')
        ab=await ev("(()=>{const r=document.getElementById('artboard').getBoundingClientRect();return [r.x,r.y,r.width,r.height]})()")
        await pg.mouse.click(ab[0]-12, ab[1]+40); await pg.wait_for_timeout(200)
        check('empty canvas unbinds to the rig\'s group', await ev(f"{L('Leaf')}.parent")==ID['Sprout'], await ev(f"{L('Leaf')}.parent"))
        check('unbinding keeps it in place', same(await bbox('Leaf'),before,0.8))
        await pg.keyboard.press('Control+z'); await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(200)
        check('undo restores the binding', await ev(f"{L('Leaf')}.parent")==ID['Stem 2'])
        await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(100)
        check('Esc leaves the Bind tool', await ev("st.S.tool")=='select')
        R['errors']=errs; check('no page errors', not errs, errs)
        print(json.dumps(R,indent=1)); print('FAILS',F); await b.close()
asyncio.run(main())
