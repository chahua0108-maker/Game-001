#!/usr/bin/env node
import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(projectRoot, '..');
const qaRound = process.env.QA_ROUND ?? 'round-11';
const outputDir = path.resolve(repoRoot, `outputs/browser-qa/${qaRound}`);
const outputFile = path.join(outputDir, 'qa-ui-result.json');
const preferredPort = Number(process.env.QA_PORT ?? 5174);
const baseUrlOverride = process.env.QA_BASE_URL;
const viewports = [
  { name: 'desktop', width: 1366, height: 768 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-360', width: 360, height: 640 }
];

const selectors = [
  '.status-strip',
  '.status-chip strong',
  '.combat-director',
  '.director-cell strong',
  '.director-cell em',
  '.deal-panel',
  '.deal-panel button',
  '.target-panel',
  '.run-layer-panel',
  '.enemy-peek-toggle',
  '.card-row',
  '.card-rail-hint',
  '.card-button',
  '.card-button strong',
  '.card-cost',
  '.card-meta',
  '.chain-preview',
  '.card-intent-preview',
  '.card-authorization',
  '.card-payoff',
  '.card-effect',
  '.mobile-effect',
  '.payment-state-token',
  '.missing-cost',
  '.authorization-cost',
  '.build-gap-bar',
  '.build-gap-token',
  '.reward-panel',
  '.reward-card',
  '.reward-card strong',
  '.reward-card small',
  '.reward-card em',
  '.combat-feed',
  '.combat-feed li',
  '.debug-panel[open]',
  '.debug-panel[open] dd'
];

const cleanup = {
  pages: [],
  contexts: [],
  browser: null,
  server: null
};

const report = {
  name: 'qa-ui',
  qaRound,
  status: 'started',
  startedAt: new Date().toISOString(),
  config: {
    viewports,
    preferredPort,
    baseUrlOverride: baseUrlOverride ?? null
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
  const server = baseUrlOverride
    ? { url: baseUrlOverride, owned: false, pid: null, port: Number(new URL(baseUrlOverride).port || 80) }
    : await startServer(preferredPort);
  cleanup.server = server;
  report.server = {
    url: server.url,
    owned: server.owned,
    pid: server.pid,
    port: server.port,
    preferredPort,
    preflightPortCheck: server.preflightPortCheck ?? null
  };

  const { chromium } = await loadPlaywright();
  const launchOptions = { headless: true };
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (existsSync(chromePath)) {
    launchOptions.executablePath = chromePath;
  }
  cleanup.browser = await chromium.launch(launchOptions);

  for (const viewport of viewports) {
    const context = await cleanup.browser.newContext({ viewport });
    cleanup.contexts.push(context);
    const page = await context.newPage();
    cleanup.pages.push(page);

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    await page.goto(server.url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.waitForSelector('#hud .status-strip', { timeout: 10_000 });
    await page.waitForTimeout(100);

    const liveInitial = await inspectPage(page, 'live-initial');
    await clickIfVisible(page, '[data-deal]');
    await page.waitForTimeout(100);
    const liveAfterDeal = await inspectPage(page, 'live-after-deal');

    const paperEvidence = await buildPaperTopdeckHud(page);
    await page.waitForTimeout(100);
    const paperTopdeck = await inspectPage(page, 'paper-topdeck');
    const wildEvidence = await buildWildExtensionHud(page);
    await page.waitForTimeout(100);
    const wildExtension = await inspectPage(page, 'wild-extension');
    const endTurnStillUsable = await usableButton(page, '[data-end-turn]');
    const activityEvidence = await buildActivityCarryoverHud(page);
    await page.waitForTimeout(100);
    const activityCarryover = await inspectPage(page, 'activity-carryover');
    const cardReadabilityEvidence = await buildCardReadabilityHud(page);
    await page.waitForTimeout(100);
    const cardReadability = await inspectPage(page, 'card-readability');
    const rewardEmptyEvidence = await buildRewardEmptyHud(page);
    await page.waitForTimeout(100);
    const rewardEmpty = await inspectPage(page, 'reward-empty');
    const rewardExclusiveEvidence = await buildRewardExclusiveHud(page);
    await page.waitForTimeout(100);
    const rewardExclusive = await inspectPage(page, 'reward-exclusive');

    const findings = [
      ...liveInitial.failures,
      ...liveAfterDeal.failures,
      ...paperTopdeck.failures,
      ...wildExtension.failures,
      ...activityCarryover.failures,
      ...cardReadability.failures,
      ...rewardEmpty.failures,
      ...rewardExclusive.failures
    ];
    const horizontalOverflowDetected = [
      liveInitial,
      liveAfterDeal,
      paperTopdeck,
      wildExtension,
      activityCarryover,
      cardReadability,
      rewardEmpty,
      rewardExclusive
    ].some(
      (item) => item.pageOverflow.horizontal
    );
    const topdeckEvidenceVisible = paperEvidence.feedText.includes('整备：顶终结');
    const paperScenarioReached =
      paperEvidence.topdeck?.cardId === 'severance_burst' &&
      paperEvidence.handDealt?.cardIds?.[0] === 'severance_burst' &&
      paperEvidence.topdeckIndex >= 0 &&
      paperEvidence.handDealtIndex > paperEvidence.topdeckIndex;
    const wildScenarioReached =
      wildEvidence.extended?.type === 'ChainExtended' &&
      wildEvidence.extended?.extendedCost === 3 &&
      wildEvidence.extendedCardPlayed?.chainExtended === true &&
      wildEvidence.extendedCardPlayed?.effectMultiplier === 4;
    const extensionTokenVisible =
      wildEvidence.visibleText.includes('延展 MP 3') ||
      wildEvidence.visibleText.includes('延链MP3') ||
      wildEvidence.visibleText.includes('延MP3x4') ||
      wildEvidence.visibleText.includes('延MP3');
    const continuationTokenVisible = wildEvidence.visibleText.includes('续燃x5');
    const activityScenarioReached =
      activityEvidence.settlementText.includes('继承 D1 牌组与基础属性') &&
      activityEvidence.d2LevelId === 'd2' &&
      activityEvidence.restartLevelId === 'd2';
    const activityInheritanceTokenVisible =
      activityEvidence.d2RunLayerText.includes('活动继承牌组') &&
      activityEvidence.d2RunLayerText.includes('牌组') &&
      !activityEvidence.d2RunLayerText.includes('仅本run') &&
      !activityEvidence.d2RunLayerText.includes('永久');
    const cardReadabilityScenarioReached =
      cardReadabilityEvidence.cardIds.includes('debt_hook') &&
      cardReadabilityEvidence.cardIds.includes('wild_gap_key') &&
      cardReadabilityEvidence.cardIds.includes('static_overload') &&
      cardReadabilityEvidence.cardIds.includes('severance_burst');
    const expectedHandBaseText = `/${cardReadabilityEvidence.baseHandSize}`;
    const handBaseVisible =
      Number.isFinite(cardReadabilityEvidence.baseHandSize) &&
      cardReadabilityEvidence.pileText.includes('手') &&
      cardReadabilityEvidence.pileText.includes(expectedHandBaseText);
    const cardSemanticAttrsVisible =
      cardReadabilityEvidence.cardCount > 0 &&
      cardReadabilityEvidence.allCardsHaveSemanticAttrs &&
      cardReadabilityEvidence.allCardsHavePaymentState;
    const requiredTypeClasses = ['card-type-attack', 'card-type-repair', 'card-type-payoff', 'card-type-status'];
    const cardTypeSamplesVisible = requiredTypeClasses.every((className) =>
      cardReadabilityEvidence.visibleTypeClasses.includes(className)
    );
    const authorizationGrantVisible = cardReadabilityEvidence.visibleText.includes('临时授权3');
    const payoffAuthorizationLabelsVisible =
      cardReadabilityEvidence.visibleText.includes('授权可付') && cardReadabilityEvidence.unauthorizedText.includes('未授权');
    const lifecycleTokensVisible =
      cardReadabilityEvidence.visibleText.includes('状态 · 污染/不接链') &&
      cardReadabilityEvidence.visibleText.includes('净') &&
      cardReadabilityEvidence.visibleText.includes('留');
    const mobileEffectLabelsReady =
      cardReadabilityEvidence.mobileEffectLabels.includes('单体4') &&
      cardReadabilityEvidence.mobileEffectLabels.includes('前排5') &&
      cardReadabilityEvidence.mobileEffectLabels.includes('净化抽1') &&
      cardReadabilityEvidence.mobileEffectLabels.includes('全场16');
    const mobileEffectDisplayOk = cardReadabilityEvidence.mobileEffectDisplayOk;
    const mobileHandCardWidthOk = cardReadabilityEvidence.mobileHandCardWidthOk;
    const playerHudModeDefault =
      cardReadabilityEvidence.initialHudMode === 'player' &&
      cardReadabilityEvidence.playerDebugSurfacesHidden &&
      cardReadabilityEvidence.combatDialsVisible &&
      cardReadabilityEvidence.debugToggleVisible &&
      cardReadabilityEvidence.debugModeAfterToggle;
    const railHintVisible =
      playerHudModeDefault ||
      (cardReadabilityEvidence.railHintVisible &&
        cardReadabilityEvidence.railHintText.includes(`手牌 ${cardReadabilityEvidence.cardCount}/${cardReadabilityEvidence.baseHandSize} 可横滑`));
    const buildGapTokensVisible =
      playerHudModeDefault ||
      (cardReadabilityEvidence.buildGapVisible &&
        ['开链x', '承接x', '展开x', '终结x', '修补x', '污染x'].every((token) =>
          cardReadabilityEvidence.buildGapText.includes(token)
        ) &&
        cardReadabilityEvidence.buildGapRoles.includes('payoff') &&
        cardReadabilityEvidence.buildGapRoles.includes('repair'));
    const firstHandCopyVisible =
      (cardReadabilityEvidence.unauthorizedText.includes('先打 MP 0') ||
        cardReadabilityEvidence.unauthorizedText.includes('等待0费起链')) &&
      !cardReadabilityEvidence.visibleText.includes('非起x1') &&
      !cardReadabilityEvidence.unauthorizedText.includes('非起x1') &&
      !cardReadabilityEvidence.visibleText.includes('给授权 +3') &&
      !cardReadabilityEvidence.unauthorizedText.includes('给授权 +3');
    const rewardEmptyShellHidden = rewardEmptyEvidence.rewardPanelCount === 0;
    const rewardExclusiveVisible =
      rewardExclusiveEvidence.rewardPanelVisible &&
      rewardExclusiveEvidence.rewardCardCount >= 3 &&
      rewardExclusiveEvidence.cardRowDimmed &&
      rewardExclusiveEvidence.cardRowDisabled &&
      rewardExclusiveEvidence.overlayBlocksPointerEvents;

    report.results.push({
      viewport,
      consoleErrorCount: consoleErrors.length,
      consoleErrors,
      horizontalOverflowDetected,
      textOverflowCount: findings.length,
      findings,
      acceptedCount:
        liveInitial.accepted.length +
        liveAfterDeal.accepted.length +
        paperTopdeck.accepted.length +
        wildExtension.accepted.length +
        activityCarryover.accepted.length +
        cardReadability.accepted.length +
        rewardEmpty.accepted.length +
        rewardExclusive.accepted.length,
      paperScenarioReached,
      topdeckEvidenceVisible,
      topdeckToken: topdeckEvidenceVisible ? '整备：顶终结' : null,
      wildScenarioReached,
      activityScenarioReached,
      cardReadabilityScenarioReached,
      extensionTokenVisible,
      continuationTokenVisible,
      activityInheritanceTokenVisible,
      handBaseVisible,
      expectedHandBaseText,
      cardSemanticAttrsVisible,
      cardTypeSamplesVisible,
      authorizationGrantVisible,
      payoffAuthorizationLabelsVisible,
      lifecycleTokensVisible,
      mobileEffectLabelsReady,
      mobileEffectDisplayOk,
      mobileHandCardWidthOk,
      railHintVisible,
      buildGapTokensVisible,
      playerHudModeDefault,
      firstHandCopyVisible,
      pileActuallyVisible: cardReadabilityEvidence.pileActuallyVisible || playerHudModeDefault,
      pileTextFits: cardReadabilityEvidence.pileTextFits,
      rawPileTextFits: cardReadabilityEvidence.pileTextFits,
      rewardEmptyShellHidden,
      rewardExclusiveVisible,
      extensionToken: extensionTokenVisible ? '延展 MP 3' : null,
      continuationToken: continuationTokenVisible ? '续燃x5' : null,
      activityInheritanceToken: activityInheritanceTokenVisible ? '活动继承牌组' : null,
      endTurnStillUsable,
      paperEvidence,
      wildEvidence,
      activityEvidence,
      cardReadabilityEvidence,
      rewardEmptyEvidence,
      rewardExclusiveEvidence,
      samples: [
        ...wildExtension.samples,
        ...activityCarryover.samples,
        ...cardReadability.samples,
        ...rewardEmpty.samples,
        ...rewardExclusive.samples
      ].slice(0, 12)
    });
  }
} catch (error) {
  report.status = 'failed-before-cleanup';
  report.errors.push(serializeError(error));
} finally {
  report.cleanup = await closeAll();
  report.finishedAt = new Date().toISOString();
  report.gates = buildGates(report);
  report.gateScore = buildGateScore(report);
  report.status = classifyStatus(report);
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.status === 'pass' ? 0 : 1;
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

async function startServer(startPort) {
  let port = startPort;
  const preflightPortCheck = await waitForOwnedPortRelease(port, 5_000);
  if (!preflightPortCheck.ok) {
    throw new Error(`Port ${port} still has same-project dev listeners after preflight cleanup`);
  }
  while (!(await isPortFree(port))) {
    port += 1;
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
    url: `http://127.0.0.1:${port}`,
    stdout: '',
    stderr: '',
    process: child,
    preflightPortCheck
  };
  child.stdout?.on('data', (chunk) => {
    server.stdout += chunk.toString();
  });
  child.stderr?.on('data', (chunk) => {
    server.stderr += chunk.toString();
  });

  await waitForServer(server.url, 30_000);
  return server;
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        return;
      }
    } catch {
      // Server not ready yet.
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
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

async function clickIfVisible(page, selector) {
  const locator = page.locator(selector).first();
  if (await locator.isVisible().catch(() => false)) {
    await locator.click({ timeout: 2_000 }).catch(() => false);
    return true;
  }
  return false;
}

async function usableButton(page, selector) {
  return await page
    .locator(selector)
    .first()
    .evaluate((button) => {
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      return (
        !button.disabled &&
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
}

async function buildPaperTopdeckHud(page) {
  return await page.evaluate(async () => {
    const [{ createInitialWorld }, { tickWorld }, { buildSnapshot }, { Hud }] = await Promise.all([
      import('/src/sim/world.ts'),
      import('/src/sim/runtime.ts'),
      import('/src/sim/snapshot.ts'),
      import('/src/ui/hud.ts')
    ]);

    document.body.innerHTML = '<div id="hud"></div>';
    const root = document.querySelector('#hud');
    const hud = new Hud(root, () => {});
    const world = createInitialWorld();
    tickWorld(world, [{ type: 'advance-time', deltaSeconds: 0.016, traceId: 'qa-deal' }]);

    for (const enemy of Object.values(world.enemies)) {
      enemy.hp = 50;
      enemy.maxHp = 50;
    }

    world.player.hand = ['debt_hook', 'redline_cut', 'paper_shatter'];
    world.player.drawPile = ['spark_tap', 'severance_burst', 'wild_gap_key'];
    world.player.discardPile = [];
    tickWorld(world, [{ type: 'play-card', cardId: 'debt_hook', targetId: 'enemy-1', traceId: 'qa-0' }]);
    tickWorld(world, [{ type: 'play-card', cardId: 'redline_cut', targetId: 'enemy-2', traceId: 'qa-1' }]);
    tickWorld(world, [{ type: 'play-card', cardId: 'paper_shatter', traceId: 'qa-paper' }]);

    hud.render(buildSnapshot(world));

    const topdeckIndex = world.debug.events.findIndex(
      (event) => event.traceId === 'qa-paper' && event.type === 'PayoffTopdecked'
    );
    const handDealtIndex = world.debug.events.findIndex(
      (event) => event.traceId === 'qa-paper' && event.type === 'HandDealt'
    );
    const topdeck = world.debug.events[topdeckIndex] ?? null;
    const handDealt = world.debug.events[handDealtIndex] ?? null;
    const feedText = document.querySelector('.combat-feed')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

    return {
      topdeck,
      handDealt,
      topdeckIndex,
      handDealtIndex,
      feedText,
      hand: [...world.player.hand],
      drawPile: [...world.player.drawPile]
    };
  });
}

async function buildWildExtensionHud(page) {
  return await page.evaluate(async () => {
    const [{ createInitialWorld }, { tickWorld }, { buildSnapshot }, { Hud }] = await Promise.all([
      import('/src/sim/world.ts'),
      import('/src/sim/runtime.ts'),
      import('/src/sim/snapshot.ts'),
      import('/src/ui/hud.ts')
    ]);

    document.body.innerHTML = '<div id="hud"></div>';
    const root = document.querySelector('#hud');
    const hud = new Hud(root, () => {});
    const world = createInitialWorld();
    tickWorld(world, [{ type: 'advance-time', deltaSeconds: 0.016, traceId: 'qa-wild-deal' }]);

    for (const enemy of Object.values(world.enemies)) {
      enemy.hp = 200;
      enemy.maxHp = 200;
    }

    world.player.maxEnergy = 4;
    world.player.energy = 4;
    world.player.hand = ['debt_hook', 'redline_cut', 'row_cleave', 'wild_gap_key', 'severance_burst'];
    world.player.drawPile = [];
    world.player.discardPile = [];

    tickWorld(world, [{ type: 'play-card', cardId: 'debt_hook', targetId: 'enemy-1', traceId: 'qa-wild-0' }]);
    tickWorld(world, [{ type: 'play-card', cardId: 'redline_cut', targetId: 'enemy-2', traceId: 'qa-wild-1' }]);
    tickWorld(world, [{ type: 'play-card', cardId: 'row_cleave', traceId: 'qa-wild-2' }]);
    tickWorld(world, [{ type: 'play-card', cardId: 'wild_gap_key', targetId: 'enemy-3', traceId: 'qa-wild-3' }]);

    hud.render(buildSnapshot(world));

    const extended = world.debug.events.find((event) => event.traceId === 'qa-wild-3' && event.type === 'ChainExtended') ?? null;
    const extendedCardPlayed =
      world.debug.events.find((event) => event.traceId === 'qa-wild-3' && event.type === 'CardPlayed') ?? null;
    const visibleText = document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const chainPreviews = Array.from(document.querySelectorAll('.chain-preview')).map((item) =>
      item.textContent?.replace(/\s+/g, ' ').trim()
    );

    return {
      extended,
      extendedCardPlayed,
      visibleText,
      chainPreviews,
      hand: [...world.player.hand],
      energy: world.player.energy,
      tempAuthorizationMP: world.player.tempAuthorizationMP,
      chain: { ...world.chain }
    };
  });
}

async function buildActivityCarryoverHud(page) {
  return await page.evaluate(async () => {
    const [{ createInitialActivityState }, { createInitialWorld }, { tickWorld }, { buildSnapshot }, { Hud }] =
      await Promise.all([
        import('/src/sim/activity.ts'),
        import('/src/sim/world.ts'),
        import('/src/sim/runtime.ts'),
        import('/src/sim/snapshot.ts'),
        import('/src/ui/hud.ts')
      ]);

    function forceFinalRewardReady(world, choices) {
      world.run.currentNode = world.run.maxNodes;
      world.fsm.gameFlow = 'Reward';
      world.reward = {
        ...world.reward,
        choices: [...choices],
        candidateCardPool: [...choices],
        pending: true,
        source: 'level-up'
      };
    }

    document.body.innerHTML = '<div id="hud"></div>';
    const root = document.querySelector('#hud');
    const hud = new Hud(root, () => {});
    let world = createInitialWorld(1, createInitialActivityState());

    forceFinalRewardReady(world, ['severance_burst', 'wild_gap_key', 'blood_reclaim']);
    tickWorld(world, [{ type: 'select-reward', cardId: 'severance_burst', traceId: 'qa-activity-d1-reward' }]);
    hud.render(buildSnapshot(world));
    const settlementText = document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';

    world = tickWorld(world, [{ type: 'continue-activity', traceId: 'qa-activity-continue-d2' }]);
    hud.render(buildSnapshot(world));
    const d2Text = document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const d2RunLayerText = document.querySelector('.run-layer-panel')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const d2LevelId = world.activity?.currentLevelId ?? null;

    forceFinalRewardReady(world, ['wild_gap_key', 'blood_reclaim', 'pulse_draw']);
    tickWorld(world, [{ type: 'select-reward', cardId: 'wild_gap_key', traceId: 'qa-activity-d2-midrun-reward' }]);
    world = tickWorld(world, [{ type: 'restart-current-level', traceId: 'qa-activity-restart-d2' }]);
    hud.render(buildSnapshot(world));
    const restartText = document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const restartLevelId = world.activity?.currentLevelId ?? null;

    return {
      settlementText,
      d2Text,
      d2RunLayerText,
      d2LevelId,
      restartText,
      restartLevelId,
      deck: [...world.player.deck],
      maxEnergy: world.player.maxEnergy
    };
  });
}

async function buildCardReadabilityHud(page) {
  return await page.evaluate(async () => {
    const [{ createInitialWorld }, { buildSnapshot }, { Hud }, { BASE_HAND_SIZE }] = await Promise.all([
      import('/src/sim/world.ts'),
      import('/src/sim/snapshot.ts'),
      import('/src/ui/hud.ts'),
      import('/src/sim/constants.ts')
    ]);

    document.body.innerHTML = '<div id="hud"></div>';
    const root = document.querySelector('#hud');
    const hud = new Hud(root, () => {});
    const world = createInitialWorld();

    world.fsm.gameFlow = 'PlayerTurn';
    world.player.maxEnergy = 3;
    world.player.energy = 0;
    world.player.tempAuthorizationMP = 0;
    world.player.lastPlayedCost = null;
    world.player.costChainMultiplier = 1;
    world.chain.playedCosts = [];
    world.chain.lastCost = null;
    world.chain.nextExpectedCost = 0;
    world.chain.multiplier = 1;
    world.chain.broken = false;
    world.player.hand = [
      'debt_hook',
      'row_cleave',
      'clearance_order',
      'wild_gap_key',
      'static_overload',
      'last_light_cache',
      'silt_purge',
      'severance_burst'
    ];
    world.player.deck = [
      'debt_hook',
      'redline_cut',
      'row_cleave',
      'wild_gap_key',
      'static_overload',
      'last_light_cache',
      'silt_purge',
      'severance_burst'
    ];
    world.player.drawPile = [];
    world.player.discardPile = [];
    hud.render(buildSnapshot(world));
    const initialHudMode = root.getAttribute('data-hud-mode');
    const modeToggle = document.querySelector('[data-hud-mode-toggle]');
    const modeToggleRect = modeToggle?.getBoundingClientRect();
    const modeToggleStyle = modeToggle ? getComputedStyle(modeToggle) : null;
    const playerHiddenSelectors = [
      '.build-gap-bar',
      '.combat-director',
      '.finisher-decision-bar',
      '.target-panel',
      '.run-layer-panel',
      '.enemy-peek',
      '.combat-feed',
      '.debug-panel',
      '.card-rail-hint'
    ];
    const playerDebugSurfacesHidden = playerHiddenSelectors.every((selector) => {
      const element = document.querySelector(selector);
      if (!element) {
        return true;
      }
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0;
    });
    const dials = document.querySelector('.crawler-combat-dials');
    const dialsRect = dials?.getBoundingClientRect();
    const dialsStyle = dials ? getComputedStyle(dials) : null;
    const combatDialsVisible = Boolean(
      dials &&
        dialsStyle &&
        dialsStyle.display !== 'none' &&
        dialsStyle.visibility !== 'hidden' &&
        dialsRect &&
        dialsRect.width > 0 &&
        dialsRect.height > 0
    );
    const debugToggleVisible = Boolean(
      modeToggle &&
        modeToggleStyle &&
        modeToggleStyle.display !== 'none' &&
        modeToggleStyle.visibility !== 'hidden' &&
        modeToggleRect &&
        modeToggleRect.width > 0 &&
        modeToggleRect.height > 0
    );
    if (modeToggle) {
      modeToggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
    const debugModeAfterToggle = root.getAttribute('data-hud-mode') === 'debug';
    const playerToggle = document.querySelector('[data-hud-mode-toggle]');
    if (playerToggle) {
      playerToggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
    const unauthorizedText = document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';

    world.player.energy = 2;
    world.player.tempAuthorizationMP = 3;
    world.player.lastPlayedCost = 0;
    world.player.costChainMultiplier = 1;
    world.chain.playedCosts = [0];
    world.chain.lastCost = 0;
    world.chain.nextExpectedCost = 1;
    world.chain.multiplier = 1;
    hud.render(buildSnapshot(world));

    const buttons = Array.from(document.querySelectorAll('.card-button[data-card-id]'));
    const visibleText = document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const pileChip = document.querySelector('.pile-chip');
    const pileSpan = pileChip?.querySelector('span') ?? null;
    const pileRect = pileChip?.getBoundingClientRect();
    const pileStyle = pileChip ? getComputedStyle(pileChip) : null;
    const pileText = pileChip?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const domBaseHandSize = Number(pileChip?.getAttribute('data-base-hand-size'));
    const titleTexts = buttons.map((button) => button.querySelector('strong')?.textContent?.trim() ?? '');
    const cardWidths = buttons.map((button) => Math.round(button.getBoundingClientRect().width));
    const mobileEffectLabels = buttons.map((button) => button.querySelector('.mobile-effect')?.textContent?.trim() ?? '');
    const mobileEffectDisplayOk =
      window.innerWidth > 640 ||
      buttons.every((button) => {
        const mobileEffect = button.querySelector('.mobile-effect');
        const desktopEffect = button.querySelector('.desktop-effect');
        return (
          mobileEffect &&
          desktopEffect &&
          getComputedStyle(mobileEffect).display !== 'none' &&
          getComputedStyle(desktopEffect).display === 'none'
        );
      });
    const mobileHandCardWidthOk = window.innerWidth > 640 || cardWidths.every((width) => width >= 188 && width <= 206);
    const railHint = document.querySelector('.card-rail-hint');
    const railHintRect = railHint?.getBoundingClientRect();
    const railHintStyle = railHint ? getComputedStyle(railHint) : null;
    const railHintText = railHint?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const railHintVisible = Boolean(
      railHint &&
        railHintStyle &&
        railHintStyle.display !== 'none' &&
        railHintStyle.visibility !== 'hidden' &&
        railHintRect &&
        railHintRect.width > 0 &&
        railHintRect.height > 0 &&
        railHintRect.left >= -1 &&
        railHintRect.right <= window.innerWidth + 1 &&
        railHintRect.top >= -1 &&
        railHintRect.bottom <= window.innerHeight + 1
    );
    const buildGapBar = document.querySelector('.build-gap-bar');
    const buildGapRect = buildGapBar?.getBoundingClientRect();
    const buildGapStyle = buildGapBar ? getComputedStyle(buildGapBar) : null;
    const buildGapText = buildGapBar?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const buildGapVisible = Boolean(
      buildGapBar &&
        buildGapStyle &&
        buildGapStyle.display !== 'none' &&
        buildGapStyle.visibility !== 'hidden' &&
        buildGapRect &&
        buildGapRect.width > 0 &&
        buildGapRect.height > 0 &&
        buildGapRect.left >= -1 &&
        buildGapRect.right <= window.innerWidth + 1 &&
        buildGapRect.top >= -1 &&
        buildGapRect.bottom <= window.innerHeight + 1
    );
    const buildGapRoles = Array.from(document.querySelectorAll('.build-gap-token')).map((token) =>
      token.getAttribute('data-build-gap-role')
    );
    const visibleTypeClasses = Array.from(
      new Set(
        buttons.flatMap((button) =>
          Array.from(button.classList).filter((className) => className.startsWith('card-type-'))
        )
      )
    );

    return {
      visibleText,
      unauthorizedText,
      initialHudMode,
      playerDebugSurfacesHidden,
      combatDialsVisible,
      debugToggleVisible,
      debugModeAfterToggle,
      pileText,
      pileActuallyVisible: Boolean(
        pileChip &&
          pileStyle &&
          pileStyle.display !== 'none' &&
          pileStyle.visibility !== 'hidden' &&
          pileRect &&
          pileRect.width > 0 &&
          pileRect.height > 0 &&
          pileRect.left >= -1 &&
          pileRect.right <= window.innerWidth + 1 &&
          pileRect.top >= -1 &&
          pileRect.bottom <= window.innerHeight + 1
      ),
      pileTextFits: Boolean(pileSpan && pileSpan.scrollWidth <= pileSpan.clientWidth + 1),
      baseHandSize: Number.isFinite(domBaseHandSize) ? domBaseHandSize : BASE_HAND_SIZE,
      cardCount: buttons.length,
      cardIds: buttons.map((button) => button.getAttribute('data-card-id')),
      titleTexts,
      cardWidths,
      mobileEffectLabels,
      mobileEffectDisplayOk,
      mobileHandCardWidthOk,
      railHintText,
      railHintVisible,
      buildGapText,
      buildGapVisible,
      buildGapRoles,
      allCardsHaveSemanticAttrs: buttons.every(
        (button) => button.hasAttribute('data-card-type') && button.hasAttribute('data-chain-role')
      ),
      allCardsHavePaymentState: buttons.every((button) => button.hasAttribute('data-payment-state')),
      visibleTypeClasses,
      paymentStates: buttons.map((button) => button.getAttribute('data-payment-state'))
    };
  });
}

async function buildRewardEmptyHud(page) {
  return await page.evaluate(async () => {
    const [{ createInitialWorld }, { buildSnapshot }, { Hud }] = await Promise.all([
      import('/src/sim/world.ts'),
      import('/src/sim/snapshot.ts'),
      import('/src/ui/hud.ts')
    ]);

    document.body.innerHTML = '<div id="hud"></div>';
    const root = document.querySelector('#hud');
    const hud = new Hud(root, () => {});
    const world = createInitialWorld();
    world.fsm.gameFlow = 'Reward';
    world.reward.pending = false;
    world.reward.choices = [];
    world.player.hand = [];
    hud.render(buildSnapshot(world));

    return {
      visibleText: document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      rewardPanelCount: document.querySelectorAll('.reward-panel').length
    };
  });
}

async function buildRewardExclusiveHud(page) {
  return await page.evaluate(async () => {
    const [{ createInitialWorld }, { buildSnapshot }, { Hud }] = await Promise.all([
      import('/src/sim/world.ts'),
      import('/src/sim/snapshot.ts'),
      import('/src/ui/hud.ts')
    ]);

    document.body.innerHTML = '<div id="hud"></div>';
    const root = document.querySelector('#hud');
    const hud = new Hud(root, () => {});
    const world = createInitialWorld();
    world.fsm.gameFlow = 'Reward';
    world.reward.pending = true;
    world.reward.choices = ['severance_burst', 'wild_gap_key', 'blood_reclaim'];
    world.player.hand = ['debt_hook', 'row_cleave', 'wild_gap_key', 'severance_burst'];
    hud.render(buildSnapshot(world));

    const rewardPanel = document.querySelector('.reward-panel');
    const rewardRect = rewardPanel?.getBoundingClientRect();
    const rewardStyle = rewardPanel ? getComputedStyle(rewardPanel) : null;
    const cardRow = document.querySelector('.card-row');
    const cardRowStyle = cardRow ? getComputedStyle(cardRow) : null;
    const hudRoot = document.querySelector('#hud');
    const overlayStyle = hudRoot ? getComputedStyle(hudRoot, '::before') : null;

    return {
      visibleText: document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      rewardPanelVisible: Boolean(
        rewardPanel &&
          rewardStyle &&
          rewardStyle.display !== 'none' &&
          rewardStyle.visibility !== 'hidden' &&
          rewardRect &&
          rewardRect.width > 0 &&
          rewardRect.height > 0 &&
          rewardRect.left >= -1 &&
          rewardRect.right <= window.innerWidth + 1 &&
          rewardRect.top >= -1 &&
          rewardRect.bottom <= window.innerHeight + 1
      ),
      rewardCardCount: document.querySelectorAll('.reward-card').length,
      cardRowDimmed: Boolean(cardRowStyle && Number.parseFloat(cardRowStyle.opacity) <= 0.25),
      cardRowDisabled: Boolean(cardRowStyle && cardRowStyle.pointerEvents === 'none'),
      overlayBlocksPointerEvents: Boolean(
        overlayStyle && overlayStyle.content !== 'none' && overlayStyle.pointerEvents === 'auto'
      )
    };
  });
}

async function inspectPage(page, phase) {
  return await page.evaluate(
    ({ phase, selectors }) => {
      const failures = [];
      const accepted = [];
      const samples = [];
      const rawTokenPattern =
        /CardTopdecked|DeckSearchMissed|PayoffTopdecked|PayoffTopdeckMissed|ChainExtended|SearchAndTopdeck|TopdeckPayoffFromDrawPile|RouteSelect|\bFSM\b|pointer|payoff|drawPile|discardPile|rewardCardPool|candidateCardPool|\b[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*){2,}\b|undefined|NaN|\[object Object\]/i;

      const pageOverflow = {
        horizontal:
          Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) >
          document.documentElement.clientWidth + 1,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.body?.scrollWidth || 0,
        bodyClientWidth: document.body?.clientWidth || 0
      };

      if (pageOverflow.horizontal) {
        failures.push({
          phase,
          category: 'fail-viewport-overflow',
          severity: 'blocker',
          ruleId: 'PAGE_HORIZONTAL_OVERFLOW',
          selector: 'document',
          text: '',
          reason: 'page-level horizontal overflow detected',
          metrics: pageOverflow
        });
      }

      for (const selector of selectors) {
        for (const [index, el] of Array.from(document.querySelectorAll(selector)).entries()) {
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
          const visible =
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom >= 0 &&
            rect.top <= window.innerHeight;
          if (!visible) {
            continue;
          }

          const overflowX = el.scrollWidth - el.clientWidth > 1;
          const overflowY = el.scrollHeight - el.clientHeight > 1;
          const outsideX = rect.left < -1 || rect.right > window.innerWidth + 1;
          const outsideY = rect.top < -1 || rect.bottom > window.innerHeight + 1;
          const insideCardRail = selector !== '.card-row' && Boolean(el.closest('.card-row'));
          const isCardRail = selector === '.card-row';
          const isScrollPanel = selector === '.reward-panel';
          const singleLineEllipsis =
            style.overflow === 'hidden' &&
            style.textOverflow === 'ellipsis' &&
            style.whiteSpace === 'nowrap';
          const clipsVerticalOverflow =
            ['hidden', 'clip'].includes(style.overflowY) || ['hidden', 'clip'].includes(style.overflow);
          const scrollPanelY = ['auto', 'scroll'].includes(style.overflowY) || ['auto', 'scroll'].includes(style.overflow);
          const metrics = {
            rect: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            clientWidth: el.clientWidth,
            scrollWidth: el.scrollWidth,
            clientHeight: el.clientHeight,
            scrollHeight: el.scrollHeight,
            overflow: style.overflow,
            overflowX: style.overflowX,
            overflowY: style.overflowY,
            textOverflow: style.textOverflow,
            whiteSpace: style.whiteSpace
          };

          if (samples.length < 12 && ['.card-button', '.deal-panel', '.combat-director', '.combat-feed'].includes(selector)) {
            samples.push({ selector, index, text: text.slice(0, 160), metrics });
          }

          if (rawTokenPattern.test(text)) {
            failures.push({
              phase,
              category: 'fail-hidden-critical-text',
              severity: 'blocker',
              ruleId: 'RAW_DEBUG_TOKEN_VISIBLE',
              selector,
              index,
              text: text.slice(0, 160),
              reason: 'player-visible text leaked raw debug/runtime token',
              metrics
            });
            continue;
          }

          if (isCardRail) {
            const contained = rect.left >= -1 && rect.right <= window.innerWidth + 1 && rect.top >= -1 && rect.bottom <= window.innerHeight + 1;
            const needsHorizontalRail = el.scrollWidth > el.clientWidth + 1;
            const ok = contained && (!needsHorizontalRail || ['auto', 'scroll'].includes(style.overflowX));
            (ok ? accepted : failures).push({
              phase,
              category: ok ? 'accepted-horizontal-rail' : 'fail-viewport-overflow',
              severity: ok ? 'info' : 'blocker',
              ruleId: 'CARD_ROW_RAIL',
              selector,
              index,
              text: text.slice(0, 160),
              reason: ok
                ? needsHorizontalRail
                  ? 'hand rail may scroll horizontally inside its container'
                  : 'desktop hand row is contained without rail scrolling'
                : 'hand row is not contained or lacks required horizontal scrolling',
              metrics
            });
            continue;
          }

          if (isScrollPanel && overflowY && scrollPanelY && !outsideX && !outsideY) {
            accepted.push({
              phase,
              category: 'accepted-scroll-panel',
              severity: 'info',
              ruleId: 'REWARD_PANEL_SCROLL',
              selector,
              index,
              text: text.slice(0, 160),
              reason: 'reward panel is allowed to scroll internally',
              metrics
            });
            continue;
          }

          if (outsideX && !insideCardRail) {
            failures.push({
              phase,
              category: 'fail-viewport-overflow',
              severity: 'blocker',
              ruleId: 'ELEMENT_OUTSIDE_VIEWPORT_X',
              selector,
              index,
              text: text.slice(0, 160),
              reason: 'element extends outside viewport horizontally',
              metrics
            });
          }

          if (outsideY) {
            failures.push({
              phase,
              category: 'fail-viewport-overflow',
              severity: 'blocker',
              ruleId: 'ELEMENT_OUTSIDE_VIEWPORT_Y',
              selector,
              index,
              text: text.slice(0, 160),
              reason: 'element extends outside viewport vertically',
              metrics
            });
          }

          if (overflowX && !singleLineEllipsis) {
            failures.push({
              phase,
              category: 'fail-text-horizontal-overflow',
              severity: 'major',
              ruleId: 'TEXT_HORIZONTAL_OVERFLOW',
              selector,
              index,
              text: text.slice(0, 160),
              reason: 'text/content overflows without ellipsis protection',
              metrics
            });
          } else if (overflowX && singleLineEllipsis) {
            accepted.push({
              phase,
              category: 'accepted-ellipsis',
              severity: 'minor',
              ruleId: 'ELLIPSIS_PROTECTED',
              selector,
              index,
              text: text.slice(0, 160),
              reason: 'overflow is protected by ellipsis',
              metrics
            });
          }

          if (overflowY && clipsVerticalOverflow && !singleLineEllipsis) {
            failures.push({
              phase,
              category: 'fail-hidden-vertical-overflow',
              severity: 'blocker',
              ruleId: 'HIDDEN_VERTICAL_CLIP',
              selector,
              index,
              text: text.slice(0, 160),
              reason: 'visible HUD content is vertically clipped by hidden overflow; only explicit single-line ellipsis is allowed',
              metrics
            });
          } else if (
            overflowY &&
            !['hidden', 'auto', 'scroll', 'clip'].includes(style.overflow) &&
            !['hidden', 'auto', 'scroll', 'clip'].includes(style.overflowY)
          ) {
            failures.push({
              phase,
              category: 'fail-text-vertical-overflow',
              severity: 'major',
              ruleId: 'TEXT_VERTICAL_OVERFLOW',
              selector,
              index,
              text: text.slice(0, 160),
              reason: 'content overflows vertically without clipping or scroll protection',
              metrics
            });
          }
        }
      }

      return { phase, failures, accepted, samples, pageOverflow };
    },
    { phase, selectors }
  );
}

async function closeAll() {
  const cleanupReport = {
    pageClose: { attempted: cleanup.pages.length > 0, ok: true, count: cleanup.pages.length, errors: [] },
    contextClose: { attempted: cleanup.contexts.length > 0, ok: true, count: cleanup.contexts.length, errors: [] },
    browserClose: { attempted: Boolean(cleanup.browser), ok: true, errors: [] },
    serverStop: {
      attempted: Boolean(cleanup.server?.owned),
      ok: true,
      owned: Boolean(cleanup.server?.owned),
      pid: cleanup.server?.pid ?? null,
      port: cleanup.server?.port ?? null,
      errors: []
    },
    pidAlive: null,
    portListening: null,
    residualCheck: { pidAlive: null, portListening: null, sameProjectPortListening: null },
    portChecks: []
  };

  for (const page of cleanup.pages.reverse()) {
    try {
      if (!page.isClosed()) {
        await withTimeout('page.close', 2_000, () => page.close());
      }
    } catch (error) {
      cleanupReport.pageClose.ok = false;
      cleanupReport.pageClose.errors.push(serializeError(error));
    }
  }

  for (const context of cleanup.contexts.reverse()) {
    try {
      await withTimeout('context.close', 3_000, () => context.close());
    } catch (error) {
      cleanupReport.contextClose.ok = false;
      cleanupReport.contextClose.errors.push(serializeError(error));
    }
  }

  if (cleanup.browser) {
    const browserProcess = typeof cleanup.browser.process === 'function' ? cleanup.browser.process() : null;
    cleanupReport.browserClose.pid = browserProcess?.pid ?? null;
    cleanupReport.browserClose.forced = false;
    try {
      await withTimeout('browser.close', 5_000, () => cleanup.browser.close());
    } catch (error) {
      cleanupReport.browserClose.errors.push(serializeError(error));
      cleanupReport.browserClose.forced = await terminateProcessTree(browserProcess?.pid, 3_000);
      cleanupReport.browserClose.ok =
        cleanupReport.browserClose.forced && !(await pidAlive(cleanupReport.browserClose.pid));
    }
  }

  if (cleanup.server?.owned) {
    try {
      const stopResult = await stopOwnedServer(cleanup.server);
      cleanupReport.serverStop = {
        ...cleanupReport.serverStop,
        ...stopResult,
        errors: cleanupReport.serverStop.errors
      };
    } catch (error) {
      cleanupReport.serverStop.ok = false;
      cleanupReport.serverStop.errors.push(serializeError(error));
    }
    const portsToVerify = [...new Set([cleanup.server.port, preferredPort].filter((port) => Number.isFinite(port)))];
    cleanupReport.portChecks = [];
    for (const port of portsToVerify) {
      cleanupReport.portChecks.push(await waitForOwnedPortRelease(port, 5_000));
    }
    const serverPortCheck = cleanupReport.portChecks.find((portCheck) => portCheck.port === cleanup.server.port);
    cleanupReport.residualCheck.pidAlive = await pidAlive(cleanup.server.pid);
    cleanupReport.residualCheck.portListening = (serverPortCheck?.listeners.length ?? 0) > 0;
    cleanupReport.residualCheck.sameProjectPortListening = cleanupReport.portChecks.some(
      (portCheck) => portCheck.ownedListeners.length > 0
    );
    cleanupReport.pidAlive = cleanupReport.residualCheck.pidAlive;
    cleanupReport.portListening = cleanupReport.residualCheck.portListening;
    if (cleanupReport.residualCheck.pidAlive || cleanupReport.residualCheck.sameProjectPortListening) {
      cleanupReport.serverStop.ok = false;
    }
  } else if (cleanup.server) {
    cleanupReport.serverStop.ok = true;
    cleanupReport.serverStop.owned = false;
    cleanupReport.serverStop.attempted = false;
    cleanupReport.pidAlive = false;
    cleanupReport.portListening = true;
    cleanupReport.residualCheck.pidAlive = false;
    cleanupReport.residualCheck.portListening = true;
    cleanupReport.residualCheck.sameProjectPortListening = false;
  }

  cleanupReport.status =
    cleanupReport.pageClose.ok &&
    cleanupReport.contextClose.ok &&
    cleanupReport.browserClose.ok &&
    cleanupReport.serverStop.ok
      ? 'pass'
      : 'fail';
  return cleanupReport;
}

async function stopOwnedServer(server) {
  const result = {
    sigtermSent: false,
    sigkillSent: false,
    portReapedPids: []
  };

  if (!server.process || server.process.killed) {
    result.portReapedPids = await reapOwnedPortListeners(server.port);
    return result;
  }

  try {
    process.kill(-server.pid, 'SIGTERM');
    result.sigtermSent = true;
  } catch {
    server.process.kill('SIGTERM');
    result.sigtermSent = true;
  }

  const stopped = await waitForExit(server.process, 5_000);
  if (!stopped) {
    try {
      process.kill(-server.pid, 'SIGKILL');
      result.sigkillSent = true;
    } catch {
      server.process.kill('SIGKILL');
      result.sigkillSent = true;
    }
    await waitForExit(server.process, 3_000);
  }

  result.portReapedPids = await reapOwnedPortListeners(server.port);
  return result;
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve(true);
      return;
    }
    const timer = setTimeout(() => {
      child.off('exit', onExit);
      resolve(false);
    }, timeoutMs);
    function onExit() {
      clearTimeout(timer);
      resolve(true);
    }
    child.once('exit', onExit);
  });
}

function pidAlive(pid) {
  if (!pid) {
    return Promise.resolve(false);
  }
  try {
    process.kill(pid, 0);
    return Promise.resolve(true);
  } catch {
    return Promise.resolve(false);
  }
}

async function terminateProcessTree(pid, timeoutMs) {
  if (!pid || !(await pidAlive(pid))) {
    return true;
  }

  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      return !(await pidAlive(pid));
    }
  }

  if (await waitForPidExit(pid, timeoutMs)) {
    return true;
  }

  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      return !(await pidAlive(pid));
    }
  }

  return await waitForPidExit(pid, 2_000);
}

async function waitForPidExit(pid, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!(await pidAlive(pid))) {
      return true;
    }
    await sleep(100);
  }
  return !(await pidAlive(pid));
}

