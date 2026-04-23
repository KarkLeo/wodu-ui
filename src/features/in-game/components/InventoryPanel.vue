<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Character, InventoryItem } from '@/types/character'
import type { CharacterCommand } from '@/domain/commands'
import { useInventory } from '@/composables/useInventory'
import { useDiceRoller, isRolling } from '@/composables/useDiceRoller'
import { GEAR_CATEGORIES, findGearTemplate, getItemsByCategory } from '@/data/gear'
import { isConsumable } from '@/domain/inventory'
import { isQuicksilverOverdose } from '@/utils/derived'
import { createLogger } from '@/utils/logger'

const log = createLogger('inventory')

type Dispatcher = (cmd: CharacterCommand) => void

const props = defineProps<{ char: Character; dispatch: Dispatcher }>()

const inv = useInventory(props.dispatch)
const { rollStat } = useDiceRoller()

const showCatalog = ref(false)
const openCat = ref<string | null>('weapon')
const customName = ref('')
const customPrice = ref(0)
const customNotes = ref('')
const customConsumable = ref(false)
const customQuantity = ref(1)
const pendingTemplateId = ref<string | null>(null)

const editingItemId = ref<string | null>(null)
const editDraft = ref({ name: '', price: 0, notes: '', consumable: false, quantity: 1 })

const pendingTemplate = computed(() =>
  pendingTemplateId.value ? findGearTemplate(pendingTemplateId.value) ?? null : null
)

function setCoins(value: number) {
  inv.setCoins(Math.max(0, value))
}

function addFromCatalog(templateId: string) {
  const tpl = findGearTemplate(templateId)
  if (!tpl) return
  const price = tpl.price ?? 0
  if (price > props.char.coins) {
    pendingTemplateId.value = templateId
    return
  }
  commitPurchase(tpl, true)
}

function commitPurchase(tpl: NonNullable<ReturnType<typeof findGearTemplate>>, deductCoins: boolean) {
  if (deductCoins) {
    inv.buy(tpl.templateId)
  } else {
    inv.receive({
      templateId: tpl.templateId,
      name: tpl.name,
      descriptor: tpl.descriptor,
      damage: tpl.damage,
      price: tpl.price,
      notes: tpl.notes,
    })
  }
  pendingTemplateId.value = null
}

function cancelPending() {
  pendingTemplateId.value = null
}

function gmApproved() {
  if (!pendingTemplate.value) return
  commitPurchase(pendingTemplate.value, false)
}

function removeItem(id: string) {
  inv.remove(id)
}

function toggleEquipped(id: string) {
  const item = props.char.inventory.find(i => i.id === id)
  if (!item) return
  if (item.equipped) inv.unequip(id)
  else inv.equip(id)
}

const sortedInventory = computed(() => {
  const equipped = props.char.inventory.filter(i => i.equipped)
  const rest = props.char.inventory.filter(i => !i.equipped)
  return [...equipped, ...rest]
})

const multipleWeaponsEquipped = computed(() =>
  props.char.inventory.filter(i => i.equipped && i.descriptor.kind === 'weapon').length > 1
)

function addCustom() {
  if (!customName.value.trim()) return
  inv.addCustom(
    customName.value.trim(),
    customPrice.value || undefined,
    customNotes.value.trim() || undefined,
    customConsumable.value || undefined,
    customConsumable.value ? customQuantity.value : undefined,
  )
  customName.value = ''
  customPrice.value = 0
  customNotes.value = ''
  customConsumable.value = false
  customQuantity.value = 1
}

function startEdit(item: InventoryItem) {
  editingItemId.value = item.id
  editDraft.value = {
    name: item.name,
    price: item.price ?? 0,
    notes: item.notes ?? '',
    consumable: item.descriptor.kind === 'custom' ? (item.descriptor.consumable ?? false) : false,
    quantity: item.quantity ?? 1,
  }
}

function saveEdit() {
  if (!editingItemId.value || !editDraft.value.name.trim()) return
  inv.editCustom(editingItemId.value, {
    name: editDraft.value.name.trim(),
    price: editDraft.value.price || undefined,
    notes: editDraft.value.notes.trim() || undefined,
    consumable: editDraft.value.consumable || undefined,
    quantity: editDraft.value.consumable ? editDraft.value.quantity : undefined,
  })
  editingItemId.value = null
}

function cancelEdit() {
  editingItemId.value = null
}

const overdosePendingItemId = ref<string | null>(null)

