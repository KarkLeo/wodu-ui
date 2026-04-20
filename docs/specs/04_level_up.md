# Level-Up System Spec

## Overview

When a character accumulates enough XP, a level-up prompt appears in the header. The player launches a multi-step wizard to apply all level rewards, then confirms to commit the changes. Hit dice are always rolled last.

---

## XP & Readiness

### XP Thresholds

| Level | XP Required |
|-------|-------------|
| 1     | 0           |
| 2     | 1,000       |
| 3     | 3,000       |
| 4     | 6,000       |
| 5     | 10,000      |
| 6     | 15,000      |
| 7     | 21,000      |
| 8     | 28,000      |
| 9     | 36,000      |
| 10    | 45,000      |

Max level is **10**. XP can still be added above the cap but no level-up occurs.

### XP Controls (HeaderStrip)

- Buttons: **−10 / +10 / +100** — dispatch `{ type: 'GAIN_XP', amount }`.
- XP progress bar shows fraction of the way to next level.
- Label shows "XP (до N)" where N = XP needed for next level.

### Readiness Check

`isReadyToLevelUp(char)` in `src/utils/derived.ts`:
- Returns `false` if `char.level >= 10`.
- Returns `true` if `char.xp >= XP_THRESHOLDS[char.level + 1]`.

When `true`, the header shows **"Готов к повышению уровня!"** and a **"Повысить ↑"** button that navigates to `/character/:id/levelup`.

---

## Level Rewards Table

| Target Level | Hit Dice | Skill | Ability | Stat +1 | Damage Dice |
|-------------|----------|-------|---------|---------|-------------|
| 2           | +1       |       |         |         |             |
| 3           |          | +1    | +1      |         |             |
| 4           | +1       |       |         | +1      |             |
| 5           |          |       |         |         | +1d6        |
| 6           | +1       | +1    | +1      |         |             |
| 7           |          |       |         | +1      |             |
| 8           | +1       |       |         |         |             |
| 9           |          | +1    | +1      |         |             |
| 10          | +1       |       |         | +1      | +1d6        |

`damageBonusDice` rewards are auto-applied in `init()` before any steps begin — no player interaction required.

---

## Wizard Steps

Steps are shown in this fixed order. Any step whose reward is absent for the target level is skipped automatically.

1. **Skill** — pick one new skill (radio list of unlearned skills)
2. **Ability** — pick one new ability (radio list of unpicked class abilities); skipped if none available
3. **Stat** — bump one stat by +1; stats are capped at +3
4. **Hit Dice** — roll hit dice (always last)
5. **Confirm** — review summary and apply all changes

> Hit dice are always the final active step before confirmation, per game rules.

### Step: Skill

- Displays all skills not yet in `char.skillIds`.
- If all skills learned, shows "Все навыки уже освоены" and the step is skipped.

### Step: Ability

- Displays abilities from the character's class pool that are not yet in `char.abilityIds`.
- If none available, step is skipped automatically.
- **Special cases on pick:**
  - `summoning` — initializes `magic: { spirits: [], rituals: [], cantrips: [] }` if not present.
  - `sturdy` — auto-grants +6 HP (no roll); recorded in `hpHistory` as `{ level, roll: 6, source: 'sturdy' }`.

### Step: Stat

- 3×2 grid of the six stats; each shows current bonus.
- Selecting a stat increments it by +1 (enforced: `Math.min(3, current + 1)`).
- Stats already at +3 are disabled.

### Step: Hit Dice (always last)

- Pool size: `char.hitDice + 1` dice (one extra die is added each time hit dice are rewarded).
- Roll all dice (player can re-roll as many times as desired).
- Keep the **top `targetLevel` rolls**; remaining dice are discarded.
- Total of kept dice = new `maxHp` and `currentHp` (full replacement, not delta).
- Result recorded as `{ level: targetLevel, roll: total, source: 'dice' }` appended to `hpHistory`.
- `rollHitDice(numDice, level)` in `src/utils/derived.ts` implements the logic.

### Step: Confirm

- Shows `RewardsSummary` — all choices made during the wizard.
- "Подтвердить" dispatches `{ type: 'LEVEL_UP', patch: LevelUpPatch }` and navigates back.

---

## Domain Command

```ts
{ type: 'LEVEL_UP'; patch: LevelUpPatch }
```

`LevelUpPatch` accumulates all wizard selections:

```ts
interface LevelUpPatch {
  level: number
  maxHp: number
  currentHp: number
  hitDice: number
  hpHistory: HpHistoryEntry[]
  skillIds: SkillId[]
  abilityIds: AbilityId[]
  stats: Stats
  damageBonusDice: number
  magic?: Magic
}
```

Applied in `src/domain/progression.ts` → `levelUp(char, patch)`.

---

## HP History

Each HP gain is appended to `char.hpHistory`:

```ts
{ level: number; roll: number; source: 'dice' | 'sturdy' }
```

Used by `HpBreakdownPopover` to show a per-level HP breakdown. `hpBreakdownLines()` in `src/utils/derived.ts` formats this into display rows.

---

## Key Files

| Purpose               | File                                                            |
|-----------------------|-----------------------------------------------------------------|
| Readiness check       | `src/utils/derived.ts` — `isReadyToLevelUp()`                 |
| Dice rolling          | `src/utils/derived.ts` — `rollHitDice()`, `rollD6()`          |
| XP table & rewards    | `src/data/xpTable.ts`                                          |
| Class ability pools   | `src/data/classes.ts`                                          |
| State machine         | `src/composables/useLevelUp.ts`                                |
| Wizard container      | `src/features/level-up/LevelUpView.vue`                        |
| Hit dice step         | `src/features/level-up/components/HitDiceRollStep.vue`        |
| Skill step            | `src/features/level-up/components/SkillPickStep.vue`          |
| Ability step          | `src/features/level-up/components/AbilityPickStep.vue`        |
| Stat step             | `src/features/level-up/components/StatBumpStep.vue`           |
| Confirm step          | `src/features/level-up/components/RewardsSummary.vue`         |
| Level-up button       | `src/features/in-game/components/HeaderStrip.vue`             |
| Domain command        | `src/domain/commands.ts` — `LEVEL_UP`, `GAIN_XP`             |
| Domain logic          | `src/domain/progression.ts`                                    |