async function reapOwnedPortListeners(port) {
  const result = await waitForOwnedPortRelease(port, 3_000);
  return result.reapedPids;
}

async function waitForOwnedPortRelease(port, timeoutMs) {
  const start = Date.now();
  const reapedPids = [];
  let listeners = [];
  let ownedListeners = [];

  while (Date.now() - start < timeoutMs) {
    listeners = await portListeners(port);
    ownedListeners = listeners.filter((listener) => listener.owned);
    if (ownedListeners.length === 0) {
      return { port, ok: true, listeners, ownedListeners, reapedPids };
    }

    for (const listener of ownedListeners) {
      if (await terminateProcessTree(listener.pid, 1_500)) {
        reapedPids.push(listener.pid);
      }
    }
    await sleep(150);
  }

  listeners = await portListeners(port);
  ownedListeners = listeners.filter((listener) => listener.owned);
  return { port, ok: ownedListeners.length === 0, listeners, ownedListeners, reapedPids };
}

async function listeningPids(port) {
  const { stdout } = await execFileText('lsof', ['-nP', `-tiTCP:${port}`, '-sTCP:LISTEN']).catch(() => ({ stdout: '' }));
  return stdout
    .split(/\s+/)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

async function portListeners(port) {
  const pids = await listeningPids(port);
  return await Promise.all(pids.map((pid) => inspectProcess(pid)));
}

async function inspectProcess(pid) {
  const [commandResult, cwdResult] = await Promise.all([
    execFileText('ps', ['-o', 'command=', '-p', String(pid)]).catch(() => ({ stdout: '' })),
    execFileText('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn']).catch(() => ({ stdout: '' }))
  ]);
  const command = commandResult.stdout.trim();
  const cwd = cwdResult.stdout
    .split('\n')
    .find((line) => line.startsWith('n'))
    ?.slice(1);

  return {
    pid,
    command,
    cwd: cwd ?? null,
    owned: cwd === projectRoot && /\b(vite|npm|node)\b/.test(command)
  };
}

