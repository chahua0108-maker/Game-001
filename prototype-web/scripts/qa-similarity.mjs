#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const qaRound = process.env.QA_ROUND ?? 'round-12';
const outputDir = path.resolve(projectRoot, `outputs/browser-qa/${qaRound}`);
const outputFile = path.join(outputDir, 'qa-similarity-result.json');
const preferredPort = Number(process.env.QA_PORT ?? 5174);
const baseUrlOverride = process.env.QA_BASE_URL;
const pressureRoundCount = Number(process.env.QA_PRESSURE_ROUNDS ?? 3);

const viewports = [
  { name: 'desktop', width: 1366, height: 768 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-360', width: 360, height: 640 }
];

const selectors = [
  '.status-strip',
  '.status-chip',
  '.status-chip strong',
  '.status-chip span',
  '.status-chip em',
  '.resource-chip',
  '.resource-head',
  '.resource-head strong',
  '.resource-head em',
  '.combat-director',
  '.director-cell',
  '.director-cell strong',
  '.director-cell em',
  '.deal-panel',
  '.deal-panel button',
  '.target-panel',
  '.run-layer-panel',
  '.run-layer-main',
  '.run-layer-meta',
  '.enemy-peek-toggle',
  '.card-row',
  '.card-button',
  '.card-button strong',
  '.card-meta',
  '.chain-preview',
  '.card-intent-preview',
  '.card-payoff',
  '.card-effect',
  '.missing-cost',
  '.authorization-cost',
  '.reward-panel',
  '.reward-card',
  '.reward-card strong',
  '.reward-card small',
  '.reward-card em',
  '.combat-feed',
  '.combat-feed li'
];

const cleanup = {
  pages: [],
  contexts: [],
  browser: null,
  server: null
};

const report = {
  name: 'qa-similarity',
  qaRound,
  similarityScope: 'mechanic-slice-only',
  notAFullClone: true,
  status: 'started',
  startedAt: new Date().toISOString(),
  config: {
    pressureRoundCount,
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
  if (pressureRoundCount < 3 || pressureRoundCount > 5) {
    throw new Error(`QA_PRESSURE_ROUNDS must be between 3 and 5, got ${pressureRoundCount}`);
  }

  const server = baseUrlOverride
    ? { url: baseUrlOverride, owned: false, pid: null, port: Number(new URL(baseUrlOverride).port || 80) }
    : await startServer(preferredPort);
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
    await page.waitForTimeout(150);

    const bootInspection = await inspectPage(page, 'boot');
    const pressure = await exercisePressureRounds(page, pressureRoundCount);
    const pressureInspection = await inspectPage(page, 'pressure-after-rounds');

    const wild = await buildWildPayoffHud(page);
    await page.waitForTimeout(100);
    const wildInspection = await inspectPage(page, 'wild-extension-payoff');

    const paper = await buildPaperTopdeckHud(page);
    await page.waitForTimeout(100);
    const paperInspection = await inspectPage(page, 'paper-topdeck-sample');

    const routeFlow = await exerciseRewardRouteButtons(page);
    await page.waitForTimeout(100);
    const routeFlowInspection = await inspectPage(page, 'reward-route-button-flow');

    const inspections = [
      bootInspection,
      ...pressure.inspections,
      pressureInspection,
      wildInspection,
      paperInspection,
      routeFlowInspection
    ];
    const layoutFailures = inspections.flatMap((item) => item.failures);
    const acceptedCount = inspections.reduce((total, item) => total + item.accepted.length, 0);
    const horizontalOverflowDetected = inspections.some((item) => item.pageOverflow.horizontal);

    const assertions = {
      pressureRoundCountInRange: pressure.rounds.length >= 3 && pressure.rounds.length <= 5,
      failurePressureVisible: pressure.hpBefore !== null && pressure.hpAfter !== null && pressure.hpAfter < pressure.hpBefore,
      pressureDidNotEndRun: pressure.hpAfter !== null && pressure.hpAfter > 0,
      endTurnStillUsable: pressure.endTurnStillUsable,
      wildMp3Extension:
        wild.extended?.type === 'ChainExtended' &&
        wild.extended.extendedCost === 3 &&
        wild.extended.multiplier === 4 &&
        wild.extendedCardPlayed?.chainExtended === true &&
        wild.extendedCardPlayed?.effectiveCost === 3,
      wildExtensionVisible: wild.extensionTokenVisible,
      payoffContinuationVisible: wild.continuationTokenVisible,
      payoffContinuationResolved:
        wild.payoffTriggered?.type === 'PayoffTriggered' &&
        wild.payoffTriggered.enhanced === true &&
        wild.payoffTriggered.multiplier >= 5,
      paperTopdeckSample:
        paper.topdeck?.type === 'PayoffTopdecked' &&
        paper.topdeck.cardId === 'severance_burst' &&
        paper.handDealt?.type === 'HandDealt' &&
        paper.handDealt.cardIds.includes('severance_burst') &&
        paper.topdeckIndex >= 0 &&
        paper.handDealtIndex > paper.topdeckIndex,
      paperTopdeckVisible: paper.feedText.includes('整备：顶终结'),
      routeRewardButtonVisible: routeFlow.routeRewardButtonVisible,
      routeCandidateLabelVisible: routeFlow.routeCandidateLabelVisible,
      routeRewardButtonClickable: routeFlow.routeRewardButtonClickable,
      routeRewardSelectionResolved:
        routeFlow.selectedIntent?.type === 'select-reward' &&
        routeFlow.selectedIntent.cardId === routeFlow.selectedCardId &&
        routeFlow.rewardChosen?.type === 'RewardChosen' &&
        routeFlow.rewardChosen.cardId === routeFlow.selectedCardId &&
        routeFlow.rewardPendingAfter === false &&
        routeFlow.deckIncludesSelected === true,
      routeChoiceButtonVisible: routeFlow.routeChoiceButtonVisible,
      routeChoiceButtonClickable: routeFlow.routeChoiceButtonClickable,
      routeSelectionResolved:
        routeFlow.selectedRouteIntent?.type === 'select-route' &&
        routeFlow.selectedRouteIntent.routeId === routeFlow.selectedRouteId &&
        routeFlow.routeChosen?.type === 'RouteChosen' &&
        routeFlow.routeChosen.routeId === routeFlow.selectedRouteId,
      routeFlowContinuesRun:
        routeFlow.runCurrentNodeAfter === 2 &&
        routeFlow.fsmAfter === 'PlayerTurn' &&
        routeFlow.routeRecordVisibleAfter === true &&
        routeFlow.nextStateVisibleAfter === true,
      noHorizontalOverflow: !horizontalOverflowDetected && !layoutFailures.some((failure) => failure.axis === 'x'),
      noTextOverflow: !layoutFailures.some((failure) => failure.category.includes('text')),
      noConsoleErrors: consoleErrors.length === 0
    };

    report.results.push({
      viewport,
      status: Object.values(assertions).every(Boolean) && layoutFailures.length === 0 && consoleErrors.length === 0 ? 'pass' : 'fail',
      assertions,
      consoleErrorCount: consoleErrors.length,
      consoleErrors,
      horizontalOverflowDetected,
      layoutFailureCount: layoutFailures.length,
      layoutFailures,
      acceptedCount,
      pressure: {
        hpBefore: pressure.hpBefore,
        hpAfter: pressure.hpAfter,
        hpLost: pressure.hpBefore !== null && pressure.hpAfter !== null ? pressure.hpBefore - pressure.hpAfter : null,
        rounds: pressure.rounds,
        feedText: pressure.feedText
      },
      wild: {
        extended: wild.extended,
        extendedCardPlayed: wild.extendedCardPlayed,
        payoffTriggered: wild.payoffTriggered,
        payment: wild.payment,
        extensionTokenVisible: wild.extensionTokenVisible,
        continuationTokenVisible: wild.continuationTokenVisible,
        chainPreviews: wild.chainPreviews,
        feedText: wild.feedText,
        handBeforePayoff: wild.handBeforePayoff,
        handAfterPayoff: wild.handAfterPayoff
      },
      paper: {
        topdeck: paper.topdeck,
        handDealt: paper.handDealt,
        topdeckIndex: paper.topdeckIndex,
        handDealtIndex: paper.handDealtIndex,
        feedText: paper.feedText,
        hand: paper.hand,
        drawPile: paper.drawPile
      },
      routeFlow,
      samples: inspections.flatMap((item) => item.samples).slice(0, 24)
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
  while (port < 65_536 && !(await isPortFree(port))) {
    port += 1;
  }
  if (port >= 65_536) {
    throw new Error(`No free localhost port found from ${startPort} to 65535`);
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
    process: child
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

async function exercisePressureRounds(page, roundCount) {
  const hpBefore = await readHp(page);
  const rounds = [];
  const inspections = [];

  for (let index = 0; index < roundCount; index += 1) {
    await waitForUsableEndTurn(page);
    const beforeClickUsable = await usableButton(page, '[data-end-turn]');
    const buttonLabel = await page.locator('[data-end-turn]').first().innerText().catch(() => '');

    if (beforeClickUsable) {
      await page.locator('[data-end-turn]').first().click({ timeout: 3_000 });
    }

    await page.waitForTimeout(200);
    const afterClickUsable = await waitForUsableEndTurn(page).catch(() => false);
    const hpAfterRound = await readHp(page);
    const feedText = await readFeedText(page);
    const inspection = await inspectPage(page, `pressure-round-${index + 1}`);
    inspections.push(inspection);
    rounds.push({
      round: index + 1,
      beforeClickUsable,
      afterClickUsable,
      buttonLabel,
      hpAfterRound,
      attackFeedVisible: /攻击 -\d+ HP|结束回合/.test(feedText)
    });
  }

  return {
    hpBefore,
    hpAfter: await readHp(page),
    endTurnStillUsable: await usableButton(page, '[data-end-turn]'),
    feedText: await readFeedText(page),
    rounds,
    inspections
  };
}

async function waitForUsableEndTurn(page) {
  await page.waitForFunction(
    () => {
      const button = document.querySelector('[data-end-turn]');
      if (!(button instanceof HTMLButtonElement) || button.disabled) {
        return false;
      }
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    },
    null,
    { timeout: 5_000 }
  );
  return true;
}

async function readHp(page) {
  return await page
    .locator('.hp-chip em')
    .first()
    .innerText({ timeout: 2_000 })
    .then((text) => {
      const match = text.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
      return match ? Number(match[1]) : null;
    })
    .catch(() => null);
}

async function readFeedText(page) {
  return await page
    .locator('.combat-feed')
    .first()
    .innerText({ timeout: 2_000 })
    .then((text) => text.replace(/\s+/g, ' ').trim())
    .catch(() => '');
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

async function buildWildPayoffHud(page) {
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
    tickWorld(world, [{ type: 'advance-time', deltaSeconds: 0.016, traceId: 'qa-sim-wild-deal' }]);

    for (const enemy of Object.values(world.enemies)) {
      enemy.hp = 200;
      enemy.maxHp = 200;
    }

    world.player.maxEnergy = 4;
    world.player.energy = 4;
    world.player.hand = ['debt_hook', 'redline_cut', 'row_cleave', 'wild_gap_key', 'severance_burst'];
    world.player.drawPile = [];
    world.player.discardPile = [];

    tickWorld(world, [{ type: 'play-card', cardId: 'debt_hook', targetId: 'enemy-1', traceId: 'qa-sim-wild-0' }]);
    tickWorld(world, [{ type: 'play-card', cardId: 'redline_cut', targetId: 'enemy-2', traceId: 'qa-sim-wild-1' }]);
    tickWorld(world, [{ type: 'play-card', cardId: 'row_cleave', traceId: 'qa-sim-wild-2' }]);
    tickWorld(world, [{ type: 'play-card', cardId: 'wild_gap_key', targetId: 'enemy-3', traceId: 'qa-sim-wild-3' }]);

    hud.render(buildSnapshot(world));

    const beforePayoffText = document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const feedText = document.querySelector('.combat-feed')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const chainPreviews = Array.from(document.querySelectorAll('.chain-preview')).map((item) =>
      item.textContent?.replace(/\s+/g, ' ').trim()
    );
    const handBeforePayoff = [...world.player.hand];
    const extended = world.debug.events.find(
      (event) => event.traceId === 'qa-sim-wild-3' && event.type === 'ChainExtended'
    ) ?? null;
    const extendedCardPlayed = world.debug.events.find(
      (event) => event.traceId === 'qa-sim-wild-3' && event.type === 'CardPlayed'
    ) ?? null;

    tickWorld(world, [{ type: 'play-card', cardId: 'severance_burst', traceId: 'qa-sim-payoff-continued' }]);

    const payoffTriggered = world.debug.events.find(
      (event) => event.traceId === 'qa-sim-payoff-continued' && event.type === 'PayoffTriggered'
    ) ?? null;
    const payoffCardPlayed = world.debug.events.find(
      (event) => event.traceId === 'qa-sim-payoff-continued' && event.type === 'CardPlayed'
    ) ?? null;
    const payment = world.debug.events.find(
      (event) => event.traceId === 'qa-sim-payoff-continued' && event.type === 'CardPaymentRecorded'
    ) ?? null;

    return {
      extended,
      extendedCardPlayed,
      payoffTriggered,
      payoffCardPlayed,
      payment,
      extensionTokenVisible: beforePayoffText.includes('延链MP3') || beforePayoffText.includes('延MP3x4') || feedText.includes('延MP3'),
      continuationTokenVisible: beforePayoffText.includes('续燃x5') || chainPreviews.includes('续燃x5'),
      chainPreviews,
      feedText,
      beforePayoffText,
      handBeforePayoff,
      handAfterPayoff: [...world.player.hand],
      energyAfterPayoff: world.player.energy,
      tempAuthorizationMPAfterPayoff: world.player.tempAuthorizationMP,
      chain: { ...world.chain }
    };
  });
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
    tickWorld(world, [{ type: 'advance-time', deltaSeconds: 0.016, traceId: 'qa-sim-paper-deal' }]);

    for (const enemy of Object.values(world.enemies)) {
      enemy.hp = 50;
      enemy.maxHp = 50;
    }

    world.player.hand = ['debt_hook', 'redline_cut', 'paper_shatter'];
    world.player.drawPile = ['spark_tap', 'severance_burst', 'wild_gap_key'];
    world.player.discardPile = [];

    tickWorld(world, [{ type: 'play-card', cardId: 'debt_hook', targetId: 'enemy-1', traceId: 'qa-sim-paper-0' }]);
    tickWorld(world, [{ type: 'play-card', cardId: 'redline_cut', targetId: 'enemy-2', traceId: 'qa-sim-paper-1' }]);
    tickWorld(world, [{ type: 'play-card', cardId: 'paper_shatter', traceId: 'qa-sim-paper-2' }]);

    hud.render(buildSnapshot(world));

    const topdeckIndex = world.debug.events.findIndex(
      (event) => event.traceId === 'qa-sim-paper-2' && event.type === 'PayoffTopdecked'
    );
    const handDealtIndex = world.debug.events.findIndex(
      (event) => event.traceId === 'qa-sim-paper-2' && event.type === 'HandDealt'
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
      drawPile: [...world.player.drawPile],
      tempAuthorizationMP: world.player.tempAuthorizationMP,
      payoffArmed: world.player.payoffArmed
    };
  });
}

async function exerciseRewardRouteButtons(page) {
  return await page.evaluate(async () => {
    const [{ createInitialWorld }, { tickWorld }, { buildSnapshot }, { Hud }] = await Promise.all([
      import('/src/sim/world.ts'),
      import('/src/sim/runtime.ts'),
      import('/src/sim/snapshot.ts'),
      import('/src/ui/hud.ts')
    ]);

    document.body.innerHTML = '<div id="hud"></div>';
    const root = document.querySelector('#hud');
    const world = createInitialWorld();
    const intents = [];
    const hud = new Hud(root, (intent) => {
      intents.push({ ...intent });
      tickWorld(world, [intent]);
      hud.render(buildSnapshot(world));
    });

    world.fsm.gameFlow = 'Reward';
    world.player.level = 2;
    world.player.xp = world.reward.xpThreshold;
    world.reward.pending = true;
    world.reward.source = 'level-up';
    world.reward.choices = ['pulse_draw', 'severance_burst', 'signal_relay'];
    world.player.hand = [];
    world.player.drawPile = [];
    world.player.discardPile = [];

    hud.render(buildSnapshot(world));

    const selectedCardId = 'pulse_draw';
    const routeButton = document.querySelector(`[data-reward-card-id="${selectedCardId}"]`);
    const routeRewardButtons = Array.from(document.querySelectorAll('[data-reward-card-id]')).filter((button) =>
      ['pulse_draw', 'signal_relay'].includes(button.getAttribute('data-reward-card-id') ?? '')
    );
    const textBefore = document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const routeButtonRect = routeButton?.getBoundingClientRect();
    const routeRewardButtonVisible = Boolean(
      routeButton instanceof HTMLButtonElement &&
        routeButtonRect &&
        routeButtonRect.width > 0 &&
        routeButtonRect.height > 0 &&
        routeButtonRect.left >= -1 &&
        routeButtonRect.right <= window.innerWidth + 1 &&
        !routeButton.disabled
    );
    const routeCandidateLabelVisible = textBefore.includes('路线候选') && textBefore.includes('Pulse Draw');

    if (routeButton instanceof HTMLButtonElement) {
      routeButton.click();
    }

    const textAfterReward = document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const selectedIntent = intents.find((intent) => intent.type === 'select-reward') ?? null;
    const rewardChosen =
      world.debug.events.find((event) => event.traceId === selectedIntent?.traceId && event.type === 'RewardChosen') ?? null;
    const selectedRouteId = world.route?.pendingNodeChoices?.[0]?.id ?? null;
    const routeChoiceButton = selectedRouteId
      ? document.querySelector(`[data-route-choice-id="${selectedRouteId}"]`)
      : document.querySelector('[data-route-choice-id]');
    const routeChoiceButtonRect = routeChoiceButton?.getBoundingClientRect();
    const routeChoiceButtonVisible = Boolean(
      routeChoiceButton instanceof HTMLButtonElement &&
        routeChoiceButtonRect &&
        routeChoiceButtonRect.width > 0 &&
        routeChoiceButtonRect.height > 0 &&
        routeChoiceButtonRect.left >= -1 &&
        routeChoiceButtonRect.right <= window.innerWidth + 1 &&
        !routeChoiceButton.disabled
    );

    if (routeChoiceButton instanceof HTMLButtonElement) {
      routeChoiceButton.click();
    }

    const textAfterRoute = document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const selectedRouteIntent = intents.find((intent) => intent.type === 'select-route') ?? null;
    const routeChosen =
      world.debug.events.find((event) => event.traceId === selectedRouteIntent?.traceId && event.type === 'RouteChosen') ?? null;

    return {
      selectedCardId,
      selectedRouteId,
      routeRewardButtonCount: routeRewardButtons.length,
      routeRewardButtonVisible,
      routeCandidateLabelVisible,
      routeRewardButtonClickable: Boolean(selectedIntent),
      routeChoiceButtonVisible,
      routeChoiceButtonClickable: Boolean(selectedRouteIntent),
      selectedIntent,
      selectedRouteIntent,
      rewardChosen,
      routeChosen,
      runCurrentNodeAfter: world.run.currentNode,
      rewardPendingAfter: world.reward.pending,
      fsmAfter: world.fsm.gameFlow,
      deckIncludesSelected: world.player.deck.includes(selectedCardId),
      routeRecordVisibleAfter: textAfterRoute.includes('路线记录 1') || textAfterReward.includes('路线记录 1'),
      nextStateVisibleAfter: textAfterRoute.includes('带入 Pulse Draw') || textAfterReward.includes('带入 Pulse Draw'),
      textBefore,
      textAfterReward,
      textAfterRoute
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
        /CardTopdecked|DeckSearchMissed|PayoffTopdecked|PayoffTopdeckMissed|ChainExtended|SearchAndTopdeck|TopdeckPayoffFromDrawPile|drawPile|discardPile|rewardCardPool|candidateCardPool|undefined|NaN|\[object Object\]/;

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
          axis: 'x',
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
          const insideCardRail = selector !== '.card-row' && Boolean(el.closest('.card-row'));
          const isCardRail = selector === '.card-row';
          const isScrollPanel = selector === '.reward-panel';
          const clippedByDesign = style.overflow === 'hidden' && style.textOverflow === 'ellipsis';
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
            const contained = rect.left >= -1 && rect.right <= window.innerWidth + 1;
            const needsHorizontalRail = el.scrollWidth > el.clientWidth + 1;
            const ok = contained && (!needsHorizontalRail || ['auto', 'scroll'].includes(style.overflowX));
            (ok ? accepted : failures).push({
              phase,
              category: ok ? 'accepted-horizontal-rail' : 'fail-viewport-overflow',
              severity: ok ? 'info' : 'blocker',
              ruleId: 'CARD_ROW_RAIL',
              axis: 'x',
              selector,
              index,
              text: text.slice(0, 160),
              reason: ok
                ? needsHorizontalRail
                  ? 'hand rail may scroll horizontally inside its container'
                  : 'hand row is contained without rail scrolling'
                : 'hand row is not contained or lacks required horizontal scrolling',
              metrics
            });
            continue;
          }

          if (isScrollPanel && overflowY && scrollPanelY && !outsideX) {
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
              axis: 'x',
              selector,
              index,
              text: text.slice(0, 160),
              reason: 'element extends outside viewport horizontally',
              metrics
            });
          }

          if (overflowX && !clippedByDesign && !insideCardRail) {
            failures.push({
              phase,
              category: 'fail-text-horizontal-overflow',
              severity: 'major',
              ruleId: 'TEXT_HORIZONTAL_OVERFLOW',
              axis: 'x',
              selector,
              index,
              text: text.slice(0, 160),
              reason: 'text/content overflows without ellipsis protection',
              metrics
            });
          } else if (overflowX && clippedByDesign) {
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

          if (
            overflowY &&
            !['hidden', 'auto', 'scroll'].includes(style.overflow) &&
            !['hidden', 'auto', 'scroll'].includes(style.overflowY)
          ) {
            failures.push({
              phase,
              category: 'fail-text-vertical-overflow',
              severity: 'major',
              ruleId: 'TEXT_VERTICAL_OVERFLOW',
              axis: 'y',
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
    residualCheck: { pidAlive: null, portListening: null }
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
    cleanupReport.browserClose = await closeBrowser();
  }

  if (cleanup.server?.owned) {
    try {
      await stopOwnedServer(cleanup.server);
    } catch (error) {
      cleanupReport.serverStop.ok = false;
      cleanupReport.serverStop.errors.push(serializeError(error));
    }
    cleanupReport.residualCheck.pidAlive = await pidAlive(cleanup.server.pid);
    cleanupReport.residualCheck.portListening = !(await isPortFree(cleanup.server.port));
    cleanupReport.pidAlive = cleanupReport.residualCheck.pidAlive;
    cleanupReport.portListening = cleanupReport.residualCheck.portListening;
    if (cleanupReport.residualCheck.pidAlive || cleanupReport.residualCheck.portListening) {
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

async function closeBrowser() {
  const browserProcess = typeof cleanup.browser.process === 'function' ? cleanup.browser.process() : null;
  const closeReport = {
    attempted: true,
    ok: true,
    pid: browserProcess?.pid ?? null,
    gracefulClose: { attempted: true, ok: true, errors: [] },
    forcedKill: { attempted: false, ok: true, signal: null, errors: [] },
    residualCheck: { pidAlive: null },
    errors: []
  };

  try {
    await withTimeout('browser.close', 5_000, () => cleanup.browser.close());
  } catch (error) {
    const serialized = serializeError(error);
    closeReport.gracefulClose.ok = false;
    closeReport.gracefulClose.errors.push(serialized);
    closeReport.errors.push(serialized);

    if (browserProcess?.pid) {
      closeReport.forcedKill.attempted = true;
      closeReport.forcedKill.signal = 'SIGKILL';
      try {
        browserProcess.kill('SIGKILL');
        await waitForExit(browserProcess, 3_000);
      } catch (killError) {
        closeReport.forcedKill.ok = false;
        closeReport.forcedKill.errors.push(serializeError(killError));
      }
      closeReport.residualCheck.pidAlive = await pidAlive(browserProcess.pid);
      if (closeReport.residualCheck.pidAlive) {
        closeReport.forcedKill.ok = false;
      }
    } else {
      closeReport.forcedKill.ok = false;
      closeReport.forcedKill.errors.push({
        name: 'Error',
        message: 'browser process pid unavailable',
        stack: undefined
      });
    }
  }

  closeReport.ok =
    closeReport.gracefulClose.ok ||
    (closeReport.forcedKill.attempted && closeReport.forcedKill.ok && closeReport.residualCheck.pidAlive === false);
  return closeReport;
}

async function stopOwnedServer(server) {
  if (!server.process || server.process.killed) {
    return;
  }

  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    server.process.kill('SIGTERM');
  }

  const stopped = await waitForExit(server.process, 5_000);
  if (!stopped) {
    try {
      process.kill(-server.pid, 'SIGKILL');
    } catch {
      server.process.kill('SIGKILL');
    }
    await waitForExit(server.process, 3_000);
  }
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

function withTimeout(label, timeoutMs, fn) {
  return Promise.race([
    fn(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
}

function classifyStatus(currentReport) {
  const resultFailure =
    currentReport.results.length !== viewports.length ||
    currentReport.results.some((result) => result.status !== 'pass');
  if (currentReport.errors.length > 0 || resultFailure || currentReport.notAFullClone !== true) {
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
    notFullClone:
      currentReport.similarityScope === 'mechanic-slice-only' && currentReport.notAFullClone === true ? 'pass' : 'fail',
    allViewportsPass: everyResult((result) => result.status === 'pass') ? 'pass' : 'fail',
    noRawTokens:
      everyResult((result) => result.layoutFailures.every((failure) => failure.ruleId !== 'RAW_DEBUG_TOKEN_VISIBLE')) ? 'pass' : 'fail',
    noConsoleErrors: everyResult((result) => result.consoleErrorCount === 0) ? 'pass' : 'fail',
    noHorizontalOverflow: everyResult((result) => !result.horizontalOverflowDetected) ? 'pass' : 'fail',
    rewardRouteFlow:
      everyResult(
        (result) =>
          result.assertions.routeRewardButtonVisible &&
          result.assertions.routeCandidateLabelVisible &&
          result.assertions.routeRewardButtonClickable &&
          result.assertions.routeRewardSelectionResolved &&
          result.assertions.routeChoiceButtonVisible &&
          result.assertions.routeChoiceButtonClickable &&
          result.assertions.routeSelectionResolved &&
          result.assertions.routeFlowContinuesRun
      )
        ? 'pass'
        : 'fail'
  };
}

function buildGateScore(currentReport) {
  const results = currentReport.results;
  const everyResult = (predicate) => results.length > 0 && results.every(predicate);
  const breakdown = {
    allViewportsPass: everyResult((result) => result.status === 'pass') ? 3 : 0,
    pressureJourney:
      everyResult(
        (result) =>
          result.assertions.pressureRoundCountInRange &&
          result.assertions.failurePressureVisible &&
          result.assertions.pressureDidNotEndRun
      )
        ? 3
        : 0,
    wildMp3Extension: everyResult((result) => result.assertions.wildMp3Extension) ? 4 : 0,
    payoffContinuation:
      everyResult((result) => result.assertions.payoffContinuationVisible && result.assertions.payoffContinuationResolved) ? 3 : 0,
    paperTopdeck:
      everyResult((result) => result.assertions.paperTopdeckSample && result.assertions.paperTopdeckVisible) ? 3 : 0,
    rewardRouteFlow:
      everyResult(
        (result) =>
          result.assertions.routeRewardButtonVisible &&
          result.assertions.routeCandidateLabelVisible &&
          result.assertions.routeRewardButtonClickable &&
          result.assertions.routeRewardSelectionResolved &&
          result.assertions.routeChoiceButtonVisible &&
          result.assertions.routeChoiceButtonClickable &&
          result.assertions.routeSelectionResolved &&
          result.assertions.routeFlowContinuesRun
      )
        ? 3
        : 0,
    failurePressureReadable:
      everyResult(
        (result) =>
          result.assertions.failurePressureVisible &&
          result.pressure.hpLost > 0 &&
          result.pressure.rounds.some((round) => /结束-\d+/.test(round.buttonLabel))
      )
        ? 2
        : 0,
    scopeBoundary: currentReport.similarityScope === 'mechanic-slice-only' && currentReport.notAFullClone === true ? 2 : 0,
    browserCleanup: currentReport.cleanup?.status === 'pass' ? 2 : 0
  };
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const caps = [];
  if (currentReport.cleanup?.status !== 'pass') {
    caps.push({ reason: 'browser cleanup failed', maxTotal: 19 });
  }
  if (currentReport.notAFullClone !== true) {
    caps.push({ reason: 'notAFullClone boundary missing', maxTotal: 23 });
  }
  return { scale: 'qa-similarity-gate-25', max: 25, total, breakdown, caps };
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
