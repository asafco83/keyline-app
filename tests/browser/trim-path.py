import asyncio, sys, json, io, os
from playwright.async_api import async_playwright
from PIL import Image
OUT=os.environ.get('CIN_OUT','/tmp/svgcinema-shots/'); os.makedirs(OUT, exist_ok=True)
# Trim path with round line caps: only the trimmed part may be painted. A dash repeating exactly at
# the end of the path (or an empty trim's zero-length dash) used to show as a flickering dot.
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
        # the Horizon line alone (no overlay), so any teal pixel near its ends comes from its stroke
        await ev("(()=>{st.doc.layers.forEach(l=>{if(l.name!=='Horizon'&&l.name!=='Landscape')l.hid=true}); hi.select(null); hi.commit({insp:true})})()")
        async def teal_at(t, end):
            await ev(f"hi.setTime({t})"); await pg.wait_for_timeout(150)
            pt=await ev(f"(()=>{{const l=st.doc.layers.find(l=>l.name==='Horizon'),e=document.getElementById('e-'+l.id+'-s');const q=e.getPointAtLength({'e.getTotalLength()' if end else '0'}),r=new DOMPoint(q.x,q.y).matrixTransform(e.getScreenCTM());return [r.x,r.y]}})()")
            png=await pg.screenshot(clip={'x':pt[0]-8,'y':pt[1]-8,'width':16,'height':16})
            im=Image.open(io.BytesIO(png)).convert('RGB')
            return sum(1 for c in im.getdata() if abs(c[0]-0x7F)<40 and abs(c[1]-0xD4)<40 and abs(c[2]-0xC1)<40)
        check('the trim is set up (the line draws on with End)', await ev("!!st.doc.layers.find(l=>l.name==='Horizon').t.te"))
        for t in [0.6, 1.0, 1.4]:
            n=await teal_at(t, True)
            check(f'no dot at the end of the path while it draws on (t={t})', n==0, n)
        n=await teal_at(0.1, False)
        check('an empty trim paints nothing (no dot at the start)', n==0, n)
        n=await teal_at(1.0, False)
        check('the drawn part still paints', n>20, n)
        n=await teal_at(2.5, True)
        check('the fully drawn line reaches the end', n>20, n)
        await pg.screenshot(path=OUT+'trim-path.png')
        R['errors']=errs; print(json.dumps(R,indent=1)); print('FAILS',F+(['errors'] if errs else []))
        await b.close()
asyncio.run(main())
