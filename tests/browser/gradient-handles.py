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
        async def drag(a,b2,mods=None):
            await pg.mouse.move(*a); await pg.mouse.down(); await pg.mouse.move(*b2,steps=6); await pg.mouse.up(); await pg.wait_for_timeout(100)
        async def ctr(sel):
            return await ev(f"(()=>{{const r=document.querySelector('{sel}').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}})()")
        check('bg has text + swatch', await ev("!!document.querySelector('#d-bg') && !!document.querySelector('#d-bgc.pswatch')"))
        await ev("hi.setTime(0)")
        await ev("TR.pickTool('rect')"); await drag((560,330),(760,470)); rid=await ev("st.S.sel"); await ev("TR.pickTool('select')")
        L=f"st.layerById('{rid}')"
        check('fill text field back', await ev("!!document.querySelector('#t-fill')"))
        await pg.fill('#t-fill','#336699'); await pg.press('#t-fill','Tab')
        check('typing a hex sets fill', await ev(f"{L}.b.fill")=='#336699')
        check('no handles without window', await ev("!document.querySelector('[data-gh]')"))
        await pg.click('#insp [data-paint=fill]'); await pg.click('[data-cpt=lin]'); await pg.wait_for_timeout(100)
        check('text says Linear', await ev("document.querySelector('#t-fill').value")=='Linear')
        n=await ev("document.querySelectorAll('[data-gh]').length"); check('linear handles', n==3, n)
        p1=await ctr('[data-gh=p1]'); p2=await ctr('[data-gh=p2]')
        check('default bar spans the box horizontally', abs(p1[0]-560)<3 and abs(p2[0]-760)<3 and abs(p1[1]-400)<3, (p1,p2))
        await drag(tuple(p2),(860,500)); 
        pp=await ev(f"JSON.stringify({L}.b.fill.p)"); check('drag end point sets p', pp!='undefined' and abs(json.loads(pp)[2]-1.5)<0.02 and abs(json.loads(pp)[3]-1.214)<0.03, pp)
        x2=await ev(f"document.getElementById('e-{rid}-gf').getAttribute('x2')"); check('canvas follows', x2=='1.5', x2)
        check('window stays open', await ev("!document.getElementById('cpop').hidden"))
        ang=await ev("document.querySelector('[data-cpg=a]').value"); check('angle field follows', ang not in ('90',''), ang)
        # move whole bar
        mid=await ev("(()=>{const l=document.querySelector('[data-gh=line]');const a=l.getBoundingClientRect();return [a.x+a.width/2,a.y+a.height/2]})()")
        await drag(tuple(mid),(mid[0]-50,mid[1]))
        q=json.loads(await ev(f"JSON.stringify({L}.b.fill.p)")); check('drag bar moves both', abs(q[0]-(-0.25))<0.02 and abs(q[2]-1.25)<0.02, q)
        # angle field rotates p
        await pg.fill('[data-cpg=a]','180'); await pg.press('[data-cpg=a]','Tab')
        q=json.loads(await ev(f"JSON.stringify({L}.b.fill.p)")); check('angle field rotates points', abs(q[0]-q[2])<0.01 and q[3]>q[1], q)
        await pg.screenshot(path=OUT+'gh-lin.png', clip={'x':400,'y':200,'width':900,'height':500})
        # radial
        await pg.click('[data-cpt=rad]'); await pg.wait_for_timeout(100)
        n=await ev("[...document.querySelectorAll('[data-gh]')].map(e=>e.dataset.gh).sort().join()"); check('radial handles', n=='c,q,r', n)
        c=await ctr('[data-gh=c]'); check('centre at box centre', abs(c[0]-660)<3 and abs(c[1]-400)<3, c)
        r=await ctr('[data-gh=r]'); check('radius end at right edge', abs(r[0]-760)<3, r)
        await drag(tuple(r),(660,330))  # point up: angle -90, r = 70/140=0.5
        g=await ev(f"JSON.stringify({L}.b.fill)"); gg=json.loads(g); check('radius handle sets r + direction', abs(gg['ra']+90)<1 and abs(gg['r']-0.5)<0.02, g)
        qh=await ctr('[data-gh=q]')
        await drag(tuple(qh),(qh[0]+ (50 if qh[0]>=660 else -50), qh[1]))
        gg=json.loads(await ev(f"JSON.stringify({L}.b.fill)")); check('square handle sets ellipse ratio', abs(gg['rr']-1.5)<0.05, gg.get('rr'))
        gt=await ev(f"document.getElementById('e-{rid}-gf').getAttribute('gradientTransform')"); check('gradientTransform', gt and 'rotate(-90' in gt, gt)
        await drag(tuple(c),(c[0]+40,c[1]+20))
        gg=json.loads(await ev(f"JSON.stringify({L}.b.fill)")); check('centre drag', abs(gg['cx']-0.7)<0.02 and abs(gg['cy']-(0.5+20/140))<0.02, (gg['cx'],gg['cy']))
        check('X field follows', await ev("document.querySelector('[data-cpg=cx]').value")=='70')
        await pg.screenshot(path=OUT+'gh-rad.png', clip={'x':400,'y':200,'width':900,'height':500})
        code=await ev("st.doc.ex.mode='js', B.buildExport(null).code"); check('export has gradientTransform', 'gradientTransform' in code)
        await pg.mouse.click(1000,150); await pg.wait_for_timeout(100)
        check('handles go when window closes', await ev("!document.querySelector('[data-gh]')"))
        await ev("hi.undo()"); check('one undo', await ev(f"st.layerById('{rid}').b.fill")=='#336699', await ev(f"JSON.stringify(st.layerById('{rid}').b.fill)"))
        await pg.screenshot(path=OUT+'gh-panel.png', clip={'x':1120,'y':60,'width':320,'height':900})
        R['errors']=errs; print(json.dumps(R,indent=1)); print('FAILS',F); await b.close()
asyncio.run(main())
