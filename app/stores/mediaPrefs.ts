import { defineStore } from 'pinia'

export type SoundPref = 'unset' | 'on' | 'off'

// A per-device choice about what the table plays and shows: it is not cleared on sign-out or on a mode switch.
export const useMediaPrefsStore = defineStore('mediaPrefs', {
  state: () => ({
    sound: 'unset' as SoundPref,
    volume: 0.6,
    background: true,
  }),
  persist: {
    key: 'wod.media.v1',
  },
})
