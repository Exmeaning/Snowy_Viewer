/**
 * 无头 Chromium 长截图：deck-recommend 快速/进阶两态。
 * 用法: node scripts/longshot-deck.mjs [outDir]
 */
import path from 'path';
import { chromium } from 'playwright-core';

const CHROME = 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = process.argv[2] || 'F:/allium/.tmp';
const URL = 'http://localhost:3001/zh-cn/deck-recommend/';

const cfg = {
  mode: 'event', eventId: '215', selectedEventType: 'marathon', eventBonusCharacterIds: [],
  liveType: 'multi', supportCharacterId: null, challengeCharacterId: 1,
  musicId: '74', difficulty: 'master',
  cardConfig: {
    rarity_1: { disable: false, levelMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_2: { disable: false, levelMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_3: { disable: false, levelMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_4: { disable: false, levelMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_birthday: { disable: false, levelMax: true, episodeRead: true, masterMax: false, skillMax: false },
  },
  target: 'score', bonusTargets: '', simulateEnabled: false, simType: 'marathon', simAttr: '',
  simUnit: '', simTurn: 3, simCharacterId: null, customSubMode: 'unit', customUnit: 'light_sound',
  customCharacterIds: [], customCharacterUnits: {}, customAttr: '', strongestTarget: 'power',
  multiTeammatePower: '', multiTeammateScoreUp: '', multiScoreUpLowerBound: '',
  skillOrder: 'average', specificSkillOrder: '', skillReference: 'average',
  keepAfterTrainingState: false, bestSkillAsLeader: true, minimize: false,
  boost: '', otherScore: '', fixedCards: [], fixedCharacters: [], excludedCards: [],
  singleCardOverrides: [], limit: '3', timeoutSeconds: '120',
};

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2 });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.evaluate((c) => {
  localStorage.setItem('deck_recommend_saved_config_v2', JSON.stringify(c));
  localStorage.setItem('deck_recommend_userid', '21906891722772489');
  localStorage.setItem('deck_recommend_server', 'jp');
}, cfg);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);

async function runAndCapture(name, layout) {
  if (layout) {
    await page.evaluate((l) => {
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === l)?.click();
    }, layout);
    await page.waitForTimeout(700);
  }
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('开始推荐'))?.click();
  });
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(2500);
    const decks = await page.evaluate(() => document.querySelectorAll('.ds-result-row').length);
    if (decks > 0) break;
  }
  await page.evaluate(() => {
    const st = document.createElement('style');
    st.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;}';
    document.head.appendChild(st);
  });
  await page.waitForTimeout(500);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  // 需要把 fixed 侧栏与全屏壳改成普通流，否则长视口会留出固定层
  await page.evaluate(() => {
    const st = document.createElement('style');
    st.id = 'longshot-layout';
    st.textContent = `
      aside { position: static !important; display: none !important; }
      body > .fixed, [class*="fixed inset-0"] { position: static !important; }
      [class*="h-screen"], [class*="min-h-screen"] { height: auto !important; min-height: 0 !important; }
      [class*="overflow-y-auto"] { overflow: visible !important; }
      body, html { overflow: visible !important; height: auto !important; }
      main { margin-left: 0 !important; }
      footer, [class*="footer"], [data-testid="footer"] { display: none !important; }
    `;
    document.head.appendChild(st);
  });
  await page.waitForTimeout(500);
  const fixedHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: 1360, height: fixedHeight });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, name) });
  console.log(`[longshot] ${name} height=${fixedHeight} (was ${height})`);
  await page.setViewportSize({ width: 1360, height: 900 });
}

await runAndCapture('deck-quick.png', null);
await runAndCapture('deck-advanced.png', '进阶模式');
await browser.close();
console.log('[longshot] done');
