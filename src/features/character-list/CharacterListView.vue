<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import { useCreationStore } from '@/stores/creation'
import { t } from '@/locales'
import IconDice from '@/components/ui/icons/IconDice.vue'

const router = useRouter()
const characters = useCharactersStore()
const creation = useCreationStore()

const activeChars = computed(() => characters.list.filter(c => c.status === 'active'))
const draftChars = computed(() => characters.list.filter(c => c.status === 'draft'))

function resumeCreation(id: string) {
  creation.setDraft(id)
  router.push('/character/new')
}
</script>

<template>
  <div class="content-wrap cl-screen">
    <section v-if="draftChars.length > 0" class="cl-drafts">
      <div class="cl-drafts__label">{{ t('characterList.drafts') }}</div>
      <button
        v-for="char in draftChars"
        :key="char.id"
        type="button"
        class="cl-card cl-card--draft"
        @click="resumeCreation(char.id)"
      >
        <div class="cl-card__main">
          <div class="cl-card__name">{{ char.name || t('characterList.draftUnnamed') }}</div>
          <div class="cl-card__meta cl-card__meta--resume">{{ t('characterList.resume') }} →</div>
        </div>
      </button>
    </section>

    <div v-if="activeChars.length === 0 && draftChars.length === 0" class="cl-empty">
      <div class="cl-empty__icon">
        <IconDice />
      </div>
      <div class="cl-empty__title">{{ t('characterList.empty.title') }}</div>
      <div class="cl-empty__hint">{{ t('characterList.empty.hint') }}</div>
    </div>

    <div v-else-if="activeChars.length > 0" class="cl-hint">
      {{ t('characterList.pickFromSidebar') }}
    </div>
  </div>
</template>

<style scoped>
.cl-screen {
  max-width: 640px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.cl-drafts { display: flex; flex-direction: column; gap: 10px; }
.cl-drafts__label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
  padding-left: 4px;
}

.cl-card {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  width: 100%;
  padding: 14px 16px;
  text-align: left;
  background: var(--vtt-bg-surface);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-md);
  color: inherit;
  font-family: inherit;
  cursor: pointer;
  box-shadow: var(--shadow-1);
  transition:
    border-color var(--t-fast) var(--ease),
    background var(--t-fast) var(--ease),
    box-shadow var(--t-fast) var(--ease);
}
.cl-card:hover {
  border-color: var(--vtt-border-strong);
  background: var(--vtt-bg-elevated);
}
.cl-card__main { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.cl-card__name {
  font-family: var(--font-serif);
  font-weight: 500;
  font-size: 19px;
  color: var(--vtt-text-primary);
  line-height: 1.15;
}
.cl-card__meta {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}
.cl-card__meta--resume { color: var(--vtt-accent-soft); }

.cl-card--draft {
  opacity: 0.7;
  border-style: dashed;
  background: transparent;
}
.cl-card--draft:hover { opacity: 1; background: var(--vtt-bg-surface); }

.cl-empty {
  margin: 32px auto;
  padding: 40px 20px;
  text-align: center;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.cl-empty__icon {
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-pill);
  color: var(--vtt-accent-deep);
}
.cl-empty__icon :deep(svg) { width: 22px; height: 22px; }
.cl-empty__title {
  font-family: var(--font-serif);
  font-size: 20px;
  color: var(--vtt-accent-soft);
}
.cl-empty__hint {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}

.cl-hint {
  margin: 48px auto;
  padding: 24px;
  text-align: center;
  max-width: 320px;
  color: var(--vtt-text-muted);
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 14px;
  line-height: 1.55;
}
</style>
