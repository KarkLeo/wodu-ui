<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import LocaleSwitch from '@/components/ui/LocaleSwitch.vue'
import IconChevronLeft from '@/components/ui/icons/IconChevronLeft.vue'
import { useAccount } from '@/composables/useAccount'
import { useTable } from '@/composables/useTable'
import { mode } from '@/transport/mode'
import { buildDate } from '@/utils/build'
import { panelHomeLocation } from '@/utils/scope'
import { t, currentLocale } from '@/locales'

// The bottom of the players panel: the way out of the table, the build, and offline (which has no
// profile) the language.
const router = useRouter()
const route = useRoute()
const { setLanguage } = useAccount()
const { tableScope } = useTable()

const offline = computed(() => mode.value === 'offline')

const buildLine = computed(() => t('gameLayout.players.buildLine', { version: __APP_VERSION__, built: buildDate(currentLocale.value) }))

function goHome() {
  void router.push(panelHomeLocation(tableScope.value, offline.value, String(route.name)))
}
</script>

<template>
  <Button variant="ghost" size="sm" class="pf-home" :icon-left="IconChevronLeft" @click="goHome">
    {{ t('nav.home') }}
  </Button>
  <div class="build-id">{{ buildLine }}</div>
  <LocaleSwitch
    v-if="offline"
    class="pr-locale"
    :model-value="currentLocale"
    :aria-label="t('gameLayout.players.language')"
    @update:model-value="setLanguage"
  />
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

.pr-locale { margin-top: 6px; }
</style>
