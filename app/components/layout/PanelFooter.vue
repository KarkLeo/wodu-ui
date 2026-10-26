<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import IconChevronLeft from '@/components/ui/icons/IconChevronLeft.vue'
import { useAccount } from '@/composables/useAccount'
import { useTable } from '@/composables/useTable'
import { mode } from '@/transport/mode'
import { buildDate } from '@/utils/build'
import { panelHomeLocation } from '@/utils/scope'
import { t, currentLocale, LOCALES } from '@/locales'

// The bottom of the players panel: the way out of the table, the build, and offline (which has no
// profile) the language.
const router = useRouter()
const { setLanguage } = useAccount()
const { tableScope } = useTable()

const offline = computed(() => mode.value === 'offline')

const buildLine = computed(() => t('gameLayout.players.buildLine', { version: __APP_VERSION__, built: buildDate(currentLocale.value) }))

function goHome() {
  void router.push(panelHomeLocation(tableScope.value, offline.value))
}
</script>

<template>
  <Button variant="ghost" size="sm" class="pf-home" :icon-left="IconChevronLeft" @click="goHome">
    {{ t('nav.home') }}
  </Button>
  <div class="build-id">{{ buildLine }}</div>
  <div v-if="offline" class="pr-locale" role="group" :aria-label="t('gameLayout.players.language')">
    <button
      v-for="l in LOCALES"
      :key="l"
      type="button"
      class="pr-locale-btn"
      :class="{ 'is-active': currentLocale === l }"
      :aria-pressed="currentLocale === l"
      @click="setLanguage(l)"
    >{{ l.toUpperCase() }}</button>
  </div>
</template>

<style scoped>
.pf-home { width: 100%; justify-content: center; }

.build-id {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--vtt-text-muted);
  opacity: 0.7;
  text-align: center;
}

.pr-locale { display: flex; gap: 2px; margin-top: 6px; }
.pr-locale-btn {
  padding: 2px 6px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--vtt-text-muted);
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.pr-locale-btn.is-active {
  color: var(--vtt-text-primary);
  background: var(--vtt-bg-elevated);
}
</style>
