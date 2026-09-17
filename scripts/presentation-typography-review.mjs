import { mkdirSync, writeFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/presentation-browser/node_modules/playwright/index.mjs');
const base = process.env.PRESENTATION_URL || 'http://127.0.0.1:4176';
const output = 'review-artifacts/typography';
mkdirSync(output, { recursive: true });
const report = { layouts: [], errors: [] };
// Check the displayed font size AFTER fitting, not just the CSS declaration.
const cases = [[320,568,8],[390,844,13],[680,800,13],[844,390,9],[1024,768,16],[1280,720,18],[1366,768,20],[1440,900,21],[1857,1010,27],[1920,1080,30],[2560,1440,31],[3840,2160,31]];
const copy = [
  'Фокус КМ на значимых клиентах через перезакрепление', 'Ролевую модель КМ',
  'Процессы взаимодействия со смежниками', 'Лидогенерацию', 'Мотивацию',
  'Глубокое понимание потребностей клиентов, больше касаний и рост лояльности',
  'Рост эффективности КМ через развитие экспертизы по направлениям',
  'Продажи низкодоходным клиентам ГС без привлечения КМ РГС',
  'Релевантные предложения разным группам клиентов', 'Рост удовлетворённости КМ',
];
function audit() {
  const frame = document.querySelector('.deck-stage:not(.deck-stage-leave)');
  const fit = frame.querySelector('.deck-fit-content');
  const scale = Number(fit.style.getPropertyValue('--slide-scale'));
  const box = frame.getBoundingClientRect();
  const rect = e => e.getBoundingClientRect();
  const contains = (a, b) => b.top >= a.top - 1 && b.bottom <= a.bottom + 1 && b.left >= a.left - 1 && b.right <= a.right + 1;
  const items = [...frame.querySelectorAll('.change-columns li')];
  const rows = items.map(item => {
    const range = document.createRange(); range.selectNodeContents(item);
    const b = rect(item), panel = rect(item.closest('section'));
    return { copy: item.textContent, fontPx: parseFloat(getComputedStyle(item).fontSize) * scale,
      center: (b.top + b.bottom) / 2,
      contained: contains(box, b) && contains(panel, b) && [...range.getClientRects()].every(r => contains(b, r)) };
  });
  return { scale, rows, controlsVisible: contains({top:0,left:0,right:innerWidth,bottom:innerHeight},rect(document.querySelector('.deck-controls'))) };
}
for (const [engine, type] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await type.launch({ headless: true });
  try {
    for (const [width, height, minFont] of cases) {
      const context = await browser.newContext({ viewport: {width, height}, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.on('pageerror', e => report.errors.push(e.message));
      await page.goto(`${base}/?section=sales-model&modelView=premises&slide=3`);
      await page.locator('.deck-stage[data-fit-ready="true"]').waitFor();
      const result = await page.evaluate(audit);
      report.layouts.push({ engine, width, height, ...result });
      assert.deepEqual(result.rows.map(r => r.copy), copy, 'Slide copy changed');
      assert(result.rows.every(r => r.contained), `Clipped copy: ${engine} ${width}x${height}`);
      assert(result.rows.every(r => r.fontPx >= minFont), `Small text: ${engine} ${width}x${height}: ${result.rows[0].fontPx}`);
      assert(result.controlsVisible, `Navigation outside viewport: ${engine} ${width}x${height}`);
      if (width > 680) for (let row = 0; row < 5; row++) {
        assert(Math.abs(result.rows[row].center - result.rows[row + 5].center) < 1, 'Paired rows are misaligned');
      }
      if ([390,1366,1440,1857].includes(width)) await page.screenshot({path:`${output}/${engine}-${width}x${height}-slide3.png`});
      await context.close();
    }
  } catch (error) { report.errors.push(String(error)); throw error; }
  finally { await browser.close(); writeFileSync(`${output}/report.json`, JSON.stringify(report,null,2)); }
}
assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
console.log(`PASS: ${report.layouts.length} slide-3 typography/containment checks; copy and row alignment preserved.`);
