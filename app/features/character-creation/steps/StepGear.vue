<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Character, InventoryItem } from '@/types/character'
import { useInventory } from '@/composables/useInventory'
import { useDiceRoller, isRolling } from '@/composables/useDiceRoller'
import { useCharacterCreation } from '@/composables/useCharacterCreation'
import { findGearTemplate } from '@/data/gear'
import { catalogItem } from '@/domain/inventory'
import { gearName, abilityName } from '@/locales/content'
import { hitDiceCount, sturdinessBonus } from '@/utils/derived'
import CoinBar from '@/features/in-game/components/inventory/CoinBar.vue'
import InvItem from '@/features/in-game/components/inventory/InvItem.vue'
import CatalogSheet from '@/features/in-game/components/inventory/CatalogSheet.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import WizardSection from '@/components/layout/WizardSection.vue'
import Button from '@/components/ui/Button.vue'
import IconReroll from '@/components/ui/icons/IconReroll.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import { t } from '@/locales'

const { draft, dispatch, setHitDiceResult } = useCharacterCreation()

const { roll } = useDiceRoller()
const inv = useInventory(dispatch)

const catalogOpen = ref(false)

const gmPendingId = ref<string | null>(null)
const gmPending = computed(() => gmPendingId.value ? findGearTemplate(gmPendingId.value) ?? null : null)
const gmOpen = computed({
  get: () => gmPendingId.value !== null,
  set: v => { if (!v) gmPendingId.value = null },
})

const numDice = computed(() => hitDiceCount(draft.value?.stats.con ?? 0))
const hasSturdy = computed(() => draft.value?.abilityIds.includes('sturdy') ?? false)
const hpRolled = computed(() => (draft.value?.maxHp ?? 0) > 0)

const hpFormulaLines = computed(() => {
  const hist = draft.value?.hpHistory ?? []
  const diceEntry = hist.find(h => h.level === 1 && h.source === 'dice')
  const sturdyEntry = hist.find(h => h.level === 1 && h.source === 'sturdy')
  if (!diceEntry) return null
  return { top: diceEntry.roll, sturdy: sturdyEntry?.roll }
})

async function rollHp() {
  const d = draft.value
  if (!d) return
  const result = await roll({
    notation: `${numDice.value}d6`,
    label: t('characterCreation.gear.rollLabel', { dice: numDice.value }),
    purpose: { kind: 'hp-init', level: 1, numDice: numDice.value, kept: 1 },
    characterId: d.id,
    // Pass undefined rather than a locale-baked fallback: DiceDrawer's authorFor()
    // resolves a missing name from the live character list, in the roller's own locale.
    characterName: d.name || undefined,
  })
  if (!result) return
  const rolls = result.dice.map(dv => dv.value)
  const top = Math.max(...rolls)
  const sturdyBonus = sturdinessBonus(d.abilityIds)
  const hp = top + sturdyBonus
  const hpHistory: NonNullable<Character['hpHistory']> = [
    { level: 1, roll: top, source: 'dice' },
    ...(sturdyBonus > 0 ? [{ level: 1, roll: 6, source: 'sturdy' as const }] : []),
  ]
  setHitDiceResult(numDice.value, hp, hp, hpHistory)
}

function removeItem(id: string) { inv.remove(id) }
function onBuy(templateId: string) { inv.buy(templateId) }
function onRequestGm(templateId: string) { gmPendingId.value = templateId }
function gmApprove() {
  const tpl = gmPending.value
  if (!tpl) return
  inv.receive(catalogItem(tpl))
  gmPendingId.value = null
}
function gmCancel() { gmPendingId.value = null }

function onToggleEquip(item: InventoryItem) {
  if (item.equipped) inv.unequip(item.id)
  else inv.equip(item.id)
}
function onUse(item: InventoryItem) {
  inv.use(item.id)
}
</script>