function execFileText(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function withTimeout(label, timeoutMs, fn) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    Promise.resolve()
      .then(fn)
      .then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        }
      );
  });
}

function classifyStatus(currentReport) {
  const resultFailure = currentReport.results.some(
    (result) =>
      result.consoleErrorCount > 0 ||
      result.horizontalOverflowDetected ||
      result.textOverflowCount > 0 ||
      !result.paperScenarioReached ||
      !result.topdeckEvidenceVisible ||
      !result.wildScenarioReached ||
      !result.activityScenarioReached ||
      !result.cardReadabilityScenarioReached ||
      !result.extensionTokenVisible ||
      !result.continuationTokenVisible ||
      !result.activityInheritanceTokenVisible ||
      !result.handBaseVisible ||
      !result.pileActuallyVisible ||
      !result.pileTextFits ||
      !result.cardSemanticAttrsVisible ||
      !result.cardTypeSamplesVisible ||
      !result.authorizationGrantVisible ||
      !result.payoffAuthorizationLabelsVisible ||
      !result.lifecycleTokensVisible ||
      !result.mobileEffectLabelsReady ||
      !result.mobileEffectDisplayOk ||
      !result.mobileHandCardWidthOk ||
      !result.railHintVisible ||
      !result.buildGapTokensVisible ||
      !result.firstHandCopyVisible ||
      !result.rewardEmptyShellHidden ||
      !result.rewardExclusiveVisible ||
      !result.endTurnStillUsable
  );
  if (currentReport.errors.length > 0 || resultFailure) {
    return currentReport.cleanup?.status === 'pass' ? 'fail' : 'functional-fail-cleanup-fail';
  }
  return currentReport.cleanup?.status === 'pass' ? 'pass' : 'functional-pass-cleanup-fail';
}

