<script setup lang="ts">
import GamesTab from './GamesTab.vue'
import ScreenHeader from '@/components/layout/ScreenHeader.vue'
import StateNote from '@/components/ui/StateNote.vue'
import { onlineDataReady } from '@/transport/bootstrap'
import { t } from '@/locales'
import './cabinet.css'
</script>

<template>
  <ScreenHeader variant="eyebrow" :title="t('nav.games')" />
  <StateNote v-if="!onlineDataReady" role="status">{{ t('games.loading') }}</StateNote>
  <GamesTab v-else />
</template>
