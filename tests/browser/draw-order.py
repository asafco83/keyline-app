import asyncio, sys, json, math
from playwright.async_api import async_playwright
import os
OUT=os.environ.get('CIN_OUT','/tmp/svgcinema-shots/'); os.makedirs(OUT, exist_ok=True)
# A rig's own draw order (Bone section of its top bone): artwork drawn in a list's order instead of by
# nesting, at the same places; the list (move buttons, drag), turning it off and on, the Edit bone rest
# view, picking artwork on the canvas, and both exports.
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(); await pg.set_viewport_size({'width':1440,'height':1000})
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto((sys.argv[1] if len(sys.argv)>1 else 'http://localhost:5199/')); await pg.wait_for_timeout(2500)
        await pg.evaluate("async()=>{ window.st=await import('/src/core/state.ts'); window.hi=await import('/src/core/history.ts'); window.D=await import('/src/core/dom.ts'); window.B=await import('/src/export/build.ts'); window.SG=await import('/src/render/stage.ts')}")
        ev=pg.evaluate; R={}; F=[]
        def check(n,c,i=None):
            R[n]=('ok' if c else 'FAIL')+('' if i is None else f' {i}')
            if not c: F.append(n)
        ID={}
        for n in ['Stem','Stem 2','Stem 3','Stalk','Stalk 2','Stalk 3','Leaf','Leaf 2','Bloom']: ID[n]=await ev(f"st.doc.layers.find(l=>l.name==='{n}').id")
        NM={v:k for k,v in ID.items()}
        rows=lambda: ev("[...document.querySelectorAll('.dord-row .dord-name')].map(e=>e.textContent)")
        dord=lambda: ev(f"(st.layerById('{ID['Stem']}').dord||[]).map(id=>st.layerById(id).name)")
        # the artwork as drawn: wrappers in document order (back to front)
        drawn=lambda: ev("[...document.querySelectorAll('#content [id$=\"-w\"]')].map(e=>st.layerById(e.id.slice(2,-2)).name)")
        boxes=lambda: ev(f"(()=>{{const M=D.CONTENT.getScreenCTM().inverse();return {json.dumps(list(ID.values()))}.filter(id=>st.layerById(id).type!=='bone').map(id=>{{const r=document.getElementById('e-'+id+'-s').getBoundingClientRect(),a=new DOMPoint(r.x,r.y).matrixTransform(M),c=new DOMPoint(r.right,r.bottom).matrixTransform(M);return [a.x,a.y,c.x,c.y]}})}})()")
        await ev("hi.setTime(1.9)"); await ev(f"hi.select('{ID['Stem']}')"); await pg.wait_for_timeout(150)
        check('Own draw order on the rig\'s top bone', await ev("!!document.getElementById('fl-dord') && document.getElementById('fl-dord').checked"))
        r0=await rows()
        check('the list shows the front first', r0==['Bloom','Leaf 2','Stalk 3','Stalk 2','Stalk','Leaf'], r0)
        check('the canvas draws in that order', await drawn()==list(reversed(r0)), await drawn())
        check('the Leaf is drawn outside its bone', await ev(f"!document.getElementById('e-{ID['Stem 2']}').contains(document.getElementById('e-{ID['Leaf']}'))"))
        await ev(f"hi.select('{ID['Stem 2']}')"); await pg.wait_for_timeout(100)
        check('not on a child bone', await ev("!document.getElementById('fl-dord')"))
        await ev(f"hi.select('{ID['Stem']}')"); await pg.wait_for_timeout(100)
        own=await boxes()
        await pg.screenshot(path=OUT+'draw-order-insp.png', clip={'x':1144,'y':52,'width':296,'height':940})
        # ---- off: back to nesting, at the same places
        await pg.click('#fl-dord'); await pg.wait_for_timeout(200)
        check('off: drawn by nesting again', await ev(f"document.getElementById('e-{ID['Stem 2']}').contains(document.getElementById('e-{ID['Leaf']}'))") and await drawn()==[])
        nest=await boxes()
        check('the artwork is where nesting puts it', all(abs(a-c)<0.3 for x,y in zip(own,nest) for a,c in zip(x,y)), (own[:2],nest[:2]))
        # ---- on: starts as the nesting order
        await pg.click('#fl-dord'); await pg.wait_for_timeout(200)
        r1=await rows()
        check('on: starts in nesting order', r1==['Bloom','Leaf 2','Stalk 3','Leaf','Stalk 2','Stalk'], r1)
        # ---- move buttons: Leaf two steps back (behind Stalk 2 and Stalk); one undo per step
        await pg.click(f".dord-mv[data-id=\"{ID['Leaf']}\"][data-dir=\"back\"]"); await pg.wait_for_timeout(150)
        await pg.click(f".dord-mv[data-id=\"{ID['Leaf']}\"][data-dir=\"back\"]"); await pg.wait_for_timeout(150)
        check('move back', await rows()==['Bloom','Leaf 2','Stalk 3','Stalk 2','Stalk','Leaf'] and await drawn()==['Leaf','Stalk','Stalk 2','Stalk 3','Leaf 2','Bloom'])
        check('the backmost can\'t go further back', await ev(f"document.querySelector('.dord-mv[data-id=\"{ID['Leaf']}\"][data-dir=\"back\"]').disabled"))
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(150)
        check('one undo per step', await rows()==['Bloom','Leaf 2','Stalk 3','Stalk 2','Leaf','Stalk'])
        await pg.keyboard.press('Control+y'); await pg.wait_for_timeout(150)
        # ---- drag a row: Bloom onto the lower half of Stalk 3 (just behind it)
        src=f".dord-row[data-dord-id=\"{ID['Bloom']}\"]"; dst=f".dord-row[data-dord-id=\"{ID['Stalk 3']}\"]"
        h=await ev(f"document.querySelector('{dst}').getBoundingClientRect().height")
        await pg.drag_and_drop(src, dst, target_position={'x':40,'y':h*0.8}); await pg.wait_for_timeout(200)
        r2=await rows()
        check('drag a row to reorder', r2==['Leaf 2','Stalk 3','Bloom','Stalk 2','Stalk','Leaf'], r2)
        # ---- Edit bone shows the rest pose: the artwork follows it
        await pg.keyboard.press('e'); await pg.wait_for_timeout(200)
        same=await ev(f"(()=>{{const w=document.getElementById('e-{ID['Leaf']}-w'),b=document.getElementById('e-{ID['Stem 2']}-s'),A=w.getScreenCTM(),C=b.getScreenCTM();return [A.a-C.a,A.b-C.b,A.c-C.c,A.d-C.d,A.e-C.e,A.f-C.f].every(v=>Math.abs(v)<1e-3)}})()")
        check('in the rest pose the artwork stays on its bone', same)
        await pg.keyboard.press('v'); await pg.wait_for_timeout(150)
        # ---- Ctrl+click picks a piece of the rig's artwork on the canvas
        leaf=await ev(f"(()=>{{const r=document.getElementById('e-{ID['Leaf']}-s').getBoundingClientRect();return [r.x+r.width*0.25,r.y+r.height*0.5]}})()")
        await pg.keyboard.down('Control'); await pg.mouse.click(*leaf); await pg.keyboard.up('Control'); await pg.wait_for_timeout(150)
        check('Ctrl+click picks the artwork', await ev("st.S.sel")==ID['Leaf'], await ev("st.S.sel"))
        await pg.screenshot(path=OUT+'draw-order.png')
        # ---- exports: the order and the places, at 1.9 s
        await ev("hi.setTime(1.9)"); ed=await boxes()
        await ev("st.doc.ex.mode='js'; st.doc.ex.trigger='load'"); js=await ev("B.buildExport(null).code")
        await ev("st.doc.ex.mode='css'"); css=await ev("B.buildExport(null).code"); await ev("st.doc.ex.mode='js'")
        async def probe(code, mode, t):
            q=await b.new_page(); await q.set_viewport_size({'width':1440,'height':1000})
            await q.set_content('<!doctype html><html><body style="margin:0">'+code+'</body></html>'); await q.wait_for_timeout(300)
            if mode=='js': await q.evaluate(f"document.querySelector('svg').player.pause().seekTo({t*1000})")
            else: await q.evaluate(f"(()=>{{const s=document.querySelector('svg');s.pauseAnimations();s.setCurrentTime({t});document.getAnimations().forEach(a=>{{a.pause();a.currentTime={t*1000}}})}})()")
            await q.wait_for_timeout(80)
            r=await q.evaluate(f"(()=>{{const s=document.querySelector('svg'),P=s.id.replace(/svg$/,''),M=s.getScreenCTM().inverse();return {{order:[...s.querySelectorAll('[id$=\"-w\"]')].map(e=>e.id.slice(P.length,-2)),box:{json.dumps(list(ID.values()))}.filter(id=>document.getElementById(P+id+'-s')&&!document.getElementById(P+id+'-s').closest('[id$=\"-w\"]')===false).map(id=>{{const r=document.getElementById(P+id+'-s').getBoundingClientRect(),a=new DOMPoint(r.x,r.y).matrixTransform(M),c=new DOMPoint(r.right,r.bottom).matrixTransform(M);return [a.x,a.y,c.x,c.y]}})}}}})()")
            await q.close(); return r
        rj=await probe(js,'js',1.9); rc=await probe(css,'css',1.9)
        check('JS export draws in the rig\'s order', [NM.get(i) for i in rj['order']]==['Leaf','Stalk','Stalk 2','Bloom','Stalk 3','Leaf 2'], [NM.get(i) for i in rj['order']])
        check('JS export matches the editor', len(rj['box'])==len(ed) and all(abs(a-c)<0.6 for x,y in zip(rj['box'],ed) for a,c in zip(x,y)), (rj['box'][:2],ed[:2]))
        check('CSS export matches the JS export', rc['order']==rj['order'] and all(abs(a-c)<0.8 for x,y in zip(rj['box'],rc['box']) for a,c in zip(x,y)), (rj['box'][:2],rc['box'][:2]))
        R['errors']=errs; check('no page errors', not errs, errs)
        print(json.dumps(R,indent=1)); print('FAILS',F); await b.close()
asyncio.run(main())
