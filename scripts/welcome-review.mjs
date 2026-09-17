import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/presentation-browser/node_modules/playwright/index.mjs');
const base = process.env.PRESENTATION_URL || 'http://127.0.0.1:4176';
const output = 'review-artifacts/welcome';
mkdirSync(output, { recursive: true });
const report = { layouts: [], interactions: [], motion: [], errors: [] };
const url = `${base}/?section=title&branch=all&role=all&group=both&scope=without&quarter=3&metric=sales`;
const ready = page => page.locator('.welcome-page[data-ready="true"]').waitFor();
const sizes = [[320,568],[360,640],[375,667],[390,844],[430,932],[680,800],[681,400],[768,1024],[844,390],[1024,768],[1280,720],[1440,900],[1857,1010],[1920,1080],[2560,1440],[3840,2160]];
function audit() {
  const root = document.querySelector('.welcome-panel');
  const r = root.getBoundingClientRect();
  const contains = (a,b) => b.top >= a.top - 1 && b.left >= a.left - 1 && b.right <= a.right + 1 && b.bottom <= a.bottom + 1;
  const elements = [...root.querySelectorAll('.welcome-heading,.welcome-event,.welcome-speaker,.welcome-footer')];
  const copyInside = elements.every(e => {
    const box = e.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(e);
    return contains(r,box) && [...range.getClientRects()].every(t => contains(r,t));
  });
  const button = document.querySelector('.welcome-next').getBoundingClientRect();
  return { copyInside, viewport: [innerWidth,innerHeight], document: [document.documentElement.scrollWidth,document.documentElement.scrollHeight],
    fontSize: parseFloat(getComputedStyle(document.querySelector('.welcome-heading')).fontSize),
    buttonInside: contains({top:0,left:0,right:innerWidth,bottom:innerHeight},button),
    headline: document.querySelector('h1').textContent,
    nav: [...document.querySelectorAll('.presentation-nav-link')].map(e => e.getBoundingClientRect().toJSON()) };
}
for (const [engine,type] of [['chromium',chromium],['webkit',webkit]]) {
  const browser = await type.launch({ headless: true });
  try {
    for (const [width,height] of sizes) {
      const page = await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
      page.on('pageerror',e=>report.errors.push(e.message));
      await page.goto(url); await ready(page);
      const result = await page.evaluate(audit);
      report.layouts.push({engine,width,height,...result});
      assert(result.copyInside, `${engine} ${width}x${height}: copy clipped`);
      assert(result.document[0] <= width + 1 && result.document[1] <= height + 1, `${engine} ${width}x${height}: page overflow ${result.document}`);
      assert(result.buttonInside, `${engine} ${width}: CTA outside viewport`);
      assert(result.fontSize >= 32, `${engine} ${width}: small title`);
      assert.equal(result.headline,'Государственныйсектор');
      assert(result.nav.every(r=>r.left>=0 && r.right<=width+1 && r.top>=0), 'Navigation clipped');
      assert.equal(await page.getByRole('link',{name:'Приветствие',exact:true}).getAttribute('aria-current'),'page');
      assert.equal(await page.locator('.welcome-page button').count(),1);
      if ([320,390,1440,1857].includes(width)) await page.screenshot({path:`${output}/${engine}-${width}x${height}.png`});
      assert.equal(await page.locator('.welcome-page').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0,'Reduced motion ignored');
      await page.close();
    }
    const page = await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
    page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(url); await ready(page);
    await page.getByRole('button',{name:'Далее: Кредитование СМО',exact:true}).click();
    await page.getByRole('button',{name:'Назад: Приветствие',exact:true}).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('section'),'smo');
    await page.getByRole('button',{name:'Назад: Приветствие',exact:true}).click(); await ready(page);
    await page.goBack(); assert.equal(new URL(page.url()).searchParams.get('section'),'smo');
    await page.goBack(); await ready(page);
    await page.locator('body').click({position:{x:2,y:200}});
    await page.keyboard.press('ArrowRight');
    await page.getByRole('button',{name:'Назад: Приветствие',exact:true}).waitFor();
    await page.getByRole('link',{name:'Приветствие',exact:true}).click(); await ready(page);
    assert.equal(await page.title(),'Приветствие · Пульс');
    assert.equal(new URL(page.url()).searchParams.get('quarter'),'3');
    report.interactions.push(`${engine}: next/back, history, keyboard, top navigation and filters`);
    await page.close();
    const touch = await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
    await touch.goto(url);await ready(touch);
    await touch.locator('.welcome-page').dispatchEvent('touchstart',{touches:[{identifier:1,clientX:300,clientY:480}],changedTouches:[{identifier:1,clientX:300,clientY:480}]});
    await touch.locator('.welcome-page').dispatchEvent('touchend',{touches:[],changedTouches:[{identifier:1,clientX:80,clientY:482}]});
    await touch.getByRole('button',{name:'Назад: Приветствие',exact:true}).waitFor();
    report.interactions.push(`${engine}: emulated touch swipe advances to next section`);await touch.close();
    const animated = await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
    await animated.goto(url);await ready(animated);await animated.waitForTimeout(1100);
    await animated.keyboard.press('Tab');
    assert.equal(await animated.evaluate(()=>document.documentElement.dataset.input),'keyboard','Keyboard modality was not activated');
    const samples = [];
    for(let i=0;i<12;i++) {
      samples.push(await animated.evaluate(()=>({transform:getComputedStyle(document.querySelector('.welcome-ribbon-main')).transform,
        layout: [...document.querySelectorAll('.welcome-copy,.welcome-heading,.welcome-event,.welcome-speaker')].map(e=>[e.offsetTop,e.offsetLeft,e.offsetWidth,e.offsetHeight]).flat().join('|')})));
      await animated.waitForTimeout(400);
    }
    assert(new Set(samples.map(s=>s.transform)).size>1, 'Sculpture is not animated in keyboard mode');
    assert.equal(new Set(samples.map(s=>s.layout)).size,1,'Text geometry changed during the animation');
    assert.equal(new URL(animated.url()).searchParams.get('section'),'title','Unexpected auto-navigation');
    await animated.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    await animated.waitForTimeout(50);
    assert.equal(await animated.locator('.welcome-page').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0,'Hidden-tab animations running');
    report.motion.push(`${engine}: loop motion, stable text geometry, no auto-advance, hidden-tab pause`);
    await animated.close();
    const fallback=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
    await fallback.route('**/fonts/*.ttf',route=>route.abort());
    await fallback.route('**/dashboard/manifest.json',route=>route.abort());
    await fallback.goto(url);await ready(fallback);
    assert((await fallback.evaluate(audit)).copyInside,'Fallback clipping');
    report.interactions.push(`${engine}: welcome available when fonts and analytics data fail`);
    await fallback.close();
  } catch(error) {report.errors.push(String(error));throw error;}
  finally {await browser.close();writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));}
}
assert.equal(report.errors.length,0,JSON.stringify(report.errors));
console.log(`PASS: ${report.layouts.length} welcome layouts; ${report.interactions.length} navigation/fallback groups; ${report.motion.length} motion groups.`);
