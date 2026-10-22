import asyncio, sys, json, os
from playwright.async_api import async_playwright
OUT=os.environ.get('CIN_OUT','/tmp/svgcinema-shots/'); os.makedirs(OUT, exist_ok=True)
# Size (every shape and image, grows around the origin), animated dash pattern, and Mask mode
# (opacity / brightness): editor, inspector, JS export and CSS export.
PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAEklEQVR4nGP4z8DwHxkzkC4AADxAE/3RhrMJAAAAAElFTkSuQmCC'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page()
        await pg.set_viewport_size({'width':1440,'height':900}); pg.set_default_timeout(5000)
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto((sys.argv[1] if len(sys.argv)>1 else 'http://localhost:5199/'), wait_until='domcontentloaded'); await pg.wait_for_timeout(2500)
        await pg.evaluate("async()=>{ window.st=await import('/src/core/state.ts'); window.hi=await import('/src/core/history.ts'); window.C=await import('/src/core/constants.ts'); window.bx=await import('/src/export/build.ts'); window.am=await import('/src/ui/animate-menu.ts'); window.as=await import('/src/io/assets.ts'); }")
        ev=lambda js, a=None: pg.evaluate(js, a); R={}; F=[]
        def check(n,c,i=None):
            R[n]=('ok' if c else 'FAIL')+('' if i is None else f' {i}')
            if not c: F.append(n)
        L=lambda name: f"st.doc.layers.find(l=>l.name==={json.dumps(name)})"
        attr=lambda name, a: ev(f"document.getElementById('e-'+{L(name)}.id+'-s').getAttribute('{a}')")
        sel=lambda name: ev(f"(()=>{{hi.select({L(name)}.id); hi.commit({{insp:true}})}})()")

        # ---- Size: the sample's Mist grows as it drifts
        await ev("hi.setTime(0)"); await pg.wait_for_timeout(100)
        check('Mist starts at its base size', await attr('Mist','rx')=='120', await attr('Mist','rx'))
        await ev("hi.setTime(3)"); await pg.wait_for_timeout(100)
        check('Mist ends at the keyed size (330 wide)', await attr('Mist','rx')=='165' and await attr('Mist','ry')=='20', [await attr('Mist','rx'), await attr('Mist','ry')])
        check('it grows around its origin (centre stays)', await attr('Mist','cx')=='120', await attr('Mist','cx'))
        await sel('Mist')
        check('the ellipse has a Size row with ◆ (animated) and no Radius row',
              await ev("!!document.querySelector('#insp [data-kb=\"sz\"].has') && ![...document.querySelectorAll('#insp .rl')].some(e=>e.textContent==='Radius')"))
        check('the Size fields show the value at the playhead', await ev("document.querySelector('[data-f=\"sz:0\"]').value")=='330')

        # a rectangle: typing W in the inspector resizes it around its origin (Wipe's origin is its left edge)
        await ev("hi.setTime(0)"); await sel('Wipe')
        await pg.fill('[data-f="sz:0"]', '300'); await pg.press('[data-f="sz:0"]', 'Enter'); await pg.wait_for_timeout(150)
        g=await ev(f"(()=>{{const G={L('Wipe')}.geo;return [G.x,G.w]}})()")
        check('typing W resizes the rectangle from its origin (left edge stays)', g==[200,300], g)
        await ev("document.querySelector('#insp [data-kb=\"sz\"]').click()"); await pg.wait_for_timeout(100)
        check('◆ on Size adds a Size track', await ev(f"!!({L('Wipe')}.t.sz && {L('Wipe')}.t.sz.length===1)"))
        await ev("hi.undo()"); await ev("hi.undo()")

        # a path: Size scales its nodes; a polygon keeps its settings when the proportions stay
        await sel('Comet trail')
        w0=await ev(f"C.valueAt({L('Comet trail')},'sz',0)")
        await pg.fill('[data-f="sz:0"]', str(round(w0[0]*2,3))); await pg.press('[data-f="sz:0"]', 'Enter'); await pg.wait_for_timeout(150)
        w1=await ev(f"C.valueAt({L('Comet trail')},'sz',0)")
        check('a path resizes to the typed width', abs(w1[0]-w0[0]*2)<0.05 and abs(w1[1]-w0[1])<0.05, [w0,w1])
        await ev("hi.undo()")

        # ---- Dash pattern: the Comet trail's dashes stretch
        await ev("hi.setTime(0)"); await sel('Comet trail'); await pg.wait_for_timeout(100)
        check('the Dashes field shows the pattern at the playhead', await ev("document.getElementById('x-dash').value")=='1, 11')
        check('Dashes has a ◆ that shows it is animated', await ev("!!document.querySelector('#insp [data-kb=\"da\"].has')"))
        await ev("hi.setTime(1.5)"); await pg.wait_for_timeout(100)
        check('the dash pattern blends to the middle key', await attr('Comet trail','stroke-dasharray')=='5 7', await attr('Comet trail','stroke-dasharray'))
        # typing a pattern on a layer without a dash track sets it statically
        await ev("hi.setTime(0)"); await sel('Horizon')
        await pg.fill('#x-dash', '4 2'); await pg.press('#x-dash', 'Enter'); await pg.wait_for_timeout(150)
        check('typing a pattern sets the static dashes', await ev(f"{L('Horizon')}.extra['stroke-dasharray']")=='4, 2')
        await ev("hi.undo()")
        names=await ev("am.ANIM_GROUPS.flat().map(x=>x[0])")
        check('the Animate menu offers Size and Dash pattern', 'sz' in names and 'da' in names)

        # ---- Mask mode: the Signature masks by brightness
        check('the Signature mask is a luminance mask', await ev(f"document.getElementById('e-'+{L('Signature')}.id+'-mask').getAttribute('mask-type')")=='luminance')
        await sel('Signature')
        check('the mask group shows Mask by = Brightness', await ev("document.getElementById('ly-mm') && document.getElementById('ly-mm').value")=='lum')
        await pg.select_option('#ly-mm', ''); await pg.wait_for_timeout(150)
        check('switching to Opacity makes an alpha mask', await ev(f"document.getElementById('e-'+{L('Signature')}.id+'-mask').getAttribute('mask-type')")=='alpha' and await ev(f"{L('Signature')}.mm===undefined"))
        await ev("hi.undo()")
        await sel('Hills')
        check('a clipping group has no Mask mode', await ev("!document.getElementById('ly-mm')"))

        # ---- an image with an animated size (for the exports)
        await ev(f"""(()=>{{const a=as.addAsset({{kind:'image',name:'dot',mime:'image/png',data:{json.dumps(PNG)},w:4,h:4,size:80}});
          const l=st.mkLayer('image','Dot',{{x:10,y:10,w:40,h:40,asset:a.id}},C.NOFILL); l.o=[10,10]; l.t.sz=[[0,[40,40],'linear'],[3,[100,60],'linear']];
          st.doc.layers.push(l); hi.commit({{insp:true}})}})()""")

        # ---- JS export plays all three
        async def exported(mode, t):
            code=await ev(f"(()=>{{st.doc.ex.mode='{mode}'; st.doc.ex.trigger='load'; st.doc.ex.prefix='cin'; st.doc.ex.ids='gen'; return bx.buildExport(null).code}})()")
            q=await b.new_page(); await q.set_content('<body style="margin:0">'+code+'</body>'); await q.wait_for_timeout(300)
            await q.evaluate("""t=>{const s=document.querySelector('svg'); if(s.player){s.player.pause();s.player.seekTo(t*1000);}
              document.getAnimations().forEach(a=>{a.pause();a.currentTime=t*1000;});
              if(s.pauseAnimations){s.pauseAnimations();s.setCurrentTime(t);}}""", t)
            await q.wait_for_timeout(100)
            return q
        ids=await ev("({mist:'cin-'+"+L('Mist')+".id+'-s', trail:'cin-'+"+L('Comet trail')+".id+'-s', dot:'cin-'+"+L('Dot')+".id+'-s', sig:'cin-'+"+L('Signature')+".id+'-mask'})")
        q=await exported('js', 2.99)
        r=await q.evaluate("i=>[document.getElementById(i.mist).getAttribute('rx'), document.getElementById(i.dot).getBBox().width, document.getElementById(i.sig).getAttribute('mask-type')]", ids)
        check('JS export: the ellipse and the image reach their keyed sizes; the mask is by brightness', abs(float(r[0])-165)<0.5 and abs(r[1]-100)<0.5 and r[2]=='luminance', r)
        await q.evaluate("()=>{const s=document.querySelector('svg');s.player.seekTo(1500)}"); await q.wait_for_timeout(50)
        r=await q.evaluate("i=>document.getElementById(i.trail).getAttribute('stroke-dasharray')", ids)
        check('JS export: the dash pattern animates', r=='5 7', r); await q.close()
        q=await exported('css', 2.99)
        r=await q.evaluate("i=>{const e=document.getElementById(i.mist),c=getComputedStyle(e);return [c.rx, Math.round(document.getElementById(i.dot).getBBox().width), Math.round(document.getElementById(i.dot).getBoundingClientRect().width)]}", ids)
        check('CSS export: the ellipse and the image reach their keyed sizes', abs(float(r[0][:-2])-165)<0.5 and r[2]>=95, r)
        await q.evaluate("()=>document.getAnimations().forEach(a=>a.currentTime=1500)"); await q.wait_for_timeout(50)
        r=await q.evaluate("i=>getComputedStyle(document.getElementById(i.trail)).strokeDasharray", ids)
        check('CSS export: the dash pattern animates', r.replace('px','').replace(',','').split()[:2]==['5','7'], r)
        await q.close()
        await pg.screenshot(path=OUT+'size-dash-mask.png')
        R['errors']=errs; print(json.dumps(R,indent=1)); print('FAILS',F+(['errors'] if errs else []))
        await b.close()
asyncio.run(main())
