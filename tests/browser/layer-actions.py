import asyncio, sys, json
from playwright.async_api import async_playwright
import os
OUT=os.environ.get('KL_OUT','/tmp/keyline-shots/'); os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(device_scale_factor=2)
        await pg.set_viewport_size({'width':1440,'height':900}); pg.set_default_timeout(5000)
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto((sys.argv[1] if len(sys.argv)>1 else 'http://localhost:5199/'), wait_until='domcontentloaded'); await pg.wait_for_timeout(2500)
        await pg.evaluate("async()=>{ window.st=await import('/src/core/state.ts'); window.hi=await import('/src/core/history.ts'); }")
        ev=lambda js: pg.evaluate(js); R={}; F=[]
        def check(n,c,i=None):
            R[n]=('ok' if c else 'FAIL')+('' if i is None else f' {i}')
            if not c: F.append(n)
        st=lambda: ev("Object.fromEntries(['lUp','lDown','lDup','lUngroup','lGroup','lDel','lAnim'].map(i=>[i,!document.getElementById(i).disabled]))")
        rows=lambda: ev("[...document.querySelectorAll('#lp .lp-row')].map(r=>r.textContent.trim())")
        lay=await ev("""(()=>{const a=document.querySelector('.lp-acts').getBoundingClientRect(),l=document.getElementById('lp').getBoundingClientRect(),f=document.querySelector('.lp-foot').getBoundingClientRect(),an=lAnim.getBoundingClientRect();
          const order=[...document.querySelectorAll('.lp-acts button')].map(b=>b.id);
          const gap=document.getElementById('lDup').getBoundingClientRect().left-document.getElementById('lDown').getBoundingClientRect().right;
          return {topBar:a.bottom<=l.top+1, order:order.join(','), split:gap>10, gap:Math.round(gap), animRight:Math.abs(an.right-(f.right-parseFloat(getComputedStyle(document.querySelector('.lp-foot')).paddingRight)))<2, iconOnly:[...document.querySelectorAll('.lp-acts button')].every(b=>!b.textContent.trim()&&b.querySelector('svg'))}})()""")
        check('actions at the top, in order, split left/right; Animate bottom-right', lay['topBar'] and lay['order']=='lUp,lDown,lDup,lUngroup,lGroup,lDel' and lay['split'] and lay['animRight'] and lay['iconOnly'], lay)
        await ev("hi.select(null)"); s=await st()
        check('nothing selected: only Group available', s=={'lUp':False,'lDown':False,'lDup':False,'lUngroup':False,'lGroup':True,'lDel':False,'lAnim':False}, s)
        tid=await ev("st.doc.layers.find(l=>l.name==='Title').id"); await ev(f"hi.select('{tid}')"); s=await st()
        check('top layer: Move up greyed, Move down on', (not s['lUp']) and s['lDown'] and s['lDup'] and s['lDel'] and s['lAnim'] and not s['lUngroup'], s)
        r0=await rows(); await pg.click('#lDown'); r1=await rows()
        check('Move down moves the layer below the next one (a group with its children)', r0.index('Title')==0 and r1.index('Title')>r1.index('Landscape'), r1[:3])
        await pg.click('#lUp'); r2=await rows()
        check('Move up moves it back', r2.index('Title')==0, r2[:3])
        n0=await ev("st.doc.layers.length"); await pg.click('#lDup'); n1=await ev("st.doc.layers.length"); nm=await ev("st.selLayer().name")
        check('Duplicate copies the layer and selects the copy', n1==n0+1 and nm=='Title copy', (n0,n1,nm))
        await ev("document.activeElement.blur()"); await pg.keyboard.press('Control+z')
        gid=await ev("st.doc.layers.find(l=>l.name==='Sunrise').id"); await ev(f"hi.select('{gid}')"); s=await st()
        check('group selected: Ungroup on', s['lUngroup'], s)
        sun=await ev("st.doc.layers.find(l=>l.name==='Rays').id"); await ev(f"hi.select('{sun}')"); s=await st()
        check('bottom child in a group: Move down greyed, Move up on', s['lUp'] and not s['lDown'], s)
        await ev(f"(()=>{{st.S.selSet.add('{tid}'); hi.commit({{insp:true}})}})()"); s=await st()
        check('two layers selected: Move up/down greyed (single layer only)', not s['lUp'] and not s['lDown'] and s['lDel'], s)
        await ev(f"hi.select('{tid}')")
        await pg.screenshot(path=(OUT+'layer-actions')+'-panel.png', clip={'x':70,'y':60,'width':240,'height':680})
        R['errors']=errs; print(json.dumps(R,indent=1)); print('FAILS',F)
        await b.close()
asyncio.run(main())
