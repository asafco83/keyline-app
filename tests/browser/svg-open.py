import asyncio, sys, json, os, io, re
from playwright.async_api import async_playwright
from PIL import Image, ImageChops
OUT=os.environ.get('CIN_OUT','/tmp/svgcinema-shots/'); os.makedirs(OUT, exist_ok=True)
FIX=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','fixtures','svg')
# Opening an SVG as a project (Open…), adding one from Assets, and pasting markup: layers keep their
# hierarchy and names, stay editable, and the result draws like the original.
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page()
        await pg.set_viewport_size({'width':1440,'height':900}); pg.set_default_timeout(8000)
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto((sys.argv[1] if len(sys.argv)>1 else 'http://localhost:5199/'), wait_until='domcontentloaded'); await pg.wait_for_timeout(2500)
        await pg.evaluate("async()=>{ window.st=await import('/src/core/state.ts'); window.hi=await import('/src/core/history.ts'); window.bx=await import('/src/export/build.ts'); window.as=await import('/src/io/assets.ts'); }")
        ev=lambda js, a=None: pg.evaluate(js, a); R={}; F=[]
        def check(n,c,i=None):
            R[n]=('ok' if c else 'FAIL')+('' if i is None else f' {i}')
            if not c: F.append(n)
        names=lambda: ev("st.doc.layers.map(l=>l.name)")
        L=lambda name: f"st.doc.layers.find(l=>l.name==={json.dumps(name)})"

        async def same_as_original(path, label, tol=200):
            src=open(path).read()
            # text is checked on its own (web fonts may not load here): compare the rest
            src=re.sub(r'<script[\s\S]*?</script>','',src)
            src=re.sub(r'<text[\s\S]*?</text>','',src)
            code=await ev("(()=>{const t=st.doc.layers.filter(l=>l.type==='text'&&!l.hid);t.forEach(l=>l.hid=true);st.doc.ex.prefix='cin';st.doc.ex.mode='js';const tg=st.doc.ex.trigger;st.doc.ex.trigger='api';const c=bx.buildExport(null).code;st.doc.ex.trigger=tg;t.forEach(l=>l.hid=false);return c})()")
            shots=[]
            for svg in [src, code]:
                q=await b.new_page(viewport={'width':640,'height':480})
                await q.set_content('<body style="margin:0;background:#fff">'+svg+'</body>')
                await q.add_style_tag(content='*{animation:none!important} body>svg{width:640px!important;height:auto!important;display:block}')
                await q.wait_for_timeout(600)
                shots.append(Image.open(io.BytesIO(await q.screenshot())).convert('RGB')); await q.close()
            d=ImageChops.difference(shots[0],shots[1]).convert('L').point(lambda v:255 if v>48 else 0)
            n=sum(1 for v in d.get_flattened_data() if v) if hasattr(d,'get_flattened_data') else sum(1 for v in d.getdata() if v)
            check(f'{label}: draws like the original', n<=tol, n)
            if n>tol:
                shots[0].save(OUT+'svg-open-orig.png'); shots[1].save(OUT+'svg-open-ours.png')

        # ---- Open… accepts SVG
        check('Open… offers SVG files', '.svg' in (await ev("document.getElementById('fProj').accept")))
        await pg.set_input_files('#fProj', os.path.join(FIX,'generic.svg')); await pg.wait_for_timeout(1200)
        d=await ev("({name:st.doc.name,size:[st.doc.vx,st.doc.vy,st.doc.w,st.doc.h],undo:st.S.undo.length,dirty:!!st.S.dirty,file:st.S.file})")
        check('opens as a project with the SVG title and canvas', d['name']=='Generic test' and d['size']==[0,0,400,300], d)
        check('a fresh, unsaved project', d['undo']==0 and d['dirty'] and not d['file'], d)
        n=await names()
        check('layer names: labels, ids, kinds', all(x in n for x in ['Shapes','Rectangle 1','Clip group','Text 1','Link 1']), n)
        check('the report lists what stayed as it was', await ev("!document.getElementById('mImpRep').hidden && [...document.querySelectorAll('#irList li')].some(l=>/filters/.test(l.textContent))"))
        await pg.click('#mImpRep footer [data-close]'); await pg.wait_for_timeout(100)
        check('the report closes', await ev("document.getElementById('mImpRep').hidden"))
        r=await ev(f"(()=>{{const l={L('Rectangle 1')};return [l.type,l.b.fill,l.b.stk,l.b.sw,l.geo.rx, (st.doc.layers.find(x=>x.id===l.parent)||{{}}).name]}})()")
        check('a stylesheet-styled rectangle is a real rectangle in its group', r==['rect','#e63946','#1d3557',3,8,'Shapes'], r)
        check('a clip path on a shape became a clipping group', await ev("st.doc.layers.some(l=>l.mask==='clip' && st.doc.layers.some(k=>k.parent===l.id && k.maskSrc))"))
        await same_as_original(os.path.join(FIX,'generic.svg'), 'generic SVG', 400)
        # it stays editable: change a fill in the inspector
        await ev(f"(()=>{{hi.select({L('Rectangle 1')}.id); hi.commit({{insp:true}})}})()"); await pg.wait_for_timeout(200)
        await pg.fill('[data-f="fill"]', '#00ff00'); await pg.press('[data-f="fill"]', 'Enter'); await pg.wait_for_timeout(200)
        check('its fill can be changed', await ev(f"{L('Rectangle 1')}.b.fill")=='#00ff00')
        f=await ev(f"document.getElementById('e-'+{L('Rectangle 1')}.id+'-s').getAttribute('fill')")
        check('and the canvas shows it', f=='#00ff00', f)

        # ---- SVGator file with element names
        await pg.set_input_files('#fProj', os.path.join(FIX,'svgator-test2-js-named.svg')); await pg.wait_for_timeout(1500)
        await ev("document.getElementById('mImpRep').hidden=true")
        n=await names()
        check('SVGator names come across', all(x in n for x in ['s1','clip-group','clipping-paths','grouplevel1','grouplevel2','mask-group','masks','Rectangle 2','Path 3']), n)
        check('the project is named after the file\'s project', await ev("st.doc.name")=='animation-test')
        tree=await ev("['grouplevel2','mask-group','Path 3'].map(n=>(st.doc.layers.find(x=>x.id===st.doc.layers.find(l=>l.name===n).parent)||{}).name)")
        check('nesting is kept', tree==['grouplevel1','grouplevel2','mask-group'], tree)
        check('the mask masks by brightness', await ev(f"{L('mask-group')}.mm==='lum'"))
        t=await ev("(()=>{const l=st.doc.layers.find(l=>l.type==='text');return [l.geo.text,l.geo.family,l.geo.size,l.geo.lh]})()")
        check('three lines of text, one editable text in Roboto', t==['Sample Text\nmultiLINE\nsssss','Roboto',25,1], t)
        img=await ev(f"(()=>{{const l={L('s1')};return [l.type, !!st.ASSETS[l.geo.asset]]}})()")
        check('the picture is an image layer with its file in Assets', img==['image',True], img)
        await same_as_original(os.path.join(FIX,'svgator-test2-js-named.svg'), 'SVGator test 2 (first frame)', 400)

        # ---- add an SVG from Assets: same layers, inside a group, project settings unchanged
        await ev("hi.setTime(0)")
        before=await ev("({n:st.doc.layers.length, w:st.doc.w, dur:st.doc.dur})")
        await ev("st.S.pickPlace=false")
        await pg.set_input_files('#fSvg', os.path.join(FIX,'generic.svg')); await pg.wait_for_timeout(800)
        aid=await ev("Object.values(st.ASSETS).find(a=>a.kind==='svg' && a.name==='generic').id")
        check('the SVG is in Assets', bool(aid))
        await ev(f"as.placeAsset(st.ASSETS['{aid}'], null)"); await pg.wait_for_timeout(1200)
        await ev("document.getElementById('mImpRep').hidden=true")
        after=await ev("({n:st.doc.layers.length, w:st.doc.w, dur:st.doc.dur, wrap:(st.doc.layers.find(l=>l.name==='generic')||{}).id})")
        check('placing it adds its layers inside a group named after it', after['wrap'] and after['n']>before['n']+10, after)
        check('the canvas size stays', after['w']==before['w'])
        kids=await ev("st.doc.layers.filter(l=>l.parent===st.doc.layers.find(l=>l.name==='generic').id).map(l=>l.name)")
        check('its top layers sit in that group', 'Shapes' in kids, kids)
        await ev("hi.undo()"); await pg.wait_for_timeout(200)
        check('one undo step removes it', await ev("st.doc.layers.length")==before['n'])

        # ---- paste markup in the Import dialog
        await ev("document.getElementById('mImport').hidden=false; document.getElementById('iReplace').checked=false")
        await pg.fill('#iText', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><g id="Pasted_x20_group"><circle cx="25" cy="25" r="10" fill="#123456"/></g></svg>')
        await pg.click('#iGo'); await pg.wait_for_timeout(600)
        check('pasted markup becomes layers', await ev("st.doc.layers.some(l=>l.name==='Pasted group') && st.doc.layers.some(l=>l.type==='ellipse' && l.b.fill==='#123456')"))
        await pg.screenshot(path=OUT+'svg-open.png')
        R['errors']=errs; print(json.dumps(R,indent=1)); print('FAILS',F+(['errors'] if errs else []))
        await b.close()
asyncio.run(main())
