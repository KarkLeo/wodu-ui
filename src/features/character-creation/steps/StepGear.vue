<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Character, InventoryItem } from '@/types/character'
import type { CharacterCommand } from '@/domain/commands'
import { useInventory } from '@/composables/useInventory'
import { useDiceRoller, isRolling } from '@/composables/useDiceRoller'
import { findGearTemplate } from '@/data/gear'
import { hitDiceCount, sturdinessBonus } from '@/utils/derived'
import CoinBar from '@/features/in-game/components/inventory/CoinBar.vue'
import InvItem from '@/features/in-game/components/inventory/InvItem.vue'
import CatalogSheet from '@/features/in-game/components/inventory/CatalogSheet.vue'
import CustomItemSheet, { type CustomPayload } from '@/features/in-game/components/inventory/CustomItemSheet.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import Button from '@/components/ui/Button.vue'
import { t } from '@/locales'

const props = defineProps<{ draft: Character; dispatch: (cmd: CharacterCommand) => void }>()
const emit = defineEmits<{ patch: [Partial<Character>] }>()

const { roll } = useDiceRoller()
const inv = useInventory(props.dispatch)

const catalogOpen = ref(false)
const customOpen = ref(false)
const editingItem = ref<InventoryItem | null>(null)

const gmPendingId = ref<string | null>(null)
const gmPending = computed(() => gmPendingId.value ? findGearTemplate(gmPendingId.value) ?? null : null)
const gmOpen = computed({
  get: () => gmPendingId.value !== null,
  set: v => { if (!v) gmPendingId.value = null },
})

const numDice = computed(() => hitDiceCount(props.draft.stats.con))
const hasSturdy = computed(() => props.draft.abilityIds.includes('sturdy'))
const hpRolled = computed(() => props.draft.maxHp > 0)

const hpFormulaLines = computed(() => {
  const hist = props.draft.hpHistory ?? []
  const diceEntry = hist.find(h => h.level === 1 && h.source === 'dice')
  const sturdyEntry = hist.find(h => h.level === 1 && h.source === 'sturdy')
  if (!diceEntry) return null
  return { top: diceEntry.roll, sturdy: sturdyEntry?.roll }
})

async function rollHp() {
  const result = await roll({
    notation: `${numDice.value}d6`,
    label: `Очки здоровья (${numDice.value}d6, оставить 1)`,
    purpose: { kind: 'hp-init', level: 1, numDice: numDice.value, kept: 1 },
    characterId: props.draft.id,
    characterName: props.draft.name || 'Новый персонаж',
  })
  if (!result) return
  const rolls = result.dice.map(d => d.value)
  const top = Math.max(...rolls)
  const sturdyBonus = sturdinessBonus(props.draft.abilityIds)
  const hp = top + sturdyBonus
  const hpHistory: NonNullable<Character['hpHistory']> = [
    { level: 1, roll: top, source: 'dice' },
    ...(sturdyBonus > 0 ? [{ level: 1, roll: 6, source: 'sturdy' as const }] : []),
  ]
  emit('patch', { hitDice: numDice.value, maxHp: hp, currentHp: hp, hpHistory })
}

function removeItem(id: string) { inv.remove(id) }
function onBuy(templateId: string) { inv.buy(templateId) }
function onRequestGm(templateId: string) { gmPendingId.value = templateId }
function gmApprove() {
  const tpl = gmPending.value
  if (!tpl) return
  inv.receive({
    templateId: tpl.templateId,
    name: tpl.name,
    descriptor: tpl.descriptor,
    damage: tpl.damage,
    price: tpl.price,
    notes: tpl.notes,
  })
  gmPendingId.value = null
}
function gmCancel() { gmPendingId.value = null }

function onSaveCustom(payload: CustomPayload) {
  if (editingItem.value) {
    inv.editCustom(editingItem.value.id, {
      name: payload.name,
      price: payload.price,
      notes: payload.notes,
      consumable: payload.consumable,
      quantity: payload.quantity,
    })
  } else {
    inv.addCustom(payload.name, payload.price, payload.notes, payload.consumable || undefined, payload.quantity)
  }
  editingItem.value = null
}
function onRemoveCustom(itemId: string) {
  inv.remove(itemId)
  editingItem.value = null
}
function openAddCustom() {
  editingItem.value = null
  customOpen.value = true
}
function onEditCustom(item: InventoryItem) {
  editingItem.value = item
  customOpen.value = true
}
function onToggleEquip(item: InventoryItem) {
  if (item.equipped) inv.unequip(item.id)
  else inv.equip(item.id)
}
function onUse(item: InventoryItem) {
  inv.use(item.id)
}
</script>

