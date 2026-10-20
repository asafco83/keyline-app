import re
import asyncio, sys, json
from playwright.async_api import async_playwright
import os
OUT=os.environ.get('KL_OUT','/tmp/keyline-shots/'); os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(device_scale_factor=1); await pg.set_viewport_size({'width':1440,'height':1000}); pg.set_default_timeout(5000)
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto((sys.argv[1] if len(sys.argv)>1 else 'http://localhost:5199/')); await pg.wait_for_timeout(2500)
        await pg.evaluate("async()=>{ window.st=await import('/src/core/state.ts'); window.hi=await import('/src/core/history.ts'); window.K=await import('/src/core/constants.ts'); window.B=await import('/src/export/build.ts'); window.TR=await import('/src/ui/tools-rail.ts')}")
        ev=pg.evaluate; R={}; F=[]
        def check(n,c,i=None):
            R[n]=('ok' if c else 'FAIL')+('' if i is None else f' {i}')
            if not c: F.append(n)
        async def drag(a,b2):
            await pg.mouse.move(*a); await pg.mouse.down(); await pg.mouse.move(*b2,steps=5); await pg.mouse.up(); await pg.wait_for_timeout(100)
        menu=lambda: ev("[...document.querySelectorAll('#layermenu > .lm-it > button')].map(b=>b.textContent.trim().replace(/\\s+/g,' ')+(b.disabled?' (off)':''))")
        async def pick(*path):
            for i,lab in enumerate(path):
                sel = '#layermenu ' + ('> .lm-it > ' if i==0 else '.lm-it.has-sub:hover .lm-sub > .lm-it > ') + 'button'
                btn = pg.locator(sel, has_text=lab).first
                if i < len(path)-1: await btn.hover()
                else: await btn.click()
            await pg.wait_for_timeout(120)
        await ev("hi.setTime(0)")
        # two shapes
        await ev("TR.pickTool('rect')"); await drag((600,350),(760,480))
        rid=await ev("st.S.sel")
        await ev("TR.pickTool('ellipse')"); await drag((640,380),(740,460))
        eid=await ev("st.S.sel"); await ev("TR.pickTool('select')")
        # right-click on canvas
        await pg.mouse.click(690,420, button='right'); await pg.wait_for_timeout(100)
        m=await menu()
        check('canvas right-click opens the menu, selecting the layer', not await ev("document.getElementById('layermenu').hidden") and await ev("st.S.sel")==eid, m)
        check('menu matches SVGator order', [re.sub(r'(Ctrl.*|Del)$','',x.replace(' (off)','').replace('▸','')).strip() for x in m][:4]==['Copy / Paste','Group','Ungroup','Delete'], m[:6])
        print(json.dumps(R), m, await ev("[st.S.sel, [...st.S.selSet]]"))
        await pick('Rotate 90° right')
        check('rotate 90', abs(await ev(f"K.valueAt(st.layerById('{eid}'),'rot',0)")-90)<1e-6)
        await pg.mouse.click(690,420, button='right'); await pick('Flip horizontal')
        check('flip', await ev(f"K.valueAt(st.layerById('{eid}'),'scl',0)[0]")<0)
        await pg.mouse.click(690,420, button='right'); await pick('Copy / Paste','Copy')
        n0=await ev("st.doc.layers.length")
        await pg.mouse.click(690,420, button='right'); await pick('Copy / Paste','Paste in place')
        check('copy + paste in place', await ev("st.doc.layers.length")==n0+1 and await ev(f"JSON.stringify(st.selLayer().b.pos)==JSON.stringify(st.layerById('{eid}').b.pos)"))
        await pg.keyboard.press('Delete')
        await ev(f"hi.select('{eid}')"); await pg.keyboard.press('Control+c'); await pg.keyboard.press('Control+v')
        check('Ctrl+C / Ctrl+V copies layers (offset)', await ev("st.doc.layers.length")==n0+1 and await ev(f"st.selLayer().b.pos[0]==st.layerById('{eid}').b.pos[0]+16"))
        await pg.keyboard.press('Delete')
        # lock via shortcut
        await ev(f"hi.select('{eid}')"); await pg.keyboard.press('Control+l')
        check('Ctrl+L locks', await ev(f"st.layerById('{eid}').lock===true"))
        await pg.keyboard.press('Control+l')
        # arrange submenu
        await ev(f"hi.select('{rid}')"); await pg.mouse.click(610,360, button='right')
        await pick('Arrange','Bring to front')
        lst=await ev("st.doc.layers.filter(l=>!l.parent).map(l=>l.id)")
        check('bring to front', lst[-1]==rid, lst[-3:])
        await ev(f"hi.select('{rid}')"); await pg.keyboard.press('Control+Shift+BracketLeft')
        lst=await ev("st.doc.layers.filter(l=>!l.parent).map(l=>l.id)")
        check('send to back shortcut', lst[0]==rid, lst[:3])
        # hyperlink
        await ev(f"hi.select('{eid}')"); await pg.mouse.click(690,420, button='right'); await pick('Hyperlink')
        check('hyperlink dialog', not await ev("document.getElementById('mLink').hidden"))
        await pg.fill('#hlUrl','javascript:alert(1)'); await pg.click('#hlDone')
        check('script links refused', not await ev("document.getElementById('hlErr').hidden") and not await ev(f"!!st.layerById('{eid}').link"))
        await pg.fill('#hlUrl','example.com/x'); await pg.select_option('#hlTarget','_self'); await pg.click('#hlDone')
        check('link saved', await ev(f"JSON.stringify(st.layerById('{eid}').link)")=='{"url":"https://example.com/x","target":"_self"}')
        code=await ev("B.buildExport(null).code")
        check('export wraps in <a>', '<a href="https://example.com/x"' in code)
        # panel right-click + mask: select both, rect below ellipse? ellipse is above (later) after send to back of rect
        await ev(f"(()=>{{hi.select('{rid}'); st.S.selSet.add('{eid}'); hi.commit({{insp:true}})}})()")
        row=await ev(f"(()=>{{const e=document.querySelector('#lp .lp-row[data-lid=\"{eid}\"]');e.scrollIntoView({{block:'center'}});const r=e.getBoundingClientRect();return [r.x+40,r.y+r.height/2]}})()")
        await pg.mouse.click(*row, button='right'); await pg.wait_for_timeout(100)
        check('panel right-click keeps multi-selection', await ev("st.S.selSet.size")==2)
        await pick('Create mask')
        g=await ev("(()=>{const g=st.selLayer();const ch=st.doc.layers.filter(l=>l.parent===g.id);return {mask:g.mask,kids:ch.map(c=>[c.name,!!c.maskSrc]),inF:st.doc.layers.filter(l=>l.parent===(ch.find(c=>c.maskSrc)||{}).id).map(l=>l.id)}})()")
        check('mask group with Masks folder holding the top layer', g['mask']=='mask' and any(k[1] for k in g['kids']) and g['inF']==[eid], g)
        rows=await ev("[...document.querySelectorAll('#lp .lp-row')].map(r=>r.textContent.trim().replace(/\\s+/g,' ')).slice(0,5)")
        R['panel']=rows
        dom=await ev("(()=>{const m=[...document.querySelectorAll('#content mask')].find(x=>x.querySelector('[id$=\"%s-s\"]'));return m?[m.getAttribute('mask-type'), !!document.querySelector('#content [mask]'), true]:null})()" % eid)
        check('canvas renders the mask', dom==['alpha',True,True], dom)
        # pixel test: outside ellipse but inside rect should be background now
        px=await ev("""(async()=>{const r=document.getElementById('e-%s-s').getBoundingClientRect();return [r.x+4,r.y+4]})()""" % rid)
        await pg.screenshot(path=OUT+'lm-mask.png', clip={'x':560,'y':320,'width':260,'height':200})
        code=await ev("B.buildExport(null).code")
        check('export has the mask', '<mask id=' in code and 'mask="url(#' in code)
        # mask layer selectable and movable from the panel
        await ev(f"hi.select('{eid}')"); await pg.wait_for_timeout(80)
        check('mask layer shows a selection box', await ev("document.querySelectorAll('#overlay .ov-box').length")>0)
        # clipping path variant + release
        gid=await ev(f"st.layerById('{rid}').parent"); await ev(f"hi.select('{gid}')")
        row=await ev(f"(()=>{{const e=document.querySelector('#lp .lp-row[data-lid=\"{gid}\"]');e.scrollIntoView({{block:'center'}});const r=e.getBoundingClientRect();return [r.x+40,r.y+r.height/2]}})()")
        await pg.mouse.click(*row, button='right'); await pick('Release mask')
        check('release mask', await ev(f"!st.layerById('{gid}')") and await ev(f"!st.layerById('{eid}').parent && !st.layerById('{rid}').parent"))
        await ev(f"(()=>{{hi.select('{rid}'); st.S.selSet.add('{eid}'); hi.commit({{insp:true}})}})()")
        row=await ev(f"(()=>{{const e=document.querySelector('#lp .lp-row[data-lid=\"{eid}\"]');e.scrollIntoView({{block:'center'}});const r=e.getBoundingClientRect();return [r.x+40,r.y+r.height/2]}})()")
        await pg.mouse.click(*row, button='right'); await pick('Create clipping path')
        code=await ev("B.buildExport(null).code")
        check('clipping path: shape-only mask', 'fill:#fff!important' in code and await ev("st.selLayer().mask")=='clip')
        # export selection
        await ev(f"hi.select('{rid}')"); await pg.keyboard.press('Control+Shift+e'); await pg.wait_for_timeout(1200)
        prev=await ev("document.getElementById('xprev').innerHTML")
        check('export selection only', 'Good morning' not in prev and await ev("document.getElementById('mExport').hidden===false"))
        await pg.keyboard.press('Escape')
        check('export only resets', await ev("!st.S.exportOnly"))
        R['errors']=errs; print(json.dumps(R,indent=1)); print('FAILS',F); await b.close()
asyncio.run(main())
