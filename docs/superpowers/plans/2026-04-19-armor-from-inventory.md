# Armor From Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Derive armor class entirely from equipped inventory items (like weapons), remove the manual armor-type selector everywhere, drop the «Бой» tab, and surface damage formula in the header strip next to armor.

**Architecture:** `totalArmor` and `armorBreakdownLines` in `derived.ts` will read equipped items tagged `armor`/`light`/`full`/`shield` instead of `Character.armor`. `ArmorState`/`ArmorType` types and the `armor` field are deleted from `Character`. The Combat tab and `CombatPanel` are removed; the header strip gains a damage line (equipped weapon formula + `DamageBreakdownPopover`). `StepGear` armor-selector block is removed — players buy armor from the gear catalog.

**Tech Stack:** Vue 3, TypeScript, Pinia, no test suite (CLAUDE.md: do not add tests)

---

## File Map

| File | Change |
|------|--------|
| `src/types/character.ts` | Delete `ArmorType`, `ArmorState`, `armor` field from `Character` |
| `src/utils/derived.ts` | Rewrite `totalArmor`, `armorBreakdownLines` to use inventory; delete `armorLabel` |
| `src/components/ui/ArmorBreakdownPopover.vue` | Update prop pick (remove `armor`) |
| `src/features/character-creation/CharacterCreationView.vue` | Remove `armor` from draft initial state |
| `src/features/character-creation/steps/StepGear.vue` | Remove armor selector block |
| `src/stores/characters.ts` | Add `afterHydrate` migration: delete legacy `armor` key |
| `src/features/in-game/components/HeaderStrip.vue` | Add equipped-weapon damage row |
| `src/features/in-game/InGameView.vue` | Remove `combat` tab, `CombatPanel` import/usage |
| `src/features/in-game/components/CombatPanel.vue` | Delete file |

---

### Task 1: Rewrite armor derived logic + update types

**Files:**
- Modify: `src/types/character.ts`
- Modify: `src/utils/derived.ts`

This task removes `ArmorState`/`ArmorType` from types and rewrites the two armor functions to read from `char.inventory`. No UI changes yet — just the data layer.

- [ ] **Step 1: Edit `src/types/character.ts`**

Replace the armor section. Delete lines 41–42 (`ArmorType` and `ArmorState`) and remove the `armor` field (line 97) from `Character`:

```ts
// DELETE these two lines:
// export type ArmorType = 'none' | 'light' | 'full'
// export interface ArmorState { type: ArmorType; shield: boolean }

// In Character interface, DELETE this line:
//   armor: ArmorState
```

Final `character.ts` armor section (lines around 41–100) — only the surrounding context shown; delete the two export lines and remove `armor: ArmorState` from the interface:

```ts
export type StatKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
export type Stats = Record<StatKey, number>

export interface InventoryItem {
  id: string
  name: string
  price?: number
  tags: string[]
  damage?: string
  notes?: string
  equipped?: boolean
}
```

And in `Character`:
```ts
export interface Character {
  id: string
  createdAt: number
  status: CharacterStatus

  name: string
  trueName?: string
  classId: ClassId
  level: number
  xp: number

  stats: Stats
  statRolls: Record<StatKey, number>
  hitDice: number
  currentHp: number
  maxHp: number
  hpHistory?: { level: number; roll: number; source: 'dice' | 'sturdy' }[]

  skillIds: SkillId[]
  abilityIds: AbilityId[]

  inventory: InventoryItem[]
  coins: number

  magic?: Magic

  damageBonusDice: number
  notes: string
}
```

- [ ] **Step 2: Rewrite armor functions in `src/utils/derived.ts`**

Remove `ArmorState` from the import on line 1:
```ts
import type { AbilityId, Character, InventoryItem, StatKey } from '@/types/character'
```