function useItemSafe(item: InventoryItem) {
  const tpl = item.templateId ? findGearTemplate(item.templateId) : undefined
  if (tpl?.useEffect === 'quicksilver' && isQuicksilverOverdose(props.char)) {
    overdosePendingItemId.value = item.id
    return
  }
  inv.use(item.id)
}
function overdoseCancel() { overdosePendingItemId.value = null }
function overdoseReset() {
  props.dispatch({ type: 'RESET_QUICKSILVER' })
  overdosePendingItemId.value = null
}
async function overdoseRoll() {
  const itemId = overdosePendingItemId.value
  if (!itemId) return
  try {
    await rollStat(props.char.id, props.char.name, 'con', 'ТЕЛ (сопротивление ртути)', props.char.stats.con)
  } catch (err) {
    log.error('overdose roll failed', err)
  }
  inv.use(itemId)
  overdosePendingItemId.value = null
}

const itemsByCategory = getItemsByCategory()
</script>

<template>
  <section class="panel">
    <div class="coins-row">
      <span class="label">Монеты</span>
      <input
        type="number"
        class="coins-input"
        :value="char.coins"
        min="0"
        @change="setCoins(Number(($event.target as HTMLInputElement).value))"
      />
    </div>

    <div class="list">
      <div class="label">Инвентарь</div>
      <div v-if="multipleWeaponsEquipped" class="warn">⚠ Экипировано несколько видов оружия</div>
      <template v-for="item in sortedInventory" :key="item.id">
        <div v-if="editingItemId === item.id" class="inv-row inv-row--editing">
          <div class="edit-form">
            <div class="edit-form__row">
              <input class="input" placeholder="Название" v-model="editDraft.name" />
              <input class="input input--price" type="number" min="0" placeholder="Цена" v-model.number="editDraft.price" />
            </div>
            <input class="input" placeholder="Описание" v-model="editDraft.notes" />
            <div class="edit-form__check">
              <label class="check-label">
                <input type="checkbox" v-model="editDraft.consumable" />
                Расходник
              </label>
              <input v-if="editDraft.consumable" class="input input--qty" type="number" min="1" placeholder="Кол-во" v-model.number="editDraft.quantity" />
            </div>
            <div class="edit-form__actions">
              <button class="btn-ghost" @click="cancelEdit">Отмена</button>
              <button class="btn-primary" :disabled="!editDraft.name.trim()" @click="saveEdit">Сохранить</button>
            </div>
          </div>
        </div>
        <div v-else class="inv-row" :class="{ 'inv-row--equipped': item.equipped }">
          <button
            v-if="!isConsumable(item)"
            class="equip-btn"
            :class="{ 'equip-btn--on': item.equipped }"
            type="button"
            :title="item.equipped ? 'Снять' : 'Экипировать'"
            @click="toggleEquipped(item.id)"
          >⚔</button>
          <div v-else class="equip-btn-placeholder" />
          <div class="inv-row__info">
            <div class="inv-row__name">{{ item.name }}</div>
            <div v-if="item.notes" class="inv-row__notes">{{ item.notes }}</div>
          </div>
          <div class="inv-row__right">
            <span v-if="isConsumable(item) && (item.quantity ?? 1) > 1" class="tag">×{{ item.quantity }}</span>
            <span v-if="item.damage" class="tag">{{ item.damage }}</span>
            <span v-if="item.price" class="tag">{{ item.price }}с</span>
            <button v-if="isConsumable(item)" class="btn-use" type="button" @click="useItemSafe(item)">Исп.</button>
            <button v-if="item.descriptor.kind === 'custom'" class="btn-mini" type="button" @click="startEdit(item)">✎</button>
            <button class="btn-mini" @click="removeItem(item.id)">×</button>
          </div>
        </div>
      </template>
      <div v-if="!char.inventory.length" class="empty">Пусто.</div>
    </div>

    <div class="custom">
      <div class="label">Добавить свой</div>
      <div class="custom__row">
        <input class="input" placeholder="Название" v-model="customName" />
        <input class="input input--price" type="number" min="0" placeholder="Цена" v-model.number="customPrice" />
        <button class="btn-ghost" :disabled="!customName.trim()" @click="addCustom">+</button>
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

    <div v-if="pendingTemplate" class="gm-dialog">
      <div class="gm-dialog__text">
        Не хватает монет на <b>{{ pendingTemplate.name }}</b> ({{ pendingTemplate.price }}с, у вас {{ char.coins }}с). Обговорите с ГМ.
      </div>
      <div class="gm-dialog__actions">
        <button class="btn-ghost" @click="cancelPending">Обсудить с ГМ</button>
        <button class="btn-primary" @click="gmApproved">ГМ одобрил</button>
      </div>
    </div>

    <div v-if="overdosePendingItemId" class="gm-dialog overdose-dialog">
      <div class="gm-dialog__text">
        Превышена дневная доза ртути — выпито {{ char.quicksilverCount ?? 0 }} / {{ char.level }}.
      </div>
      <div class="gm-dialog__actions">
        <button class="btn-ghost" @click="overdoseCancel">Отмена</button>
        <button class="btn-ghost" @click="overdoseReset">Сбросить счётчик</button>
        <button class="btn-primary" :disabled="isRolling" @click="overdoseRoll">Бросить кубы ТЕЛ</button>
      </div>
    </div>

    <button class="btn-ghost catalog-toggle" @click="showCatalog = !showCatalog">
      {{ showCatalog ? 'Скрыть каталог' : 'Купить из каталога' }}
    </button>

    <div v-if="showCatalog" class="catalog">
      <div v-for="cat in GEAR_CATEGORIES" :key="cat.id" class="cat">
        <button class="cat__head" @click="openCat = openCat === cat.id ? null : cat.id">
          <span>{{ cat.name }}</span>
          <span>{{ openCat === cat.id ? '▾' : '▸' }}</span>
        </button>
        <div v-if="openCat === cat.id">
          <button
            v-for="item in itemsByCategory[cat.id]"
            :key="item.templateId"
            class="gear-item"
            @click="addFromCatalog(item.templateId)"
          >
            <div class="gear-item__name">{{ item.name }}</div>
            <div class="gear-item__meta">
              <span>{{ item.price }}с</span>
              <span v-if="item.damage">· {{ item.damage }}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel { padding: 12px 16px; display: flex; flex-direction: column; gap: 14px; }
