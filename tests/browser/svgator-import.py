import asyncio, sys, json, os
from playwright.async_api import async_playwright
OUT=os.environ.get('CIN_OUT','/tmp/svgcinema-shots/'); os.makedirs(OUT, exist_ok=True)
FIX=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','fixtures','svg')
# SVGator exports (JS player or CSS) open with their animation as keyframes. The exported result moves exactly
# like SVGator's own player: element boxes at several times are compared with boxes recorded from it
# (tests/fixtures/svg/svgator-reference.json).
REF=json.load(open(os.path.join(FIX,'svgator-reference.json')))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page()
        await pg.set_viewport_size({'width':1440,'height':900}); pg.set_default_timeout(8000)
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto((sys.argv[1] if len(sys.argv)>1 else 'http://localhost:5199/'), wait_until='domcontentloaded'); await pg.wait_for_timeout(2500)
        await pg.evaluate("async()=>{ window.st=await import('/src/core/state.ts'); window.hi=await import('/src/core/history.ts'); window.bx=await import('/src/export/build.ts'); }")
        ev=lambda js, a=None: pg.evaluate(js, a); R={}; F=[]
        def check(n,c,i=None):
            R[n]=('ok' if c else 'FAIL')+('' if i is None else f' {i}')
            if not c: F.append(n)
        # the CSS export is checked against the JS export's positions (the same animation)
        for f,rk in [('svgator-test1-js.svg','svgator-test1-js.svg'),('svgator-test1-css.svg','svgator-test1-js.svg'),('svgator-test2-js-named.svg','svgator-test2-js-named.svg')]:
            await pg.set_input_files('#fProj', os.path.join(FIX,f)); await pg.wait_for_timeout(1500)
            s=await ev("({dur:st.doc.dur,it:st.doc.it,dir:st.doc.dir,fill:st.doc.ex.fill,trig:st.doc.ex.trigger,rep:document.getElementById('mImpRep').hidden})")
            check(f'{f}: playback settings from the file', s['dur']==3 and s['it']==0 and s['dir']=='normal' and s['fill']=='forwards' and s['trig']=='load', s)
            notes=await ev("[...document.querySelectorAll('#irList li')].map(l=>l.textContent)")
            check(f'{f}: the report only mentions the moving anchor', all('anchor point' in n for n in notes), notes)
            await ev("document.getElementById('mImpRep').hidden=true")
            ref=REF[rk]; names=list(ref['0'].keys())
            code=await ev("(()=>{st.doc.ex.prefix='cin';st.doc.ex.mode='js';st.doc.ex.trigger='api';return bx.buildExport(null).code})()")
            ids=await ev(f"{json.dumps(names)}.map(n=>'cin-'+st.doc.layers.find(l=>l.name===n).id+'-s')")
            q=await b.new_page(viewport={'width':600,'height':400})
            await q.set_content('<html><body style="margin:0">'+code+'</body></html>')
            await q.add_style_tag(content='body>svg{width:600px!important;height:400px!important;display:block}')
            await q.wait_for_timeout(300)
            worst=0; where=None
            for t,boxes in ref.items():
                got=await q.evaluate("([t,ids])=>{const P=document.querySelector('svg').player;P.pause();P.seekTo(t*1000);return ids.map(i=>{const r=document.getElementById(i).getBoundingClientRect();return [r.x,r.y,r.width,r.height]})}", [float(t), ids])
                for n,g in zip(names,got):
                    d=max(abs(a-b_) for a,b_ in zip(g, boxes[n]))
                    if d>worst: worst=d; where=(t,n,g,boxes[n])
            check(f'{f}: every animated layer is where SVGator puts it (largest gap {round(worst,2)} px)', worst<1.0, where)
            await q.close()
            # the imported tracks are ordinary, editable tracks
            r=await ev("(()=>{const l=st.doc.layers.find(l=>l.name==='Rectangle 2');hi.select(l.id);hi.commit({insp:true});return Object.keys(l.t).length})()")
            await pg.wait_for_timeout(200)
            check(f'{f}: the animated rectangle shows its tracks in the timeline', r>10 and await ev("document.querySelectorAll('.tl-row, [data-track]').length>5"), r)
            check(f'{f}: Size and Corner radius show as animated', await ev("!!document.querySelector('#insp [data-kb=\"sz\"].has') && !!document.querySelector('#insp [data-kb=\"rad\"].has')"))
        # edit a keyframe value: the fill at 1.5 s becomes green and the export follows
        await ev("hi.setTime(1.5)"); await pg.wait_for_timeout(100)
        await pg.fill('[data-f="fill"]', '#00ff00'); await pg.press('[data-f="fill"]', 'Enter'); await pg.wait_for_timeout(150)
        k=await ev("st.doc.layers.find(l=>l.name==='Rectangle 2').t.fill.find(q=>Math.abs(q[0]-1.5)<1e-6)[1]")
        check('a keyframe of the imported fill can be changed', k=='#00ff00', k)
        await pg.screenshot(path=OUT+'svgator-import.png')
        R['errors']=errs; print(json.dumps(R,indent=1)); print('FAILS',F+(['errors'] if errs else []))
        await b.close()
asyncio.run(main())
