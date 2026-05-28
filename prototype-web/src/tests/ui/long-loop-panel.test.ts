import { describe, expect, it } from 'vitest';

import { LongLoopPanel } from '../../ui/longLoopPanel';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

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

function rootStub(): HTMLElement {
  return {
    innerHTML: '',
    addEventListener: () => undefined
  } as unknown as HTMLElement;
}

describe('long-loop panel UI bridge', () => {
  it('renders P0 meta surfaces and drives settle, purchase, and reload through public paths', () => {
    const storage = new MemoryStorage();
    const root = rootStub();
    const panel = new LongLoopPanel(root, { storage, profileId: 'ui-long-loop-p0' });

    panel.render();
    expect(root.innerHTML).toContain('Long-loop P0');
    expect(root.innerHTML).toContain('QA profile');
    expect(root.innerHTML).toContain('Currency');
    expect(root.innerHTML).toContain('D1 Redline Gate');
    expect(root.innerHTML).toContain('D4 Pollution First Look');
    expect(root.innerHTML).toContain('D10 Final Boss Preview');
    expect(root.innerHTML).toContain('Default Chain');
    expect(root.innerHTML).toContain('Stable Chain Starter');
    expect(root.innerHTML).toContain('Iron Monk');
    expect(root.innerHTML).toContain('starter_stable_chain');
    expect(root.innerHTML).toContain('blacksmith_reroll_permit');
    expect(root.innerHTML).toContain('Settle D1');
    expect(root.innerHTML).toContain('Buy Stable Chain');
    expect(root.innerHTML).toContain('Reload Profile');

    panel.settleD1();
    expect(root.innerHTML).toContain('clear_d1');
    expect(root.innerHTML).toContain('settlement_review');
    expect(root.innerHTML).toContain('available');

    panel.buyShopItem('starter_stable_chain');
    expect(root.innerHTML).toContain('first_purchase');
    expect(root.innerHTML).toContain('purchased');
    expect(root.innerHTML).toContain('starter.stable_chain');

    panel.reloadProfile();
    expect(root.innerHTML).toContain('Reloaded from profileStorage');
    expect(root.innerHTML).toContain('starter_stable_chain');
    expect(root.innerHTML).toContain('starter.stable_chain');
  });
});