.coins-row { display: flex; justify-content: space-between; align-items: center; }
.coins-input { width: 100px; text-align: right; padding: 6px 10px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); color: var(--color-text); border-radius: 3px; font-family: inherit; }
.list { display: flex; flex-direction: column; gap: 4px; }
.warn { font-size: 12px; color: var(--color-accent); padding: 6px 8px; background: var(--color-bg-elevated); border: 1px solid var(--color-accent); border-radius: 3px; }
.inv-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 3px; }
.inv-row--equipped { border-color: var(--color-accent); }
.inv-row__info { flex: 1; min-width: 0; }
.inv-row__name { font-weight: 600; }
.inv-row__notes { font-size: 11px; color: var(--color-text-muted); }
.inv-row__right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.equip-btn { background: none; border: none; cursor: pointer; color: var(--color-text-muted); font-size: 14px; padding: 0 2px; flex-shrink: 0; }
.equip-btn--on { color: var(--color-accent); }
.equip-btn-placeholder { width: 20px; flex-shrink: 0; }
.btn-use { background: none; border: 1px solid var(--color-border); border-radius: 3px; color: var(--color-text-muted); cursor: pointer; font-size: 11px; padding: 2px 5px; font-family: inherit; flex-shrink: 0; }
.tag { font-size: 11px; color: var(--color-text-muted); }
.btn-mini { background: none; border: none; color: var(--color-text-muted); cursor: pointer; font-size: 16px; }
.custom__row { display: grid; grid-template-columns: 1fr 90px auto; gap: 6px; }
.custom__notes { width: 100%; margin-top: 6px; }
.custom__check { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.check-label { display: flex; align-items: center; gap: 5px; font-size: 13px; cursor: pointer; user-select: none; }
.input--qty { width: 70px; }
.inv-row--editing { padding: 0; background: none; border: 1px solid var(--color-accent); }
.edit-form { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; width: 100%; }
.edit-form__row { display: grid; grid-template-columns: 1fr 90px; gap: 6px; }
.edit-form__check { display: flex; align-items: center; gap: 8px; }
.edit-form__actions { display: flex; gap: 6px; justify-content: flex-end; }
.input { padding: 8px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); color: var(--color-text); border-radius: 3px; font-family: inherit; }
.catalog { display: flex; flex-direction: column; gap: 6px; }
.cat { border: 1px solid var(--color-border); border-radius: 4px; overflow: hidden; }
.cat__head { width: 100%; display: flex; justify-content: space-between; padding: 8px 12px; background: var(--color-bg-elevated); border: none; color: var(--color-text); cursor: pointer; font-family: inherit; }
.gear-item { text-align: left; padding: 8px 12px; background: var(--color-bg-dark); border: none; border-top: 1px solid var(--color-border); color: var(--color-text); cursor: pointer; font-family: inherit; width: 100%; }
.gear-item__name { font-weight: 600; }
.gear-item__meta { font-size: 11px; color: var(--color-text-muted); }
.empty { color: var(--color-text-muted); font-size: 13px; }
.catalog-toggle { align-self: flex-start; }
.gm-dialog { background: var(--color-bg-elevated); border: 1px solid var(--color-accent); border-radius: 4px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
.gm-dialog__text { font-size: 13px; }
.gm-dialog__actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
.overdose-dialog { border-color: var(--color-danger, #e05252); }
</style>
