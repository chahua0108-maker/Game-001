import type { Command, FailedCondition, GameEvent, RuleHit, WorldState } from '../sim/types';

export interface RuleContext {
  world: WorldState;
  event: GameEvent;
}

export interface ConditionResult {
  ok: boolean;
  id: string;
  reason?: string;
}

export interface Rule {
  id: string;
  event: GameEvent['type'];
  filter?: (context: RuleContext) => boolean;
  conditions: Array<(context: RuleContext) => ConditionResult>;
  actions: Array<(context: RuleContext) => Command[]>;
}

export interface RuleEvaluation {
  commands: Command[];
  failedConditions: FailedCondition[];
  hit: RuleHit;
}

export function evaluateRule(rule: Rule, context: RuleContext): RuleEvaluation | null {
  if (rule.event !== context.event.type) {
    return null;
  }

  if (rule.filter && !rule.filter(context)) {
    return null;
  }

  const failedConditions: FailedCondition[] = [];

  for (const condition of rule.conditions) {
    const result = condition(context);
    if (!result.ok) {
      failedConditions.push({
        tick: context.world.tick,
        traceId: context.event.traceId,
        ruleId: rule.id,
        conditionId: result.id,
        reason: result.reason ?? 'condition failed'
      });
    }
  }

  if (failedConditions.length > 0) {
    return {
      commands: [],
      failedConditions,
      hit: {
        tick: context.world.tick,
        traceId: context.event.traceId,
        ruleId: rule.id,
        eventType: context.event.type,
        passed: false
      }
    };
  }

  return {
    commands: rule.actions.flatMap((action) => action(context)),
    failedConditions,
    hit: {
      tick: context.world.tick,
      traceId: context.event.traceId,
      ruleId: rule.id,
      eventType: context.event.type,
      passed: true
    }
  };
}

export function evaluateRules(rules: Rule[], world: WorldState, event: GameEvent): RuleEvaluation[] {
  return rules
    .map((rule) => evaluateRule(rule, { world, event }))
    .filter((result): result is RuleEvaluation => result !== null);
}
