<script setup lang="ts">
import { ref } from 'vue'
import IconEye from '@/components/ui/icons/IconEye.vue'
import IconEyeOff from '@/components/ui/icons/IconEyeOff.vue'
import { t } from '@/locales'

defineProps<{ name: string }>()

// Never stored: the name is hidden again whenever the header mounts anew.
const revealed = ref(false)
</script>

<template>
  <button
    type="button"
    class="true-name"
    :aria-pressed="revealed"
    @click="revealed = !revealed"
  >
    <component :is="revealed ? IconEye : IconEyeOff" :size="10" class="true-name-glyph" />
    <span class="true-name-label">{{ t('inGame.trueName.label') }}</span>
    <span v-if="revealed" class="true-name-value">{{ name }}</span>
    <span v-else class="true-name-mask" aria-hidden="true">✦ ✦ ✦ ✦ ✦</span>
  </button>
</template>

<style scoped>
.true-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-width: 0;
  /* One fixed height whether masked or shown, so the header never moves; the hover pad spills into the gaps. */
  height: 16px;
  margin: -1px 0 -1px -4px;
  padding: 0 4px;
  background: transparent;
  border: 0;
  border-radius: var(--r-sm);
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  line-height: 1.1;
  color: var(--vtt-text-muted);
  text-align: left;
  cursor: pointer;
  transition: background var(--t-fast) var(--ease);
}
.true-name:hover { background: var(--vtt-gold-a10); }
.true-name:focus-visible { outline: 2px solid var(--vtt-accent); outline-offset: 1px; }
.true-name-glyph { flex-shrink: 0; color: var(--vtt-accent-deep); }
/* Read out with the button, so a screen reader hears what it toggles. */
.true-name-label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.true-name-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.true-name-mask {
  font-style: normal;
  line-height: 1;
  font-size: 10px;
  letter-spacing: 0.25em;
  color: var(--vtt-accent-deep);
}
</style>
