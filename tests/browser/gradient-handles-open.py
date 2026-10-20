import asyncio, sys, json
from playwright.async_api import async_playwright
import os
OUT=os.environ.get('KL_OUT','/tmp/keyline-shots/'); os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(); await pg.set_viewport_size({'width':1440,'height':1000})
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto((sys.argv[1] if len(sys.argv)>1 else 'http://localhost:5199/')); await pg.wait_for_timeout(2500)
        await pg.evaluate("async()=>{ window.st=await import('/src/core/state.ts'); window.hi=await import('/src/core/history.ts'); window.TR=await import('/src/ui/tools-rail.ts'); window.SG=await import('/src/render/stage.ts')}")
        ev=pg.evaluate; R={}; F=[]
        def check(n,c,i=None):
            R[n]=('ok' if c else 'FAIL')+('' if i is None else f' {i}'); 
            if not c: F.append(n)
        await ev("TR.pickTool('rect')"); await pg.mouse.move(560,330); await pg.mouse.down(); await pg.mouse.move(760,470,steps=5); await pg.mouse.up(); await ev("TR.pickTool('select')")
        rid=await ev("st.S.sel")
        await ev(f"(()=>{{const l=st.layerById('{rid}'); l.b.fill={{g:'rad',cx:.5,cy:.5,r:.5,s:[[0,'#5b7cfa'],[1,'rgba(91,124,250,0)']]}}; SG.renderStage(); SG.frame()}})()")
        check('no handles before', await ev("!document.querySelector('[data-gh]')"))
        await pg.click('#insp [data-paint=fill]'); await pg.wait_for_timeout(100)
        n=await ev("document.querySelectorAll('[data-gh]').length"); check('handles on open (existing gradient)', n==3, n)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(80)
        check('gone on Esc (no change)', await ev("!document.querySelector('[data-gh]')"))
        await pg.click('#insp [data-paint=fill]'); await pg.click('#insp [data-paint=fill]'); await pg.wait_for_timeout(80)
        check('gone on toggle close', await ev("!document.querySelector('[data-gh]')"))
        await pg.click('#insp [data-paint=stk]'); await pg.wait_for_timeout(80)
        check('none for solid stroke', await ev("!document.querySelector('[data-gh]')"))
        R['errors']=errs; print(json.dumps(R,indent=1)); print('FAILS',F); await b.close()
asyncio.run(main())
