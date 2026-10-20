import asyncio, sys, json
from playwright.async_api import async_playwright
import os
OUT=os.environ.get('CIN_OUT','/tmp/svgcinema-shots/'); os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(device_scale_factor=2); await pg.set_viewport_size({'width':1440,'height':1000})
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto((sys.argv[1] if len(sys.argv)>1 else 'http://localhost:5199/')); await pg.wait_for_timeout(2500)
        await pg.evaluate("async()=>{ window.st=await import('/src/core/state.ts'); window.hi=await import('/src/core/history.ts'); window.K=await import('/src/core/constants.ts'); window.B=await import('/src/export/build.ts')}")
        ev=pg.evaluate; R={}; F=[]
        def check(n,c,i=None):
            R[n]=('ok' if c else 'FAIL')+('' if i is None else f' {i}')
            if not c: F.append(n)
        tid=await ev("st.doc.layers.find(l=>l.name==='Title').id"); L=f"st.layerById('{tid}')"
        await ev(f"hi.select('{tid}')"); await ev("hi.setTime(1.4)"); await pg.wait_for_timeout(100)
        held=await ev(f"K.H.get({L},'op',1.4)")
        row=f".tl-prop[data-lid='{tid}'][data-prop='op']"
        check('freeze icon hidden until hover', await ev(f"getComputedStyle(document.querySelector(\"{row} .tl-fz\")).opacity")=='0')
        await pg.hover(row); 
        check('visible on hover', await ev(f"getComputedStyle(document.querySelector(\"{row} .tl-fz\")).opacity")=='1')
        await pg.click(f"{row} .tl-fz"); await pg.wait_for_timeout(100)
        check('frozen: track set aside, value held', await ev(f"!{L}.t.op && {L}.ft.op.length>=2") and abs(await ev(f"{L}.b.op")-held)<1e-6, (held, await ev(f"{L}.b.op")))
        check('icon stays on, row greyed', await ev(f"document.querySelector(\"{row}\").classList.contains('frozen') && document.querySelector(\"{row} .tl-fz\").classList.contains('on')"))
        await pg.mouse.move(10,10); await pg.wait_for_timeout(50)
        check('icon persistent without hover', await ev(f"getComputedStyle(document.querySelector(\"{row} .tl-fz\")).opacity")=='1')
        check("frozen keys greyed and inert", await ev(f"document.querySelectorAll(\"{row} .kfz\").length>=2 && document.querySelectorAll(\"{row} .kf\").length==0"), await ev(f"[document.querySelectorAll(\"{row} .kfz\").length, document.querySelectorAll(\"{row} .kf\").length]"))
        await ev("hi.setTime(0.2)"); await pg.wait_for_timeout(50)
        op=await ev(f"+document.getElementById('e-{tid}').getAttribute('opacity')")
        check('playback uses held value', abs(op-held)<0.002, (op,held))
        await pg.fill('#i-op__100','70'); await pg.press('#i-op__100','Tab')
        check('editing while frozen creates no keyframe', await ev(f"!{L}.t.op && {L}.ft.op.length>=2") and abs(await ev(f"{L}.b.op")-0.7)<1e-6)
        await pg.click('[data-kb=op]')
        check('key button blocked while frozen', await ev(f"!{L}.t.op"))
        code=await ev("st.doc.ex.mode='js', B.buildExport(null).code")
        lay=await ev(f"(()=>{{const c=B.buildExport(null).code,m=c.match(/P=CinEngine\((\{{.*?\}}),s\);/);const d=JSON.parse(m[1]);const x=d.L.find(q=>q.id.endsWith('{tid}')||q.id==='{tid}');return x?Object.keys(x.t):null}})()")
        check('export ignores frozen keyframes', lay is not None and 'op' not in lay, lay)
        # select all keys excludes frozen
        await ev("(async()=>{const k=await import('/src/core/keyframes.ts'); k.selectAllKeys()})()")
        check('select all skips frozen', await ev(f"![...st.S.keys].some(q=>{L}.ft.op.includes(q))"))
        await pg.screenshot(path=OUT+'fz.png', clip={'x':0,'y':780,'width':900,'height':220})
        await pg.click(f"{row} .tl-fz"); await pg.wait_for_timeout(100)
        check('unfreeze restores keyframes', await ev(f"{L}.t.op.length>=2 && !{L}.ft"))
        await ev("hi.setTime(0.2)"); 
        check('animation back', abs(await ev(f"+document.getElementById('e-{tid}').getAttribute('opacity')")-await ev(f"K.H.get({L},'op',0.2)"))<0.002)
        await pg.keyboard.press('Control+z'); await pg.keyboard.press('Control+z')
        check('undo restores frozen state', await ev(f"!!({L}.ft&&{L}.ft.op)"))
        R['errors']=errs; print(json.dumps(R,indent=1)); print('FAILS',F); await b.close()
asyncio.run(main())
