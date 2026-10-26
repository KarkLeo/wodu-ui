<script setup lang="ts">
import BottomSheet from '@/components/ui/BottomSheet.vue'
import MembersList from './MembersList.vue'
import type { Game } from '@/types/game'
import { t } from '@/locales'

defineProps<{ game: Game }>()
const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <BottomSheet v-model:open="open" :title="t('games.members.title')" :max-width="420">
    <MembersList :game="game" />
  </BottomSheet>
</template>