Replace `totalArmor` (lines 9–14):
```ts
export function totalArmor(char: Pick<Character, 'inventory' | 'abilityIds'>): number {
  const equipped = (char.inventory ?? []).filter(i => i.equipped)
  const hasFull = equipped.some(i => i.tags.includes('armor') && i.tags.includes('full'))
  const hasLight = equipped.some(i => i.tags.includes('armor') && i.tags.includes('light'))
  const hasShield = equipped.some(i => i.tags.includes('shield'))
  const base = hasFull ? 2 : hasLight ? 1 : 0
  const shield = hasShield ? 1 : 0
  const toughness = (char.abilityIds ?? []).includes('toughness') ? 1 : 0
  return base + shield + toughness
}
```

Delete `armorLabel` (lines 16–19) entirely.

Replace `armorBreakdownLines` (lines 115–127):
```ts
export function armorBreakdownLines(char: Pick<Character, 'inventory' | 'abilityIds'>): {
  lines: BreakdownLine[]
  note?: string
} {
  const equipped = (char.inventory ?? []).filter(i => i.equipped)
  const hasFull = equipped.some(i => i.tags.includes('armor') && i.tags.includes('full'))
  const hasLight = equipped.some(i => i.tags.includes('armor') && i.tags.includes('light'))
  const hasShield = equipped.some(i => i.tags.includes('shield'))
  const lines: BreakdownLine[] = []
  if (hasFull) lines.push({ value: '2', label: 'полный доспех' })
  else if (hasLight) lines.push({ value: '1', label: 'лёгкий доспех' })
  if (hasShield) lines.push({ value: '+1', label: 'щит' })
  const abilityIds = char.abilityIds ?? []
  if (abilityIds.includes('toughness')) lines.push({ value: '+1', label: 'Прочность' })
  const note = abilityIds.includes('skirmish') ? 'доспех считается лёгким (Манёвренность)' : undefined
  return { lines, note }
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -20
```

Expected: TypeScript errors about `char.armor` in files not yet updated. Note every file name from the error output — those are the next tasks. Build will fail here; that's expected.

- [ ] **Step 4: Commit partial (types + derived only)**

```bash
git add src/types/character.ts src/utils/derived.ts
git commit -m "refactor(armor): derive armor from inventory, remove ArmorState type"
```

---

### Task 2: Update ArmorBreakdownPopover + stores migration

**Files:**
- Modify: `src/components/ui/ArmorBreakdownPopover.vue`
- Modify: `src/stores/characters.ts`

- [ ] **Step 1: Fix `ArmorBreakdownPopover.vue`**

The popover currently passes `props.char` to `armorBreakdownLines(props.char)` and `totalArmor(props.char)`. After Task 1, `char` no longer has an `armor` field — but both functions now take `Pick<Character, 'inventory' | 'abilityIds'>` so the call site works as-is. No code change needed in the popover *unless* TypeScript still complains — verify with the build step below.

- [ ] **Step 2: Add legacy `armor` migration to `src/stores/characters.ts`**

In `afterHydrate`, add deletion of the stale `armor` key so localStorage data from before this change doesn't linger as a typed mismatch:

```ts
persist: {
  key: STORAGE_KEY,
  afterHydrate(ctx) {
    ctx.store.$patch((state) => {
      state.list = state.list.map((c: any) => {
        const { armor: _armor, ...rest } = c
        return {
          ...rest,
          inventory: rest.inventory ?? [],
          skillIds: rest.skillIds ?? [],
          abilityIds: rest.abilityIds ?? [],
        }
      })
    })
  },
},
```

- [ ] **Step 3: Verify build passes for these two files**

```bash
npm run build 2>&1 | grep -E "error|ArmorBreakdown|characters"
```

Expected: no errors for `ArmorBreakdownPopover.vue` or `characters.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/ArmorBreakdownPopover.vue src/stores/characters.ts
git commit -m "fix(armor): drop armor field from store hydration, popover uses inventory"
```

---

