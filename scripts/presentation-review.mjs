import { mkdirSync, writeFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/presentation-browser/node_modules/playwright/index.mjs');
const base = process.env.PRESENTATION_URL || 'http://127.0.0.1:4176';
const output = 'review-artifacts';
mkdirSync(`${output}/screenshots`, { recursive: true });
const report = { layouts: [], checks: [], errors: [] };
const route = (slide = 1) => `${base}/?section=sales-model&modelView=premises&slide=${slide}&page=overview&branch=all&role=all&group=both&scope=without&quarter=2&metric=sales`;
async function ready(page, slide) {
  await page.locator(`.deck-stage:not(.deck-stage-leave)[data-slide="${slide}"] .deck-fit-content`).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(180);
}
function layoutAudit() {
  const frame = document.querySelector('.deck-stage:not(.deck-stage-leave)');
  const box = frame.getBoundingClientRect();
  const content = frame.querySelector('.deck-fit-content');
  const outside = [];
  const walk = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) {
    const node = walk.currentNode, parent = node.parentElement;
    if (!node.textContent.trim() || parent.closest('[aria-hidden="true"],.sr-only,svg')) continue;
    if (!parent.getClientRects().length) continue;
    const range = document.createRange(); range.selectNodeContents(node);
    for (const r of range.getClientRects()) {
      if (r.left < box.left - 2 || r.right > box.right + 2 || r.top < box.top - 2 || r.bottom > box.bottom + 2) outside.push(node.textContent.trim().slice(0,80));
      let ancestor = parent;
      while (ancestor && ancestor !== frame) {
        const style = getComputedStyle(ancestor);
        if (['hidden','clip'].includes(style.overflowY)) {
          const clip = ancestor.getBoundingClientRect();
          if (r.top < clip.top - 2 || r.bottom > clip.bottom + 2) outside.push(`clipped: ${node.textContent.trim().slice(0,60)}`);
        }
        ancestor = ancestor.parentElement;
      }
    }
  }
  const offscreen = [...document.querySelectorAll('.pulse-header a,.deck-controls>button')].filter(e => {
    const r=e.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1 || r.top < -1 || r.bottom > innerHeight+1;
  }).map(e=>e.getAttribute('aria-label') || e.textContent);
  const svg = frame.querySelector('.pyramid-svg');
  if (svg) { const r=svg.getBoundingClientRect();if(r.bottom>box.bottom+2 || r.top<box.top-2) outside.push('pyramid SVG'); }
  return { outside: [...new Set(outside)], offscreen, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, scale: Number(getComputedStyle(content).getPropertyValue('--slide-scale')), animations: document.querySelector('.sales-deck').getAnimations({subtree:true}).length };
}
const viewports = [[320,568],[360,640],[375,667],[390,844],[430,932],[768,1024],[1024,768],[1280,720],[1366,768],[1440,900],[1920,1080],[2560,1440],[844,390]];
for (const [engine, browserType] of [['chromium',chromium],['webkit',webkit]]) {
  const browser = await browserType.launch({ headless: true });
  try {
    const sizes=engine==='chromium'?viewports:[[390,844],[1440,900],[844,390]];
    for (const [width,height] of sizes) {
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
      const page=await context.newPage();
      page.on('pageerror',e=>report.errors.push(`${engine} ${width}x${height}: ${e.message}`));
      for(let slide=1;slide<=9;slide++) {
        await page.goto(route(slide));await ready(page,slide);
        const audit=await page.evaluate(layoutAudit);
        const result={engine,width,height,slide,...audit};report.layouts.push(result);
        assert(audit.width<=width+1 && audit.height<=height+1,`Page overflow ${JSON.stringify(result)}`);
        assert.equal(audit.outside.length,0,`Clipped slide ${JSON.stringify(result)}`);
        assert.equal(audit.offscreen.length,0,`Offscreen controls ${JSON.stringify(result)}`);
        assert.equal(audit.animations,0,`Reduced motion ${JSON.stringify(result)}`);
        assert.equal(await page.getByRole('button',{name:/Все слайды|Крупнее|Вписать|Пауза|Приостановить анимацию/}).count(),0);
        if(engine==='chromium' && (width===1440 || width===390 || slide===5)) await page.screenshot({path:`${output}/screenshots/${engine}-${width}x${height}-slide${slide}.png`});
      }
      await context.close();
    }
    const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
    const page=await context.newPage();page.on('pageerror',e=>report.errors.push(`${engine} navigation: ${e.message}`));
    await page.goto(route());await ready(page,1);
    for(let slide=2;slide<=9;slide++) { await page.getByRole('button',{name:'Следующий слайд',exact:true}).click();await ready(page,slide); }
    await page.getByRole('button',{name:'К результатам',exact:true}).click();
    await page.waitForURL(/modelView=results/);
    assert.equal(new URL(page.url()).searchParams.get('quarter'),'2');
    await page.getByRole('button',{name:'Далее: Дальнейшие шаги',exact:true}).click();await page.waitForURL(/modelView=next/);
    await page.getByRole('button',{name:'Далее: Страт. диалог',exact:true}).click();await page.waitForURL(/section=strategy/);
    await page.getByRole('button',{name:'Назад: Модель продаж',exact:true}).click();await page.waitForURL(/modelView=next/);
    await page.getByRole('button',{name:'Назад: Результаты',exact:true}).click();await page.waitForURL(/modelView=results/);
    await page.getByRole('button',{name:'Назад: Предпосылки изменений',exact:true}).click();await ready(page,9);
    await page.goBack();await page.waitForURL(/modelView=results/);
    await page.goForward();await ready(page,9);
    report.checks.push(`${engine}: all arrows, section boundaries, filter retention, Back/Forward`);
    await page.getByRole('link',{name:'Результаты',exact:true}).click();await page.waitForURL(/modelView=results/);
    await page.getByRole('link',{name:'Предпосылки изменений',exact:true}).click();await ready(page,1);
    await page.locator('.deck-stage:not(.deck-stage-leave)').click({position:{x:20,y:20}});
    await page.keyboard.press('End');await ready(page,9);
    await page.keyboard.press('Home');await ready(page,1);
    await page.keyboard.press('PageDown');await ready(page,2);
    await page.keyboard.press('PageUp');await ready(page,1);
    for (const [input,expected] of [['NaN',1],['Infinity',1],['0',1],['99',9],['3.7',3]]) {
      await page.goto(route().replace('slide=1',`slide=${input}`));await ready(page,expected);
      assert.equal(new URL(page.url()).searchParams.get('slide'),String(expected));
    }
    report.checks.push(`${engine}: section links, keyboard, invalid direct links`);
    // Repeated resizes model orientation changes and browser-toolbar resizing.
    await page.goto(route(5));await ready(page,5);
    for(const [width,height] of [[390,844],[844,390],[390,700],[1440,900]]) {
      await page.setViewportSize({width,height});await page.waitForTimeout(200);
      const result=await page.evaluate(layoutAudit);
      assert.equal(result.outside.length,0,`Resize clips content: ${JSON.stringify(result)}`);
      assert.equal(result.offscreen.length,0);
    }
    report.checks.push(`${engine}: live viewport resizing and orientation`);
    await context.close();
    if(engine==='chromium') {
      const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
      const page=await mobile.newPage();await page.goto(route(2));await ready(page,2);
      const cdp=await mobile.newCDPSession(page);
      async function swipe(x1,y1,x2,y2) {
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x1,y:y1}]});
        for(let i=1;i<=8;i++) { await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x1+(x2-x1)*i/8,y:y1+(y2-y1)*i/8}]});await page.waitForTimeout(20); }
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      }
      await swipe(300,430,90,434);await ready(page,3);
      await swipe(90,430,300,434);await ready(page,2);
      await swipe(200,480,190,300);assert.equal(new URL(page.url()).searchParams.get('slide'),'2');
      await swipe(200,430,180,432);assert.equal(new URL(page.url()).searchParams.get('slide'),'2');
      await swipe(380,430,120,430);assert.equal(new URL(page.url()).searchParams.get('slide'),'2');
      await page.goto(route(9));await ready(page,9);await swipe(300,430,90,434);await page.waitForURL(/modelView=results/);
      report.checks.push('chromium: native emulated horizontal swipes in both directions and across section boundary; vertical/short/edge gestures ignored');
      await mobile.close();
      const motion=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'no-preference',recordVideo:{dir:`${output}/video`,size:{width:1440,height:900}}});
      const motionPage=await motion.newPage();await motionPage.goto(route(4));await ready(motionPage,4);
      await motionPage.getByRole('button',{name:'Следующий слайд',exact:true}).click();await ready(motionPage,5);
      await motionPage.waitForTimeout(1600);
      assert.equal(await motionPage.locator('.deck-stage').count(),1);
      const before=await motionPage.locator('.tier-rkm').evaluate(e=>getComputedStyle(e).transform);
      await motionPage.waitForTimeout(800);
      const after=await motionPage.locator('.tier-rkm').evaluate(e=>getComputedStyle(e).transform);
      assert.notEqual(before,after,'Pyramid must visibly animate');
      await motionPage.screenshot({path:`${output}/screenshots/pyramid-motion.png`});
      await motionPage.waitForTimeout(2200);
      for(let i=0;i<3;i++) await motionPage.getByRole('button',{name:'Следующий слайд',exact:true}).click();
      await motionPage.waitForTimeout(1600);assert.equal(await motionPage.locator('.deck-stage').count(),1);
      assert.equal(new URL(motionPage.url()).searchParams.get('slide'),'8');
      await motion.close();report.checks.push('chromium: animated pyramid, timed transition cleanup, rapid navigation');
    }
  } finally { await browser.close();writeFileSync(`${output}/presentation-report.json`,JSON.stringify(report,null,2)); }
}
assert.equal(report.errors.length,0,`Browser exceptions: ${JSON.stringify(report.errors)}`);
console.log(`PASS: ${report.layouts.length} slide/viewport/browser layouts; ${report.checks.length} integration groups; no page errors.`);
