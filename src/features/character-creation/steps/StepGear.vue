<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Character } from '@/types/character'
import type { CharacterCommand } from '@/domain/commands'
import { GEAR_CATALOG, GEAR_CATEGORIES } from '@/data/gear'
import { hitDiceCount, rollHitDice, sturdinessBonus } from '@/utils/derived'

const props = defineProps<{ draft: Character; dispatch: (cmd: CharacterCommand) => void }>()
const emit = defineEmits<{ patch: [Partial<Character>]; finish: [] }>()

const hpRolled = computed(() => props.draft.maxHp > 0)

function rollHp() {
  const numDice = hitDiceCount(props.draft.stats.con)
  const { total } = rollHitDice(numDice, props.draft.level)
  const sturdyBonus = sturdinessBonus(props.draft.abilityIds)
  const hp = total + sturdyBonus
  const hpHistory: NonNullable<Character['hpHistory']> = [
    { level: 1, roll: total, source: 'dice' },
    ...(sturdyBonus > 0 ? [{ level: 1, roll: 6, source: 'sturdy' as const }] : []),
  ]
  emit('patch', { hitDice: numDice, maxHp: hp, currentHp: hp, hpHistory })
}


function addFromCatalog(templateId: string) {
  props.dispatch({ type: 'BUY_ITEM', templateId })
}

function removeItem(id: string) {
  props.dispatch({ type: 'REMOVE_ITEM', itemId: id })
}

const customName = ref('')
const customPrice = ref(0)
const customNotes = ref('')
const customConsumable = ref(false)
const customQuantity = ref(1)

function addCustom() {
  if (!customName.value.trim()) return
  if (customPrice.value > props.draft.coins) return
  props.dispatch({
    type: 'ADD_CUSTOM_ITEM',
    name: customName.value.trim(),
    price: customPrice.value || undefined,
    notes: customNotes.value.trim() || undefined,
    consumable: customConsumable.value || undefined,
    quantity: customConsumable.value ? customQuantity.value : undefined,
  })
  customName.value = ''
  customPrice.value = 0
  customNotes.value = ''
  customConsumable.value = false
  customQuantity.value = 1
}

function openCategory(id: string) {
  openCat.value = openCat.value === id ? null : id
}
const openCat = ref<string | null>('weapon')

const itemsByCategory = computed(() => {
  const out: Record<string, typeof GEAR_CATALOG> = {}
  for (const cat of GEAR_CATEGORIES) out[cat.id] = []
  for (const item of GEAR_CATALOG) {
    const cat = item.category ?? 'gear'
    out[cat].push(item)
  }
  return out
})

const canFinish = computed(() => hpRolled.value)
</script>

