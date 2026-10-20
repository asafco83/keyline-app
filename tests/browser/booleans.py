import asyncio, sys, json
from playwright.async_api import async_playwright
import os
OUT=os.environ.get('CIN_OUT','/tmp/svgcinema-shots/'); os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(device_scale_factor=1); await pg.set_viewport_size({'width':1440,'height':1000}); pg.set_default_timeout(6000)
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto((sys.argv[1] if len(sys.argv)>1 else 'http://localhost:5199/')); await pg.wait_for_timeout(2500)
        await pg.evaluate("async()=>{ window.st=await import('/src/core/state.ts'); window.hi=await import('/src/core/history.ts'); window.TR=await import('/src/ui/tools-rail.ts')}")
        ev=pg.evaluate; R={}; F=[]
        def check(n,c,i=None):
            R[n]=('ok' if c else 'FAIL')+('' if i is None else f' {i}')
            if not c: F.append(n)
        async def drag(a,b2):
            await pg.mouse.move(*a); await pg.mouse.down(); await pg.mouse.move(*b2,steps=5); await pg.mouse.up(); await pg.wait_for_timeout(100)
        await ev("hi.setTime(0)")
        async def two():
            await ev("TR.pickTool('rect')"); await drag((600,350),(720,450)); r=await ev("st.S.sel")
            await ev("TR.pickTool('ellipse')"); await drag((660,390),(780,500)); e=await ev("st.S.sel"); await ev("TR.pickTool('select')")
            await ev(f"(()=>{{hi.select('{r}'); st.S.selSet.add('{e}'); hi.commit({{insp:true}})}})()")
            return r,e
        r,e=await two()
        check('boolean buttons enabled for 2 shapes', await ev("[...document.querySelectorAll('[data-bool]')].every(b=>!b.disabled)"))
        area=lambda: ev("(()=>{const el=document.getElementById('e-'+st.S.sel+'-s');const L=el.getTotalLength();return [el.getBBox().width,el.getBBox().height,st.selLayer().b.d.length,st.selLayer().name,L]})()")
        n0=await ev("st.doc.layers.length")
        await pg.click('[data-bool=unite]'); await pg.wait_for_timeout(800)
        u=await area()
        check('union: one path replacing both', await ev("st.doc.layers.length")==n0-1 and u[3]=='Union' and u[0]>100, u)
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(150)
        check('undo brings both back', await ev("st.doc.layers.length")==n0)
        await ev(f"(()=>{{hi.select('{r}'); st.S.selSet.add('{e}'); hi.commit({{insp:true}})}})()")
        await pg.click('[data-bool=subtract]'); await pg.wait_for_timeout(500)
        s=await area(); check('subtract keeps the bottom shape minus the top', s[3]=='Subtract' and s[0]<u[0], s)
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(100)
        await ev(f"(()=>{{hi.select('{r}'); st.S.selSet.add('{e}'); hi.commit({{insp:true}})}})()")
        await pg.click('[data-bool=intersect]'); await pg.wait_for_timeout(500)
        i=await area(); check('intersect is the overlap', i[3]=='Intersect' and i[0]<s[0]+1 and i[1]<u[1], i)
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(100)
        await ev(f"(()=>{{hi.select('{r}'); st.S.selSet.add('{e}'); hi.commit({{insp:true}})}})()")
        await pg.click('[data-bool=exclude]'); await pg.wait_for_timeout(500)
        x=await area(); check('exclude: several subpaths, even-odd', x[3]=='Exclude' and x[2]>=2 and await ev("st.selLayer().extra['fill-rule']")=='evenodd', x)
        await pg.screenshot(path=OUT+'bool.png', clip={'x':560,'y':320,'width':260,'height':220})
        R['errors']=errs; print(json.dumps(R,indent=1)); print('FAILS',F); await b.close()
asyncio.run(main())
