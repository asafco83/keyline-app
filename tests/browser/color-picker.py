import asyncio, sys, json
from playwright.async_api import async_playwright
import os
OUT=os.environ.get('KL_OUT','/tmp/keyline-shots/'); os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(); await pg.set_viewport_size({'width':1440,'height':1000}); pg.set_default_timeout(5000)
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto((sys.argv[1] if len(sys.argv)>1 else 'http://localhost:5199/')); await pg.wait_for_timeout(2500)
        await pg.evaluate("async()=>{ window.st=await import('/src/core/state.ts'); window.hi=await import('/src/core/history.ts'); window.B=await import('/src/export/build.ts'); window.TR=await import('/src/ui/tools-rail.ts')}")
        ev=pg.evaluate; R={}; F=[]
        def check(n,c,i=None):
            R[n]=('ok' if c else 'FAIL')+('' if i is None else f' {i}')
            if not c: F.append(n)
        async def drag(a,b2):
            await pg.mouse.move(*a); await pg.mouse.down(); await pg.mouse.move(*b2,steps=5); await pg.mouse.up(); await pg.wait_for_timeout(100)
        async def box(sel):
            return await ev(f"(()=>{{const r=document.querySelector('{sel}').getBoundingClientRect();return [r.x,r.y,r.width,r.height]}})()")
        # document background swatch
        check('doc bg is a swatch, no text value', await ev("!!document.querySelector('#d-bgc.pswatch') && !document.querySelector('#insp input[type=color]')"))
        await ev("hi.setTime(0)")
        await ev("TR.pickTool('rect')"); await drag((600,350),(760,470)); rid=await ev("st.S.sel"); await ev("TR.pickTool('select')")
        L=f"st.layerById('{rid}')"
        txt=await ev("[...document.querySelectorAll('#insp [data-paint]')].map(b=>b.textContent.trim()).join('|')")
        check('fill/stroke swatches have no text', txt.replace('|','')=='', txt)
        check('no type buttons in the panel', await ev("!document.querySelector('#insp [data-gtype]')"))
        await pg.click('#insp [data-paint=fill]'); await pg.wait_for_timeout(100)
        check('picker opens', await ev("!document.getElementById('cpop').hidden"))
        types=await ev("[...document.querySelectorAll('[data-cpt]')].map(b=>b.dataset.cpt).join(',')")
        check('type buttons inside', types=='none,solid,lin,rad', types)
        await pg.screenshot(path=OUT+'cp1.png')
        # pick in SV area: top-right = pure hue (red at hue 0)
        hb=await box('[data-cphue]'); await pg.mouse.click(hb[0]+2, hb[1]+hb[3]/2)
        sv=await box('[data-cpsv]'); await pg.mouse.click(sv[0]+sv[2]-2, sv[1]+2); await pg.wait_for_timeout(80)
        f=await ev(f"{L}.b.fill"); check('SV pick sets fill live', f.lower().startswith('#f') and f[3:5]<'30' and f[5:]<'10', f)
        await pg.fill('[data-cphex]','00ff00'); await pg.press('[data-cphex]','Tab')
        check('hex field', await ev(f"{L}.b.fill")=='#00ff00', await ev(f"{L}.b.fill"))
        await pg.fill('[data-cpa]','50'); await pg.press('[data-cpa]','Tab')
        check('opacity field', 'rgba(0,255,0,0.5)'==await ev(f"{L}.b.fill"), await ev(f"{L}.b.fill"))
        # linear
        await pg.click('[data-cpt=lin]'); await pg.wait_for_timeout(80)
        v=await ev(f"JSON.stringify({L}.b.fill)"); check('linear inside picker', '"g":"lin"' in v, v)
        check('bar has 2 stops', await ev("document.querySelectorAll('#cpop .g-stop').length")==2)
        bar=await box('#cpop [data-cpbar]'); await pg.mouse.click(bar[0]+bar[2]/2, bar[1]+bar[3]/2); await pg.wait_for_timeout(80)
        check('click bar adds stop', await ev(f"{L}.b.fill.s.length")==3)
        await pg.fill('[data-cphex]','0000ff'); await pg.press('[data-cphex]','Tab')
        sc=await ev(f"{L}.b.fill.s[1][1]"); check('stop colour edits selected stop', sc.startswith('rgba(0,0,255') or sc=='#0000ff', await ev(f"JSON.stringify({L}.b.fill.s)"))
        await pg.fill('[data-cpg=a]','0'); await pg.press('[data-cpg=a]','Tab')
        check('angle', await ev(f"{L}.b.fill.a")==0)
        await pg.click('[data-cpt=rad]'); await pg.wait_for_timeout(80)
        check('radial on canvas', await ev(f"document.getElementById('e-{rid}-gf').tagName")=='radialGradient')
        await pg.screenshot(path=OUT+'cp2.png')
        sw=await ev("document.querySelector('#insp [data-paint=fill] i').style.background")
        check('swatch shows gradient', 'radial-gradient' in sw, sw[:60])
        # close by clicking outside -> one undo step
        await pg.mouse.click(1000,150); await pg.wait_for_timeout(100)
        check('closes on outside click', await ev("document.getElementById('cpop').hidden"))
        await ev("hi.undo()"); await pg.wait_for_timeout(80)
        f=await ev(f"JSON.stringify(st.layerById('{rid}').b.fill)")
        check('one undo restores the original colour', 'g' not in f and f!='"#00ff00"', f)
        await ev("hi.redo()")
        # stroke none
        await ev(f"hi.select('{rid}')"); await pg.wait_for_timeout(80)
        await pg.click('#insp [data-paint=stk]'); await pg.click('[data-cpt=none]'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(80)
        check('Esc closes', await ev("document.getElementById('cpop').hidden"))
        check('stroke none shows no-colour swatch', await ev("document.querySelector('#insp [data-paint=stk]').classList.contains('none')"))
        check('still selected after Esc', await ev("st.S.sel")==rid)
        # toggle
        await pg.click('#insp [data-paint=fill]'); await pg.click('#insp [data-paint=fill]'); await pg.wait_for_timeout(80)
        check('clicking swatch again closes', await ev("document.getElementById('cpop').hidden"))
        R['errors']=errs; print(json.dumps(R,indent=1)); print('FAILS',F); await b.close()
asyncio.run(main())
