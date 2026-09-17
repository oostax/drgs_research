import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/presentation-browser/node_modules/playwright/index.mjs');
const base = process.env.REVIEW_URL || 'http://127.0.0.1:4176';
const out = 'review-artifacts';
mkdirSync(out, { recursive: true });
const report = { commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding:'utf8' }).trim(), base, layouts: [], checks: [], errors: [] };
const sizes = [[320,568],[360,640],[390,844],[430,932],[768,1024],[844,390],[1024,768],[1280,720],[1366,768],[1440,900],[1920,1080],[2560,1440],[3840,2160]];
const query = (slide = 1) => `${base}/?section=sales-model&modelView=premises&slide=${slide}&page=overview&branch=all&role=all&group=both&scope=without&quarter=3&metric=sales`;
async function ready(page, slide) {
  await page.waitForFunction(s => document.querySelector('.sales-deck')?.dataset.slide === String(s), slide);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(100);
}
function check(value, description) { assert.ok(value, description); report.checks.push(description); }

let runningBrowser;
try {
  for (const [name, engine] of [['chromium',chromium],['webkit',webkit]]) {
    const browser = await engine.launch();
    runningBrowser = browser;
    const context = await browser.newContext({ reducedMotion:'reduce', hasTouch:true });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(`${name}: ${error.message}`));
    for (const [width,height] of sizes) {
      await page.setViewportSize({ width,height });
      for (let slide = 1; slide <= 9; slide++) {
        await page.goto(query(slide)); await ready(page, slide);
        const layout = await page.evaluate(() => {
          const active = document.querySelector('.deck-stage-active'), viewport = document.querySelector('.deck-viewport');
          const box = active.getBoundingClientRect(), frame = viewport.getBoundingClientRect();
          const visibleLinks = [...document.querySelectorAll('.pulse-header a')].every(el => {
            const r=el.getBoundingClientRect(); return r.left>=-1 && r.right<=innerWidth+1 && r.top>=-1 && r.bottom<=innerHeight+1 && r.height>=44;
          });
          const controls = [...document.querySelectorAll('.deck-controls>button')].every(el => {
            const r=el.getBoundingClientRect(); return r.left>=-1 && r.right<=innerWidth+1 && r.bottom<=innerHeight+1 && r.height>=44 && r.width>=44;
          });
          const overflow = [];
          const walker = document.createTreeWalker(active,NodeFilter.SHOW_TEXT);
          while(walker.nextNode()) {
            const node=walker.currentNode;
            if(!node.textContent.trim() || node.parentElement.closest('[aria-hidden="true"]')) continue;
            const range=document.createRange();range.selectNodeContents(node);
            for (const r of range.getClientRects()) if(r.width && r.height && (r.left<box.left-2 || r.right>box.right+2 || r.top<box.top-2 || r.bottom>box.bottom+2)) overflow.push(node.textContent.slice(0,70));
          }
          viewport.scrollTop=viewport.scrollHeight;
          const lastReachable=active.getBoundingClientRect().bottom<=viewport.getBoundingClientRect().bottom+2;
          viewport.scrollTop=0;
          return { visibleLinks, controls, overflow, lastReachable,
            documentFits:document.documentElement.scrollWidth<=innerWidth+1 && document.documentElement.scrollHeight<=innerHeight+1,
            slideFits:box.top>=frame.top-2 && box.bottom<=frame.bottom+2,
            images:[...active.querySelectorAll('img')].every(img=>img.complete && img.naturalWidth>0) };
        });
        report.layouts.push({ browser:name,width,height,slide,...layout });
        const label=`${name} ${width}x${height} slide ${slide}`;
        assert.ok(layout.visibleLinks && layout.controls && layout.documentFits && layout.images, `${label}: chrome does not fit ${JSON.stringify(layout)}`);
        assert.equal(layout.overflow.length,0,`${label}: text outside slide ${layout.overflow.join('; ')}`);
        assert.ok(width>900 ? layout.slideFits : layout.lastReachable,`${label}: slide is clipped`);
        if ([320,390,844,1366,1920].includes(width)) await page.screenshot({ path:`${out}/${name}-${width}x${height}-${slide}.png` });
      }
    }
    report.checks.push(`${name}: 117 slide/viewport combinations; all text and controls reachable`);

    await page.setViewportSize({width:1440,height:900});
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.goto(query(1));await ready(page,1);
    for(let slide=2;slide<=9;slide++) {
      await page.locator('.deck-next').click();await ready(page,slide);
      await page.waitForTimeout(1500);
      check(await page.locator('.deck-stage-leave').count()===0,`${name}: transition ${slide-1}→${slide} cleans up`);
    }
    for(let slide=8;slide>=1;slide--) { await page.locator('.deck-previous').click();await ready(page,slide); }
    for(let i=0;i<5;i++) await page.locator('.deck-next').click();
    await ready(page,6);await page.waitForTimeout(1500);
    check(await page.locator('.deck-stage-leave').count()===0,`${name}: interrupted transitions clean up`);
    await page.keyboard.press('ArrowRight');await ready(page,7);
    await page.keyboard.press('PageUp');await ready(page,6);
    await page.locator('.deck-overview-button').click();
    const dialog=page.getByRole('dialog',{name:'Все слайды'});
    await dialog.waitFor();
    for(let i=0;i<20;i++) await page.keyboard.press('Tab');
    check(await page.evaluate(()=>!!document.activeElement.closest('dialog')),`${name}: overview traps focus`);
    await page.keyboard.press('ArrowRight');
    check(await page.locator('.sales-deck').getAttribute('data-slide')==='6',`${name}: modal does not change underlying slide`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
    check(await page.locator('.deck-overview-button').evaluate(el=>el===document.activeElement),`${name}: overview restores focus`);
    await page.locator('.deck-overview-button').click();
    await dialog.getByRole('button').filter({hasText:'Проводится пилот'}).click();await ready(page,9);
    await page.locator('.deck-next').click();
    await page.waitForFunction(()=>new URLSearchParams(location.search).get('modelView')==='results');
    check(new URL(page.url()).searchParams.get('page')==='overview',`${name}: final slide opens results overview`);
    await page.goBack();await ready(page,9);await page.goForward();
    await page.getByRole('button',{name:'Назад: Предпосылки изменений'}).click();await ready(page,9);
    await page.locator('.deck-next').click();
    await page.getByRole('button',{name:'Далее: Дальнейшие шаги'}).click();
    await page.getByRole('button',{name:'Далее: Стратегический диалог'}).click();
    await page.getByRole('button',{name:'Далее: Академия гибридных лидеров'}).click();
    await page.getByRole('button',{name:'Далее: Задачи ТБ'}).click();
    check(await page.getByRole('button',{name:'Конец презентации'}).isDisabled(),`${name}: final section is a non-circular endpoint`);
    await page.getByRole('link',{name:'Титульный лист',exact:true}).click();
    await page.getByRole('button',{name:'Далее: Кредитование СМО'}).click();
    await page.getByRole('button',{name:'Далее: Предпосылки изменений'}).click();await ready(page,1);
    await page.locator('.deck-motion-button').click();
    check(await page.locator('.sales-deck').getAttribute('data-motion')==='off',`${name}: explicit motion pause`);
    await page.locator('.deck-next').click();await ready(page,2);
    check(await page.locator('.deck-stage-active h2').evaluate(el=>getComputedStyle(el).opacity==='1'),`${name}: pause does not hide new content`);

    await page.setViewportSize({width:390,height:844});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto(query(1));await ready(page,1);
    if(name==='chromium') {
      const cdp=await context.newCDPSession(page);
      const swipe=async(x,y,dx,dy)=>{
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
        for(let i=1;i<=5;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/5,y:y+dy*i/5}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      };
      await swipe(290,380,-150,0);await ready(page,2);
      await swipe(90,380,170,0);await ready(page,1);
      await page.goto(query(3));await ready(page,3);
      await swipe(200,650,0,-220);
      check(await page.locator('.sales-deck').getAttribute('data-slide')==='3',`${name}: native vertical scroll does not advance`);
      check(await page.locator('.deck-viewport').evaluate(el=>el.scrollTop>0),`${name}: native vertical scroll remains available`);
      await page.goto(query(9));await ready(page,9);await swipe(290,400,-150,0);
      await page.waitForFunction(()=>new URLSearchParams(location.search).get('modelView')==='results');
      report.checks.push('chromium: native touchscreen swipes forward/backward/across subsection boundary');
    } else {
      await page.locator('.deck-viewport').dispatchEvent('pointerdown',{pointerType:'touch',isPrimary:true,pointerId:1,clientX:290,clientY:380});
      await page.locator('.deck-viewport').dispatchEvent('pointerup',{pointerType:'touch',isPrimary:true,pointerId:1,clientX:90,clientY:380});
      await ready(page,2);report.checks.push('webkit: synthesized touch PointerEvents reach the navigation handler');
    }
    await browser.close();
  }
  assert.equal(report.errors.length,0,report.errors.join('\n'));
  report.status='passed';
} catch(error) { report.status='failed';report.failure=String(error.stack || error);throw error; }
finally { await runningBrowser?.close(); writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,layouts:report.layouts.length,checks:report.checks.length,errors:report.errors})); }
