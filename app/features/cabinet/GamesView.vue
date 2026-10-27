<script setup lang="ts">
import GamesTab from './GamesTab.vue'
import { onlineDataReady } from '@/transport/bootstrap'
import { t } from '@/locales'
import './cabinet.css'
</script>

<template>
  <h1 class="eyebrow hm-heading">{{ t('nav.games') }}</h1>
  <div v-if="!onlineDataReady" class="hm-loading" role="status">{{ t('games.loading') }}</div>
  <GamesTab v-else />
</template>
