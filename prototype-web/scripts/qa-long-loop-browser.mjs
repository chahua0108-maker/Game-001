#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.resolve(projectRoot, process.env.QA_LONG_LOOP_BROWSER_OUTPUT_DIR ?? 'outputs/long-loop/browser-p0-latest');
const outputFile = path.join(outputDir, 'browser-proof.json');
const preferredPort = Number(process.env.QA_PORT ?? 5174);
const baseUrlOverride = process.env.QA_BASE_URL;
const profileStorageKey = 'vampire-crawlers.profile.v1';

const viewports = [
  { name: 'desktop', width: 1366, height: 768 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-360', width: 360, height: 640 }
];

const bannedVisibleTerms = [
  'Long-loop P0',
  'QA profile',
  'orchestrator',
  'orchestrator-backed',
  'profileStorage',
  'phaseEvents',
  'Visible shop ids',
  'visibleItemIds',
  'raw ids',
  'facade',
  'MemoryStorage',
  'adapter_payload_only',
  'unlockRuleIds',
  'featureGateIds',
  'starterPayload',
  'selectedStarterKitId',
  'purchasedShopItemIds',
  'map.',
  'crawler.',
  'starter.',
  'hub.',
  'unlock.',
  'starter_stable_chain',
  'blacksmith_raise_level_permit',
  'blacksmith_red_socket_permit',
  'blacksmith_reroll_permit',
  'Settle D1',
  'Reload Profile'
];

const testidGroups = {
  hub: ['long-loop-hub', 'meta-hub', 'hub-shell'],
  wallet: ['long-loop-wallet', 'wallet-summary', 'hub-wallet'],
  d1Entry: ['start-d1', 'd1-entry', 'district-d1-entry', 'start-d1-entry'],
  d1Brief: ['d1-brief', 'district-d1-brief', 'district-d1-card', 'run-brief'],
  d1Run: ['district-d1-run', 'd1-run', 'run-screen'],
  startD1Run: ['start-d1-run', 'start-d1', 'begin-d1-run'],
  completeD1Run: ['complete-d1-run', 'clear-d1-run', 'finish-d1-run', 'complete-d1'],
  settlement: ['settlement', 'd1-settlement', 'settlement-screen', 'settlement-summary'],
  settlementRewards: ['settlement-rewards', 'd1-clear-rewards', 'reward-summary', 'settlement-summary'],
  settlementToShop: ['settlement-to-shop', 'open-shop', 'go-to-shop', 'nav-shop'],
  shop: ['shop', 'shop-screen', 'shop-inventory'],
  stableChainCard: ['stable-chain-card', 'shop-stable-chain', 'shop-item-stable-chain', 'starter-stable-chain-card'],
  buyStableChain: ['buy-stable-chain', 'purchase-stable-chain', 'buy-stable-chain-starter'],
  stableChainOwned: ['stable-chain-owned', 'owned-stable-chain', 'stable-chain-purchased', 'shop-item-stable-chain'],
  nextD1Action: ['start-next-d1', 'start-next-run', 'next-d1-action'],
  nextRunPreview: ['next-run-preview', 'next-run-summary', 'run-preview']
};

const stageRequirements = {
  hub: ['hub', 'wallet', 'd1Entry', 'nextRunPreview'],
  d1Brief: ['d1Brief', 'startD1Run'],
  d1Run: ['d1Run', 'completeD1Run'],
  settlement: ['settlement', 'settlementRewards', 'settlementToShop'],
  shop: ['shop', 'stableChainCard', 'buyStableChain'],
  afterBuy: ['wallet', 'stableChainOwned', 'nextD1Action', 'nextRunPreview'],
  afterReload: ['hub', 'wallet', 'stableChainOwned', 'nextRunPreview']
};

const flowSelectors = {
  d1Entry: {
    group: 'd1Entry',
    fallback: [
      'button:has-text("D1")',
      'button:has-text("District 1")',
      'button:has-text("Start D1")',
      'button:has-text("准备 D1")',
      'button:has-text("进入 D1")',
      'button:has-text("开始 D1")',
      '[data-long-loop-action="settle-d1"]'
    ]
  },
  startD1Run: {
    group: 'startD1Run',
    fallback: [
      'button:has-text("Start Run")',
      'button:has-text("Begin Run")',
      'button:has-text("Start D1")',
      'button:has-text("开始挑战")',
      'button:has-text("开始 D1")'
    ]
  },
  completeD1Run: {
    group: 'completeD1Run',
    fallback: [
      'button:has-text("Clear D1")',
      'button:has-text("Complete D1")',
      'button:has-text("Finish D1")',
      'button:has-text("结算")',
      'button:has-text("清理 D1")',
      'button:has-text("完成 D1")',
      '[data-long-loop-action="settle-d1"]'
    ]
  },
  settlementToShop: {
    group: 'settlementToShop',
    fallback: [
      'button:has-text("Shop")',
      'button:has-text("Open Shop")',
      'button:has-text("Go to Shop")',
      'button:has-text("花费声望")',
      'button:has-text("打开商店")',
      'button:has-text("商店")'
    ]
  },
  buyStableChain: {
    group: 'buyStableChain',
    fallback: [
      'button:has-text("Buy Stable Chain")',
      'button:has-text("Purchase Stable Chain")',
      'button:has-text("购买")',
      'button:has-text("稳定链")',
      '[data-long-loop-action="buy"][data-shop-item-id="starter_stable_chain"]'
    ]
  }
};

const screenshotStages = [
  '01-hub',
  '02-d1-brief',
  '03-d1-run',
  '04-settlement',
  '05-shop-before-buy',
  '06-next-run-preview-after-buy',
  '07-after-browser-reload',
  '08-second-d1-run-after-reload'
];

const cleanup = {
  pages: [],
  contexts: [],
  browser: null,
  server: null
};

const report = {
  name: 'qa-long-loop-browser',
  status: 'started',
  startedAt: new Date().toISOString(),
  browserProof: {
    status: 'started',
    requiredPath:
      'Fresh Hub -> D1 -> Settlement -> Shop -> Buy Stable Chain -> Next Run Preview -> reload persistence -> second D1 uses Stable Chain',
    outputDir,
    outputFile
  },
  config: {
    viewports,
    preferredPort,
    baseUrlOverride: baseUrlOverride ?? null,
    profileStorageKey,
    bannedVisibleTerms,
    testidGroups,
    stageRequirements
  },
  server: null,
  results: [],
  errors: [],
  cleanup: null,
  gates: null,
  gateScore: null,
  outputFile
};

try {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const server = baseUrlOverride
    ? { url: baseUrlOverride, owned: false, pid: null, port: Number(new URL(baseUrlOverride).port || 80) }
    : await resolveServer(preferredPort);
  cleanup.server = server;
  report.server = {
    url: server.url,
    owned: server.owned,
    pid: server.pid,
    port: server.port,
    preferredPort
  };

  const { chromium } = await loadPlaywright();
  const launchOptions = { headless: true };
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (existsSync(chromePath)) {
    launchOptions.executablePath = chromePath;
  }
  cleanup.browser = await chromium.launch(launchOptions);

  for (const viewport of viewports) {
    report.results.push(await exerciseViewport(cleanup.browser, server.url, viewport));
  }
} catch (error) {
  report.status = 'failed-before-cleanup';
  report.errors.push(serializeError(error));
} finally {
  report.cleanup = await closeAll();
  report.finishedAt = new Date().toISOString();
  report.gates = buildGates(report);
  report.gateScore = buildGateScore(report.gates);
  report.status = classifyStatus(report);
  report.browserProof = {
    ...report.browserProof,
    status: report.status,
    generatedAt: report.finishedAt,
    viewports: report.results.map((result) => ({
      name: result.viewport.name,
      status: result.status,
      failedGateCount: result.failedGates.length,
      screenshotCount: result.screenshots.length
    }))
  };
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.status === 'pass' ? 0 : 1;
}

async function exerciseViewport(browser, url, viewport) {
  const context = await browser.newContext({ viewport });
  cleanup.contexts.push(context);
  const page = await context.newPage();
  cleanup.pages.push(page);

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const result = {
    viewport,
    status: 'started',
    flow: [],
    stageChecks: [],
    screenshots: [],
    consoleErrors,
    pageErrors,
    failedGates: []
  };

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(200);

  await captureStage(page, result, '01-hub', 'hub');
  recordFlow(result, 'fresh_hub_visible', await isAnyTestidVisible(page, testidGroups.hub));
  recordFlow(result, 'hub_has_d1_entry', await hasAnyVisible(page, selectorsForGroup('d1Entry')));
  recordFlow(result, 'hub_has_next_run_preview', await hasAnyVisible(page, selectorsForGroup('nextRunPreview')));
  recordFlow(result, 'fresh_load_not_combat_first', !(await page.locator('#hud .status-strip').first().isVisible().catch(() => false)));

  const clickedD1Entry = await clickFlowAction(page, flowSelectors.d1Entry);
  recordFlow(result, 'open_d1_from_hub', clickedD1Entry);
  await page.waitForTimeout(250);

  let d1BriefVisible = await isAnyTestidVisible(page, testidGroups.d1Brief);
  if (!d1BriefVisible && !(await isAnyTestidVisible(page, testidGroups.settlement))) {
    d1BriefVisible = await visibleTextMatches(page, /D1|District 1|第\s*1|一区/i);
  }
  await captureStage(page, result, '02-d1-brief', 'd1Brief');
  recordFlow(result, 'd1_brief_or_run_visible', d1BriefVisible);
  recordFlow(result, 'd1_start_action_in_first_view', await isAnySelectorInViewport(page, selectorsForGroup('startD1Run')));

  if (!(await isAnyTestidVisible(page, testidGroups.settlement))) {
    const clickedStart = await clickFlowAction(page, flowSelectors.startD1Run);
    recordFlow(result, 'start_d1_run', clickedStart);
    await page.waitForTimeout(250);
  }

  if (!(await isAnyTestidVisible(page, testidGroups.settlement))) {
    await captureStage(page, result, '03-d1-run', 'd1Run');
    recordFlow(result, 'd1_run_visible', await isAnyTestidVisible(page, testidGroups.d1Run));
    recordFlow(result, 'd1_finish_action_in_first_view', await isAnySelectorInViewport(page, selectorsForGroup('completeD1Run')));
  }

  if (!(await isAnyTestidVisible(page, testidGroups.settlement))) {
    const clickedComplete = await clickFlowAction(page, flowSelectors.completeD1Run);
    recordFlow(result, 'complete_d1_run', clickedComplete);
    await page.waitForTimeout(300);
  } else {
    recordFlow(result, 'complete_d1_run', true, 'Settlement already visible after D1 entry/start.');
  }

  await captureStage(page, result, '04-settlement', 'settlement');
  recordFlow(result, 'settlement_visible', await isAnyTestidVisible(page, testidGroups.settlement));
  recordFlow(result, 'settlement_rewards_visible', await settlementRewardTextVisible(page));
  recordFlow(result, 'settlement_shop_action_in_first_view', await isAnySelectorInViewport(page, selectorsForGroup('settlementToShop')));

  if (!(await isAnyTestidVisible(page, testidGroups.shop))) {
    const clickedShop = await clickFlowAction(page, flowSelectors.settlementToShop);
    recordFlow(result, 'open_shop_from_settlement', clickedShop);
    await page.waitForTimeout(250);
  } else {
    recordFlow(result, 'open_shop_from_settlement', true, 'Shop already visible.');
  }

  await captureStage(page, result, '05-shop-before-buy', 'shop');
  recordFlow(result, 'shop_visible', await isAnyTestidVisible(page, testidGroups.shop));
  recordFlow(result, 'stable_chain_card_visible', await isAnyTestidVisible(page, testidGroups.stableChainCard));
  recordFlow(result, 'stable_chain_card_in_shop_first_view', await isAnySelectorInViewport(page, selectorsForGroup('stableChainCard')));
  const buyButtonUsableBefore = await isActionUsable(page, flowSelectors.buyStableChain);
  recordFlow(result, 'stable_chain_purchase_accessible', buyButtonUsableBefore);
  recordFlow(result, 'stable_chain_purchase_in_shop_first_view', await isAnySelectorInViewport(page, selectorsForGroup('buyStableChain')));

  const clickedBuy = await clickFlowAction(page, flowSelectors.buyStableChain);
  recordFlow(result, 'buy_stable_chain', clickedBuy);
  await page.waitForTimeout(350);

  await captureStage(page, result, '06-next-run-preview-after-buy', 'afterBuy');
  recordFlow(result, 'stable_chain_owned_visible', await stableChainOwnedVisible(page));
  recordFlow(result, 'next_d1_action_after_buy_in_first_view', await isAnySelectorInViewport(page, selectorsForGroup('nextD1Action')));
  recordFlow(result, 'next_run_preview_after_buy_visible', await isAnyTestidVisible(page, testidGroups.nextRunPreview));
  recordFlow(result, 'stable_chain_next_run_impact_visible', await stableChainNextRunImpactVisible(page));

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(300);

  await captureStage(page, result, '07-after-browser-reload', 'afterReload');
  recordFlow(result, 'reload_returns_to_hub', await isAnyTestidVisible(page, testidGroups.hub));
  recordFlow(result, 'reload_preserves_stable_chain', await stableChainOwnedVisible(page));
  recordFlow(result, 'reload_preserves_d1_clear', await d1ClearVisible(page));
  recordFlow(result, 'reload_preserves_next_run_changes', await stableChainNextRunImpactVisible(page));

  const clickedSecondD1Entry = await clickFlowAction(page, flowSelectors.d1Entry);
  recordFlow(result, 'open_second_d1_from_reloaded_hub', clickedSecondD1Entry);
  await page.waitForTimeout(250);
  const clickedSecondStart = await clickFlowAction(page, flowSelectors.startD1Run);
  recordFlow(result, 'start_second_d1_after_reload', clickedSecondStart);
  await page.waitForTimeout(250);
  await captureStage(page, result, '08-second-d1-run-after-reload', 'd1Run');
  recordFlow(result, 'second_d1_run_visible', await isAnyTestidVisible(page, testidGroups.d1Run));
  recordFlow(result, 'second_d1_uses_stable_chain_after_reload', await secondRunUsesStableChain(page));
  const secondRunStorage = await secondRunStorageProof(page);
  recordFlow(result, 'second_d1_storage_records_stable_chain_run', secondRunStorage.ok, secondRunStorage);

  result.failedGates = buildViewportFailures(result);
  result.status = result.failedGates.length === 0 ? 'pass' : 'failed';
  return result;
}

async function captureStage(page, result, screenshotName, requirementStage) {
  const viewportDir = path.join(outputDir, result.viewport.name);
  await mkdir(viewportDir, { recursive: true });
  const screenshotPath = path.join(viewportDir, `${screenshotName}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const inspection = await inspectPage(page, requirementStage);
  const testidCheck = await inspectRequiredTestids(page, requirementStage);
  const screenshot = {
    name: screenshotName,
    path: screenshotPath,
    requirementStage,
    inspection,
    testidCheck
  };
  result.screenshots.push(screenshot);
  result.stageChecks.push({
    stage: requirementStage,
    screenshot: screenshotPath,
    status:
      inspection.failures.length === 0 && testidCheck.missing.length === 0 && !inspection.horizontalOverflow.detected
        ? 'pass'
        : 'failed',
    failures: [...inspection.failures, ...testidCheck.missing.map((item) => ({ type: 'missing_testid', ...item }))]
  });
}

async function inspectPage(page, stage) {
  return await page.evaluate(
    ({ bannedTerms, stageName }) => {
      const visibleText = document.body.innerText.replace(/\s+/g, ' ').trim();
      const bannedVisibleTerms = bannedTerms.filter((term) => visibleText.includes(term));
      const overlaySelectors = [
        'vite-error-overlay',
        'nextjs-portal',
        '[data-nextjs-dialog-overlay]',
        'iframe#webpack-dev-server-client-overlay',
        '.webpack-dev-server-client-overlay',
        '.vite-error-overlay'
      ];
      const frameworkOverlays = overlaySelectors
        .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
        .filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        })
        .map((element) => element.tagName.toLowerCase());

      const doc = document.documentElement;
      const horizontalOverflow = {
        detected: doc.scrollWidth > window.innerWidth + 1 || document.body.scrollWidth > window.innerWidth + 1,
        viewportWidth: window.innerWidth,
        documentScrollWidth: doc.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        offenders: []
      };

      for (const element of Array.from(document.body.querySelectorAll('*'))) {
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.position === 'fixed') {
          continue;
        }
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          continue;
        }
        if (rect.left < -1 || rect.right > window.innerWidth + 1) {
          horizontalOverflow.offenders.push({
            tag: element.tagName.toLowerCase(),
            className: typeof element.className === 'string' ? element.className : '',
            testid: element.getAttribute('data-testid'),
            text: (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width)
          });
        }
        if (horizontalOverflow.offenders.length >= 20) {
          break;
        }
      }

      const failures = [];
      if (bannedVisibleTerms.length > 0) {
        failures.push({ type: 'banned_visible_terms', terms: bannedVisibleTerms });
      }
      if (frameworkOverlays.length > 0) {
        failures.push({ type: 'framework_overlay', overlays: frameworkOverlays });
      }
      if (horizontalOverflow.detected || horizontalOverflow.offenders.length > 0) {
        failures.push({ type: 'horizontal_overflow', horizontalOverflow });
      }

      return {
        stage: stageName,
        visibleTextSample: visibleText.slice(0, 1000),
        bannedVisibleTerms,
        frameworkOverlays,
        horizontalOverflow,
        failures
      };
    },
    { bannedTerms: bannedVisibleTerms, stageName: stage }
  );
}

async function inspectRequiredTestids(page, stage) {
  const requiredGroups = stageRequirements[stage] ?? [];
  const missing = [];
  const present = [];

  for (const groupName of requiredGroups) {
    const candidates = testidGroups[groupName] ?? [];
    const matched = [];
    for (const testid of candidates) {
      const locator = page.locator(`[data-testid="${cssEscape(testid)}"]`);
      const count = await locator.count().catch(() => 0);
      const visible = count > 0 && (await locator.first().isVisible().catch(() => false));
      if (count > 0) {
        matched.push({ testid, count, visible });
      }
    }
    if (matched.some((item) => item.visible)) {
      present.push({ group: groupName, candidates, matched });
    } else {
      missing.push({ group: groupName, candidates });
    }
  }

  return {
    stage,
    requiredGroups,
    present,
    missing
  };
}

async function clickFlowAction(page, action) {
  const selectors = [...selectorsForGroup(action.group), ...action.fallback];
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (!(await locator.isVisible().catch(() => false))) {
      continue;
    }
    if (!(await locator.isEnabled().catch(() => false))) {
      continue;
    }
    await locator.scrollIntoViewIfNeeded({ timeout: 2_000 }).catch(() => undefined);
    const usable = await locator
      .evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          style.pointerEvents !== 'none' &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.left >= -1 &&
          rect.right <= window.innerWidth + 1 &&
          rect.top >= -1 &&
          rect.bottom <= window.innerHeight + 1
        );
      })
      .catch(() => false);
    if (!usable) {
      continue;
    }
    await locator.click({ timeout: 3_000 });
    return true;
  }
  return false;
}

async function isActionUsable(page, action) {
  const selectors = [...selectorsForGroup(action.group), ...action.fallback];
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (!(await locator.isVisible().catch(() => false)) || !(await locator.isEnabled().catch(() => false))) {
      continue;
    }
    await locator.scrollIntoViewIfNeeded({ timeout: 2_000 }).catch(() => undefined);
    const usable = await locator
      .evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          style.pointerEvents !== 'none' &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.left >= -1 &&
          rect.right <= window.innerWidth + 1 &&
          rect.top >= -1 &&
          rect.bottom <= window.innerHeight + 1
        );
      })
      .catch(() => false);
    if (usable) {
      return true;
    }
  }
  return false;
}

async function isAnySelectorInViewport(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (!(await locator.isVisible().catch(() => false))) {
      continue;
    }
    const visibleInViewport = await locator
      .evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.left >= -1 &&
          rect.right <= window.innerWidth + 1 &&
          rect.top >= -1 &&
          rect.bottom <= window.innerHeight + 1
        );
      })
      .catch(() => false);
    if (visibleInViewport) {
      return true;
    }
  }
  return false;
}

async function hasAnyVisible(page, selectors) {
  for (const selector of selectors) {
    if (await page.locator(selector).first().isVisible().catch(() => false)) {
      return true;
    }
  }
  return false;
}

async function isAnyTestidVisible(page, testids) {
  return await hasAnyVisible(page, testids.map((testid) => `[data-testid="${cssEscape(testid)}"]`));
}

function selectorsForGroup(groupName) {
  return (testidGroups[groupName] ?? []).map((testid) => `[data-testid="${cssEscape(testid)}"]`);
}

async function visibleTextMatches(page, pattern) {
  const text = await page.locator('body').innerText().catch(() => '');
  return pattern.test(text);
}

async function settlementRewardTextVisible(page) {
  const text = await page.locator('body').innerText().catch(() => '');
  const hasReputationReward =
    /\+?\s*100\s*(rep|reputation|声望)/i.test(text) || /(rep|reputation|声望)[\s\S]{0,60}\+?\s*100/i.test(text);
  const hasGemReward = /\+?\s*1\s*(gem|gems|宝石)/i.test(text) || /(gem|gems|宝石)[\s\S]{0,60}\+?\s*1/i.test(text);
  return (
    hasReputationReward &&
    hasGemReward &&
    /unlock|unlocked|opened|reveals|revealed|解锁|开放/i.test(text)
  );
}

async function stableChainOwnedVisible(page) {
  const text = await page.locator('body').innerText().catch(() => '');
  return /(Stable Chain|稳定链)/i.test(text) && /(owned|purchased|equipped|selected|已拥有|已购买|已装备|已选择|已解锁|unlocked)/i.test(text);
}

async function stableChainNextRunImpactVisible(page) {
  const text = await page.locator('[data-testid="next-run-preview"]').innerText().catch(() => '');
  return (
    /(Stable Chain|稳定链)/i.test(text) &&
    /(equipped|selected|stable starter deck|已装备|已选择|稳定起始牌组)/i.test(text) &&
    /(Wild Gap Key|Severance Burst|stable starter deck|野隙钥|断离爆发|野性|终结|起始牌组|Starting deck)/i.test(text) &&
    !/(Starter\s+Default Chain|起手链\s+默认链)/i.test(text)
  );
}

async function d1ClearVisible(page) {
  const text = await page.locator('body').innerText().catch(() => '');
  return /(D1|District 1|第\s*1|一区)/i.test(text) && /(clear|cleared|complete|completed|已通关|完成|清理)/i.test(text);
}

async function secondRunUsesStableChain(page) {
  const text = await page.locator('[data-testid="district-d1-run"]').innerText().catch(() => '');
  const proof = await page
    .locator('[data-testid="district-d1-run"]')
    .evaluate((element) => ({
      runId: element.getAttribute('data-run-id'),
      starterKitId: element.getAttribute('data-starter-kit-id'),
      deckModifierId: element.getAttribute('data-deck-modifier-id'),
      starterCardIds: element.getAttribute('data-starter-card-ids')
    }))
    .catch(() => null);
  return (
    /(Iron Monk|铁僧)/i.test(text) &&
    /(Stable Chain|稳定链)/i.test(text) &&
    /(Wild Gap Key|野隙钥)/i.test(text) &&
    /(Severance Burst|断离爆发)/i.test(text) &&
    !/(Default Chain|默认链)/i.test(text) &&
    proof?.runId === 'run-2' &&
    proof?.starterKitId === 'starter.stable_chain' &&
    proof?.deckModifierId === 'starter.stable_chain.deck' &&
    proof?.starterCardIds === 'debt_hook,wild_gap_key,severance_burst'
  );
}

async function secondRunStorageProof(page) {
  return await page
    .evaluate((storageKey) => {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return { ok: false, reason: 'missing_storage', storageKey };
      }

      try {
        const profile = JSON.parse(raw);
        const phaseEvents = Array.isArray(profile?.orchestrator?.phaseEvents) ? profile.orchestrator.phaseEvents : [];
        const startedRun2 = phaseEvents.some((event) => event?.type === 'p0.d1.started' && event?.runId === 'run-2');
        const proof = {
          storageKey,
          nextRunSequence: profile?.orchestrator?.nextRunSequence,
          selectedStarterKitId: profile?.starter?.selectedStarterKitId,
          selectedCrawlerId: profile?.starter?.selectedCrawlerId,
          unlockedCrawlerIds: Array.isArray(profile?.starter?.unlockedCrawlerIds) ? profile.starter.unlockedCrawlerIds : [],
          startedRun2,
          phaseEventCount: phaseEvents.length
        };

        return {
          ...proof,
          ok:
            proof.nextRunSequence === 3 &&
            proof.selectedStarterKitId === 'starter.stable_chain' &&
            proof.selectedCrawlerId === 'crawler.iron_monk' &&
            proof.unlockedCrawlerIds.includes('crawler.iron_monk') &&
            startedRun2
        };
      } catch (error) {
        return { ok: false, reason: 'invalid_json', storageKey, error: error instanceof Error ? error.message : String(error) };
      }
    }, profileStorageKey)
    .catch((error) => ({ ok: false, reason: 'evaluation_failed', error: error instanceof Error ? error.message : String(error) }));
}

function recordFlow(result, name, passed, detail = null) {
  result.flow.push({
    name,
    status: passed ? 'pass' : 'failed',
    ...(detail ? { detail } : {})
  });
}

function buildViewportFailures(result) {
  const failedGates = [];
  if (result.consoleErrors.length > 0) {
    failedGates.push({ type: 'console_errors', count: result.consoleErrors.length, errors: result.consoleErrors });
  }
  if (result.pageErrors.length > 0) {
    failedGates.push({ type: 'page_errors', count: result.pageErrors.length, errors: result.pageErrors });
  }
  for (const flowStep of result.flow) {
    if (flowStep.status !== 'pass') {
      failedGates.push({ type: 'flow_step_failed', step: flowStep.name, detail: flowStep.detail ?? null });
    }
  }
  for (const stageCheck of result.stageChecks) {
    if (stageCheck.status !== 'pass') {
      failedGates.push({ type: 'stage_check_failed', stage: stageCheck.stage, failures: stageCheck.failures });
    }
  }
  if (result.screenshots.length !== screenshotStages.length) {
    failedGates.push({
      type: 'missing_screenshots',
      expected: screenshotStages,
      actual: result.screenshots.map((screenshot) => screenshot.name)
    });
  }
  return failedGates;
}

function buildGates(currentReport) {
  const viewportResults = currentReport.results.map((result) => ({
    viewport: result.viewport.name,
    status: result.status,
    failedGateCount: result.failedGates.length
  }));
  return {
    browserProofPresent: currentReport.results.length === viewports.length,
    allViewportsPassed: currentReport.results.length === viewports.length && currentReport.results.every((result) => result.status === 'pass'),
    noScriptErrors: currentReport.errors.length === 0,
    viewportResults
  };
}

function buildGateScore(gates) {
  const checks = [gates.browserProofPresent, gates.allViewportsPassed, gates.noScriptErrors];
  return {
    passed: checks.filter(Boolean).length,
    total: checks.length
  };
}

function classifyStatus(currentReport) {
  if (currentReport.errors.length > 0) {
    return 'failed';
  }
  return currentReport.results.length === viewports.length && currentReport.results.every((result) => result.status === 'pass')
    ? 'pass'
    : 'failed';
}

async function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    path.join(projectRoot, 'node_modules/playwright/index.mjs'),
    '/Users/roc/.codex/worktrees/9487/gstack/node_modules/playwright/index.mjs'
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (candidate === process.env.PLAYWRIGHT_MODULE || existsSync(candidate)) {
        return await import(pathToFileURL(candidate).href);
      }
    } catch {
      // Try the next known location.
    }
  }

  try {
    return await import('playwright');
  } catch (error) {
    throw new Error(`Playwright is not available. Set PLAYWRIGHT_MODULE to index.mjs. ${error.message}`);
  }
}

async function resolveServer(port) {
  const url = `http://127.0.0.1:${port}`;
  if (await waitForServer(url, 1_500)) {
    return { url, owned: false, pid: null, port };
  }

  if (!(await isPortFree(port))) {
    throw new Error(`Port ${port} is occupied but ${url} did not respond as a Vite app. Set QA_BASE_URL to the correct server.`);
  }

  const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: projectRoot,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.unref();

  const server = {
    owned: true,
    pid: child.pid,
    port,
    url,
    stdout: '',
    stderr: '',
    process: child
  };
  child.stdout?.on('data', (chunk) => {
    server.stdout += chunk.toString();
  });
  child.stderr?.on('data', (chunk) => {
    server.stderr += chunk.toString();
  });

  if (!(await waitForServer(url, 30_000))) {
    throw new Error(`Timed out waiting for ${url}. stdout=${server.stdout.slice(-500)} stderr=${server.stderr.slice(-500)}`);
  }
  return server;
}

async function waitForServer(url, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) {
        return true;
      }
    } catch {
      // Server is not ready yet.
    }
    await sleep(250);
  }
  return false;
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function closeAll() {
  const cleanupResult = {
    pagesClosed: 0,
    contextsClosed: 0,
    browserClosed: false,
    serverStopped: false,
    errors: []
  };

  for (const page of cleanup.pages.reverse()) {
    try {
      await page.close();
      cleanupResult.pagesClosed += 1;
    } catch (error) {
      cleanupResult.errors.push(serializeError(error));
    }
  }

  for (const context of cleanup.contexts.reverse()) {
    try {
      await context.close();
      cleanupResult.contextsClosed += 1;
    } catch (error) {
      cleanupResult.errors.push(serializeError(error));
    }
  }

  if (cleanup.browser) {
    try {
      await cleanup.browser.close();
      cleanupResult.browserClosed = true;
    } catch (error) {
      cleanupResult.errors.push(serializeError(error));
    }
  }

  if (cleanup.server?.owned && cleanup.server.process) {
    try {
      process.kill(-cleanup.server.process.pid, 'SIGTERM');
      cleanupResult.serverStopped = true;
    } catch (error) {
      cleanupResult.errors.push(serializeError(error));
    }
  }

  return cleanupResult;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cssEscape(value) {
  return value.replace(/["\\]/g, '\\$&');
}

function serializeError(error) {
  if (error instanceof Error) {
    return {
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {})
    };
  }
  return { message: String(error) };
}
