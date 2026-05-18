# Redline Hyper-Turn 30 Expert Lens Index

Date: 2026-05-18
Status: orchestration index for the second expert-review pass.
Baseline commit: `b24b262 Refocus Redline on hyper-turn card pressure`

## Purpose

This pass expands the previous game-design and game-experience review into 30 concrete expert lenses.

The goal is not to add more features by default. The goal is to reduce wrong turns by making the next implementation batch answer one narrow question:

> Can Redline's current hyper-turn card pressure become a clearly readable, repeatable, 3-5 turn fun slice?

## Worker Split

| File | Expert Group | Lenses |
| --- | --- | --- |
| `2026-05-18-expert-lens-01-combat-chain.md` | Core combat and card chain | 1-3 |
| `2026-05-18-expert-lens-02-enemy-intent.md` | Enemy pressure and intent | 4-6 |
| `2026-05-18-expert-lens-03-hud-ux.md` | HUD and interaction UX | 7-9 |
| `2026-05-18-expert-lens-04-vfx-feedback.md` | Combat VFX and feedback | 10-12 |
| `2026-05-18-expert-lens-05-balance-progression.md` | Balance, deck economy, progression | 13-15 |
| `2026-05-18-expert-lens-06-qa-metrics.md` | QA, telemetry, regression gates | 16-18 |
| `2026-05-18-expert-lens-07-theme-art.md` | Theme, copy, art direction | 19-21 |
| `2026-05-18-expert-lens-08-tech-architecture.md` | Runtime architecture and maintainability | 22-24 |
| `2026-05-18-expert-lens-09-product-competitive.md` | Competitive and product scope | 25-27 |
| `2026-05-18-expert-lens-10-web-shipping.md` | Web performance, platform, delivery | 28-30 |

## 30 Expert Lenses

| ID | Expert Lens | Primary Question |
| ---: | --- | --- |
| 1 | Card-chain system designer | Does the `0 -> 1 -> 2 -> 3` chain create decisions rather than a forced script? |
| 2 | In-turn rhythm designer | Does each turn feel fast enough for a "hyper-turn" game? |
| 3 | Core payoff designer | Does payoff feel like rescue and liquidation, not ordinary AoE? |
| 4 | Encounter designer | Do front row, back row, and refill create readable board situations? |
| 5 | Pressure curve designer | Does intent create pressure without reverting to realtime attrition? |
| 6 | Telegraph readability designer | Can the player understand consequence before committing? |
| 7 | Game UX architect | Does the first screen answer "what should I do now?" |
| 8 | Mobile hand-operation designer | Does 390x844 support reading and tapping cards safely? |
| 9 | Accessibility and text readability reviewer | Are Chinese labels, numbers, colors, and truncation usable? |
| 10 | Combat VFX director | Are slash, kill, and payoff feedback hierarchically distinct? |
| 11 | Animation timing designer | Does input-to-feedback timing sell impact? |
| 12 | Audio feedback designer | Are event hooks ready for sound even before audio ships? |
| 13 | Combat balance designer | Do HP, damage, MP, and multipliers support a 3-5 turn slice? |
| 14 | Deck and draw economy designer | Do draw, discard, wild, and repair create enough route variance? |
| 15 | Reward and progression designer | Does XP/reward serve the demo instead of slowing it? |
| 16 | Playtest QA lead | What fixed 3-5 turn script should a human verify? |
| 17 | Gameplay telemetry analyst | Which events prove chain pressure is working? |
| 18 | Regression test architect | Can tests prevent a return to the rejected realtime model? |
| 19 | World/narrative designer | Does "Redline liquidation bureau" explain mechanics? |
| 20 | Naming and copy designer | Are cards, enemies, and HUD labels memorable and concise? |
| 21 | Art direction lead | Is the visual direction coherent enough to guide assets? |
| 22 | Runtime architect | Are command, state, and event boundaries clean? |
| 23 | Data modeling engineer | Can card/enemy/snapshot models extend without ad hoc patches? |
| 24 | Test maintainability engineer | Are tests robust or overfitted to one seed/path? |
| 25 | Competitive systems analyst | What should be copied, avoided, or differentiated from card survival competitors? |
| 26 | Demo scope owner | What is the smallest next loop that avoids another 2-3 day detour? |
| 27 | Steam demo product lead | Does the first 30 seconds sell a hook? |
| 28 | WebGL/Three.js performance engineer | Is the current render path plausible on weaker devices? |
| 29 | Input and platform compatibility engineer | Are mouse, touch, viewport, and browser differences covered? |
| 30 | Build and delivery engineer | Is the demo reproducible, clean, and commit-friendly? |

## Merge Criteria

The final synthesis should not average all opinions. It should identify:

- repeated risks across expert groups;
- changes that improve multiple lenses at once;
- changes that are tempting but outside the next slice;
- exact acceptance evidence needed before the next commit.
