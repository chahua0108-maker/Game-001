import { describe, expect, it } from 'vitest';
import { tickWorld } from '../../sim/runtime';
import {
  applyCardUpgradeChoice,
  buildCardUpgradeChoices,
  decodeCardUpgradeRewardChoiceId,
  isCardUpgradeRewardChoiceId,
  getCardDamageBonus
} from '../../sim/cardUpgrades';
import { createInitialWorld } from '../../sim/world';
import type { CardId, WorldState } from '../../sim/types';

function dealOpeningHand(world: WorldState): void {
  tickWorld(world, [{ type: 'deal-hand', traceId: 'upgrade-gems-deal' }]);
}

function prepareHand(world: WorldState, hand: CardId[]): void {
  dealOpeningHand(world);
  world.player.hand = [...hand];
  world.player.drawPile = [];
  world.player.discardPile = [];
  world.player.energy = world.player.maxEnergy;
}

function playCard(world: WorldState, cardId: CardId, traceId: string, targetId?: string): void {
  tickWorld(world, [{ type: 'play-card', cardId, traceId, targetId }]);
}

function selectFirstPendingRoute(world: WorldState, traceId: string): void {
  const routeId = world.route?.pendingNodeChoices[0]?.id;
  if (!routeId) {
    return;
  }

  tickWorld(world, [{ type: 'select-route', routeId, traceId }]);
}

describe('run-local card upgrade and gem slot sim slice', () => {
  it('offers a card upgrade as a later-node reward choice and applies it before the next fight', () => {
    const world = createInitialWorld();
    world.run.currentNode = 2;
    world.reward.xpThreshold = 1;
    world.enemies['enemy-1'].hp = 4;

    dealOpeningHand(world);
    playCard(world, 'debt_hook', 'upgrade-gems-reward-kill', 'enemy-1');

    const upgradeRewardId = world.reward.choices.find(isCardUpgradeRewardChoiceId);
    expect(upgradeRewardId).toBeDefined();

    const pendingUpgradeChoice = world.cardUpgrades.choices.find((choice) => choice.id === decodeCardUpgradeRewardChoiceId(upgradeRewardId!));
    expect(pendingUpgradeChoice).toMatchObject({
      type: 'raise-level',
      targetCardId: 'debt_hook',
      preview: '4 -> 6 damage this run',
      reason: 'upgrade debt_hook because it is already in deck and gains +2 repeatable damage',
      buildPlanReason: 'Make debt_hook a stronger repeatable front-target damage card for the current run.'
    });

    tickWorld(world, [{ type: 'select-reward', cardId: upgradeRewardId!, traceId: 'upgrade-gems-select-reward' }]);
    selectFirstPendingRoute(world, 'upgrade-gems-select-route');

    expect(world.cardUpgrades.enhancements.debt_hook).toMatchObject({
      cardId: 'debt_hook',
      level: 1
    });
    expect(world.player.deck.filter((cardId) => cardId === upgradeRewardId)).toHaveLength(0);
    expect(world.fsm.gameFlow).toBe('PlayerTurn');

    world.enemies['enemy-1'].hp = 30;
    world.enemies['enemy-1'].maxHp = 30;
    world.enemies['enemy-1'].alive = true;
    prepareHand(world, ['debt_hook']);
    playCard(world, 'debt_hook', 'upgrade-gems-next-fight', 'enemy-1');

    expect(world.enemies['enemy-1'].hp).toBe(24);
    expect(world.debug.events).toContainEqual(
      expect.objectContaining({
        type: 'CardUpgradeApplied',
        traceId: 'upgrade-gems-select-reward',
        cardId: 'debt_hook',
        choiceType: 'raise-level',
        damageBonus: 2
      })
    );
  });

  it('offers focused card growth choices and applies level plus socketed gem damage inside the current run', () => {
    const world = createInitialWorld();
    const target = world.enemies['enemy-1'];
    target.hp = 30;
    target.maxHp = 30;

    const firstChoices = buildCardUpgradeChoices(world, 'debt_hook', 'upgrade-gems-offer-1');

    expect(firstChoices.map((choice) => choice.type)).toEqual(['raise-level', 'add-gem-slot']);
    expect(firstChoices[0]).toMatchObject({
      preview: '4 -> 6 damage this run',
      reason: 'upgrade debt_hook because it is already in deck and gains +2 repeatable damage',
      buildPlanReason: 'Make debt_hook a stronger repeatable front-target damage card for the current run.'
    });
    expect(firstChoices[1]).toMatchObject({
      preview: 'opens red gem slot; damage unchanged until socketed',
      reason: 'prepare debt_hook for a red damage gem because it has no empty slot yet',
      buildPlanReason: 'Prepare debt_hook for a later socketed gem instead of taking immediate damage.'
    });

    applyCardUpgradeChoice(world, firstChoices[0].id, 'upgrade-gems-level');
    const secondChoices = buildCardUpgradeChoices(world, 'debt_hook', 'upgrade-gems-offer-2');
    const addSlot = secondChoices.find((choice) => choice.type === 'add-gem-slot');

    expect(addSlot).toBeDefined();
    applyCardUpgradeChoice(world, addSlot!.id, 'upgrade-gems-add-slot');

    const thirdChoices = buildCardUpgradeChoices(world, 'debt_hook', 'upgrade-gems-offer-3');
    const socketRuby = thirdChoices.find((choice) => choice.type === 'socket-gem' && choice.gemId === 'crimson_chip');

    expect(socketRuby).toBeDefined();
    expect(socketRuby).toMatchObject({
      preview: '6 -> 9 damage this run',
      reason: 'socket crimson_chip into debt_hook because an empty red slot is available for +3 damage',
      buildPlanReason: 'Turn debt_hook into the current run damage carry by using the prepared red slot.'
    });
    applyCardUpgradeChoice(world, socketRuby!.id, 'upgrade-gems-socket');

    expect(world.cardUpgrades.enhancements.debt_hook).toMatchObject({
      cardId: 'debt_hook',
      level: 1,
      gemSlots: [{ color: 'red', gemId: 'crimson_chip' }]
    });
    expect(getCardDamageBonus(world.cardUpgrades, 'debt_hook')).toBe(5);

    prepareHand(world, ['debt_hook']);
    playCard(world, 'debt_hook', 'upgrade-gems-play', 'enemy-1');

    expect(world.enemies['enemy-1'].hp).toBe(21);
    expect(world.debug.events).toContainEqual(
      expect.objectContaining({
        type: 'CardUpgradeApplied',
        traceId: 'upgrade-gems-socket',
        cardId: 'debt_hook',
        choiceType: 'socket-gem'
      })
    );
  });

  it('keeps upgrades as single-run growth and clears them on restart', () => {
    const world = createInitialWorld();
    const choices = buildCardUpgradeChoices(world, 'redline_cut', 'upgrade-gems-run-offer');

    applyCardUpgradeChoice(world, choices[0].id, 'upgrade-gems-run-apply');

    expect(world.cardUpgrades.enhancements.redline_cut?.level).toBe(1);

    const restarted = tickWorld(world, [{ type: 'restart-run', traceId: 'upgrade-gems-restart' }]);

    expect(restarted.cardUpgrades.enhancements.redline_cut).toBeUndefined();
    expect(restarted.cardUpgrades.history).toEqual([]);
  });
});
