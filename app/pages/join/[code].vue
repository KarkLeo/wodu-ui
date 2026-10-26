<script setup lang="ts">
import { computed } from 'vue'
import { definePageMeta, useRoute } from '#imports'
import JoinView from '@/features/join/JoinView.vue'

definePageMeta({ name: 'join' })

const route = useRoute()
const code = computed(() => String(route.params.code ?? ''))
</script>

<template>
  <JoinView :code="code" />
</template>
