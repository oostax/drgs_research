import { mkdirSync, writeFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/presentation-browser/node_modules/playwright/index.mjs');
const base = process.env.PRESENTATION_URL || 'http://127.0.0.1:4176';
const output = 'review-artifacts';
mkdirSync(`${output}/stability`, { recursive: true });
const report = { containment: [], coldStarts: [], checks: [], errors: [] };
const url = (slide = 6) => `${base}/?section=sales-model&modelView=premises&slide=${slide}`;
const ready = page => page.locator('.deck-stage:not(.deck-stage-leave)[data-fit-ready="true"]').waitFor();
function recordFrames() {
  window.fitFrames = [];
  // Headless WebKit may throttle rAF even on an active page. Observe visible
  // layout commits as well as paint callbacks, without sampling within a fit.
  const sample = source => {
    const frame = document.querySelector('.deck-stage:not(.deck-stage-leave)');
    const inner = frame?.querySelector('.deck-fit-content');
    if (inner && getComputedStyle(inner).visibility === 'visible') {
      window.fitFrames.push({ source, time: performance.now(), slide: frame.dataset.slide, fonts: document.fonts.status, contentHeight: inner.offsetHeight,
        key: [frame.clientWidth, frame.clientHeight, inner.offsetWidth,
          inner.style.getPropertyValue('--slide-scale'), inner.style.getPropertyValue('--slide-available-height')].join('|') });
    }
  };
  const tick = () => { sample('animation-frame'); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  setInterval(() => sample('interval'), 16);
  new MutationObserver(() => sample('layout-commit')).observe(document, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ['style', 'class', 'data-fit-ready'],
  });
}
function cardAudit() {
  const cards = [...document.querySelectorAll('.deck-stage:not(.deck-stage-leave) .assignment-role')];
  const note = document.querySelector('.deck-stage:not(.deck-stage-leave) .table-note').getBoundingClientRect();
  return cards.map(card => {
    const box = card.getBoundingClientRect();
    const elements = [...card.querySelectorAll('header,.assignment-rule')];
    const children = elements.map(e => e.getBoundingClientRect());
    return { role: card.querySelector('.role-badge').textContent, bottom: box.bottom,
      contained: children.every(r => r.top >= box.top - .5 && r.bottom <= box.bottom + .5 && r.left >= box.left - .5 && r.right <= box.right + .5),
      noteClearance: note.top - box.bottom,
      textContained: [...card.querySelectorAll('.assignment-rule')].every(rule => {
        const r = rule.getBoundingClientRect(); const range = document.createRange(); range.selectNodeContents(rule);
        return [...range.getClientRects()].every(t => t.bottom <= r.bottom + 1 && t.right <= r.right + 1 && t.left >= r.left - 1);
      }) };
  });
}
const sizes = [[320,568],[390,844],[680,800],[844,390],[1024,768],[1280,720],[1366,768],[1440,900],[1834,980],[1920,1080],[2560,1440],[3840,2160]];
for (const [engine, browserType] of [['chromium',chromium],['webkit',webkit]]) {
  const browser = await browserType.launch({ headless: true });
  try {
    for (const [width,height] of sizes) {
      const context = await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
      const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
      await page.goto(url()); await ready(page); await page.evaluate(() => document.fonts.ready);
      const cards = await page.evaluate(cardAudit);
      assert.equal(cards.length,4); assert(cards.every(c => c.contained && c.textContained && c.noteClearance > 0), JSON.stringify({engine,width,height,cards}));
      report.containment.push({engine,width,height,cards});
      if ([390,1440,1834].includes(width)) await page.screenshot({path:`${output}/stability/${engine}-${width}x${height}-slide6.png`});
      await context.close();
    }
    // Deliberately stagger cold font responses. No fallback-sized slide may be painted.
    for (const [width,height,slide] of [[1440,900,3],[1834,980,6],[390,844,6],[844,390,5]]) {
      const context = await browser.newContext({viewport:{width,height},reducedMotion:'no-preference'});
      await context.route('**/fonts/*.ttf', async route => {
        const index = Number(route.request().url().match(/golos-(\d)/)?.[1] || 0);
        await new Promise(resolve => setTimeout(resolve, 350 + index * 300)); await route.continue();
      });
      const page = await context.newPage(); page.on('pageerror',e => report.errors.push(e.message));
      await page.addInitScript(recordFrames);
      await page.bringToFront();
      await page.goto(url(slide)); await ready(page); await page.waitForTimeout(3300);
      const frames = await page.evaluate(() => window.fitFrames);
      const layouts = [...new Set(frames.map(f => f.key))];
      const contentHeightRange = [Math.min(...frames.map(f=>f.contentHeight)), Math.max(...frames.map(f=>f.contentHeight))];
      report.coldStarts.push({engine,width,height,slide,samples:frames.length,
        paintCallbacks:frames.filter(f=>f.source==='animation-frame').length,visibleLayouts:layouts.length,layouts,contentHeightRange});
      assert(frames.length > 20, `Insufficient visible-layout samples: ${engine} ${width} slide ${slide}: ${frames.length}`);
      assert.equal(new Set(frames.map(f => f.key)).size,1, `Visible refit: ${engine} ${width} slide ${slide}: ${JSON.stringify([...new Set(frames.map(f=>f.key))])}`);
      // Integer-rounded heights allow one CSS pixel; scale and width must be exact.
      assert(contentHeightRange[1]-contentHeightRange[0] <= 1, 'Content reflowed after reveal');
      assert(frames.every(f => f.fonts === 'loaded'), 'Revealed before fonts finished');
      if(slide===6) assert((await page.evaluate(cardAudit)).every(c=>c.contained && c.textContained));
      // A warm slide transition must also keep one layout throughout the entrance.
      if(slide===6) {
        await page.getByRole('button',{name:'Следующий слайд',exact:true}).click(); await ready(page); await page.waitForTimeout(2000);
        const entering = await page.evaluate(() => window.fitFrames.filter(f=>f.slide==='7'));
        assert(entering.length > 10); assert.equal(new Set(entering.map(f=>f.key)).size,1,'Refit during warm transition');
        assert(Math.max(...entering.map(f=>f.contentHeight))-Math.min(...entering.map(f=>f.contentHeight)) <= 1, 'Content reflowed during warm transition');
        report.checks.push(`${engine} ${width}: warm slide transition stays at final scale`);
      }
      await context.close();
    }
    // Font failure must fall back once, never leave a permanently hidden slide.
    const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
    await context.route('**/fonts/*.ttf', route=>route.abort());
    const page=await context.newPage();await page.goto(url());await ready(page);
    assert((await page.evaluate(cardAudit)).every(c=>c.contained && c.textContained));
    report.checks.push(`${engine}: readable, contained fallback when fonts fail`);
    await context.close();
  } catch (error) {
    report.errors.push(String(error));
    throw error;
  } finally {
    await browser.close();
    writeFileSync(`${output}/stability-report.json`,JSON.stringify(report,null,2));
  }
}
assert.equal(report.errors.length,0,JSON.stringify(report.errors));
console.log(`PASS: ${report.containment.length} card layouts; ${report.coldStarts.length} staggered-font first-paint checks; ${report.checks.length} transition/fallback checks.`);
