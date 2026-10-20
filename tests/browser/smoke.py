# Click-through smoke test of the editor: every step must run without page errors.
import asyncio, sys, json, os
from playwright.async_api import async_playwright
import os
OUT=os.environ.get('KL_OUT','/tmp/keyline-shots/'); os.makedirs(OUT, exist_ok=True)
URL=sys.argv[1]
SVG='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g id="grp"><rect x="5" y="5" width="40" height="30" fill="#f00"/><circle cx="70" cy="60" r="20" fill="#0a0"/></g><path d="M10 90 Q50 50 90 90" stroke="#00f" fill="none"/></svg>'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(accept_downloads=True); pg=await ctx.new_page()
        await pg.set_viewport_size({'width':1440,'height':1000})
        pg.set_default_timeout(4000)
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        steps=[]
        async def step(name, coro):
            n=len(errs)
            try: await coro; ok=True
            except Exception as e: ok=False; errs.append(f'{name}: {type(e).__name__}: {str(e)[:160]}')
            await pg.wait_for_timeout(120)
            steps.append((name, ok and len(errs)==n)); print(('ok  ' if steps[-1][1] else 'FAIL'), name, errs[n:], file=sys.stderr, flush=True)
        print('goto', file=sys.stderr, flush=True); await pg.goto(URL, wait_until='domcontentloaded'); await pg.wait_for_timeout(900); print('loaded', file=sys.stderr, flush=True)
        art=await (await pg.query_selector('#artboard')).bounding_box()
        X=lambda f: art['x']+art['width']*f; Y=lambda f: art['y']+art['height']*f
        count=lambda: pg.eval_on_selector_all('#lp .lp-row','e=>e.length')
        n0=await count()
        async def drag(x0,y0,x1,y1,mods=None):
            if mods: await pg.keyboard.down(mods)
            await pg.mouse.move(x0,y0); await pg.mouse.down(); await pg.mouse.move((x0+x1)/2,(y0+y1)/2,steps=4); await pg.mouse.move(x1,y1,steps=4); await pg.mouse.up()
            if mods: await pg.keyboard.up(mods)
        async def rect():
            await pg.keyboard.press('m'); await drag(X(.1),Y(.1),X(.25),Y(.3))
        await step('draw rectangle', rect())
        async def ell():
            await pg.keyboard.press('o'); await drag(X(.3),Y(.1),X(.45),Y(.3),'Shift')
        await step('draw ellipse (shift)', ell())
        async def star():
            sb=await (await pg.query_selector('#tools .grp[data-group="shapes"]')).bounding_box(); await pg.mouse.click(sb['x']+17,sb['y']+17,button='right'); await pg.click('#toolfly [data-tool="star"]'); await drag(X(.6),Y(.2),X(.65),Y(.3))
        await step('draw star', star())
        async def pen():
            await pg.keyboard.press('p')
            for fx,fy in [(.1,.6),(.2,.7),(.3,.6)]: await pg.mouse.click(X(fx),Y(fy))
            await drag(X(.35),Y(.65),X(.4),Y(.7))
            await pg.mouse.click(X(.1),Y(.6))
        await step('pen path (closed on first node)', pen())
        async def text():
            await pg.keyboard.press('t'); await pg.mouse.click(X(.5),Y(.8)); await pg.keyboard.type('Hi'); await pg.keyboard.press('Escape')
        await step('text tool', text())
        n1=await count()
        async def move_scale_rotate():
            await pg.keyboard.press('v')
            await pg.click('#lp .lp-row:has-text("Rectangle")')
            await drag(X(.17),Y(.2),X(.2),Y(.25))
            h=await pg.query_selector('[data-h="se"]')
            if h:
                bb=await h.bounding_box(); await drag(bb['x']+3,bb['y']+3,bb['x']+30,bb['y']+20,'Alt')
            r=await pg.query_selector('[data-h="rot"]')
            if r:
                bb=await r.bounding_box(); await drag(bb['x']+3,bb['y']+3,bb['x']+40,bb['y']+30,'Shift')
        await step('move / alt-scale / shift-rotate', move_scale_rotate())
        async def insp():
            await pg.fill('[data-f="rot"]','33'); await pg.press('[data-f="rot"]','Enter')
            await pg.fill('[data-f^="op"]','50'); await pg.press('[data-f^="op"]','Enter')
            t=await pg.query_selector('input[data-f="fill"]:not([type=color])')
            if t: await t.fill('#123456'); await t.press('Enter')
        await step('inspector fields', insp())
        async def scrub():
            s=await pg.query_selector('[data-scrub="rot"]'); bb=await s.bounding_box(); await drag(bb['x']+5,bb['y']+5,bb['x']+60,bb['y']+5)
        await step('scrub label', scrub())
        async def keys():
            await pg.click('#ruler',position={'x':400,'y':10})
            await pg.click('[data-kb="rot"]'); await pg.click('#ruler',position={'x':200,'y':10})
            await pg.fill('[data-f="rot"]','90'); await pg.press('[data-f="rot"]','Enter')
        await step('add keyframes', keys())
        async def kdrag():
            kf=await pg.query_selector('.kf'); bb=await kf.bounding_box()
            await drag(bb['x']+4,bb['y']+4,bb['x']+40,bb['y']+4)
            await drag(bb['x']+40,bb['y']+4,bb['x']+80,bb['y']+4,'Control')
        await step('drag + ctrl-duplicate keyframe', kdrag())
        async def marq():
            lane=await pg.query_selector('[data-act="lane"]'); bb=await lane.bounding_box()
            await drag(bb['x']+2,bb['y']+2,bb['x']+bb['width']-5,bb['y']+bb['height']-2)
            await pg.keyboard.press('Control+a')
        await step('marquee + select all keys', marq())
        async def ease():
            kf=await pg.query_selector('.kf'); await kf.click()
            t=await pg.query_selector('.ezb'); 
            if t: await t.click()
            h=await pg.query_selector('[data-hd="0"]')
            if h:
                bb=await h.bounding_box(); await drag(bb['x']+3,bb['y']+3,bb['x']+20,bb['y']-15)
            c=await pg.query_selector('#ezCss')
            if c: await c.fill('ease-in'); await c.press('Enter')
        await step('easing presets / curve / css', ease())
        async def menu():
            kf=await pg.query_selector('.kf'); await kf.click(button='right')
            b2=await pg.query_selector('#ctxmenu [data-m="rev"]')
            if b2: await b2.click()
            else: await pg.keyboard.press('Escape')
        await step('keyframe context menu', menu())
        async def layers():
            row=await pg.query_selector('#lp .lp-row:has-text("Ellipse")')
            nm=await row.query_selector('.lp-name') or row
            await nm.dblclick(); await pg.keyboard.type('Renamed'); await pg.keyboard.press('Enter')
            await pg.keyboard.press('Control+d')
            await pg.keyboard.press('Control+g')
            await pg.keyboard.press('Control+z'); await pg.keyboard.press('Control+Shift+z')
        await step('rename / duplicate / group / undo-redo', layers())
        async def ldrag():
            moved = await pg.evaluate("""() => {
              const rows = () => [...document.querySelectorAll('#lp .lp-row')];
              const find = t => rows().find(r => r.textContent.trim() === t);
              const dt = new DataTransfer();
              const ev = (el, type, y) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: 30, clientY: y }));
              ev(find('Ground'), 'dragstart', 0);
              const dst = find('Title'), r = dst.getBoundingClientRect();
              ev(dst, 'dragover', r.top + 2); ev(dst, 'drop', r.top + 2);
              const n = rows().map(x => x.textContent.trim()); return n[n.indexOf('Title') - 1];
            }""")
            if moved != 'Ground': raise Exception('layer did not move: row above Title is ' + str(moved))
        await step('drag layer in panel', ldrag())
        async def nodes():
            await pg.click('#lp .lp-row:has-text("Shape")'); await pg.keyboard.press('a')
            an=await pg.query_selector('.ov-an')
            if not an: raise Exception('no path nodes shown')
            bb=await an.bounding_box(); await drag(bb['x']+3,bb['y']+3,bb['x']+25,bb['y']+10)
            an=await pg.query_selector('.ov-an'); await an.dblclick()
            await pg.keyboard.press('v')
        await step('node editing', nodes())
        async def bones():
            await pg.keyboard.press('b'); await drag(X(.7),Y(.7),X(.8),Y(.7)); await drag(X(.8),Y(.7),X(.9),Y(.6))
            await pg.keyboard.press('v')
            tip=await pg.query_selector('.ov-bt'); 
            if tip:
                bb=await tip.bounding_box(); await drag(bb['x']+3,bb['y']+3,bb['x']+5,bb['y']+40)
        await step('bones + IK/FK drag', bones())
        async def imp():
            await pg.set_input_files('#fSvg', files=[{'name':'t.svg','mimeType':'image/svg+xml','buffer':SVG.encode()}])
            await pg.wait_for_timeout(500)
            png=os.path.join(os.path.dirname(__file__),'test.png')
            if os.path.exists(png): await pg.set_input_files('#fSvg', png); await pg.wait_for_timeout(600)
            await pg.keyboard.press('Escape')
        await step('import svg + png', imp())
        async def assets():
            tab=await pg.query_selector('[data-tab="assets"]')
            if tab:
                await tab.click(); th=await pg.query_selector('#ag [data-aact="place"]')
                if th: await th.click()
                t2=await pg.query_selector('[data-tab="layers"]'); 
                if t2: await t2.click()
        await step('assets panel place', assets())
        async def export():
            await pg.keyboard.press('Control+e'); await pg.wait_for_timeout(1200)
            for v in ['css','js']: await pg.click(f'#xMode button[data-v="{v}"]'); await pg.wait_for_timeout(400)
            await pg.click('#xSize button[data-v="fixed"]'); await pg.fill('#xW','300'); await pg.press('#xW','Enter'); await pg.wait_for_timeout(700)
            await pg.click('#xTab button[data-v="embed"]')
            for fw in ['react','vue','api','html']: await pg.click(f'#xFw button[data-v="{fw}"]')
            await pg.click('#mExport [data-close]')
        await step('export dialog: modes, fixed size, snippets', export())
        async def playback():
            await pg.keyboard.press('Space'); await pg.wait_for_timeout(600); await pg.keyboard.press('Space')
        await step('play / pause', playback())
        klp=None
        async def saveopen():
            nonlocal klp
            await pg.evaluate('()=>{ window.showSaveFilePicker=undefined; }'); await pg.keyboard.press('Control+s'); await pg.wait_for_timeout(300)
            async with pg.expect_download() as dl: await pg.click('#sGo')
            d=await dl.value; klp=OUT+'smoke.klp'; await d.save_as(klp)
            before=await count()
            await pg.set_input_files('#fProj', klp); await pg.wait_for_timeout(900)
            dz=await pg.query_selector('#mDiscard:not([hidden]) #dDiscard')
            if dz: await dz.click(); await pg.wait_for_timeout(900)
            after=await count()
            if before!=after: raise Exception(f'layer count changed on reopen {before}->{after}')
        await step('save .klp and reopen', saveopen())
        n2=await count()
        print(json.dumps({'steps':steps,'layers':[n0,n1,n2],'errors':errs},indent=1)); print('FAILS', [n for n,ok in steps if not ok])
        await b.close()
asyncio.run(main())
