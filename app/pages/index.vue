<script setup lang="ts">
import { definePageMeta } from '#imports'
import LandingView from '@/features/landing/LandingView.vue'

// `bare`: app.vue renders it without the table layout and without the sign-in gate.
definePageMeta({ name: 'landing', shell: 'bare' })
</script>

<template>
  <LandingView />
</template>