<template>
  <section class="cc-section">
    <div class="cc-section-head">
      <span class="cc-section-label">{{ t('characterCreation.gear.hpLabel') }}</span>
      <span class="cc-section-hint">
        {{ t('characterCreation.gear.hpHint', { dice: numDice, sturdy: hasSturdy ? t('characterCreation.gear.hpSturdy') : '' }) }}
      </span>
      <span class="cc-section-action">
        <button type="button" class="cc-btn-roll" :disabled="isRolling" @click="rollHp">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M3 6 C3 4 4.5 3 6 3 M9 6 C9 8 7.5 9 6 9 M9 6 L10.5 4.5 M9 6 L7.5 4.5"/></svg>
          {{ hpRolled ? t('characterCreation.shell.reroll') : t('characterCreation.shell.rollAll') }}
        </button>
      </span>
    </div>
    <div class="cc-hp">
      <span class="cc-hp-value">{{ draft.maxHp || '—' }}</span>
      <div class="cc-hp-body">
        <span class="cc-hp-label">{{ t('characterCreation.gear.hpFormulaLabel') }}</span>
        <span v-if="hpFormulaLines" class="cc-hp-formula">
          {{ numDice }}d6 → <em>{{ hpFormulaLines.top }}</em>
          <span v-if="hpFormulaLines.sturdy">
            + 6 <span class="cc-hp-formula-note">Стойкость</span>
          </span>
        </span>
        <span v-else class="cc-hp-formula">{{ t('characterCreation.gear.hpEmpty') }}</span>
      </div>
    </div>
  </section>

  <section class="cc-section">
    <div class="cc-section-head">
      <span class="cc-section-label">{{ t('characterCreation.gear.gearLabel') }}</span>
      <span class="cc-section-hint">{{ t('characterCreation.gear.gearHint') }}</span>
    </div>

    <CoinBar :coins="draft.coins" @update="inv.setCoins" />

    <div class="cc-gear-actions">
      <button type="button" class="cc-gear-btn" @click="catalogOpen = true">
        {{ t('characterCreation.gear.openCatalog') }}
      </button>
      <button type="button" class="cc-gear-btn" @click="openAddCustom">
        + {{ t('characterCreation.gear.addCustom') }}
      </button>
    </div>

    <div v-if="draft.inventory.length" class="cc-gear-list">
      <InvItem
        v-for="item in draft.inventory"
        :key="item.id"
        :item="item"
        @toggle-equip="onToggleEquip(item)"
        @use="onUse(item)"
        @edit="onEditCustom(item)"
        @remove="removeItem(item.id)"
      />
    </div>
    <div v-else class="cc-gear-empty">{{ t('characterCreation.gear.boughtEmpty') }}</div>
  </section>

  <CatalogSheet
    v-model:open="catalogOpen"
    :coins="draft.coins"
    @buy="onBuy"
    @request-gm="onRequestGm"
  />

  <CustomItemSheet
    v-model:open="customOpen"
    :editing="editingItem"
    @save="onSaveCustom"
    @remove="onRemoveCustom"
  />

  <ConfirmSheet
    v-if="gmPending"
    v-model:open="gmOpen"
    variant="gold"
    :title="t('inGame.inventory.gm.title')"
  >
    <p>
      {{ t('inGame.inventory.gm.body', { name: gmPending.name, price: gmPending.price ?? 0, coins: draft.coins }) }}
    </p>
    <template #actions>
      <Button variant="hero" @click="gmApprove">{{ t('inGame.inventory.gm.approve') }}</Button>
      <Button variant="ghost" @click="gmCancel">{{ t('inGame.inventory.gm.discuss') }}</Button>
    </template>
  </ConfirmSheet>
</template>

<style scoped>
.cc-section { display: flex; flex-direction: column; gap: var(--s-3); }
.cc-section-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.cc-section-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
}
.cc-section-hint {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  color: var(--vtt-text-muted);
}
.cc-section-action { margin-left: auto; }

.cc-btn-roll {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 12px;
  background: rgba(36, 28, 21, 0.55);
  border: 1px solid rgba(140, 106, 58, 0.35);
  border-radius: var(--r-sm);
  color: var(--vtt-accent);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--t-fast) var(--ease);
}
.cc-btn-roll:hover:not(:disabled) {
  background: rgba(140, 106, 58, 0.2);
  border-color: var(--vtt-border-gold);
}
.cc-btn-roll:disabled { opacity: 0.5; cursor: not-allowed; }
.cc-btn-roll svg { width: 12px; height: 12px; }

.cc-hp {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  column-gap: var(--s-4);
  padding: 18px 20px;
  background: rgba(36, 28, 21, 0.45);
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
.cc-hp-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
}
.cc-hp-formula {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13px;
  color: var(--vtt-text-muted);
}
.cc-hp-formula em { color: var(--vtt-text-secondary); font-style: normal; }
.cc-hp-formula-note { color: var(--vtt-accent-deep); }

.cc-summary {
  display: grid;
  grid-template-columns: 22px 1fr auto;
  align-items: center;
  column-gap: 14px;
  padding: 12px 14px;
  background: rgba(140, 106, 58, 0.08);
  border: 1px solid rgba(140, 106, 58, 0.3);
  border-radius: var(--r-sm);
}
.cc-check {
  width: 22px;
  height: 22px;
  border-radius: var(--r-pill);
  background: transparent;
  border: 1px solid rgba(140, 106, 58, 0.35);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: transparent;
}
.cc-check svg { width: 12px; height: 12px; }
.cc-check.cc-check-locked {
  background: rgba(140, 106, 58, 0.45);
  border-color: rgba(140, 106, 58, 0.55);
  color: var(--vtt-accent-soft);
}
.cc-summary-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.cc-summary-name {
  font-family: var(--font-serif);
  font-size: 16px;
  color: var(--vtt-text-primary);
  line-height: 1.2;
}
.cc-summary-desc {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  color: var(--vtt-text-muted);
  line-height: 1.35;
}
.cc-summary-flag {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
}

.cc-gear-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.cc-gear-btn {
  flex: 1;
  min-width: 140px;
  padding: 10px 16px;
  background: var(--vtt-bg-elevated);
  border: 1px solid var(--vtt-border-strong);
  border-radius: var(--r-pill);
  color: var(--vtt-accent-soft);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--t-fast) var(--ease);
}
.cc-gear-btn:hover {
  background: #2e241a;
  border-color: var(--vtt-border-gold);
  color: var(--vtt-accent);
}

.cc-gear-list { display: flex; flex-direction: column; gap: 8px; }
.cc-gear-empty {
  padding: 18px 14px;
  text-align: center;
  color: var(--vtt-text-muted);
  font-size: 12px;
  font-style: italic;
  border: 1px dashed var(--vtt-border-subtle);
  border-radius: var(--r-sm);
}
</style>