function buildGates(currentReport) {
  const results = currentReport.results;
  const everyResult = (predicate) => results.length > 0 && results.every(predicate);
  return {
    commandExit: currentReport.errors.length === 0 ? 'pass' : 'fail',
    browserCleanup: currentReport.cleanup?.status === 'pass' ? 'pass' : 'fail',
    ownedServer: currentReport.server?.owned === true && currentReport.cleanup?.serverStop?.attempted === true ? 'pass' : 'fail',
    allViewportsPresent: results.length === viewports.length ? 'pass' : 'fail',
    noConsoleErrors: everyResult((result) => result.consoleErrorCount === 0) ? 'pass' : 'fail',
    noHorizontalOverflow: everyResult((result) => !result.horizontalOverflowDetected) ? 'pass' : 'fail',
    noTextOverflow: everyResult((result) => result.textOverflowCount === 0) ? 'pass' : 'fail',
    activityCarryover:
      everyResult((result) => result.activityScenarioReached && result.activityInheritanceTokenVisible) ? 'pass' : 'fail',
    cardReadabilityP0:
      everyResult(
        (result) =>
          result.cardReadabilityScenarioReached &&
          result.handBaseVisible &&
          result.pileActuallyVisible &&
          result.pileTextFits &&
          result.cardSemanticAttrsVisible &&
          result.cardTypeSamplesVisible &&
          result.authorizationGrantVisible &&
          result.payoffAuthorizationLabelsVisible &&
          result.lifecycleTokensVisible &&
          result.mobileEffectLabelsReady &&
          result.mobileEffectDisplayOk &&
          result.mobileHandCardWidthOk &&
          result.railHintVisible &&
          result.buildGapTokensVisible &&
          result.firstHandCopyVisible &&
          result.rewardExclusiveVisible
      )
        ? 'pass'
        : 'fail',
    coreTokensVisible:
      everyResult(
        (result) =>
          result.topdeckEvidenceVisible &&
          result.extensionTokenVisible &&
          result.handBaseVisible &&
          result.pileActuallyVisible &&
          result.pileTextFits &&
          result.cardSemanticAttrsVisible &&
          result.cardTypeSamplesVisible &&
          result.authorizationGrantVisible &&
          result.payoffAuthorizationLabelsVisible &&
          result.lifecycleTokensVisible &&
          result.mobileEffectLabelsReady &&
          result.mobileEffectDisplayOk &&
          result.mobileHandCardWidthOk &&
          result.railHintVisible &&
          result.buildGapTokensVisible &&
          result.firstHandCopyVisible &&
          result.rewardEmptyShellHidden &&
          result.rewardExclusiveVisible &&
          result.continuationTokenVisible &&
          result.endTurnStillUsable
      )
        ? 'pass'
        : 'fail'
  };
}

