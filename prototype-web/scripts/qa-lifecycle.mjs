#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const qaRound = process.env.QA_ROUND ?? 'round-13';
const outputDir = path.resolve(projectRoot, `outputs/browser-qa/${qaRound}`);
const outputFile = path.join(outputDir, 'qa-lifecycle-result.json');
const preferredPort = Number(process.env.QA_PORT ?? 5174);
const baseUrlOverride = process.env.QA_BASE_URL;

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
  '.combat-director',
  '.director-cell',
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
  name: 'qa-lifecycle',
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
    await page.waitForTimeout(150);

    const bootInspection = await inspectPage(page, 'boot');
    const support = await detectLifecycleSupport(page);
    const lifecycle = support.supported ? await exerciseLifecycleV1(page) : null;
    const lifecycleInspection = support.supported ? await inspectPage(page, 'lifecycle-v1') : null;
    const inspections = [bootInspection, lifecycleInspection].filter(Boolean);
    const layoutFailures = inspections.flatMap((item) => item.failures);
    const horizontalOverflowDetected = inspections.some((item) => item.pageOverflow.horizontal);
    const acceptedCount = inspections.reduce((total, item) => total + item.accepted.length, 0);

    const assertions = support.supported
      ? {
          lifecycleV1Supported: true,
          cardMovedEventReadable: Boolean(lifecycle?.cardMovedEventReadable),
          lifecycleShortTokenVisible: Boolean(lifecycle?.lifecycleShortTokenVisible),
          lifecycleZoneCountsVisible: Boolean(lifecycle?.lifecycleZoneCountsVisible),
          lifecycleZoneCountsChanged: Boolean(lifecycle?.lifecycleZoneCountsChanged),
          noHorizontalOverflow: !horizontalOverflowDetected && !layoutFailures.some((failure) => failure.axis === 'x'),
          noTextOverflow: !layoutFailures.some((failure) => failure.category.includes('text')),
          noConsoleErrors: consoleErrors.length === 0
        }
      : {
          lifecycleV1Supported: false,
          pendingBecauseRuntimeUnsupported: support.readiness === 'unsupported',
          failBecauseRuntimePartial: support.readiness === 'partial',
          noConsoleErrors: consoleErrors.length === 0
        };

    const resultStatus = classifyViewportStatus({ support, assertions, layoutFailures, consoleErrors });

    report.results.push({
      viewport,
      status: resultStatus,
      assertions,
      support,
      lifecycle,
      consoleErrorCount: consoleErrors.length,
      consoleErrors,
      horizontalOverflowDetected,
      layoutFailureCount: layoutFailures.length,
      layoutFailures,
      acceptedCount,
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

async function detectLifecycleSupport(page) {
  return await page.evaluate(async () => {
    const [{ cards }, { createInitialWorld }, { tickWorld }, { buildSnapshot }] = await Promise.all([
      import('/src/data/cards.ts'),
      import('/src/sim/world.ts'),
      import('/src/sim/runtime.ts'),
      import('/src/sim/snapshot.ts')
    ]);

    const world = createInitialWorld();
    tickWorld(world, [{ type: 'advance-time', deltaSeconds: 0.016, traceId: 'qa-life-detect-deal' }]);
    tickWorld(world, [{ type: 'play-card', cardId: world.player.hand[0], targetId: 'enemy-1', traceId: 'qa-life-detect-play' }]);
    tickWorld(world, [{ type: 'end-turn', traceId: 'qa-life-detect-end' }]);
    const snapshot = buildSnapshot(world);
    const player = snapshot.player;
    const events = snapshot.debug.events;
    const cardMovedEvents = events.filter((event) => event.type === 'CardMoved');
    const lifecycleEvents = events.filter((event) =>
      ['CardMoved', 'CardDrawn', 'CardDiscarded', 'CardExhausted', 'CardRetained', 'DeckReshuffled', 'StatusCardAdded'].includes(
        event.type
      )
    );
    const cardPlayed = events.find((event) => event.type === 'CardPlayed') ?? null;
    const turnEnded = events.find((event) => event.type === 'TurnEnded') ?? null;
    const zoneFields = [
      'exhaustPile',
      'retainPile',
      'retainedCards',
      'statusQueue',
      'statusPile',
      'purgePile',
      'limboPile'
    ].filter((field) => Array.isArray(player?.[field]) || Array.isArray(world.player?.[field]));
    const lifecycleCards = Object.values(cards)
      .filter((card) => hasLifecycleMetadata(card))
      .map((card) => ({
        id: card.id,
        name: card.name,
        cost: card.cost,
        targets: card.targets,
        lifecycle: card.lifecycle ?? card.lifecycleV1 ?? card.disposition ?? card.onPlay ?? card.onTurnEnd ?? null,
        keywords: card.keywords ?? []
      }));

    const hasCardMovedEvent = cardMovedEvents.length > 0;
    const hasLifecycleZone = zoneFields.length > 0;
    const hasLifecycleCardMetadata = lifecycleCards.length > 0;
    const hasCardPlayedDispositionFields = Boolean(
      cardPlayed &&
        ('fromZone' in cardPlayed ||
          'toZone' in cardPlayed ||
          'destinationZone' in cardPlayed ||
          'lifecycleDisposition' in cardPlayed ||
          'cardInstanceId' in cardPlayed)
    );
    const hasTurnEndedLifecycleFields = Boolean(
      turnEnded && ('discardedCardIds' in turnEnded || 'retainedCardIds' in turnEnded || 'expiredAuthorizationMP' in turnEnded)
    );
    const hasAnyLifecycleSignal =
      hasCardMovedEvent ||
      hasLifecycleZone ||
      hasLifecycleCardMetadata ||
      hasCardPlayedDispositionFields ||
      hasTurnEndedLifecycleFields ||
      lifecycleEvents.length > 0;
    const supported = hasCardMovedEvent && (hasLifecycleZone || hasLifecycleCardMetadata || hasCardPlayedDispositionFields);
    const missing = [
      hasCardMovedEvent ? null : 'missing CardMoved or equivalent card-zone movement event',
      hasLifecycleZone ? null : 'missing lifecycle zone array such as exhaustPile/retain/statusQueue',
      hasLifecycleCardMetadata ? null : 'missing lifecycle card metadata such as onPlay=exhaust or onTurnEnd=retain',
      hasCardPlayedDispositionFields ? null : 'missing CardPlayed source/destination lifecycle fields'
    ].filter(Boolean);

    return {
      supported,
      readiness: supported ? 'supported' : hasAnyLifecycleSignal ? 'partial' : 'unsupported',
      hasAnyLifecycleSignal,
      capabilityChecks: {
        hasCardMovedEvent,
        hasLifecycleZone,
        hasLifecycleCardMetadata,
        hasCardPlayedDispositionFields,
        hasTurnEndedLifecycleFields
      },
      missing,
      evidence: {
        zoneFields,
        lifecycleCards: lifecycleCards.slice(0, 12),
        eventTypes: Array.from(new Set(events.map((event) => event.type))).sort(),
        lifecycleEventSamples: lifecycleEvents.slice(0, 8),
        cardMovedEventSamples: cardMovedEvents.slice(0, 8),
        cardPlayedSample: cardPlayed,
        turnEndedSample: turnEnded,
        playerZoneCounts: zoneCounts(player)
      }
    };

    function hasLifecycleMetadata(card) {
      if (!card || typeof card !== 'object') {
        return false;
      }
      if (card.lifecycle || card.lifecycleV1 || card.disposition || card.onPlay || card.onTurnEnd || card.purgePolicy) {
        return true;
      }
      if (card.exhausts === true || card.retains === true || card.temporary === true || card.status === true) {
        return true;
      }
      const keywords = Array.isArray(card.keywords) ? card.keywords.join(' ') : '';
      return /消耗|保留|状态|污染|exhaust|retain|status|temporary/i.test(`${keywords} ${card.rulesText ?? ''} ${card.detail ?? ''}`);
    }

    function zoneCounts(source) {
      const fields = ['deck', 'drawPile', 'hand', 'discardPile', 'exhaustPile', 'retainPile', 'retainedCards', 'statusQueue', 'statusPile'];
      return Object.fromEntries(fields.map((field) => [field, Array.isArray(source?.[field]) ? source[field].length : null]));
    }
  });
}

async function exerciseLifecycleV1(page) {
  return await page.evaluate(async () => {
    const [{ cards }, { createInitialWorld }, { tickWorld }, { buildSnapshot }, { Hud }] = await Promise.all([
      import('/src/data/cards.ts'),
      import('/src/sim/world.ts'),
      import('/src/sim/runtime.ts'),
      import('/src/sim/snapshot.ts'),
      import('/src/ui/hud.ts')
    ]);

    document.body.innerHTML = '<div id="hud"></div>';
    const root = document.querySelector('#hud');
    const hud = new Hud(root, () => {});
    const world = createInitialWorld();
    tickWorld(world, [{ type: 'advance-time', deltaSeconds: 0.016, traceId: 'qa-life-deal' }]);

    for (const enemy of Object.values(world.enemies)) {
      enemy.hp = 200;
      enemy.maxHp = 200;
    }

    world.player.maxEnergy = 9;
    world.player.energy = 9;
    const lifecycleCards = Object.values(cards).filter((card) => hasLifecycleMetadata(card));
    const exhaustCard = lifecycleCards.find((card) => lifecycleDisposition(card) === 'exhaust') ?? null;
    const retainCard = lifecycleCards.find((card) => lifecycleDisposition(card) === 'retain') ?? null;
    const statusCard = lifecycleCards.find((card) => lifecycleDisposition(card) === 'status') ?? null;
    const primaryCard = exhaustCard ?? retainCard ?? lifecycleCards[0] ?? null;

    if (primaryCard) {
      world.player.hand = [primaryCard.id, ...(retainCard && retainCard.id !== primaryCard.id ? [retainCard.id] : [])];
      world.player.drawPile = ['debt_hook', 'redline_cut', 'row_cleave', 'severance_burst'].filter(
        (cardId) => cardId !== primaryCard.id && cardId !== retainCard?.id
      );
      world.player.discardPile = [];
    }

    const before = snapshotEvidence(world);
    if (primaryCard) {
      tickWorld(world, [
        {
          type: 'play-card',
          cardId: primaryCard.id,
          ...(cards[primaryCard.id]?.targets === 'front-enemy' ? { targetId: 'enemy-1' } : {}),
          traceId: 'qa-life-play-primary'
        }
      ]);
    }
    const afterPlay = snapshotEvidence(world);
    if (world.fsm.gameFlow === 'PlayerTurn') {
      tickWorld(world, [{ type: 'end-turn', traceId: 'qa-life-end-turn' }]);
    }
    const afterEndTurn = snapshotEvidence(world);

    hud.render(buildSnapshot(world));
    const visibleText = document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const cardMovedEvents = world.debug.events.filter((event) => event.type === 'CardMoved');
    const lifecycleEvents = world.debug.events.filter((event) =>
      ['CardMoved', 'CardDrawn', 'CardDiscarded', 'CardExhausted', 'CardRetained', 'DeckReshuffled', 'StatusCardAdded'].includes(
        event.type
      )
    );
    const lifecycleShortTokenVisible = /消耗|保留|状态|污染|弃牌|洗回|Exhaust|Retain|Status|弃\d|消\d|留\d|状\d/i.test(visibleText);
    const lifecycleZoneCountsVisible =
      /(消耗|保留|状态|污染|exhaust|retain|status|弃牌).{0,12}\d|\d.{0,12}(消耗|保留|状态|污染|exhaust|retain|status|弃牌)|(?:抽\s*\d+\s*)?(弃\s*\d+).{0,8}(消\s*\d+).{0,8}(留\s*\d+)/i.test(
        visibleText
      );
    const lifecycleZoneCountsChanged = zoneCountChanged(before.zoneCounts, afterPlay.zoneCounts, afterEndTurn.zoneCounts);

    return {
      selectedCards: {
        primary: primaryCard ? cardSummary(primaryCard) : null,
        exhaust: exhaustCard ? cardSummary(exhaustCard) : null,
        retain: retainCard ? cardSummary(retainCard) : null,
        status: statusCard ? cardSummary(statusCard) : null
      },
      before,
      afterPlay,
      afterEndTurn,
      cardMovedEventReadable:
        cardMovedEvents.length > 0 &&
        cardMovedEvents.every((event) => event.cardId && event.fromZone && event.toZone && event.reason),
      lifecycleShortTokenVisible,
      lifecycleZoneCountsVisible,
      lifecycleZoneCountsChanged,
      visibleText: visibleText.slice(0, 2000),
      lifecycleEvents: lifecycleEvents.slice(0, 24),
      cardMovedEvents: cardMovedEvents.slice(0, 24)
    };

    function snapshotEvidence(sourceWorld) {
      const snapshot = buildSnapshot(sourceWorld);
      return {
        tick: snapshot.tick,
        round: snapshot.round,
        gameFlow: snapshot.fsm.gameFlow,
        zoneCounts: zoneCounts(snapshot.player),
        hand: [...snapshot.player.hand],
        drawPile: [...snapshot.player.drawPile],
        discardPile: [...snapshot.player.discardPile],
        events: snapshot.debug.events.slice(-24)
      };
    }

    function zoneCounts(source) {
      const fields = ['deck', 'drawPile', 'hand', 'discardPile', 'exhaustPile', 'retainPile', 'retainedCards', 'statusQueue', 'statusPile'];
      return Object.fromEntries(fields.map((field) => [field, Array.isArray(source?.[field]) ? source[field].length : null]));
    }

    function zoneCountChanged(...states) {
      const keys = ['discardPile', 'exhaustPile', 'retainPile', 'retainedCards', 'statusQueue', 'statusPile'];
      return keys.some((key) => {
        const values = states.map((state) => state[key]).filter((value) => typeof value === 'number');
        return values.length >= 2 && new Set(values).size > 1;
      });
    }

    function hasLifecycleMetadata(card) {
      if (!card || typeof card !== 'object') {
        return false;
      }
      if (card.lifecycle || card.lifecycleV1 || card.disposition || card.onPlay || card.onTurnEnd || card.purgePolicy) {
        return true;
      }
      if (card.exhausts === true || card.retains === true || card.temporary === true || card.status === true) {
        return true;
      }
      const keywords = Array.isArray(card.keywords) ? card.keywords.join(' ') : '';
      return /消耗|保留|状态|污染|exhaust|retain|status|temporary/i.test(`${keywords} ${card.rulesText ?? ''} ${card.detail ?? ''}`);
    }

    function lifecycleDisposition(card) {
      const values = [card.lifecycle, card.lifecycleV1, card.disposition, card.onPlay, card.onTurnEnd, card.purgePolicy]
        .map((value) => (typeof value === 'string' ? value : JSON.stringify(value ?? '')))
        .join(' ')
        .toLowerCase();
      const keywords = Array.isArray(card.keywords) ? card.keywords.join(' ') : '';
      const text = `${values} ${keywords} ${card.rulesText ?? ''} ${card.detail ?? ''}`;
      if (/exhaust|消耗/.test(text)) {
        return 'exhaust';
      }
      if (/retain|保留/.test(text)) {
        return 'retain';
      }
      if (/status|curse|污染|状态/.test(text)) {
        return 'status';
      }
      return 'lifecycle';
    }

    function cardSummary(card) {
      return {
        id: card.id,
        name: card.name,
        cost: card.cost,
        targets: card.targets,
        disposition: lifecycleDisposition(card),
        keywords: card.keywords ?? []
      };
    }
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
              axis: 'x',
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
              axis: 'y',
              selector,
              index,
              text: text.slice(0, 160),
              reason: 'element extends outside viewport vertically',
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

function classifyViewportStatus({ support, assertions, layoutFailures, consoleErrors }) {
  if (!support.supported) {
    return support.readiness === 'partial' ? 'fail' : 'pending';
  }
  return Object.values(assertions).every(Boolean) && layoutFailures.length === 0 && consoleErrors.length === 0 ? 'pass' : 'fail';
}

function classifyStatus(currentReport) {
  const cleanupPassed = currentReport.cleanup?.status === 'pass';
  if (currentReport.errors.length > 0) {
    return cleanupPassed ? 'fail' : 'functional-fail-cleanup-fail';
  }
  if (currentReport.results.some((result) => result.status === 'fail')) {
    return cleanupPassed ? 'fail' : 'functional-fail-cleanup-fail';
  }
  if (currentReport.results.length !== viewports.length || currentReport.results.some((result) => result.status === 'pending')) {
    return cleanupPassed ? 'pending' : 'pending-cleanup-fail';
  }
  return cleanupPassed ? 'pass' : 'functional-pass-cleanup-fail';
}

function buildGates(currentReport) {
  const results = currentReport.results;
  const everyResult = (predicate) => results.length > 0 && results.every(predicate);
  return {
    commandExit: currentReport.errors.length === 0 ? 'pass' : 'fail',
    browserCleanup: currentReport.cleanup?.status === 'pass' ? 'pass' : 'fail',
    ownedServer: currentReport.server?.owned === true && currentReport.cleanup?.serverStop?.attempted === true ? 'pass' : 'fail',
    allViewportsPresent: results.length === viewports.length ? 'pass' : 'fail',
    lifecycleSupported: everyResult((result) => result.assertions.lifecycleV1Supported === true) ? 'pass' : 'fail',
    lifecycleEventsReadable: everyResult((result) => result.assertions.cardMovedEventReadable === true) ? 'pass' : 'fail',
    lifecycleHudReadable:
      everyResult(
        (result) =>
          result.assertions.lifecycleShortTokenVisible === true &&
          result.assertions.lifecycleZoneCountsVisible === true &&
          result.assertions.lifecycleZoneCountsChanged === true
      )
        ? 'pass'
        : 'fail',
    noConsoleErrors: everyResult((result) => result.consoleErrorCount === 0) ? 'pass' : 'fail',
    noHorizontalOverflow: everyResult((result) => !result.horizontalOverflowDetected) ? 'pass' : 'fail'
  };
}

function buildGateScore(currentReport) {
  const results = currentReport.results;
  const everyResult = (predicate) => results.length > 0 && results.every(predicate);
  const breakdown = {
    allViewportsPresent: results.length === viewports.length ? 2 : 0,
    lifecycleSupported: everyResult((result) => result.assertions.lifecycleV1Supported === true) ? 4 : 0,
    cardMovedEventReadable: everyResult((result) => result.assertions.cardMovedEventReadable === true) ? 3 : 0,
    lifecycleZoneCountsChanged: everyResult((result) => result.assertions.lifecycleZoneCountsChanged === true) ? 3 : 0,
    lifecycleHudTokens:
      everyResult(
        (result) =>
          result.assertions.lifecycleShortTokenVisible === true && result.assertions.lifecycleZoneCountsVisible === true
      )
        ? 3
        : 0,
    noUiRegression:
      everyResult(
        (result) =>
          result.assertions.noHorizontalOverflow && result.assertions.noTextOverflow && result.assertions.noConsoleErrors
      )
        ? 3
        : 0,
    browserCleanup: currentReport.cleanup?.status === 'pass' ? 2 : 0
  };
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const caps = [];
  if (currentReport.cleanup?.status !== 'pass') {
    caps.push({ reason: 'browser cleanup failed', maxTotal: 15 });
  }
  if (results.some((result) => result.status === 'pending')) {
    caps.push({ reason: 'lifecycle runtime unsupported or partial', maxTotal: 9 });
  }
  return { scale: 'qa-lifecycle-gate-20', max: 20, total, breakdown, caps };
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
