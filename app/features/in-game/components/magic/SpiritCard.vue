<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Spirit } from '@/types/character'
import { SPHERE_PRESET_IDS } from '@/data/spheres'
import { spherePresetName } from '@/locales/content'
import SphereChip from './SphereChip.vue'
import IconEdit from '@/components/ui/icons/IconEdit.vue'
import IconTrash from '@/components/ui/icons/IconTrash.vue'
import Button from '@/components/ui/Button.vue'
import { t } from '@/locales'

const props = defineProps<{ spirit: Spirit }>()
const emit = defineEmits<{
  (e: 'update', patch: Partial<Spirit>): void
  (e: 'remove'): void
}>()

const editing = ref(false)

const draft = ref({
  name: props.spirit.name,
  appearance: props.spirit.appearance,
  sphere1: props.spirit.sphere1,
  sphere2: props.spirit.sphere2,
})

watch(() => props.spirit, (s) => {
  if (!editing.value) {
    draft.value = { name: s.name, appearance: s.appearance, sphere1: s.sphere1, sphere2: s.sphere2 }
  }
}, { deep: true })

const isEmpty = computed(() =>
  !props.spirit.name && !props.spirit.appearance && !props.spirit.sphere1 && !props.spirit.sphere2
)

const sigil = computed(() => {
  const name = props.spirit.name.trim()
  return name ? name[0].toUpperCase() : '?'
})

function openEdit() {
  draft.value = { ...props.spirit }
  editing.value = true
}

function cancel() {
  draft.value = { ...props.spirit }
  editing.value = false
}

function save() {
  emit('update', { ...draft.value })
  editing.value = false
}

</script>

<template>
  <div
    :class="['spirit-card', { 'is-empty': isEmpty && !editing, 'is-editing': editing, 'is-clickable': isEmpty && !editing }]"
    @click="isEmpty && !editing && openEdit()"
  >
    <div class="spirit-head">
      <div class="spirit-sigil">{{ editing ? (draft.name[0]?.toUpperCase() || '?') : sigil }}</div>
      <div class="spirit-name">
        <template v-if="editing">{{ t('inGame.magic.spirits.edit') }}</template>
        <template v-else-if="isEmpty">{{ t('inGame.magic.spirits.empty') }}</template>
        <template v-else>{{ spirit.name || t('inGame.magic.spirits.empty') }}</template>
      </div>
      <div class="spirit-actions">
        <button
          v-if="!editing && !isEmpty"
          class="btn-icon-sm"
          :title="t('inGame.magic.spirits.edit')"
          :aria-label="t('inGame.magic.spirits.edit')"
          @click.stop="openEdit"
        >
          <IconEdit />
        </button>
        <button
          class="btn-icon-sm is-danger"
          :title="t('inGame.magic.spirits.remove')"
          :aria-label="t('inGame.magic.spirits.remove')"
          @click.stop="emit('remove')"
        >
          <IconTrash />
        </button>
      </div>
    </div>

    <template v-if="!editing">
      <p class="spirit-appearance">
        {{ isEmpty ? t('inGame.magic.spirits.emptyHint') : spirit.appearance }}
      </p>
      <div class="spirit-spheres">
        <SphereChip :value="spirit.sphere1" :placeholder="t('inGame.magic.spirits.sphere1')" />
        <SphereChip :value="spirit.sphere2" :placeholder="t('inGame.magic.spirits.sphere2')" />
      </div>
    </template>

    <form v-else class="spirit-edit-form" @click.stop @submit.prevent="save">
      <div class="form-row">
        <label class="form-label">{{ t('inGame.magic.spirits.name') }}</label>
        <input
          v-model="draft.name"
          class="form-input"
          :placeholder="t('inGame.magic.spirits.namePlaceholder')"
        />
      </div>
      <div class="form-row">
        <label class="form-label">{{ t('inGame.magic.spirits.appearance') }}</label>
        <textarea
          v-model="draft.appearance"
          class="form-textarea"
          :placeholder="t('inGame.magic.spirits.appearancePlaceholder')"
        />
      </div>
      <div class="form-row-pair">
        <div class="form-row">
          <label class="form-label">
            {{ t('inGame.magic.spirits.sphere1') }}
            <span class="form-label-note">{{ t('inGame.magic.spirits.sphereCustomNote') }}</span>
          </label>
          <input
            v-model="draft.sphere1"
            class="form-input"
            list="sphere-presets"
            :placeholder="t('inGame.magic.spirits.sphereEmpty')"
          />
        </div>
        <div class="form-row">
          <label class="form-label">
            {{ t('inGame.magic.spirits.sphere2') }}
            <span class="form-label-note">{{ t('inGame.magic.spirits.sphereCustomNote') }}</span>
          </label>
          <input
            v-model="draft.sphere2"
            class="form-input"
            list="sphere-presets"
            :placeholder="t('inGame.magic.spirits.sphereEmpty')"
          />
        </div>
      </div>
      <datalist id="sphere-presets">
        <option v-for="id in SPHERE_PRESET_IDS" :key="id" :value="spherePresetName(id)" />
      </datalist>
      <div class="spirit-edit-foot">
        <Button type="button" variant="ghost" @click="cancel">{{ t('common.cancel') }}</Button>
        <Button type="submit" variant="primary">{{ t('common.save') }}</Button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.spirit-card {
  position: relative;
  background: var(--vtt-bg-surface);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  padding: 14px 16px;
  transition: border-color var(--t-fast) var(--ease);
}
.spirit-card:hover { border-color: var(--vtt-border-strong); }

.spirit-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.spirit-sigil {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--vtt-border-gold);
  border-radius: var(--r-pill);
  color: var(--vtt-accent);
  background: radial-gradient(circle at center, rgba(140, 106, 58, 0.15), transparent 70%);
  font-family: var(--font-serif);
  font-size: 15px;
  font-style: italic;
}
.spirit-name {
  font-family: var(--font-serif);
  font-size: 17px;
  color: var(--vtt-accent-soft);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.spirit-actions { display: flex; gap: 4px; flex-shrink: 0; }

.spirit-appearance {
  color: var(--vtt-text-secondary);
  font-size: 13px;
  line-height: 1.5;
  margin: 0 0 10px 44px;
  font-family: var(--font-serif);
  font-style: italic;
}
.spirit-spheres {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-left: 44px;
}

.spirit-card.is-empty {
  border-style: dashed;
  background: transparent;
}
.spirit-card.is-empty:hover { border-color: var(--vtt-border-gold); }
.spirit-card.is-clickable { cursor: pointer; }
.spirit-card.is-empty .spirit-sigil {
  border-style: dashed;
  color: var(--vtt-text-muted);
  background: transparent;
}
.spirit-card.is-empty .spirit-name {
  color: var(--vtt-text-muted);
  font-style: italic;
}
.spirit-card.is-empty .spirit-appearance {
  color: var(--vtt-text-muted);
  opacity: 0.7;
}

.spirit-card.is-editing {
  border-color: var(--vtt-border-gold);
  background: var(--vtt-bg-elevated);
}
.spirit-card.is-editing .spirit-name { color: var(--vtt-accent); }

.spirit-edit-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}
.form-row { display: flex; flex-direction: column; gap: 4px; }
.form-row-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

.form-label {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}
.form-label-note {
  margin-left: 6px;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 10px;
  letter-spacing: 0;
  text-transform: none;
  color: var(--vtt-text-muted);
  opacity: 0.8;
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
  min-height: 68px;
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

.spirit-edit-foot {
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
