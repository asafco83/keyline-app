import asyncio, sys, json, math
from playwright.async_api import async_playwright
import os
OUT=os.environ.get('CIN_OUT','/tmp/svgcinema-shots/'); os.makedirs(OUT, exist_ok=True)
# Bones step 4: "Key whole rig" (posing one bone keys the whole rig without changing the motion), the
# popover that fills a rig's poses when the switch is turned on, and the timeline's Pose row.
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(); await pg.set_viewport_size({'width':1440,'height':1000})
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto((sys.argv[1] if len(sys.argv)>1 else 'http://localhost:5199/')); await pg.wait_for_timeout(2500)
        await pg.evaluate("async()=>{ window.st=await import('/src/core/state.ts'); window.hi=await import('/src/core/history.ts'); window.BO=await import('/src/tools/bones.ts'); window.D=await import('/src/core/dom.ts'); window.K=await import('/src/core/constants.ts')}")
        ev=pg.evaluate; R={}; F=[]
        def check(n,c,i=None):
            R[n]=('ok' if c else 'FAIL')+('' if i is None else f' {i}')
            if not c: F.append(n)
        ID={}
        for n in ['Stem','Stem 2','Stem 3']: ID[n]=await ev(f"st.doc.layers.find(l=>l.name==='{n}').id")
        L=lambda n: f"st.layerById('{ID[n]}')"
        await ev("window.scr=(x,y)=>{const M=D.CONTENT.getScreenCTM();return [M.a*x+M.c*y+M.e, M.b*x+M.d*y+M.f]}")
        bp=lambda n: ev(f"(()=>{{const q=BO.bonePts({L(n)});return {{j:scr(q.J.x,q.J.y),t:scr(q.T.x,q.T.y)}}}})()")
        times=lambda n,k='rot': ev(f"({L(n)}.t.{k}||[]).map(q=>q[0])")
        SAMPLE=[1.25,1.35,1.45,1.6,1.8,1.95,2.05,2.3,2.55,2.75,2.9]
        motion=lambda: ev(f"[{','.join(L(n) for n in ID)}].map(l=>[{','.join(str(t) for t in SAMPLE)}].map(t=>K.H.get(l,'rot',t)).concat([{','.join(str(t) for t in SAMPLE)}].map(t=>(K.H.get(l,'scl',t)||[1,1])[0])))")
        same=lambda a,c: all(abs(x-y)<2e-3 for ra,rc in zip(a,c) for x,y in zip(ra,rc))
        async def fk(n, t):
            await ev(f"hi.setTime({t})"); await pg.wait_for_timeout(80)
            q=await bp(n); m=[q['j'][0]*0.6+q['t'][0]*0.4, q['j'][1]*0.6+q['t'][1]*0.4]
            await pg.mouse.move(m[0],m[1]); await pg.mouse.down(); await pg.mouse.move(m[0]+6,m[1],steps=3); await pg.mouse.move(m[0]+12,m[1]+2,steps=3); await pg.mouse.up(); await pg.wait_for_timeout(150)

        # ---- the switch: on the rig's top bone only, on by default
        await ev(f"hi.select('{ID['Stem']}')"); await pg.wait_for_timeout(100)
        check('Key whole rig on the top bone, on by default', await ev("!!document.getElementById('fl-kr') && document.getElementById('fl-kr').checked"))
        await ev(f"hi.select('{ID['Stem 2']}')"); await pg.wait_for_timeout(100)
        check('not on a child bone', await ev("!document.getElementById('fl-kr')"))

        # ---- Pose row
        lab=await ev(f"(()=>{{const r=document.querySelector('.tl-pose[data-lid=\"{ID['Stem']}\"]');return r&&r.querySelector('.tl-pname').textContent}})()")
        check('Pose row under the rig\'s top bone', lab=='Pose · 3 bones', lab)
        union=sorted(set([round(x,3) for n in ID for k in ['rot','scl'] for x in (await times(n,k))]))
        nd=await ev(f"document.querySelectorAll('.tl-pose[data-lid=\"{ID['Stem']}\"] .sdot.pose').length")
        check('a Pose diamond at every key time of the rig', nd==len(union), (nd,len(union)))

        # ---- posing one bone keys the whole rig, without changing the motion
        m0=await motion(); k0=[await times(n) for n in ID]
        await pg.keyboard.press('v'); await fk('Stem 3', 1.6)
        ks=[await times(n) for n in ID]
        check('every bone keyed at the playhead', all(any(abs(t-1.6)<1e-6 for t in k) for k in ks), ks)
        m1=await motion()
        check('the other bones keep their motion', same(m0[:2],m1[:2]), (m0[0][:5],m1[0][:5]))
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(150)
        check('undo removes the pose keys', [await times(n) for n in ID]==k0)

        # ---- switch off: only the dragged bone is keyed
        await ev(f"hi.select('{ID['Stem']}')"); await pg.wait_for_timeout(100)
        await pg.click('#fl-kr'); await pg.wait_for_timeout(150)
        check('switch off', await ev(f"{L('Stem')}.kr===false") and await ev("!document.querySelector('.rig-pop')"))
        await fk('Stem 3', 1.6)
        ks=[await times(n) for n in ID]
        check('off: only the dragged bone is keyed', [any(abs(t-1.6)<1e-6 for t in k) for k in ks]==[False,False,True], ks)
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(150)

        # ---- switch on again: the popover offers to fill the poses
        await ev(f"hi.select('{ID['Stem']}')"); await pg.wait_for_timeout(100)
        await pg.click('#fl-kr'); await pg.wait_for_timeout(200)
        pop=await ev("(()=>{const p=document.querySelector('.rig-pop');return p&&p.textContent})()")
        check('popover when the rig has partial poses', pop is not None and 'Add keys to every bone?' in pop and f'{len(union)} key times' in pop, pop)
        await pg.screenshot(path=OUT+'rig-popover.png', clip={'x':1144,'y':52,'width':296,'height':700})
        m0=await motion()
        await pg.click('.rig-pop [data-rp="yes"]'); await pg.wait_for_timeout(200)
        ks=[await times(n) for n in ID]
        check('Add keys: every bone has a key at every time', all(all(any(abs(t-u)<1e-3 for t in k) for u in union) for k in ks), [len(k) for k in ks])
        check('Add keys keeps the motion', same(m0, await motion()))
        check('popover closed', await ev("!document.querySelector('.rig-pop')"))
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(200)
        check('one undo: switch off again and no added keys', await ev(f"{L('Stem')}.kr===false") and [await times(n) for n in ID]==k0)
        await pg.click('#fl-kr'); await pg.wait_for_timeout(200)
        await pg.click('.rig-pop [data-rp="no"]'); await pg.wait_for_timeout(150)
        check('Not now: switch on, keys untouched', await ev(f"{L('Stem')}.kr===true") and [await times(n) for n in ID]==k0)

        # ---- a Pose diamond stands for all the rig's keys at its time
        await ev(f"(()=>{{const r=document.querySelector('.tl-pose[data-lid=\"{ID['Stem']}\"]');r.scrollIntoView({{block:'center'}})}})()"); await pg.wait_for_timeout(100)
        sel=f".tl-pose[data-lid=\"{ID['Stem']}\"] .sdot.pose[data-t=\"1.9\"]"
        r=await ev(f"(()=>{{const e=document.querySelector('{sel}').getBoundingClientRect();return [e.x+e.width/2,e.y+e.height/2]}})()")
        await pg.mouse.click(r[0],r[1]); await pg.wait_for_timeout(150)
        n3=await ev("st.S.keys.size")
        want=await ev(f"[{','.join(L(n) for n in ID)}].flatMap(l=>Object.values(l.t).flat().filter(q=>Math.abs(q[0]-1.9)<0.004)).length")
        check('clicking a Pose diamond selects the rig keys at that time', n3==want and n3>0, (n3,want))
        await pg.screenshot(path=OUT+'rig-pose-row.png', clip={'x':0,'y':700,'width':1440,'height':300})
        if n3: await pg.keyboard.press('Delete'); await pg.wait_for_timeout(150)
        ks=[await times(n) for n in ID]
        check('Delete removes the pose', n3>0 and all(not any(abs(t-1.9)<1e-6 for t in k) for k in ks), ks)
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(200)
        R['errors']=errs; check('no page errors', not errs, errs)
        print(json.dumps(R,indent=1)); print('FAILS',F); await b.close()
asyncio.run(main())