<template>
  <div class="step">
    <section class="block">
      <div class="block-header">
        <span class="label">Очки здоровья</span>
        <span class="hint">1 + ТЕЛ = {{ hitDiceCount(draft.stats.con) }} к6, оставляется {{ draft.level }}</span>
      </div>
      <div class="hp-row">
        <span class="hp-value">{{ draft.maxHp || '—' }}</span>
        <button class="btn-primary" @click="rollHp">{{ hpRolled ? 'Перебросить' : 'Бросить ОЗ' }}</button>
      </div>
    </section>

    <section class="block">
      <div class="block-header">
        <span class="label">Снаряжение</span>
        <span class="coins">💰 {{ draft.coins }}с</span>
      </div>

      <div v-for="cat in GEAR_CATEGORIES" :key="cat.id" class="cat">
        <button class="cat__head" @click="openCategory(cat.id)">
          <span>{{ cat.name }}</span>
          <span>{{ openCat === cat.id ? '▾' : '▸' }}</span>
        </button>
        <div v-if="openCat === cat.id" class="cat__body">
          <button
            v-for="item in itemsByCategory[cat.id]"
            :key="item.templateId"
            class="gear-item"
            :disabled="(item.price ?? 0) > draft.coins"
            @click="addFromCatalog(item.templateId)"
          >
            <div class="gear-item__name">{{ item.name }}</div>
            <div class="gear-item__meta">
              <span>{{ item.price }}с</span>
              <span v-if="item.damage">· урон {{ item.damage }}</span>
            </div>
            <div v-if="item.notes" class="gear-item__notes">{{ item.notes }}</div>
          </button>
        </div>
      </div>

      <div class="custom">
        <div class="label">Свой предмет</div>
        <div class="custom__row">
          <input class="input" placeholder="Название" v-model="customName" />
          <input class="input input--price" type="number" min="0" placeholder="Цена" v-model.number="customPrice" />
          <button class="btn-ghost" :disabled="!customName.trim() || customPrice > draft.coins" @click="addCustom">+</button>
        </div>
        <input class="input custom__notes" placeholder="Описание" v-model="customNotes" />
        <div class="custom__check">
          <label class="check-label">
            <input type="checkbox" v-model="customConsumable" />
            Расходник
          </label>
          <input v-if="customConsumable" class="input input--qty" type="number" min="1" placeholder="Кол-во" v-model.number="customQuantity" />
        </div>
      </div>

      <div v-if="draft.inventory.length" class="inventory">
        <div class="label">Куплено</div>
        <div v-for="item in draft.inventory" :key="item.id" class="inv-row">
          <span class="inv-row__name">{{ item.name }}</span>
          <span class="inv-row__price">{{ item.price ?? 0 }}с</span>
          <button class="btn-mini" @click="removeItem(item.id)">×</button>
        </div>
      </div>
    </section>

    <div class="step-footer">
      <button class="btn-primary" :disabled="!canFinish" @click="emit('finish')">Завершить</button>
    </div>
  </div>
</template>

<style scoped>
.step { padding: 16px; display: flex; flex-direction: column; gap: 20px; }
.block { display: flex; flex-direction: column; gap: 8px; }
.block-header { display: flex; justify-content: space-between; align-items: center; }
.hint { font-size: 12px; color: var(--color-text-muted); }
.hp-row { display: flex; justify-content: space-between; align-items: center; padding: 10px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 4px; }
.hp-value { font-size: 24px; font-weight: 700; }
.coins { font-weight: 600; }
.cat { border: 1px solid var(--color-border); border-radius: 4px; overflow: hidden; }
.cat__head { width: 100%; display: flex; justify-content: space-between; padding: 10px 12px; background: var(--color-bg-elevated); border: none; color: var(--color-text); cursor: pointer; font-family: inherit; font-size: 14px; }
.cat__body { display: flex; flex-direction: column; }
.gear-item { text-align: left; padding: 10px 12px; background: var(--color-bg-dark); border: none; border-top: 1px solid var(--color-border); color: var(--color-text); cursor: pointer; font-family: inherit; }
.gear-item:disabled { opacity: 0.3; cursor: not-allowed; }
.gear-item__name { font-weight: 600; margin-bottom: 2px; }
.gear-item__meta { font-size: 12px; color: var(--color-text-muted); }
.gear-item__notes { font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }
.custom { margin-top: 8px; }
.custom__row { display: grid; grid-template-columns: 1fr 90px auto; gap: 6px; }
.custom__notes { width: 100%; margin-top: 6px; }
.custom__check { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.check-label { display: flex; align-items: center; gap: 5px; font-size: 13px; cursor: pointer; user-select: none; }
.input--qty { width: 70px; }
.input { padding: 8px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); color: var(--color-text); font-family: inherit; border-radius: 4px; }
.input--price { width: 90px; }
.inventory { margin-top: 12px; border: 1px solid var(--color-border); border-radius: 4px; }
.inv-row { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 8px; padding: 8px 12px; border-top: 1px solid var(--color-border); }
.inv-row:first-child { border-top: none; }
.btn-mini { background: none; border: none; cursor: pointer; color: var(--color-text-muted); font-size: 16px; }
.step-footer { display: flex; justify-content: flex-end; padding-top: 8px; }
</style>
