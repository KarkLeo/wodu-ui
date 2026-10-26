<script setup lang="ts">
import BottomSheet from '@/components/ui/BottomSheet.vue'
import InvitePanel from './InvitePanel.vue'
import type { Game } from '@/types/game'
import { t } from '@/locales'

defineProps<{ game: Game }>()
const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <BottomSheet v-model:open="open" :title="t('games.invite.title')" :max-width="420">
    <InvitePanel :game="game" />
  </BottomSheet>
</template>
