<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Ritual } from '@/types/character'
import IconEdit from '@/components/ui/icons/IconEdit.vue'
import IconTrash from '@/components/ui/icons/IconTrash.vue'
import Button from '@/components/ui/Button.vue'
import { t } from '@/locales'

const props = defineProps<{ ritual: Ritual }>()
const emit = defineEmits<{
  (e: 'update', patch: Partial<Ritual>): void
  (e: 'remove'): void
}>()

const editing = ref(false)
const expanded = ref(false)
const draft = ref({ name: props.ritual.name, description: props.ritual.description })

watch(() => props.ritual, (r) => {
  if (!editing.value) draft.value = { name: r.name, description: r.description }
}, { deep: true })

const isEmpty = computed(() => !props.ritual.name && !props.ritual.description)

function openEdit() {
  draft.value = { ...props.ritual }
  editing.value = true
}
function cancel() {
  draft.value = { ...props.ritual }
  editing.value = false
}
function save() {
  emit('update', { ...draft.value })
  editing.value = false
}
function onBodyTap() {
  if (editing.value) return
  if (isEmpty.value) {
    openEdit()
    return
  }
  expanded.value = !expanded.value
}
</script>

<template>
  <div :class="['ritual-card', { 'is-empty': isEmpty && !editing, 'is-editing': editing, 'is-expanded': expanded }]">
    <div class="ritual-head">
      <div class="ritual-name">
        <template v-if="editing">{{ t('inGame.magic.rituals.edit') }}</template>
        <template v-else-if="isEmpty">{{ t('inGame.magic.rituals.empty') }}</template>
        <template v-else>{{ ritual.name || t('inGame.magic.rituals.empty') }}</template>
      </div>
      <div class="ritual-actions">
        <button
          v-if="!editing && !isEmpty"
          class="btn-icon-sm"
          :title="t('inGame.magic.rituals.edit')"
          :aria-label="t('inGame.magic.rituals.edit')"
          @click.stop="openEdit"
        >
          <IconEdit />
        </button>
        <button
          class="btn-icon-sm is-danger"
          :title="t('inGame.magic.rituals.remove')"
          :aria-label="t('inGame.magic.rituals.remove')"
          @click.stop="emit('remove')"
        >
          <IconTrash />
        </button>
      </div>
    </div>

    <p
      v-if="!editing"
      class="ritual-desc"
      :class="{ 'is-placeholder': isEmpty }"
      @click="onBodyTap"
    >
      {{ isEmpty ? t('inGame.magic.rituals.emptyHint') : ritual.description }}
    </p>

    <form v-else class="ritual-edit-form" @submit.prevent="save">
      <div class="form-row">
        <label class="form-label">{{ t('inGame.magic.rituals.name') }}</label>
        <input
          v-model="draft.name"
          class="form-input"
          :placeholder="t('inGame.magic.rituals.namePlaceholder')"
        />
      </div>
      <div class="form-row">
        <label class="form-label">{{ t('inGame.magic.rituals.description') }}</label>
        <textarea
          v-model="draft.description"
          class="form-textarea"
          rows="4"
          :placeholder="t('inGame.magic.rituals.descriptionPlaceholder')"
        />
      </div>
      <div class="ritual-edit-foot">
        <Button type="button" variant="ghost" @click="cancel">{{ t('common.cancel') }}</Button>
        <Button type="submit" variant="primary">{{ t('common.save') }}</Button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.ritual-card {
  position: relative;
  background: var(--vtt-bg-surface);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  padding: 12px 16px;
  transition: border-color var(--t-fast) var(--ease);
}
.ritual-card:hover { border-color: var(--vtt-border-strong); }

.ritual-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 4px;
}
.ritual-name {
  font-family: var(--font-serif);
  font-size: 16px;
  color: var(--vtt-accent-soft);
  line-height: 1.2;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ritual-actions { display: flex; gap: 4px; flex-shrink: 0; }

.ritual-desc {
  color: var(--vtt-text-secondary);
  font-size: 13px;
  line-height: 1.55;
  font-family: var(--font-serif);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
  cursor: pointer;
}
.ritual-card.is-expanded .ritual-desc {
  -webkit-line-clamp: initial;
  display: block;
}
.ritual-desc.is-placeholder {
  color: var(--vtt-text-muted);
  font-style: italic;
}

.ritual-card.is-empty {
  border-style: dashed;
  background: transparent;
}
.ritual-card.is-empty .ritual-name {
  color: var(--vtt-text-muted);
  font-style: italic;
}
.ritual-card.is-editing {
  border-color: var(--vtt-border-gold);
  background: var(--vtt-bg-elevated);
}
.ritual-card.is-editing .ritual-name { color: var(--vtt-accent); }

.ritual-edit-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}
.form-row { display: flex; flex-direction: column; gap: 4px; }
.form-label {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}
.form-input,
.form-textarea {
  width: 100%;
  padding: 8px 11px;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  color: var(--vtt-text-primary);
  font-family: var(--font-sans);
  font-size: 13px;
  box-sizing: border-box;
}
.form-textarea {
  font-family: var(--font-serif);
  font-style: italic;
  min-height: 96px;
  resize: none;
}
.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--vtt-border-gold);
  box-shadow: 0 0 0 2px rgba(140, 106, 58, 0.15);
}
.form-input::placeholder,
.form-textarea::placeholder {
  color: var(--vtt-text-muted);
  font-style: italic;
}

.ritual-edit-foot {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 4px;
}

.btn-icon-sm {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-xs);
  color: var(--vtt-text-muted);
  cursor: pointer;
  transition: background var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease), color var(--t-fast) var(--ease);
  padding: 0;
  flex-shrink: 0;
}
.btn-icon-sm :deep(svg) { width: 14px; height: 14px; }
.btn-icon-sm:hover {
  border-color: var(--vtt-border-strong);
  color: var(--vtt-accent-soft);
}
.btn-icon-sm.is-danger:hover {
  border-color: var(--vtt-danger-bright);
  color: var(--vtt-danger-bright);
  background: rgba(178, 59, 79, 0.08);
}
</style>
