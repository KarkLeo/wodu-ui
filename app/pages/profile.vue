<script setup lang="ts">
import { definePageMeta } from '#imports'
import ProfileView from '@/features/profile/ProfileView.vue'

definePageMeta({ name: 'profile', shell: 'cabinet' })
</script>

<template>
  <ProfileView />
</template>
