"""Real rail-view/overview UI clicks. RAF is paused; screenshots manually render the actual scene."""
import base64, json, os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

OUT=Path(os.getenv('RAIL_FOCUS_OUT','/workspace/shared/shibuya-artifacts/rail-focus'))
OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[]
def button(root,name):return root.get_by_role('button',name=name,exact=True)
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1500,'height':1000})
    page.set_default_timeout(120000)
    # Suppress only repeated rendering. React, controls and real UI handlers still execute.
    page.add_init_script("const raf=window.requestAnimationFrame.bind(window);window.__exportPause=true;window.requestAnimationFrame=cb=>raf(t=>{if(!(window.__exportPause&&cb.name==='animate'))cb(t)});")
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(os.getenv('PLAYTEST_URL','http://127.0.0.1:5173'))
    fixture=page.evaluate('''async()=>{
      const e=await import('/src/sim/engine.ts'),p=await import('/src/persistence.ts');
      let s=e.createGame('沿線フォーカス検証');s.cash=1000000000;s.listed=true;s.reputation=80;
      for(const id of ['center-01','miyashita-01'])s=e.applyAction(s,{type:'buyProperty',lotId:id});
      s.settings.quality='medium';s.week=10;
      s.railProjects={projects:['center','miyashita'].map(districtId=>({districtId,choiceId:'commerce',startWeek:1,completeWeek:5}))};
      return p.createEnvelope(s);
    }''')
    path=OUT/'fixture.json';path.write_text(json.dumps(fixture,ensure_ascii=False))
    page.locator('input[type=file]').set_input_files(str(path))
    page.wait_for_function("window.__cityScene?.getObjectByName('Station_joint_development')?.userData.projects?.length===2")
    def saved():return page.evaluate("async()=> (await import('/src/persistence.ts')).loadGame()")
    initial=saved()
    expected=page.evaluate("async(s)=>(await import('/src/sim/engine.ts')).applyAction(s,{type:'settings',changes:{quality:'low'}})",initial)
    def verify_camera(district):
        page.wait_for_function('''async(id)=>{
          const c=window.__cityCamera;if(!c)return false;
          const v=(await import('/src/city/RailProjectVisuals.ts')).RAIL_PROJECT_VIEWPOINTS[id];
          const direction=c.getWorldDirection(c.position.clone()),expected=c.position.clone().set(...v.target).sub(c.position).normalize();
          return c.position.toArray().every((x,i)=>Math.abs(x-v.position[i])<.001)&&direction.distanceTo(expected)<.001;
        }''',arg=district)
        return page.evaluate("()=>({position:window.__cityCamera.position.toArray(),direction:window.__cityCamera.getWorldDirection(window.__cityCamera.position.clone()).toArray(),fov:window.__cityCamera.fov})")
    def capture(name):
        page.evaluate('document.fonts.ready')
        data=page.evaluate("()=>{const r=window.__cityRenderer;r.render(window.__cityScene,window.__cityCamera);return r.domElement.toDataURL('image/png').split(',')[1]}")
        (OUT/name).write_bytes(base64.b64decode(data))
    def save_current():
        button(page,'設定・保存').click();dialog=page.get_by_role('dialog',name='設定と会社データ')
        button(dialog,'今すぐ保存する').click();expect(page.get_by_role('alert')).to_contain_text('保存しました')
        button(dialog,'閉じる').click();return saved()
    def overview():
        button(page,'街全体に戻る').click()
        page.wait_for_function("()=>window.__cityCamera?.position.toArray().every((x,i)=>Math.abs(x-[-290,255,325][i])<.001)")
    views={}
    for district,label in [('center','センター街'),('miyashita','宮下・東口')]:
        button(page,'街区開発').click()
        section=page.get_by_role('region',name=label+'の駅周辺共同開発')
        button(section,'沿線の様子を見る').click()
        views[district]=verify_camera(district)
        capture('clicked-'+district+'.png')
        checks.append(district+' real view button sets exported camera position and target direction')
        if district=='miyashita':
            scene_id=page.evaluate('window.__cityScene.uuid')
            button(page,'設定・保存').click();dialog=page.get_by_role('dialog',name='設定と会社データ')
            dialog.get_by_label('3D描画').select_option('low')
            page.wait_for_function('(id)=>window.__cityScene?.uuid!==id',arg=scene_id)
            button(dialog,'閉じる').click()
            verify_camera(district)
            checks.append('quality recreation preserves the selected rail endpoint')
        overview()
        checks.append(district+' overview button restores original camera')
    capture('overview-restored.png')
    final=save_current()
    assert final['settings']['quality']=='low'
    assert expected==final,'Actual saved state differs from exactly one quality-settings action'
    checks.append('saving actual UI state proves all economic data unchanged; quality alone changed')
    assert not errors,errors
    report={'passed':checks,'viewpoints':views,'errors':errors,'rendering':'Actual scene, RAF suppressed, manual renders for screenshots; no image postprocessing.'}
    (OUT/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False,indent=2))
    browser.close()
