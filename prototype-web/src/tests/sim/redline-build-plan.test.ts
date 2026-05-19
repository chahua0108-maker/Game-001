import { describe, expect, it } from 'vitest';

import { createBuildPlan } from '../../sim/buildPlan';
import { createInitialWorld } from '../../sim/world';
import type { CardId, WorldState } from '../../sim/types';

function withDeck(deck: CardId[]): WorldState {
  const world = createInitialWorld();
  world.player.deck = [...deck];
  world.player.hand = [];
  world.player.drawPile = [];
  world.player.discardPile = [];
  world.player.exhaustPile = [];
  world.player.retainedCards = [];
  return world;
}

function issueIds(world: WorldState): string[] {
  return createBuildPlan(world).issues.map((issue) => issue.id);
}

describe('redline build plan runtime', () => {
  it('explains a missing bridge when the deck cannot reliably build 0-1-2 authorization', () => {
    const world = withDeck(['debt_hook', 'severance_burst']);
    world.reward.choices = ['heartbeat_spark', 'wild_gap_key', 'blood_tithe'];
    world.reward.pending = true;

    const plan = createBuildPlan(world);

    expect(plan.summary).toContain('缺桥');
    expect(plan.issues[0]).toMatchObject({
      id: 'missing-bridge',
      label: '缺桥',
      nextStep: '优先拿低费接链或 wild 修补牌，让 0-1-2 授权链稳定成型。'
    });
    expect(plan.issues[0].recommendedCardIds).toEqual(['heartbeat_spark', 'wild_gap_key']);
  });

  it('promotes a finisher when the current deck can bridge but has no payoff end card', () => {
    const world = withDeck(['debt_hook', 'redline_cut', 'row_cleave', 'pulse_draw']);
    world.reward.choices = ['severance_burst', 'blood_tithe', 'spark_tap'];
    world.reward.pending = true;

    const plan = createBuildPlan(world);

    expect(issueIds(world)).toContain('missing-finisher');
    expect(plan.issues.find((issue) => issue.id === 'missing-finisher')).toMatchObject({
      label: '缺终结',
      recommendedCardIds: ['severance_burst']
    });
  });

  it('surfaces pollution cleanup before generic resource advice', () => {
    const world = withDeck(['debt_hook', 'redline_cut', 'row_cleave', 'severance_burst']);
    world.player.discardPile = ['static_overload', 'static_overload'];
    world.reward.choices = ['silt_purge', 'blood_tithe', 'fuse_needle'];
    world.reward.pending = true;

    const plan = createBuildPlan(world);

    expect(plan.issues[0]).toMatchObject({
      id: 'clear-pollution',
      label: '清污染',
      recommendedCardIds: ['silt_purge']
    });
    expect(plan.issues[0].reason).toContain('污染');
  });

  it('asks for resources when the deck has payoff pressure but lacks draw or repair fuel', () => {
    const world = withDeck(['debt_hook', 'redline_cut', 'row_cleave', 'severance_burst']);
    world.reward.choices = ['blood_tithe', 'wild_mana_stitch', 'crimson_receipt'];
    world.reward.pending = true;

    const plan = createBuildPlan(world);

    expect(issueIds(world)).toContain('need-resource');
    expect(plan.issues.find((issue) => issue.id === 'need-resource')).toMatchObject({
      label: '补资源',
      recommendedCardIds: ['blood_tithe', 'wild_mana_stitch']
    });
  });

  it('recommends upgrading the current key damage card from pending card upgrade choices', () => {
    const world = withDeck(['debt_hook', 'redline_cut', 'row_cleave', 'severance_burst']);
    world.cardUpgrades.pending = true;
    world.cardUpgrades.choices = [
      {
        id: 'upgrade:redline_cut:raise-level',
        type: 'raise-level',
        targetCardId: 'redline_cut',
        label: 'Redline Cut +1',
        description: '本次冒险内基础伤害 +2。',
        damageBonusPreview: 2
      }
    ];

    const plan = createBuildPlan(world);

    expect(plan.issues[0]).toMatchObject({
      id: 'upgrade-key-card',
      label: '强化关键牌',
      recommendedUpgradeChoiceIds: ['upgrade:redline_cut:raise-level'],
      recommendedCardIds: ['redline_cut']
    });
  });
});