function buildGateScore(currentReport) {
  const results = currentReport.results;
  const everyResult = (predicate) => results.length > 0 && results.every(predicate);
  const breakdown = {
    allViewportsPresent: results.length === viewports.length ? 3 : 0,
    noConsoleErrors: everyResult((result) => result.consoleErrorCount === 0) ? 3 : 0,
    noHorizontalOverflow: everyResult((result) => !result.horizontalOverflowDetected) ? 4 : 0,
    noTextOverflow: everyResult((result) => result.textOverflowCount === 0) ? 3 : 0,
    coreTokensVisible:
      everyResult(
        (result) =>
          result.topdeckEvidenceVisible &&
          result.extensionTokenVisible &&
          result.handBaseVisible &&
          result.pileActuallyVisible &&
          result.pileTextFits &&
          result.cardSemanticAttrsVisible &&
          result.cardTypeSamplesVisible &&
          result.authorizationGrantVisible &&
          result.payoffAuthorizationLabelsVisible &&
          result.lifecycleTokensVisible &&
          result.mobileEffectLabelsReady &&
          result.mobileEffectDisplayOk &&
          result.mobileHandCardWidthOk &&
          result.railHintVisible &&
          result.buildGapTokensVisible &&
          result.firstHandCopyVisible &&
          result.rewardEmptyShellHidden &&
          result.rewardExclusiveVisible &&
          result.continuationTokenVisible
      )
        ? 3
        : 0,
    interactionUsable: everyResult((result) => result.endTurnStillUsable) ? 2 : 0,
    browserCleanup: currentReport.cleanup?.status === 'pass' ? 2 : 0
  };
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const caps = currentReport.cleanup?.status === 'pass' ? [] : [{ reason: 'browser cleanup failed', maxTotal: 15 }];
  return { scale: 'qa-ui-gate-20', max: 20, total, breakdown, caps };
}

function serializeError(error) {
  return {
    name: error?.name ?? 'Error',
    message: error?.message ?? String(error),
    stack: error?.stack
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
