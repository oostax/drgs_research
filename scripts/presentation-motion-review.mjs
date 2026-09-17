import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/presentation-browser/node_modules/playwright/index.mjs');
const checks=[];
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]) {
  const browser=await engine.launch();
  try {
    const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
    await page.goto(`${process.env.REVIEW_URL || 'http://127.0.0.1:4176'}/?section=sales-model&modelView=premises&slide=5`);
    await page.locator('.pyramid-tier').first().waitFor();
    await page.waitForTimeout(1700);
    const before=await page.locator('.tier-rkm').evaluate(el=>getComputedStyle(el).transform);
    await page.screenshot({path:`review-artifacts/${name}-pyramid-motion-1.png`});
    await page.waitForTimeout(1100);
    const after=await page.locator('.tier-rkm').evaluate(el=>getComputedStyle(el).transform);
    await page.screenshot({path:`review-artifacts/${name}-pyramid-motion-2.png`});
    assert.notEqual(before,after,`${name}: pyramid should move`);
    assert.equal(await page.locator('.pyramid-tier').count(),4);
    await page.getByRole('button',{name:'Приостановить анимацию'}).click();
    assert.equal(await page.locator('.pyramid-tier').first().evaluate(el=>getComputedStyle(el).animationName),'none');
    await page.locator('.deck-next').click();
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.assignment-role').first().evaluate(el=>getComputedStyle(el).opacity),'1');
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('.presentation-icon .motion-detail').first().evaluate(el=>getComputedStyle(el).animationName),'none');
    checks.push({browser:name,pyramidMoving:true,tiers:4,pause:true,reducedMotion:true,before,after});
  } finally { await browser.close(); }
}
writeFileSync('review-artifacts/motion-report.json',JSON.stringify({status:'passed',checks},null,2));
