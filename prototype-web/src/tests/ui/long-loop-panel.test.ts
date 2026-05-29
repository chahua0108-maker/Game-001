import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type StorageRecord = Map<string, string>;

class TestStorage implements Storage {
  private readonly values: StorageRecord = new Map();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

type LongLoopUiOptions = {
  readonly storage: Storage;
  readonly profileId: string;
};

type LongLoopUiInstance = {
  readonly render?: () => void;
  readonly mount?: () => void;
  readonly start?: () => void;
  readonly openD1Brief?: () => void;
  readonly startD1Brief?: () => void;
  readonly startD1?: () => void;
  readonly startD1Run?: () => void;
  readonly startDistrictOne?: () => void;
  readonly completeD1?: () => void;
  readonly clearD1?: () => void;
  readonly finishD1?: () => void;
  readonly settleD1?: () => void;
  readonly openShop?: () => void;
  readonly showShop?: () => void;
  readonly goShop?: () => void;
  readonly buyStableChain?: () => void;
  readonly buyStarter?: (name: string) => void;
  readonly purchaseStableChain?: () => void;
  readonly buyShopItem?: (itemId: string) => void;
};

type LongLoopUiConstructor = new (root: HTMLElement, options: LongLoopUiOptions) => LongLoopUiInstance;
type LongLoopUiFactory = (root: HTMLElement, options: LongLoopUiOptions) => LongLoopUiInstance;
type ZeroArgUiMethodName = Exclude<keyof LongLoopUiInstance, 'buyStarter' | 'buyShopItem'>;

type UiCandidate = {
  readonly modulePath: string;
  readonly exportName: string;
};

const TEST_DIR = dirname(fileURLToPath(import.meta.url));

const PLAYER_FACING_UI_CANDIDATES: readonly UiCandidate[] = [
  { modulePath: '../../ui/metaLongLoopApp', exportName: 'MetaLongLoopApp' },
  { modulePath: '../../ui/metaLongLoopApp', exportName: 'createMetaLongLoopApp' },
  { modulePath: '../../ui/longLoopApp', exportName: 'MetaLongLoopApp' },
  { modulePath: '../../ui/longLoopApp', exportName: 'LongLoopApp' },
  { modulePath: '../../ui/longLoopPanel', exportName: 'MetaLongLoopApp' },
  { modulePath: '../../ui/longLoopPanel', exportName: 'LongLoopPanel' }
] as const;

const BANNED_VISIBLE_TEXT: readonly string[] = [
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
] as const;

describe('player-facing long-loop P0 UI gate', () => {
  it('starts on a player-facing Hub shell without debug or internal copy', async () => {
    const harness = await createHarness('ui-long-loop-p0-initial');

    render(harness.app);

    const text = visibleText(harness.root);
    expectNoBannedText(text);
    expect(text).toMatch(/\bHub\b|Command Hub|Safehouse|Meta|中枢/i);
    expect(text).toMatch(/\bD1\b|District 1|Redline Gate|红线闸门/i);
    expect(text).toMatch(/wallet|reputation|rep|gems?|钱包|声望|宝石/i);
    expect(text).toMatch(/loadout|crawler|starter|deck|配装|爬行者|起手链|牌组/i);
    expect(text).toMatch(/next run|next-run|preview|下一局|预览/i);
  });

  it('drives D1 clear, shop purchase, next-run impact, and reload persistence through the UI seam', async () => {
    const storage = new TestStorage();
    const firstSession = await createHarness('ui-long-loop-p0-flow', storage);

    render(firstSession.app);
    expectNoBannedText(visibleText(firstSession.root));

    openD1(firstSession);
    let text = visibleText(firstSession.root);
    expectNoBannedText(text);
    expect(text).toMatch(/\bD1\b|District 1|Redline Gate|红线闸门/i);
    expect(text).toMatch(/brief|start|run|crawler|starter|deck|简报|开始|配装|爬行者|起手链|牌组/i);

    completeD1(firstSession);
    text = visibleText(firstSession.root);
    expectNoBannedText(text);
    expect(text).toMatch(/settlement|clear|cleared|complete|结算|清理|完成/i);
    expect(text).toMatch(/\+100|100\s*(rep|reputation)|100\s*声望/i);
    expect(text).toMatch(/\+1|1\s*gem|1\s*宝石/i);
    expect(text).toMatch(/shop|unlock|next choice|continue|商店|开放|下一步|继续/i);

    openShop(firstSession);
    text = visibleText(firstSession.root);
    expectNoBannedText(text);
    expect(text).toMatch(/\bShop\b|Market|Supply|商店/i);
    expect(text).toMatch(/Stable Chain|稳定链/i);
    expect(text).toMatch(/price|cost|100\s*(rep|reputation)|afford|声望|购买|可用/i);

    buyStableChain(firstSession);
    text = visibleText(firstSession.root);
    expectNoBannedText(text);
    expect(text).toMatch(/Stable Chain|稳定链/i);
    expect(text).toMatch(/owned|purchased|equipped|已拥有|已购买|已装备/i);
    expect(text).toMatch(/next run|next-run|preview|下一局|预览/i);
    expect(text).toMatch(/equipped|selected|已装备|已选择/i);
    expect(text).toMatch(/Wild Gap Key|Severance Burst|stable starter deck|野隙钥|断离爆发|稳定起始牌组/i);

    const reloadedSession = await createHarness('ui-long-loop-p0-flow', storage);
    render(reloadedSession.app);
    text = visibleText(reloadedSession.root);
    expectNoBannedText(text);
    expect(text).toMatch(/\bHub\b|Command Hub|Safehouse|Meta|中枢/i);
    expect(text).toMatch(/Stable Chain|稳定链/i);
    expect(text).toMatch(/owned|purchased|equipped|已拥有|已购买|已装备/i);
    expect(text).toMatch(/equipped|selected|已装备|已选择/i);
    expect(text).toMatch(/\bD1\b|District 1|Redline Gate|红线闸门/i);
    expect(text).toMatch(/clear|cleared|complete|progress|清理|完成|推进|进度/i);
    expect(text).toMatch(/next run|next-run|preview|下一局|预览/i);
    expect(text).toMatch(/Wild Gap Key|Severance Burst|stable starter deck|野隙钥|断离爆发|稳定起始牌组/i);

    openD1(reloadedSession);
    if (typeof reloadedSession.app.startD1Run === 'function') {
      reloadedSession.app.startD1Run();
    } else if (!clickButton(reloadedSession.root, [/start|begin|run|开始|进入/i], [/D1|district|区域/i])) {
      throw new Error('Reloaded UI must let the player start a second D1 run.');
    }
    text = visibleText(reloadedSession.root);
    expectNoBannedText(text);
    expect(text).toMatch(/Iron Monk|铁僧/i);
    expect(text).toMatch(/Stable Chain|稳定链/i);
    expect(text).toMatch(/Wild Gap Key|野隙钥/i);
    expect(text).toMatch(/Severance Burst|断离爆发/i);

    expect(testidAttribute(reloadedSession.root, 'district-d1-run', 'data-run-id')).toBe('run-2');
    expect(testidAttribute(reloadedSession.root, 'district-d1-run', 'data-starter-kit-id')).toBe('starter.stable_chain');
    expect(testidAttribute(reloadedSession.root, 'district-d1-run', 'data-deck-modifier-id')).toBe('starter.stable_chain.deck');
    expect(testidAttribute(reloadedSession.root, 'district-d1-run', 'data-starter-card-ids')).toBe(
      'debt_hook,wild_gap_key,severance_burst'
    );
  });
});

async function createHarness(profileId: string, storage = new TestStorage()): Promise<{
  readonly root: HTMLElement;
  readonly app: LongLoopUiInstance;
}> {
  const root = createRoot();
  const app = await createLongLoopUi(root, { storage, profileId });
  return { root, app };
}

async function createLongLoopUi(root: HTMLElement, options: LongLoopUiOptions): Promise<LongLoopUiInstance> {
  const errors: string[] = [];

  for (const candidate of PLAYER_FACING_UI_CANDIDATES) {
    const moduleExports = await importCandidate(candidate, errors);
    const exported = moduleExports?.[candidate.exportName];
    if (typeof exported !== 'function') {
      continue;
    }

    return instantiateUi(exported as LongLoopUiConstructor | LongLoopUiFactory, root, options, candidate);
  }

  throw new Error(
    [
      'Missing player-facing long-loop UI seam.',
      'Export MetaLongLoopApp from src/ui/metaLongLoopApp.ts, or expose an equivalent player-facing class/API from src/ui/longLoopPanel.ts.',
      'This gate must not be satisfied by debug/admin markup that exposes banned internal text.',
      errors.length > 0 ? `Import attempts: ${errors.join(' | ')}` : ''
    ]
      .filter(Boolean)
      .join(' ')
  );
}

async function importCandidate(candidate: UiCandidate, errors: string[]): Promise<Record<string, unknown> | null> {
  if (!candidateFileExists(candidate.modulePath)) {
    errors.push(`${candidate.modulePath} unavailable`);
    return null;
  }

  try {
    return (await import(/* @vite-ignore */ candidate.modulePath)) as Record<string, unknown>;
  } catch (error) {
    if (isMissingModuleError(error)) {
      errors.push(`${candidate.modulePath} unavailable`);
      return null;
    }

    throw error;
  }
}

function candidateFileExists(modulePath: string): boolean {
  const resolvedPath = resolve(TEST_DIR, modulePath);
  return existsSync(`${resolvedPath}.ts`) || existsSync(`${resolvedPath}.tsx`) || existsSync(`${resolvedPath}.js`);
}

function instantiateUi(
  exported: LongLoopUiConstructor | LongLoopUiFactory,
  root: HTMLElement,
  options: LongLoopUiOptions,
  candidate: UiCandidate
): LongLoopUiInstance {
  try {
    return new (exported as LongLoopUiConstructor)(root, options);
  } catch (constructorError) {
    try {
      return (exported as LongLoopUiFactory)(root, options);
    } catch (factoryError) {
      throw new Error(
        `Unable to instantiate ${candidate.exportName} from ${candidate.modulePath}: ${errorMessage(constructorError)}; ${errorMessage(factoryError)}`
      );
    }
  }
}

function render(app: LongLoopUiInstance): void {
  if (typeof app.render === 'function') {
    app.render();
    return;
  }

  if (typeof app.mount === 'function') {
    app.mount();
    return;
  }

  if (typeof app.start === 'function') {
    app.start();
    return;
  }

  throw new Error('Player-facing long-loop UI seam must expose render(), mount(), or start().');
}

function openD1(harness: { readonly root: HTMLElement; readonly app: LongLoopUiInstance }): void {
  if (
    clickButton(
      harness.root,
      [/D1/i, /District 1/i, /Redline Gate/i, /红线闸门/i],
      [/brief/i, /start/i, /enter/i, /run/i, /play/i, /简报/i, /准备/i, /开始/i, /进入/i]
    )
  ) {
    return;
  }

  if (callFirst(harness.app, ['openD1Brief', 'startD1Brief', 'startD1', 'startDistrictOne'])) {
    return;
  }

  throw new Error('Player-facing long-loop UI seam must let the player open or start D1.');
}

function completeD1(harness: { readonly root: HTMLElement; readonly app: LongLoopUiInstance }): void {
  if (
    clickButton(
      harness.root,
      [/complete/i, /clear/i, /finish/i, /settle/i, /survive/i, /完成/i, /清理/i, /结算/i, /通关/i],
      [/D1/i, /district/i, /run/i, /区域/i]
    )
  ) {
    return;
  }

  if (typeof harness.app.startD1Run === 'function') {
    harness.app.startD1Run();
  }

  if (callFirst(harness.app, ['completeD1', 'clearD1', 'finishD1', 'settleD1'])) {
    return;
  }

  throw new Error('Player-facing long-loop UI seam must let the player complete D1 and reach settlement.');
}

function openShop(harness: { readonly root: HTMLElement; readonly app: LongLoopUiInstance }): void {
  if (clickButton(harness.root, [/shop/i, /market/i, /supply/i, /商店/i, /声望/i])) {
    return;
  }

  callFirst(harness.app, ['openShop', 'showShop', 'goShop']);
}

function buyStableChain(harness: { readonly root: HTMLElement; readonly app: LongLoopUiInstance }): void {
  if (clickButton(harness.root, [/Stable Chain/i, /稳定链/i], [/buy/i, /purchase/i, /购买/i])) {
    return;
  }

  if (callFirst(harness.app, ['buyStableChain', 'purchaseStableChain'])) {
    return;
  }

  if (typeof harness.app.buyStarter === 'function') {
    harness.app.buyStarter('Stable Chain');
    return;
  }

  if (typeof harness.app.buyShopItem === 'function') {
    harness.app.buyShopItem('starter_stable_chain');
    return;
  }

  throw new Error('Player-facing long-loop UI seam must let the player buy Stable Chain from the shop.');
}

function callFirst(app: LongLoopUiInstance, methodNames: readonly ZeroArgUiMethodName[]): boolean {
  for (const methodName of methodNames) {
    const method = app[methodName] as (() => void) | undefined;
    if (typeof method === 'function') {
      method.call(app);
      return true;
    }
  }

  return false;
}

function clickButton(root: HTMLElement, ...labelGroups: readonly RegExp[][]): boolean {
  if (!('querySelectorAll' in root) || typeof root.querySelectorAll !== 'function') {
    return false;
  }

  const buttons = Array.from(root.querySelectorAll('button'));
  const button = buttons.find((candidate) => {
    const label = normalizeText(candidate.textContent ?? '');
    return labelGroups.every((patterns) => patterns.some((pattern) => pattern.test(label)));
  });

  if (!button) {
    return false;
  }

  button.click();
  return true;
}

function expectNoBannedText(text: string): void {
  const leaked = BANNED_VISIBLE_TEXT.filter((banned) => text.includes(banned));
  expect(leaked, `Banned debug/internal UI text is visible: ${leaked.join(', ')}`).toEqual([]);
}

function visibleText(root: HTMLElement): string {
  if ('textContent' in root && root.textContent) {
    return normalizeText(root.textContent);
  }

  return normalizeText(stripHtml(root.innerHTML));
}

function testidAttribute(root: HTMLElement, testid: string, attributeName: string): string | null {
  if ('querySelector' in root && typeof root.querySelector === 'function') {
    return root.querySelector(`[data-testid="${testid}"]`)?.getAttribute(attributeName) ?? null;
  }

  const tag = root.innerHTML.match(new RegExp(`<[^>]*data-testid="${escapeRegExp(testid)}"[^>]*>`, 'i'))?.[0];
  return tag?.match(new RegExp(`${escapeRegExp(attributeName)}="([^"]*)"`))?.[1] ?? null;
}

function createRoot(): HTMLElement {
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    return document.createElement('div');
  }

  return {
    innerHTML: '',
    addEventListener: () => undefined,
    removeEventListener: () => undefined
  } as unknown as HTMLElement;
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isMissingModuleError(error: unknown): boolean {
  const message = errorMessage(error);
  return message.includes('Cannot find module') || message.includes('Failed to resolve import') || message.includes('ERR_MODULE_NOT_FOUND');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
