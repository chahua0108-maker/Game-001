# 数据结构草案

目标：让 Web 原型只是验证载体，而不是把逻辑绑死在 Web/Three.js 上。所有核心规则都应可迁移到 Unity/UE。

## 文件结构建议

```text
data/
  cards.json
  crawlers.json
  enemies.json
  dungeons.json
  rewards.json
  upgrades.json
  keywords.json
  localization.zh-CN.json
  localization.en-US.json
src/
  sim/
    combat.ts
    deck.ts
    dungeon.ts
    rewards.ts
    progression.ts
    save.ts
  render/
    threeScene.ts
    dungeonView.ts
    combatFx.ts
  ui/
    cards.ts
    hud.ts
    rewards.ts
```

## Card

```json
{
  "id": "nerve_probe",
  "nameKey": "card.nerve_probe.name",
  "type": "nerve",
  "cost": 0,
  "rarity": "common",
  "tags": ["starter", "draw"],
  "chainNode": "nerve",
  "effects": [
    { "op": "damage", "target": "front_enemy", "amount": 3 },
    { "op": "draw", "amount": 1 }
  ],
  "upgradeSlots": ["signal", "echo"],
  "visualKey": "fx.nerve.spark"
}
```

## Chain Rule

```json
{
  "id": "bio_chain_default",
  "nodes": ["nerve", "blood", "muscle", "acid"],
  "wildNodes": ["immune"],
  "baseMultiplier": 1.0,
  "stepMultiplier": 1.5,
  "resetOnMismatch": false,
  "preview": true
}
```

## Crawler / Player Archetype

```json
{
  "id": "surgeon_persona",
  "nameKey": "crawler.surgeon.name",
  "startingDeck": ["nerve_probe", "muscle_cut", "blood_suture", "immune_purge"],
  "passives": [
    { "trigger": "chain_complete", "op": "gain_tissue", "amount": 2 }
  ],
  "unlock": { "type": "default" }
}
```

## Enemy

```json
{
  "id": "spore_tick",
  "nameKey": "enemy.spore_tick.name",
  "hp": 12,
  "armor": 0,
  "intentDeck": [
    { "type": "attack", "value": 3, "weight": 70 },
    { "type": "infect", "value": 1, "weight": 30 }
  ],
  "rewards": {
    "mutationXp": 4,
    "protein": [2, 5]
  },
  "visualKey": "enemy.spore_tick"
}
```

## Dungeon

```json
{
  "id": "gut_corridor_01",
  "nameKey": "dungeon.gut_corridor_01.name",
  "floors": [
    {
      "width": 6,
      "height": 6,
      "start": [0, 0],
      "boss": [5, 5],
      "nodeWeights": {
        "combat": 60,
        "elite": 10,
        "protein": 10,
        "organ_table": 10,
        "rest": 10
      }
    }
  ]
}
```

## Reward

```json
{
  "id": "acid_route_pack_01",
  "trigger": "level_up",
  "choices": 3,
  "pools": [
    { "filter": { "type": "acid" }, "weight": 40 },
    { "filter": { "rarity": "common" }, "weight": 60 }
  ],
  "explainRoute": true
}
```

## Save

```json
{
  "version": 1,
  "profile": {
    "unlockedCards": ["nerve_probe"],
    "unlockedCrawlers": ["surgeon_persona"],
    "upgrades": { "starting_hand_plus_1": 1 },
    "proteinBank": 120
  },
  "lastRun": {
    "crawler": "surgeon_persona",
    "dungeon": "gut_corridor_01",
    "result": "death",
    "durationSeconds": 611
  }
}
```

## 迁移原则

1. `sim/` 不 import Three.js。
2. 所有随机数通过 seed 管理。
3. Renderer 只订阅 sim events。
4. UI 只调用 action API，不直接改状态。
5. JSON 字段命名保持 Unity/UE 也容易映射。
