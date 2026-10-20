import asyncio, sys, json
from playwright.async_api import async_playwright
import os
OUT=os.environ.get('KL_OUT','/tmp/keyline-shots/'); os.makedirs(OUT, exist_ok=True)
URL=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:5199/'); SHOT=(OUT+'tools')
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page()
        await pg.set_viewport_size({'width':1440,'height':1000}); pg.set_default_timeout(5000)
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)+' @ '+(e.stack or '')[:600]))
        await pg.goto(URL, wait_until='domcontentloaded'); await pg.wait_for_timeout(2500)
        await pg.evaluate("""async()=>{ window.st=await import('/src/core/state.ts'); window.hi=await import('/src/core/history.ts');
          window.scr=(x,y)=>{const m=document.getElementById('content').getScreenCTM(); const q=new DOMPoint(x,y).matrixTransform(m); return [q.x,q.y]}; }""")
        R={}; fails=[]
        def check(name, cond, info=None):
            R[name]=('ok' if cond else 'FAIL') + ('' if info is None else f' {info}')
            if not cond: fails.append(name)
        async def scr(x,y): return await pg.evaluate(f'scr({x},{y})')
        async def click(x,y,mods=None):
            X,Y=await scr(x,y)
            if mods: await pg.keyboard.down(mods)
            await pg.mouse.move(X,Y); await pg.mouse.down(); await pg.mouse.up()
            if mods: await pg.keyboard.up(mods)
            await pg.wait_for_timeout(40)
        async def drag(x0,y0,x1,y1,mods=None,steps=6,between=None):
            X0,Y0=await scr(x0,y0); X1,Y1=await scr(x1,y1)
            await pg.mouse.move(X0,Y0); await pg.mouse.down()
            if mods: await pg.keyboard.down(mods)
            await pg.mouse.move((X0+X1)/2,(Y0+Y1)/2,steps=steps)
            if between: await between()
            await pg.mouse.move(X1,Y1,steps=steps)
            await pg.mouse.up()
            if mods: await pg.keyboard.up(mods)
            await pg.wait_for_timeout(40)
        ev=lambda js: pg.evaluate(js)
        sel=lambda: ev("(()=>{const l=st.selLayer(); return l?{id:l.id,name:l.name,type:l.type,d:l.b.d,geo:l.geo}:null})()")
        nlayers=lambda: ev("st.doc.layers.length")
        tool=lambda: ev("st.S.tool")
        # start from an empty document
        await ev("(()=>{st.setDoc(st.blankDoc(640,400)); hi.afterSwap();})()"); await pg.wait_for_timeout(200)

        # ---- toolbar ----
        grp=await ev("[...document.querySelectorAll('#tools .grp')].map(b=>b.dataset.group+':'+b.dataset.tool)")
        check('toolbar has pen and shapes groups', grp==['pen:pen','shapes:rect'], grp)
        btn=await pg.query_selector('#tools .grp[data-group="pen"]'); bb=await btn.bounding_box()
        await pg.mouse.move(bb['x']+17,bb['y']+17); await pg.mouse.down(); await pg.wait_for_timeout(450)
        items=await ev("[...document.querySelectorAll('#toolfly .tf-item')].map(x=>x.querySelector('.nm').textContent+'|'+x.querySelector('kbd').textContent+'|'+x.getAttribute('aria-checked'))")
        check('hold opens the pen flyout', items==['Pen tool|P|true','Add node tool|+|false','Remove node tool|-|false','Convert point tool|⇧C|false','Pencil tool|N|false'], items)
        await pg.screenshot(path=SHOT+'-penfly.png', clip={'x':0,'y':40,'width':420,'height':420})
        it=await (await pg.query_selector('#toolfly [data-tool="pencil"]')).bounding_box()
        await pg.mouse.move(it['x']+30,it['y']+10,steps=4); await pg.mouse.up(); await pg.wait_for_timeout(100)
        check('release over an item picks it', await tool()=='pencil')
        check('group button shows the picked tool', await ev("document.querySelector('#tools .grp[data-group=\"pen\"]').dataset.tool")=='pencil')
        sb=await (await pg.query_selector('#tools .grp[data-group="shapes"]')).bounding_box()
        await pg.mouse.click(sb['x']+17,sb['y']+17,button='right'); await pg.wait_for_timeout(100)
        items=await ev("[...document.querySelectorAll('#toolfly .tf-item')].map(x=>x.querySelector('.nm').textContent+'|'+x.querySelector('kbd').textContent)")
        check('right-click opens the shapes flyout', items==['Ellipse|O','Rectangle|M','Polygon|','Star|','Line|L'], items)
        await pg.screenshot(path=SHOT+'-shapefly.png', clip={'x':0,'y':40,'width':420,'height':480})
        await pg.click('#toolfly [data-tool="star"]'); await pg.wait_for_timeout(80)
        check('click an item picks it', await tool()=='star' and await ev("document.getElementById('toolfly').hidden"))
        keys={}
        for k,t in [('p','pen'),('+','addnode'),('-','delnode'),('n','pencil'),('o','ellipse'),('m','rect'),('l','line'),('h','hand'),('v','select'),('a','node'),('t','text'),('b','bone')]:
            await pg.keyboard.press(k); keys[k]=await tool()
        check('shortcuts', all(keys[k]==t for k,t in [('p','pen'),('+','addnode'),('-','delnode'),('n','pencil'),('o','ellipse'),('m','rect'),('l','line'),('h','hand'),('v','select'),('a','node'),('t','text'),('b','bone')]), keys)

        # ---- pen: closed path with a corner, a curve, close on first point ----
        await pg.keyboard.press('p')
        await click(100,100); await click(200,100); await drag(200,200,240,200); await click(100,100)
        L=await sel()
        check('pen closes on the first point', L and L['type']=='path' and L['d'][0]['c'] and len(L['d'][0]['n'])==3, L and (L['name'], L['d'][0]['c'], len(L['d'][0]['n'])))
        n2=L['d'][0]['n'][2]
        check('drag makes a smooth point (mirrored handles)', abs(n2[4]-240)<1 and abs(n2[2]-160)<1, n2)
        check('pen stays active after a path', await tool()=='pen')
        closedId=L['id']
        # ---- pen: open path, Enter ends; Shift 45°; Backspace ----
        await ev("hi.select(null)")
        await click(100,300); await click(180,320,'Shift'); await click(260,330); await click(300,300)
        await pg.keyboard.press('Backspace'); await pg.keyboard.press('Enter')
        L=await sel(); n=L['d'][0]['n']
        check('open path ends with Enter, Backspace dropped a point', (not L['d'][0]['c']) and len(n)==3 and L['name'].startswith('Path'), (L['name'],len(n)))
        check('Shift snaps the segment to 45°', abs(abs(n[1][1]-n[0][1]) - abs(n[1][0]-n[0][0]))<0.6 or abs(n[1][1]-n[0][1])<0.6, n[1][:2])
        openId=L['id']
        # ---- Alt breaks the handle ----
        await ev("hi.select(null)")
        await click(400,100)
        X0,Y0=await scr(500,100); X1,Y1=await scr(540,140); X2,Y2=await scr(560,100)
        await pg.mouse.move(X0,Y0); await pg.mouse.down(); await pg.mouse.move(X1,Y1,steps=5)
        await pg.keyboard.down('Alt'); await pg.mouse.move(X2,Y2,steps=5); await pg.keyboard.up('Alt'); await pg.mouse.up()
        q=await ev("st.S.pen.nodes[1]")
        check('Alt breaks the handle (cusp)', abs(q[4]-560)<1 and abs(q[2]-460)<1.5 and abs(q[3]-60)<1.5, q)
        # ---- Space moves the point while placing ----
        X0,Y0=await scr(600,250); X1,Y1=await scr(620,270); X2,Y2=await scr(640,300)
        await pg.mouse.move(X0,Y0); await pg.mouse.down(); await pg.mouse.move(X1,Y1,steps=4)
        await pg.keyboard.down(' '); await pg.mouse.move(X2,Y2,steps=4); await pg.keyboard.up(' '); await pg.mouse.up()
        q=await ev("st.S.pen.nodes[2]"); playing=await ev("st.S.playing")
        check('Space moves the point while dragging, without playing', abs(q[0]-620)<1.5 and abs(q[1]-280)<1.5 and not playing, (q[:2],playing))
        # click on last point drops its out-handle
        await click(q[0],q[1]); q2=await ev("st.S.pen.nodes[2]")
        check('click the last point drops its handle', q2[4]==q2[0] and q2[5]==q2[1], q2)
        await pg.keyboard.press('Escape')
        # ---- auto add / delete on the selected path ----
        await ev(f"hi.select('{closedId}')")
        before=len((await sel())['d'][0]['n'])
        X,Y=await scr(150,100); await pg.mouse.move(X,Y); await pg.wait_for_timeout(60)
        hint=await ev("st.S.penHint && st.S.penHint.kind"); cur=await ev("document.getElementById('wrap').style.cursor.length>0")
        await pg.mouse.down(); await pg.mouse.up(); await pg.wait_for_timeout(60)
        after=len((await sel())['d'][0]['n'])
        check('pen hover on a segment shows add, click adds a node', hint=='add' and cur and after==before+1, (hint,before,after))
        newn=(await sel())['d'][0]['n'][1]
        check('node added on a straight segment is a corner on the line', abs(newn[1]-100)<0.6 and newn[2]==newn[0], newn)
        X,Y=await scr(newn[0],newn[1]); await pg.mouse.move(X,Y); await pg.wait_for_timeout(60)
        hint=await ev("st.S.penHint && st.S.penHint.kind"); await pg.mouse.down(); await pg.mouse.up()
        check('pen hover on an anchor shows delete, click removes it', hint=='del' and len((await sel())['d'][0]['n'])==before, hint)
        # Alt+click converts a smooth point to a corner
        sm=(await sel())['d'][0]['n'][2]
        await click(sm[0],sm[1],'Alt'); c=(await sel())['d'][0]['n'][2]
        check('Alt+click converts a smooth point to a corner', c[2]==c[0] and c[4]==c[0], c)
        # ---- continue an open path from its end ----
        await ev(f"hi.select('{openId}')")
        end=(await sel())['d'][0]['n'][-1]; cnt=len((await sel())['d'][0]['n'])
        X,Y=await scr(end[0],end[1]); await pg.mouse.move(X,Y); await pg.wait_for_timeout(60)
        curk=await ev("document.getElementById('wrap').style.cursor.includes('M15.5%2020.5l5-5')")
        await pg.mouse.down(); await pg.mouse.up(); await click(320,380); await pg.keyboard.press('Enter')
        L=await sel(); nl=await nlayers()
        check('click an open end to continue the same path', L['id']==openId and len(L['d'][0]['n'])==cnt+1 and curk, (len(L['d'][0]['n']),cnt,curk))
        # ---- convert point tool ----
        await pg.keyboard.press('Shift+C'); check('Shift+C selects the convert point tool', await tool()=='convert')
        await ev(f"hi.select('{closedId}')")
        q=(await sel())['d'][0]['n'][2]
        check('(setup) point is a corner', q[2]==q[0] and q[4]==q[0], q)
        await drag(q[0],q[1],q[0]+30,q[1]+10); q=(await sel())['d'][0]['n'][2]
        check('drag a corner pulls out smooth handles', abs(q[4]-q[0]-30)<1 and abs(q[2]-(q[0]-30))<1 and abs(q[3]-(q[1]-10))<1, q)
        await drag(q[4],q[5],q[4]+5,q[5]+40); q2=(await sel())['d'][0]['n'][2]
        check('drag a handle moves it alone (cusp)', abs(q2[5]-(q[5]+40))<1 and q2[2]==q[2] and q2[3]==q[3], (q,q2))
        await click(q2[0],q2[1]); q3=(await sel())['d'][0]['n'][2]
        check('click a smooth point makes it a corner', q3[2]==q3[0] and q3[4]==q3[0] and q3[5]==q3[1], q3)
        n=(await sel())['d'][0]['n']; a,b=n[0],n[1]
        mx,my=(a[0]+b[0])/2,(a[1]+b[1])/2
        await drag(mx,my,mx,my+30); n2=(await sel())['d'][0]['n']
        check('drag a segment reshapes it (anchors stay)', n2[0][:2]==a[:2] and n2[1][:2]==b[:2] and (n2[0][5]!=a[5] or n2[1][3]!=b[3]), (n2[0],n2[1]))
        await pg.keyboard.press('p')
        h=(await sel())['d'][0]['n'][0]
        X,Y=await scr(h[4],h[5]); await pg.mouse.move(X,Y); await pg.keyboard.down('Alt'); await pg.wait_for_timeout(60)
        curc=await ev("document.getElementById('wrap').style.cursor.includes('M15%2020l3-4%203%204')")
        await pg.mouse.down(); X2,Y2=await scr(h[4]+15,h[5]-20); await pg.mouse.move(X2,Y2,steps=4); await pg.mouse.up(); await pg.keyboard.up('Alt')
        h2=(await sel())['d'][0]['n'][0]
        check('pen + Alt on a handle moves it alone', curc and abs(h2[4]-(h[4]+15))<1 and h2[2]==h[2] and h2[3]==h[3] and await ev("!st.S.pen"), (curc,h,h2))
        # ---- add / remove node tools on a rectangle ----
        await pg.keyboard.press('m'); await drag(400,250,500,330)
        rect=await sel(); await pg.keyboard.press('+')
        await click(450,250); L=await sel()
        check('add-node tool on a rectangle converts it and adds a node', L['type']=='path' and len(L['d'][0]['n'])==5, (L['type'], L['d'] and len(L['d'][0]['n'])))
        await pg.keyboard.press('-'); a=L['d'][0]['n'][0]; await click(a[0],a[1]); L=await sel()
        check('remove-node tool removes the clicked node', len(L['d'][0]['n'])==4)
        # ---- pencil ----
        await pg.keyboard.press('n')
        pts=[(80+i*6, 200+(30 if (i//4)%2 else -30)*((i%4)/4)) for i in range(40)]
        X,Y=await scr(*pts[0]); await pg.mouse.move(X,Y); await pg.mouse.down()
        for q in pts[1:]:
            X,Y=await scr(*q); await pg.mouse.move(X,Y)
        await pg.mouse.up(); await pg.wait_for_timeout(60); L=await sel()
        check('pencil makes a simplified smooth open stroke', L['name'].startswith('Stroke') and 3<=len(L['d'][0]['n'])<40 and not L['d'][0]['c'], (L['name'], len(L['d'][0]['n'])))
        circ=[(300+60*__import__('math').cos(t/20*6.283), 220+60*__import__('math').sin(t/20*6.283)) for t in range(21)]
        X,Y=await scr(*circ[0]); await pg.mouse.move(X,Y); await pg.mouse.down()
        for q in circ[1:]:
            X,Y=await scr(*q); await pg.mouse.move(X,Y,steps=2)
        await pg.mouse.up(); await pg.wait_for_timeout(60); L=await sel()
        check('pencil closes a loop ended near its start', L['d'][0]['c'] and L['name'].startswith('Shape'), (L['name'],L['d'][0]['c']))
        # ---- shapes ----
        await pg.keyboard.press('l'); await drag(100,350,200,362,'Shift'); L=await sel(); n=L['d'][0]['n']
        check('line tool, Shift snaps to 45°', L['name'].startswith('Line') and len(n)==2 and abs(n[1][1]-350)<0.6, n)
        await ev("st.S.toolGroup.shapes='polygon'"); await ev("hi.setTool('polygon')")
        async def up2(): await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('ArrowUp')
        await drag(520,120,560,120,between=up2); L=await sel()
        check('polygon: ↑ while dragging adds sides', L['name'].startswith('Polygon') and len(L['d'][0]['n'])==8, len(L['d'][0]['n']))
        await ev("hi.setTool('star')")
        async def dn(): await pg.keyboard.press('ArrowDown')
        await drag(520,300,560,300,between=dn); L=await sel()
        check('star: ↓ while dragging removes a point', L['name'].startswith('Star') and len(L['d'][0]['n'])==8, len(L['d'][0]['n']))
        await pg.keyboard.press('o'); await drag(300,300,340,320,'Alt'); L=await sel(); g=L['geo']
        check('Alt draws an ellipse from its centre', abs(g['cx']-300)<0.6 and abs(g['cy']-300)<0.6 and abs(g['rx']-40)<0.6, g)
        check('shape tools stay active', await tool()=='ellipse')
        # ---- hand / pan / zoom ----
        t0=await ev("getComputedStyle(document.getElementById('artboard')).transform")
        await pg.keyboard.press('h'); await drag(320,200,360,230); p1=await ev("[st.S.pan.x,st.S.pan.y]")
        check('hand tool pans', abs(p1[0])>10 and abs(p1[1])>10, p1)
        await pg.keyboard.press('p'); n0=await nlayers()
        await pg.keyboard.down(' '); await drag(320,200,300,180); await pg.keyboard.up(' ')
        p2=await ev("[st.S.pan.x,st.S.pan.y]"); pl=await ev("st.S.playing")
        check('hold Space to pan from the pen tool (no point added, no playback)', p2!=p1 and await ev("!st.S.pen") and not pl and await nlayers()==n0, (p2,pl))
        await pg.keyboard.press(' '); await pg.wait_for_timeout(300); pl=await ev("st.S.playing"); await pg.keyboard.press(' ')
        check('tap Space still plays', pl)
        z0=await ev("st.S.scale"); X,Y=await scr(100,100)
        await pg.mouse.move(X,Y); await pg.keyboard.down('Control'); await pg.mouse.wheel(0,-200); await pg.keyboard.up('Control'); await pg.wait_for_timeout(80)
        z1=await ev("st.S.scale"); X2,Y2=await scr(100,100)
        check('Ctrl+wheel zooms at the pointer', z1>z0*1.2 and abs(X2-X)<2 and abs(Y2-Y)<2, (z0,z1,X2-X,Y2-Y))
        pa=await ev("[st.S.pan.x,st.S.pan.y]"); await pg.mouse.wheel(0,120); await pg.wait_for_timeout(60); pb=await ev("[st.S.pan.x,st.S.pan.y]")
        check('wheel scrolls the work area', abs((pa[1]-pb[1])-120)<1, (pa,pb))
        hb=await (await pg.query_selector('#tools [data-tool="hand"]')).bounding_box()
        await pg.mouse.dblclick(hb['x']+17,hb['y']+17); await pg.wait_for_timeout(80)
        check('double-click the hand fits the view', await ev("st.S.pan.x===0&&st.S.pan.y===0&&st.S.zoom===1"))
        # undo the last shape
        n0=await nlayers(); await ev("document.activeElement.blur()"); await pg.keyboard.press('Control+z'); n1=await nlayers()
        check('undo removes the last drawn shape', n1==n0-1, (n0,n1))
        await pg.keyboard.press('v')
        await pg.screenshot(path=SHOT+'-canvas.png')
        R['errors']=errs
        print(json.dumps(R,indent=1)); print('FAILS', fails)
        await pg.context.browser.close()
asyncio.run(main())
