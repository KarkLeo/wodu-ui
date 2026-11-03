<script setup lang="ts">
import GamesTab from './GamesTab.vue'
import StateNote from '@/components/ui/StateNote.vue'
import { onlineDataReady } from '@/transport/bootstrap'
import { t } from '@/locales'
import './cabinet.css'
</script>

<template>
  <h1 class="eyebrow hm-heading">{{ t('nav.games') }}</h1>
  <StateNote v-if="!onlineDataReady" role="status">{{ t('games.loading') }}</StateNote>
  <GamesTab v-else />
</template>
