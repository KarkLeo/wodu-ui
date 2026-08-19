<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogClose } from 'reka-ui'
import IconClose from '@/components/ui/icons/IconClose.vue'
import IconTrash from '@/components/ui/icons/IconTrash.vue'
import FormCheckbox from '@/components/ui/FormCheckbox.vue'
import Button from '@/components/ui/Button.vue'
import type { InventoryItem } from '@/types/character'
import { t } from '@/locales'

export type CustomPayload = {
  name: string
  price?: number
  notes?: string
  consumable: boolean
  quantity?: number
}

const props = defineProps<{ editing: InventoryItem | null }>()
const emit = defineEmits<{
  (e: 'save', payload: CustomPayload): void
  (e: 'remove', itemId: string): void
}>()
const open = defineModel<boolean>('open', { required: true })

const name = ref('')
const price = ref<number | null>(null)
const notes = ref('')
const consumable = ref(false)
const quantity = ref(1)

const isEditing = computed(() => props.editing !== null)

function reset() {
  if (props.editing) {
    const e = props.editing
    name.value = e.name
    price.value = e.price ?? null
    notes.value = e.notes ?? ''
    const c = e.descriptor.kind === 'custom' ? (e.descriptor.consumable ?? false) : false
    consumable.value = c
    quantity.value = e.quantity ?? 1
  } else {
    name.value = ''
    price.value = null
    notes.value = ''
    consumable.value = false
    quantity.value = 1
  }
}

watch(open, v => { if (v) reset() })
watch(() => props.editing, () => { if (open.value) reset() })

const canSave = computed(() => name.value.trim().length > 0)

function save() {
  if (!canSave.value) return
  emit('save', {
    name: name.value.trim(),
    price: price.value === null || price.value === 0 ? undefined : price.value,
    notes: notes.value.trim() || undefined,
    consumable: consumable.value,
    quantity: consumable.value ? Math.max(1, quantity.value || 1) : undefined,
  })
  open.value = false
}

function removeItem() {
  if (!props.editing) return
  emit('remove', props.editing.id)
  open.value = false
}

function close() { open.value = false }
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="bs-overlay" />
      <DialogContent class="bs-content-wrap">
        <div class="bottom-sheet custom-sheet">
          <div class="bs-head">
            <span class="bs-title">
              {{ isEditing ? t('inGame.inventory.customForm.titleEdit') : t('inGame.inventory.customForm.titleAdd') }}
            </span>
            <DialogClose class="bs-close" :aria-label="t('common.close')">
              <IconClose />
            </DialogClose>
          </div>
          <div class="bs-body">
            <div class="form-row">
              <label class="form-label">{{ t('inGame.inventory.customForm.name') }}</label>
              <input
                class="form-input"
                type="text"
                :placeholder="t('inGame.inventory.customForm.namePlaceholder')"
                v-model="name"
              />
            </div>
            <div class="form-row">
              <label class="form-label">{{ t('inGame.inventory.customForm.notes') }}</label>
              <textarea
                class="form-textarea"
                :placeholder="t('inGame.inventory.customForm.notesPlaceholder')"
                v-model="notes"
              />
            </div>
            <div class="form-row form-row-inline" :class="{ 'no-qty': !consumable }">
              <div>
                <label class="form-label">{{ t('inGame.inventory.customForm.price') }}</label>
                <input
                  class="form-input"
                  type="number"
                  min="0"
                  placeholder="0"
                  :value="price ?? ''"
                  @input="price = ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value)"
                />
              </div>
              <div v-if="consumable">
                <label class="form-label">{{ t('inGame.inventory.customForm.qty') }}</label>
                <input
                  class="form-input qty"
                  type="number"
                  min="1"
                  v-model.number="quantity"
                />
              </div>
            </div>
            <div class="form-row">
              <FormCheckbox v-model="consumable">
                {{ t('inGame.inventory.customForm.consumable') }}
              </FormCheckbox>
            </div>
          </div>
          <div class="bs-foot">
            <Button
              v-if="isEditing"
              variant="danger-ghost"
              :icon-left="IconTrash"
              @click="removeItem"
            >{{ t('inGame.inventory.remove') }}</Button>
            <div class="spacer" />
            <Button variant="ghost" @click="close">{{ t('common.cancel') }}</Button>
            <Button variant="hero" :disabled="!canSave" @click="save">
              {{ isEditing ? t('common.save') : t('inGame.inventory.customForm.add') }}
            </Button>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.custom-sheet {
  width: 100%;
  max-width: 440px;
}
.bs-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
}
.bs-title {
  font-family: var(--font-serif);
  font-size: 17px;
  color: var(--vtt-accent-soft);
}
.bs-close {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-pill);
  color: var(--vtt-text-secondary);
  cursor: pointer;
  padding: 0;
}
.bs-close:hover {
  border-color: var(--vtt-border-strong);
  color: var(--vtt-accent-soft);
}
.bs-close :deep(svg) { width: 12px; height: 12px; }

.bs-body {
  padding: 14px 18px 6px;
  overflow-y: auto;
  max-height: 60vh;
}
.bs-foot {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 12px 18px;
}
.spacer { flex: 1; }

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}
.form-row-inline {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: end;
}
.form-row-inline.no-qty {
  grid-template-columns: 1fr;
}
.form-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}
.form-input,
.form-textarea {
  width: 100%;
  padding: 9px 12px;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  color: var(--vtt-text-primary);
  font-family: var(--font-sans);
  font-size: 13px;
  outline: none;
}
.form-input:focus,
.form-textarea:focus {
  border-color: var(--vtt-border-gold);
  box-shadow: 0 0 0 2px rgba(140, 106, 58, 0.15);
}
.form-textarea {
  font-family: var(--font-serif);
  min-height: 72px;
  resize: none;
}
.form-input.qty { width: 80px; }

.form-input[type='number']::-webkit-outer-spin-button,
.form-input[type='number']::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.form-input[type='number'] {
  -moz-appearance: textfield;
  appearance: textfield;
}
</style>