### Task 3: Remove armor selector from character creation

**Files:**
- Modify: `src/features/character-creation/CharacterCreationView.vue`
- Modify: `src/features/character-creation/steps/StepGear.vue`

- [ ] **Step 1: Remove `armor` from draft initial state in `CharacterCreationView.vue`**

At line 30, delete the `armor` property from the `characters.add({...})` call:

```ts
// DELETE this line:
// armor: { type: 'none', shield: false },
```

The block after the change:
```ts
const draft = characters.add({
  status: 'draft',
  classId: 'fighter',
  name: '',
  level: 1,
  xp: 0,
  stats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
  statRolls: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
  hitDice: 1,
  currentHp: 0,
  maxHp: 0,
  skillIds: [],
  abilityIds: [],
  inventory: [],
  coins: 60,
  damageBonusDice: 0,
  notes: '',
})
```

- [ ] **Step 2: Remove armor selector from `StepGear.vue` script**

Delete the import of `ArmorType` (line 3), `setArmor` function (lines 24–26), and `toggleShield` function (lines 27–29):

```ts
import { ref, computed } from 'vue'
import type { Character, InventoryItem } from '@/types/character'
import { GEAR_CATALOG, GEAR_CATEGORIES, findGearTemplate } from '@/data/gear'
import { hitDiceCount, rollHitDice, sturdinessBonus } from '@/utils/derived'
```

(Functions `setArmor` and `toggleShield` are completely deleted — no replacement.)

- [ ] **Step 3: Remove armor selector from `StepGear.vue` template**

Delete the entire `<section class="block">` that contains the armor grid (lines 108–119):

```html
<!-- DELETE this entire section: -->
<!--
<section class="block">
  <div class="label">Доспех</div>
  <div class="armor-grid">
    <button class="armor-card" :class="{ 'armor-card--active': draft.armor.type === 'none' }" @click="setArmor('none')">Без</button>
    <button class="armor-card" :class="{ 'armor-card--active': draft.armor.type === 'light' }" @click="setArmor('light')">Лёгкий (1)</button>
    <button class="armor-card" :class="{ 'armor-card--active': draft.armor.type === 'full' }" @click="setArmor('full')">Полный (2)</button>
  </div>
  <label class="check">
    <input type="checkbox" :checked="draft.armor.shield" @change="toggleShield" />
    Щит (+1)
  </label>
</section>
-->
```

- [ ] **Step 4: Remove armor CSS from `StepGear.vue` styles**

Delete these style rules (lines ~182–185):
```css
/* DELETE: */
/* .armor-grid { ... } */
/* .armor-card { ... } */
/* .armor-card--active { ... } */
/* .check { ... } */
```

- [ ] **Step 5: Verify build**

```bash
npm run build 2>&1 | grep -E "error|StepGear|CharacterCreation"
```

Expected: no errors for these files.

- [ ] **Step 6: Commit**

```bash
git add src/features/character-creation/CharacterCreationView.vue src/features/character-creation/steps/StepGear.vue
git commit -m "feat(creation): remove manual armor selector, armor comes from gear catalog"
```

---

### Task 4: Add damage row to HeaderStrip

**Files:**
- Modify: `src/features/in-game/components/HeaderStrip.vue`

Show the equipped weapon's damage formula next to armor in the header, with a `DamageBreakdownPopover` on click.

- [ ] **Step 1: Update script in `HeaderStrip.vue`**

Add imports for `isWeapon`, `damageFormula`, `DamageBreakdownPopover`:

```ts
import { computed } from 'vue'
import type { Character } from '@/types/character'
import { CLASSES } from '@/data/classes'
import { totalArmor, xpToNextLevel, xpProgressPercent, isReadyToLevelUp, isWeapon, damageFormula } from '@/utils/derived'
import HpBreakdownPopover from '@/components/ui/HpBreakdownPopover.vue'
import ArmorBreakdownPopover from '@/components/ui/ArmorBreakdownPopover.vue'
import DamageBreakdownPopover from '@/components/ui/DamageBreakdownPopover.vue'
```

