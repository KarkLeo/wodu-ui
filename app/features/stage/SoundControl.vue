<script setup lang="ts">
import { computed } from 'vue'
import IconButton from '@/components/ui/IconButton.vue'
import Slider from '@/components/ui/Slider.vue'
import Switch from '@/components/ui/Switch.vue'
import IconVolume from '@/components/ui/icons/IconVolume.vue'
import IconVolumeOff from '@/components/ui/icons/IconVolumeOff.vue'
import { useSoundSwitch } from '@/composables/useStagePlayback'
import { useTable } from '@/composables/useTable'
import { useMediaPrefsStore } from '@/stores/mediaPrefs'
import { mode } from '@/transport/mode'
import { t } from '@/locales'

// This device's choices about the table's sound and picture. Only a game's table online has a scene to
// play; the offline table, the free table and the cabinet have none.
const prefs = useMediaPrefsStore()
const { gameId } = useTable()
const { turnSoundOn, turnSoundOff } = useSoundSwitch()

const shown = computed(() => mode.value === 'online' && gameId.value !== null)
const soundOn = computed(() => prefs.sound === 'on')

// Turning on is the browser's gesture: it is called straight from the click, before anything is awaited.
function toggleSound() {
  if (soundOn.value) turnSoundOff()
  else void turnSoundOn()
}
</script>

<template>
  <div v-if="shown" class="sound-control" role="group" :aria-label="t('stage.sound.group')">
    <div class="sc-row">
      <IconButton :label="t('stage.sound.mute')" size="md" :pressed="soundOn" @click="toggleSound">
        <IconVolume v-if="soundOn" :size="14" />
        <IconVolumeOff v-else :size="14" />
      </IconButton>
      <Slider v-model="prefs.volume" :ariaLabel="t('stage.sound.volume')" :disabled="!soundOn" />
    </div>
    <Switch v-model="prefs.background" :label="t('stage.sound.background')" />
  </div>
</template>

<style scoped>
.sound-control {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}
.sc-row {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}
.sc-row > :last-child { flex: 1 1 auto; min-width: 0; }
</style>
