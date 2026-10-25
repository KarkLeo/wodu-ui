import { defineNuxtPlugin, useRuntimeConfig } from '#app'
import { pb } from '@/transport/pb'
import { bootstrap } from '@/transport/bootstrap'

// Awaited so that the first navigation, its middleware and the first render see a loaded store.
export default defineNuxtPlugin(async () => {
  pb.baseURL = useRuntimeConfig().public.pbUrl
  await bootstrap()
})