Add the `equippedWeapon` computed (after the existing `armor` computed):

```ts
const equippedWeapon = computed(() => {
  const weapons = props.char.inventory.filter(isWeapon)
  return weapons.find(w => w.equipped) ?? weapons[0] ?? null
})
const dmgFormula = computed(() =>
  equippedWeapon.value ? damageFormula(props.char, equippedWeapon.value) : null
)
```

- [ ] **Step 2: Update template in `HeaderStrip.vue`**

The current `hdr__top` section has armor on the right. Add a damage block between title and armor so the row reads: `[← Список]  [name/class]  [Урон]  [Броня]`:

```html
<div class="hdr__top">
  <button class="btn-ghost" @click="emit('back')">← Список</button>
  <div class="hdr__title">
    <div class="hdr__name">{{ char.name }}</div>
    <div class="label">{{ className }} · Уровень {{ char.level }}<span v-if="char.trueName"> · "{{ char.trueName }}"</span></div>
  </div>
  <div v-if="equippedWeapon" class="hdr__stat">
    <div class="label">Урон</div>
    <div class="hdr__stat-row">
      <div class="hdr__stat-val">{{ dmgFormula }}</div>
      <DamageBreakdownPopover :char="char" :weapon="equippedWeapon" />
    </div>
  </div>
  <div class="hdr__stat">
    <div class="label">Броня</div>
    <div class="hdr__stat-row">
      <div class="hdr__stat-val">{{ armor }}</div>
      <ArmorBreakdownPopover :char="char" />
    </div>
  </div>
</div>
```

- [ ] **Step 3: Update styles in `HeaderStrip.vue`**

Rename `.hdr__armor` → `.hdr__stat` and `.hdr__armor-row` → `.hdr__stat-row`, and make the font size a bit smaller to fit two stat blocks:

```css
.hdr__stat { text-align: right; }
.hdr__stat-row { display: flex; align-items: center; gap: 4px; }
.hdr__stat-val { font-size: 18px; font-weight: 700; }
```

Delete the old `.hdr__armor` and `.hdr__armor-row` and `.hdr__armor-val` rules.

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | grep -E "error|HeaderStrip"
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/in-game/components/HeaderStrip.vue
git commit -m "feat(header): show equipped weapon damage with breakdown popover"
```

---

### Task 5: Remove Combat tab and CombatPanel

**Files:**
- Modify: `src/features/in-game/InGameView.vue`
- Delete: `src/features/in-game/components/CombatPanel.vue`

- [ ] **Step 1: Remove `CombatPanel` from `InGameView.vue`**

Delete the import line:
```ts
// DELETE:
// import CombatPanel from './components/CombatPanel.vue'
```

Remove `'combat'` from the `Tab` type:
```ts
type Tab = 'main' | 'inventory' | 'magic' | 'notes'
```

Remove the `combat` entry from `tabs`:
```ts
const base: { id: Tab; label: string }[] = [
  { id: 'main', label: 'Основное' },
  { id: 'inventory', label: 'Инвентарь' },
]
```

Remove the `<CombatPanel>` element from the template:
```html
<!-- DELETE: -->
<!-- <CombatPanel v-else-if="activeTab === 'combat'" :char="char" @patch="patch" /> -->
```

- [ ] **Step 2: Delete `CombatPanel.vue`**

```bash
rm src/features/in-game/components/CombatPanel.vue
```

- [ ] **Step 3: Verify full build passes**

```bash
npm run build 2>&1
```

Expected: `✓ built in` — zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/in-game/InGameView.vue
git rm src/features/in-game/components/CombatPanel.vue
git commit -m "feat(in-game): remove Combat tab, armor shown via equipped inventory items"
```
