#!/usr/bin/env node
import { spawn } from 'node:child_process';
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

    const findings = [...liveInitial.failures, ...liveAfterDeal.failures, ...paperTopdeck.failures, ...wildExtension.failures];
    const horizontalOverflowDetected = [liveInitial, liveAfterDeal, paperTopdeck, wildExtension].some(
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
      wildEvidence.visibleText.includes('延链MP3') ||
      wildEvidence.visibleText.includes('延MP3x4') ||
      wildEvidence.visibleText.includes('延MP3');
    const continuationTokenVisible = wildEvidence.visibleText.includes('续燃x5');

    report.results.push({
      viewport,
      consoleErrorCount: consoleErrors.length,
      consoleErrors,
      horizontalOverflowDetected,
      textOverflowCount: findings.length,
      findings,
      acceptedCount:
        liveInitial.accepted.length + liveAfterDeal.accepted.length + paperTopdeck.accepted.length + wildExtension.accepted.length,
      paperScenarioReached,
      topdeckEvidenceVisible,
      topdeckToken: topdeckEvidenceVisible ? '整备：顶终结' : null,
      wildScenarioReached,
      extensionTokenVisible,
      continuationTokenVisible,
      extensionToken: extensionTokenVisible ? '延链MP3/延MP3x4' : null,
      continuationToken: continuationTokenVisible ? '续燃x5' : null,
      endTurnStillUsable,
      paperEvidence,
      wildEvidence,
      samples: wildExtension.samples
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

          if (overflowX && !clippedByDesign) {
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

          if (overflowY && !['hidden', 'auto', 'scroll'].includes(style.overflow) && !['hidden', 'auto', 'scroll'].includes(style.overflowY)) {
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
    try {
      await withTimeout('browser.close', 5_000, () => cleanup.browser.close());
    } catch (error) {
      cleanupReport.browserClose.ok = false;
      cleanupReport.browserClose.errors.push(serializeError(error));
    }
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
  const resultFailure = currentReport.results.some(
    (result) =>
      result.consoleErrorCount > 0 ||
      result.horizontalOverflowDetected ||
      result.textOverflowCount > 0 ||
      !result.paperScenarioReached ||
      !result.topdeckEvidenceVisible ||
      !result.wildScenarioReached ||
      !result.extensionTokenVisible ||
      !result.continuationTokenVisible ||
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
    coreTokensVisible:
      everyResult(
        (result) =>
          result.topdeckEvidenceVisible &&
          result.extensionTokenVisible &&
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
      everyResult((result) => result.topdeckEvidenceVisible && result.extensionTokenVisible && result.continuationTokenVisible) ? 3 : 0,
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
