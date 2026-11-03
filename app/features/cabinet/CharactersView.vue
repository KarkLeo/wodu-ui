<script setup lang="ts">
import CharactersTab from './CharactersTab.vue'
import StateNote from '@/components/ui/StateNote.vue'
import { onlineDataReady } from '@/transport/bootstrap'
import { t } from '@/locales'
import './cabinet.css'
</script>

<template>
  <h1 class="eyebrow hm-heading">{{ t('nav.characters') }}</h1>
  <StateNote v-if="!onlineDataReady" role="status">{{ t('games.loading') }}</StateNote>
  <CharactersTab v-else />
</template>
