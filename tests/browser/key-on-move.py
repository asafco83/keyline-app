import asyncio, sys, json, os
from playwright.async_api import async_playwright
OUT=os.environ.get('CIN_OUT','/tmp/svgcinema-shots/'); os.makedirs(OUT, exist_ok=True)
# Moving a layer on the canvas after Animate › Position (which selects the key it makes) keys the
# position at the playhead instead of moving that key; two or more selected keys (or one at the
# playhead) still move together. Selecting a layer scrolls the timeline to its track.
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1440,'height':900}); pg.set_default_timeout(5000)
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto((sys.argv[1] if len(sys.argv)>1 else 'http://localhost:5199/')); await pg.wait_for_timeout(2500)
        await pg.evaluate("async()=>{ window.st=await import('/src/core/state.ts'); window.hi=await import('/src/core/history.ts'); }")
        ev=pg.evaluate; R={}; F=[]
        def check(n,c,i=None):
            R[n]=('ok' if c else 'FAIL')+('' if i is None else f' {i}')
            if not c: F.append(n)
        lid=lambda n: ev(f"st.doc.layers.find(l=>l.name==='{n}').id")
        sun=await lid('Sun')
        T=lambda: ev(f"(st.layerById('{sun}').t.pos||[]).map(q=>[q[0],q[1]])")
        async def drag(dx=40,dy=20):
            r=await ev(f"(()=>{{const e=document.getElementById('e-{sun}').getBoundingClientRect();return [e.x+e.width*.35,e.y+e.height*.35]}})()")
            await pg.mouse.move(r[0],r[1]); await pg.mouse.down(); await pg.mouse.move(r[0]+dx/2,r[1]+dy/2,steps=3); await pg.mouse.move(r[0]+dx,r[1]+dy,steps=3); await pg.mouse.up(); await pg.wait_for_timeout(200)
        async def ruler(f):
            rb=await pg.locator('#ruler').bounding_box(); await pg.mouse.click(rb['x']+rb['width']*f, rb['y']+rb['height']/2); await pg.wait_for_timeout(150)

        # ---- 1. Animate › Position, move the playhead, move the layer
        await pg.locator(f'.lp-row[data-lid="{sun}"] .lp-name').click(); await pg.wait_for_timeout(150)
        await pg.click('#lAnim'); await pg.wait_for_timeout(120); await pg.locator('#animMenu button', has_text='Position').first.click(); await pg.wait_for_timeout(150)
        check('Animate › Position makes a key at the playhead and selects it', await T()==[[0,[0,0]]] and await ev("st.S.keys.size")==1)
        await ruler(0.4); t1=await ev("st.S.time")
        await drag()
        tr=await T()
        check('the first move keys the position at the new time', len(tr)==2 and tr[0]==[0,[0,0]] and abs(tr[1][0]-t1)<0.002 and tr[1][1]!=[0,0], tr)
        await drag()
        tr2=await T()
        check('a second move edits that key', len(tr2)==2 and tr2[0]==[0,[0,0]] and tr2[1][1]!=tr[1][1], tr2)
        # Shift+P and arrow keys
        await ev("hi.undo(); hi.undo(); hi.undo()"); await pg.wait_for_timeout(100)
        await ev(f"hi.select('{sun}')"); await ev("hi.setTime(0)")
        await pg.mouse.move(700,300); await pg.keyboard.press('Shift+P'); await pg.wait_for_timeout(120)
        check('Shift+P too', await T()==[[0,[0,0]]] and await ev("st.S.keys.size")==1, await T())
        await ruler(0.5); t2=await ev("st.S.time"); await pg.mouse.move(700,300)
        await ev("st.S.kbArea='canvas'"); await pg.keyboard.press('ArrowRight'); await pg.wait_for_timeout(120)
        tr=await T()
        check('an arrow key after it keys the position at the playhead', len(tr)==2 and tr[0]==[0,[0,0]] and abs(tr[1][0]-t2)<0.002 and tr[1][1]==[1,0], tr)
        # ---- grouped moves still work
        await ev(f"(()=>{{const l=st.layerById('{sun}');st.S.keys=new Set(l.t.pos)}})()"); await ruler(0.75)
        before=await T(); await drag(); after=await T()
        dxy=[after[0][1][0]-before[0][1][0], after[0][1][1]-before[0][1][1]]
        check('with two keys selected a move shifts both (no new key)', len(after)==2 and dxy!=[0,0] and abs((after[1][1][0]-before[1][1][0])-dxy[0])<0.02, (before,after))
        await ev(f"(()=>{{const l=st.layerById('{sun}');st.S.keys=new Set([l.t.pos[1]]);hi.setTime(l.t.pos[1][0])}})()")
        before=await T(); await drag(); after=await T()
        check('one key selected at the playhead: the move edits it', len(after)==2 and after[0]==before[0] and after[1][1]!=before[1][1], (before,after))

        # ---- 2. selecting a layer brings its track into view
        await ev("hi.setTime(0); st.S.keys.clear()")
        rows=await ev("[...document.querySelectorAll('.tl-layer')].map(r=>st.layerById(r.dataset.lid).name)")
        vis=lambda n: ev(f"""(async()=>{{const id=st.doc.layers.find(l=>l.name==='{n}').id,r=document.querySelector('.tl-layer[data-lid="'+id+'"]'),s=document.getElementById('tlscroll').getBoundingClientRect(),q=r.getBoundingClientRect(),h=document.querySelector('.tl-ruler').getBoundingClientRect();return q.top>=h.bottom-1&&q.bottom<=s.bottom+1}})()""")
        await ev("document.getElementById('tlscroll').scrollTop=0"); await pg.wait_for_timeout(80)
        far=rows[-1]
        check('the last animated layer starts out of view', not await vis(far), (far,rows))
        fid=await lid(far)
        await pg.locator(f'.lp-row[data-lid="{fid}"] .lp-name').click(); await pg.wait_for_timeout(200)
        check('selecting it in the Layers panel scrolls its track into view', await vis(far))
        props=await ev(f"""(()=>{{const s=document.getElementById('tlscroll').getBoundingClientRect();return [...document.querySelectorAll('.tl-prop[data-lid="{fid}"]')].every(r=>r.getBoundingClientRect().bottom<=s.bottom+1)}})()""")
        check('with its property rows', props)
        first=rows[0]; fst=await lid(first)
        await ev(f"hi.select('{fst}')"); await pg.wait_for_timeout(150)
        check('and back up for a layer above the fold (selected on the canvas or anywhere)', await vis(first))
        y0=await ev("document.getElementById('tlscroll').scrollTop")
        second=rows[1]
        if await vis(second):
            await ev(f"hi.select(st.doc.layers.find(l=>l.name==='{second}').id)"); await pg.wait_for_timeout(150)
            check('a layer already in view doesn\'t scroll the timeline', await ev("document.getElementById('tlscroll').scrollTop")==y0)
        await ev("document.getElementById('tlscroll').scrollTop=0"); await ev(f"st.layerById('{sun}').hid=false"); await pg.wait_for_timeout(50)
        await ev(f"hi.select('{fst}')"); await pg.wait_for_timeout(100)
        sc=await ev("document.getElementById('tlscroll').scrollTop")
        await ev("hi.setTime(1)"); await ev(f"st.layerById('{fst}').name+=''; hi.select('{fst}')"); await pg.wait_for_timeout(100)
        check('re-rendering with the same selection leaves a scrolled timeline alone', await ev("document.getElementById('tlscroll').scrollTop")==sc)
        await pg.screenshot(path=OUT+'key-on-move.png')
        R['errors']=errs; print(json.dumps(R,indent=1,ensure_ascii=False)); print('FAILS',F+(['errors'] if errs else []))
        await b.close()
asyncio.run(main())
