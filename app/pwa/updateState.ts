import { ref } from 'vue'

// Set once a new service worker has taken over: the page still runs the old build until it reloads.
export const updateReady = ref(false)
