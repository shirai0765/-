"""Synthetic station-development geometry/lifecycle QA; not a campaign balance proof."""
import base64, json, os
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT=Path(os.getenv('RAIL_VISUAL_OUT','/workspace/shared/shibuya-artifacts/rail-visuals'))
OUT.mkdir(parents=True,exist_ok=True)
errors=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1500,'height':1000})
    page.set_default_timeout(120000)
    page.add_init_script("const raf=window.requestAnimationFrame.bind(window);window.__exportPause=false;window.requestAnimationFrame=cb=>raf(t=>{if(!window.__exportPause)cb(t)});")
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(os.getenv('PLAYTEST_URL','http://127.0.0.1:5173'))
    fixture=page.evaluate('''async()=>{
      const e=await import('/src/sim/engine.ts'),p=await import('/src/persistence.ts');
      let s=e.createGame('駅まち建築検証');s.cash=1000000000;s.listed=true;s.reputation=80;
      for(const id of ['center-01','dogenzaka-01','miyashita-01','sakuragaoka-01'])s=e.applyAction(s,{type:'buyProperty',lotId:id});
      s.settings.quality='medium';s.week=10;
      s.railProjects={projects:['center','dogenzaka','miyashita','sakuragaoka'].map((districtId,i)=>({districtId,choiceId:i%2?'rental':'commerce',startWeek:1,completeWeek:i%2?7:5}))};
      window.__railFixture=s;return p.createEnvelope(s);
    }''')
    path=OUT/'fixture.json';path.write_text(json.dumps(fixture,ensure_ascii=False))
    page.locator('input[type=file]').set_input_files(str(path))
    page.wait_for_function("window.__cityScene?.getObjectByName('Station_joint_development')?.userData.projects?.length===4")
    page.evaluate('window.__exportPause=true')
    page.evaluate('document.fonts.ready')
    def capture(name,position,target,fov=56):
        data=page.evaluate('''({position,target,fov})=>{const c=window.__cityCamera,r=window.__cityRenderer;c.position.set(...position);c.fov=fov;c.updateProjectionMatrix();c.lookAt(...target);c.updateMatrixWorld();r.render(window.__cityScene,c);return r.domElement.toDataURL('image/png').split(',')[1]}''',{'position':position,'target':target,'fov':fov})
        (OUT/name).write_bytes(base64.b64decode(data))
    if os.getenv('RAIL_VIEWPOINTS_ONLY')=='1':
        points=page.evaluate("async()=> (await import('/src/city/RailProjectVisuals.ts')).RAIL_PROJECT_VIEWPOINTS")
        for district,view in points.items():capture('focus-'+district+'.png',view['position'],view['target'],36)
        assert not errors,errors
        print(json.dumps({'fov':36,'viewpoints':points,'errors':errors},ensure_ascii=False))
        browser.close()
        raise SystemExit(0)
    capture('station-west-completed.png',[32,16,-1],[62,3,36])
    capture('station-commerce-close.png',[42,6.5,14],[60,2.1,23])
    capture('station-rental-close.png',[43,6.2,34],[59,2,44])
    capture('station-east-completed.png',[107,8,15],[89,2,26])
    result=page.evaluate('''async()=>{
      const {RailProjectVisuals}=await import('/src/city/RailProjectVisuals.ts');
      const s=structuredClone(window.__railFixture),scene=window.__cityScene;
      const actual=scene.getObjectByName('Station_joint_development'),integrated=structuredClone(actual.userData);
      const parent=actual.parent;parent.remove(actual);
      const visual=new RailProjectVisuals(parent);window.__railVisual=visual;
      visual.update(s);const first=visual.group.children[0];visual.update({...s,week:11});
      const unchangedWeekReusesGroup=first===visual.group.children[0];
      let disposedGeometry=0,disposedMaterial=0,disposedTexture=0;
      const gs=new Set(),ms=new Set(),ts=new Set();
      first.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v);}});
      gs.forEach(g=>g.addEventListener('dispose',()=>disposedGeometry++));ms.forEach(m=>m.addEventListener('dispose',()=>disposedMaterial++));ts.forEach(t=>t.addEventListener('dispose',()=>disposedTexture++));
      const suspended={...s,properties:[]};visual.update(suspended);
      const suspension=structuredClone(visual.group.userData),rebuilt=first!==visual.group.children[0];
      visual.update({...s,week:2});const building=structuredClone(visual.group.userData);
      visual.update({...s,railProjects:{projects:[]}});const resetEmpty=visual.group.children.length===0;
      visual.update(s);window.__railFixture=s;
      return {integrated,suspension,building,unchangedWeekReusesGroup,rebuilt,resetEmpty,disposal:{geometries:[disposedGeometry,gs.size],materials:[disposedMaterial,ms.size],textures:[disposedTexture,ts.size]}};
    }''')
    assert result['unchangedWeekReusesGroup'] and result['rebuilt'] and result['resetEmpty'],result
    assert all(a==b and b>0 for a,b in result['disposal'].values()),result
    assert result['integrated']['drawCalls']<=24 and result['integrated']['triangles']<8000,result
    assert result['suspension']['triangles']==result['integrated']['triangles'],result
    page.evaluate("window.__railVisual.update({...window.__railFixture,week:2})")
    capture('station-construction.png',[42,6.5,14],[60,2.1,23])
    page.evaluate("window.__railVisual.update({...window.__railFixture,properties:[]})")
    capture('station-suspended.png',[42,6.5,14],[60,2.1,23])
    assert not errors,errors
    result['errors']=errors
    (OUT/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps(result,ensure_ascii=False,indent=2))
    browser.close()
