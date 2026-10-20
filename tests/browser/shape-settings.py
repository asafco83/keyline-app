import asyncio, sys, json
from playwright.async_api import async_playwright
import os
OUT=os.environ.get('CIN_OUT','/tmp/svgcinema-shots/'); os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(device_scale_factor=1)
        await pg.set_viewport_size({'width':1440,'height':1000}); pg.set_default_timeout(6000)
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto((sys.argv[1] if len(sys.argv)>1 else 'http://localhost:5199/')); await pg.wait_for_timeout(2500)
        await pg.evaluate("async()=>{ window.st=await import('/src/core/state.ts'); window.hi=await import('/src/core/history.ts'); window.K=await import('/src/core/constants.ts')}")
        ev=lambda js: pg.evaluate(js); R={}; F=[]
        def check(n,c,i=None):
            R[n]=('ok' if c else 'FAIL')+('' if i is None else f' {i}')
            if not c: F.append(n)
        async def tool(id):
            await ev(f"(async()=>{{const m=await import('/src/ui/tools-rail.ts'); m.pickTool('{id}')}})()")
        async def drag(a,b2):
            await pg.mouse.move(*a); await pg.mouse.down(); await pg.mouse.move(*b2,steps=6); await pg.mouse.up(); await pg.wait_for_timeout(100)
        npath=lambda: ev("st.selLayer().b.d[0].n.length")
        # polygon
        await tool('polygon'); await drag((600,400),(600,330))
        check('polygon section', await ev("[...document.querySelectorAll('#insp h3')].some(h=>h.textContent.startsWith('Polygon'))"))
        n0=await npath()
        await pg.fill('#sh-n','8'); await pg.press('#sh-n','Tab')
        check('sides change the path', await npath()==8 and n0==6, (n0, await npath()))
        await pg.evaluate("(()=>{const r=document.getElementById('sh-rad-r');r.value=12;r.dispatchEvent(new Event('input',{bubbles:true}));r.dispatchEvent(new Event('change',{bubbles:true}))})()")
        check('corner radius rounds corners (2 nodes per corner)', await npath()==16 and await ev("st.selLayer().shape.rad")==12, await npath())
        await pg.keyboard.press('Control+z')
        check('slider drag is one undo step', await npath()==8, await npath())
        # star
        await tool('star'); await drag((400,400),(400,330))
        check('star section', await ev("[...document.querySelectorAll('#insp h3')].some(h=>h.textContent.startsWith('Star'))") and await ev("!!document.getElementById('sh-ratio')"))
        await pg.fill('#sh-n','7'); await pg.press('#sh-n','Tab')
        check('points', await npath()==14, await npath())
        await pg.fill('#sh-ratio','80'); await pg.press('#sh-ratio','Tab')
        rr=await ev("(()=>{const s=st.selLayer().shape,n=st.selLayer().b.d[0].n;return Math.hypot(n[1][0]-s.cx,n[1][1]-s.cy)/Math.hypot(n[0][0]-s.cx,n[0][1]-s.cy)})()")
        check('ratio sets inner radius', abs(rr-0.8)<0.01, rr)
        # node edit turns it plain
        await ev("(()=>{const l=st.selLayer();l.b.d[0].n[0][0]+=5;hi.commit({insp:true})})()")
        check('hand-edited star becomes a plain path', await ev("![...document.querySelectorAll('#insp h3')].some(h=>h.textContent.startsWith('Star'))"))
        # line
        await tool('line'); print('tool', await ev("st.S.tool"), await ev("document.elementFromPoint(300,600).tagName"), await ev("st.doc.layers.length")); await drag((450,600),(650,650)); print(await ev("st.doc.layers.length"), await ev("st.S.tool"))
        check('line section', await ev("!!document.getElementById('ln-0-0')"), await ev("JSON.stringify([st.selLayer().type, st.selLayer().b.d, [...document.querySelectorAll('#insp h3')].map(h=>h.textContent)])"))
        print(json.dumps(R,indent=1))
        v=await ev("[...['ln-0-0','ln-0-1','ln-1-0','ln-1-1']].map(i=>+document.getElementById(i).value)")
        await pg.fill('#ln-1-0', str(v[2]+40)); await pg.press('#ln-1-0','Tab')
        check('To X moves the end', abs(await ev("st.selLayer().b.d[0].n[1][0]")-(v[2]+40))<0.01)
        # animate line: key at 0, move to 1s, change From
        await ev("hi.setTime(0)"); await pg.click('[data-kb=p0]')
        await ev("hi.setTime(1)"); await pg.wait_for_timeout(100)
        await pg.fill('#ln-0-1', str(v[1]-100)); await pg.press('#ln-0-1','Tab')
        tr=await ev("(st.selLayer().t.p0||[]).length")
        mid=await ev("(()=>{const l=st.selLayer();return K.H.comp(l,0.5).d[0].n[0][1]})()")
        check('line ends animate', tr==2 and v[1]-100<mid<v[1]-1, (tr,mid,v[1]))
        await ev("hi.setTime(0.5)"); await pg.wait_for_timeout(50)
        check('fields show the animated value', abs(float(await ev("document.getElementById('ln-0-1').value"))-mid)<0.05)
        # rect radius slider
        await ev("hi.setTime(0)"); await tool('rect'); await drag((800,500),(900,600))
        await pg.evaluate("(()=>{const r=document.getElementById('sh-rad-r');r.value=20;r.dispatchEvent(new Event('input',{bubbles:true}));r.dispatchEvent(new Event('change',{bubbles:true}))})()")
        check('rect corner slider', await ev("st.selLayer().geo.rx")==20 and await ev("document.getElementById('sh-rad').value")=='20')
        mx=await ev("+document.getElementById('sh-rad-r').max")
        check('rect radius max = half the short side', abs(mx-await ev("Math.min(st.selLayer().geo.w,st.selLayer().geo.h)/2"))<0.01, mx)
        await tool('select'); await ev("hi.setTime(0)")
        # screenshot polygon panel
        pid=await ev("st.doc.layers.find(l=>l.shape&&l.shape.kind==='polygon').id"); await ev(f"hi.select('{pid}')"); await pg.wait_for_timeout(100)
        await ev("(()=>{const s=[...document.querySelectorAll('#insp .sec')].find(s=>s.querySelector('h3').textContent.startsWith('Polygon'));s.scrollIntoView()})()")
        await pg.screenshot(path=OUT+'shp.png')
        R['errors']=errs; print(json.dumps(R,indent=1)); print('FAILS',F)
        await b.close()
asyncio.run(main())