<template>
  <template v-if="draft">
  <WizardSection>
    <SectionHeader
      :title="t('characterCreation.gear.hpLabel')"
      :hint="t('characterCreation.gear.hpHint', { dice: numDice, sturdy: hasSturdy ? t('characterCreation.gear.hpSturdy') : '' })"
    >
      <template #action>
        <Button variant="roll" :icon-left="IconReroll" :disabled="isRolling" @click="rollHp">
          {{ hpRolled ? t('characterCreation.shell.reroll') : t('characterCreation.shell.rollAll') }}
        </Button>
      </template>
    </SectionHeader>
    <div class="cc-hp">
      <span class="cc-hp-value">{{ draft.maxHp || '—' }}</span>
      <div class="cc-hp-body">
        <SectionLabel>{{ t('characterCreation.gear.hpFormulaLabel') }}</SectionLabel>
        <span v-if="hpFormulaLines" class="cc-hp-formula">
          {{ numDice }}d6 → <em>{{ hpFormulaLines.top }}</em>
          <span v-if="hpFormulaLines.sturdy">
            + 6 <span class="cc-hp-formula-note">{{ abilityName('sturdy') }}</span>
          </span>
        </span>
        <span v-else class="cc-hp-formula">{{ t('characterCreation.gear.hpEmpty') }}</span>
      </div>
    </div>
  </WizardSection>

  <WizardSection>
    <SectionHeader :title="t('characterCreation.gear.gearLabel')" :hint="t('characterCreation.gear.gearHint')" />

    <CoinBar :coins="draft.coins" @update="inv.setCoins" />

    <div class="cc-gear-actions">
      <Button variant="primary" class="cc-gear-btn" @click="catalogOpen = true">
        {{ t('characterCreation.gear.openCatalog') }}
      </Button>
    </div>

    <div v-if="draft.inventory.length" class="cc-gear-list">
      <InvItem
        v-for="item in draft.inventory"
        :key="item.id"
        :item="item"
        @toggle-equip="onToggleEquip(item)"
        @use="onUse(item)"
        @remove="removeItem(item.id)"
      />
    </div>
    <EmptyState v-else :hint="t('characterCreation.gear.boughtEmpty')" />
  </WizardSection>

  <CatalogSheet
    v-model:open="catalogOpen"
    :coins="draft.coins"
    :inventory="draft.inventory"
    @buy="onBuy"
    @request-gm="onRequestGm"
  />

  <ConfirmSheet
    v-if="gmPending"
    v-model:open="gmOpen"
    variant="gold"
    :title="t('inGame.inventory.gm.title')"
  >
    <p>
      {{ t('inGame.inventory.gm.body', { name: gearName(gmPending.templateId), price: gmPending.price ?? 0, coins: draft.coins }) }}
    </p>
    <template #actions>
      <Button variant="hero" @click="gmApprove">{{ t('inGame.inventory.gm.approve') }}</Button>
      <Button variant="ghost" @click="gmCancel">{{ t('inGame.inventory.gm.discuss') }}</Button>
    </template>
  </ConfirmSheet>
  </template>
</template>

<style scoped>
.cc-hp {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  column-gap: var(--s-4);
  padding: 18px 20px;
  background: var(--vtt-elevated-a45);
  border-radius: var(--r-md);
}
.cc-hp-value {
  font-family: var(--font-serif);
  font-size: 44px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  line-height: 1;
}
.cc-hp-body { display: flex; flex-direction: column; gap: 4px; }
.cc-hp-formula {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13px;
  color: var(--vtt-text-muted);
}
.cc-hp-formula em { color: var(--vtt-text-secondary); font-style: normal; }
.cc-hp-formula-note { color: var(--vtt-accent-deep); }

.cc-gear-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.cc-gear-btn { flex: 1; min-width: 140px; justify-content: center; }

.cc-gear-list { display: flex; flex-direction: column; gap: 8px; }
</style>
