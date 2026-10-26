<script setup lang="ts">
import CharactersTab from './CharactersTab.vue'
import { onlineDataReady } from '@/transport/bootstrap'
import { t } from '@/locales'
import './cabinet.css'
</script>

<template>
  <h1 class="eyebrow hm-heading">{{ t('nav.characters') }}</h1>
  <div v-if="!onlineDataReady" class="hm-loading" role="status">{{ t('games.loading') }}</div>
  <CharactersTab v-else />
</template>
