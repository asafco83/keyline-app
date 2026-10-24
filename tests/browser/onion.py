import asyncio, sys, json, os
from playwright.async_api import async_playwright
OUT=os.environ.get('CIN_OUT','/tmp/svgcinema-shots/'); os.makedirs(OUT, exist_ok=True)
# Onion skin: the timeline bar toggle, ghosts of the selected layer before (blue) and after (red) the
# playhead, the settings, hidden while playing and never exported.
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1440,'height':900}); pg.set_default_timeout(5000)
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto((sys.argv[1] if len(sys.argv)>1 else 'http://localhost:5199/')); await pg.wait_for_timeout(2500)
        await pg.evaluate("async()=>{ localStorage.removeItem('svgcinema:onion'); window.st=await import('/src/core/state.ts'); window.hi=await import('/src/core/history.ts'); window.bu=await import('/src/export/build.ts'); window.pb=await import('/src/core/playback.ts'); }")
        ev=pg.evaluate; R={}; F=[]
        def check(n,c,i=None):
            R[n]=('ok' if c else 'FAIL')+('' if i is None else f' {i}')
            if not c: F.append(n)
        title=await ev("st.doc.layers.find(l=>l.name==='Title').id")
        await ev(f"hi.select('{title}'); hi.setTime(1.4)"); await pg.wait_for_timeout(150)
        n=lambda: ev("document.querySelectorAll('#onion .og').length")
        check('off by default', await n()==0 and await ev("document.getElementById('tOnion').getAttribute('aria-pressed')")=='false')
        await pg.click('#tOnion'); await pg.wait_for_timeout(150)
        check('on: 3 ghosts before and 3 after', await n()==6 and await ev("document.querySelectorAll('#onion .og-b').length")==3)
        check('a ghost is the layer at that time', await ev(f"document.querySelector('#onion .og #og0-{title}') && document.querySelector('#onion .og #og0-{title}').getAttribute('transform')")!=await ev(f"document.querySelector('#onion .og #og5-{title}').getAttribute('transform')"))
        check('outlines only, not clickable', await ev("getComputedStyle(document.querySelector('#onion .og text')).fill")=='none' and await ev("getComputedStyle(document.getElementById('onion')).pointerEvents")=='none')
        op=await ev("[...document.querySelectorAll('#onion .og-b')].map(g=>+g.getAttribute('opacity'))")
        check('fading with distance', op==sorted(op, reverse=True) and op[0]==0.6, op)
        await pg.click('#tOnionOpt'); await pg.wait_for_timeout(100)
        await pg.fill('[data-onion=before]','1'); await pg.fill('[data-onion=after]','0'); await pg.wait_for_timeout(100)
        check('the settings change the ghosts', await n()==1, await n())
        await pg.screenshot(path=OUT+'onion.png')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(100)
        check('Esc closes the settings', not await ev("!!document.getElementById('onionPop')"))
        check('remembered in this browser', await ev("JSON.parse(localStorage.getItem('svgcinema:onion')).before")==1)
        await ev("pb.togglePlay()"); await pg.wait_for_timeout(200)
        check('hidden while playing', await n()==0)
        await ev("pb.togglePlay()"); await pg.wait_for_timeout(200)
        check('back when stopped', await n()==1)
        check('never in the export', 'og0-' not in await ev("bu.buildExport(null).code"))
        await ev("hi.select(null)"); await pg.wait_for_timeout(100)
        check('nothing selected: no ghosts', await n()==0)
        check('no page errors', not errs, errs[:3])
        print(json.dumps(R, indent=1, ensure_ascii=False)); print('FAILS', F)
        await b.close()
asyncio.run(main())
