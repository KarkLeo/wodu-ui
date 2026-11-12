<script setup lang="ts">
import { computed } from 'vue'
import AlertBanner from '@/components/ui/AlertBanner.vue'
import Button from '@/components/ui/Button.vue'
import { useSoundSwitch, useStageTarget } from '@/composables/useStagePlayback'
import { useMediaPrefsStore } from '@/stores/mediaPrefs'
import { t } from '@/locales'

// Asks once, while the stage has a sound and this device has not chosen, or chose sound but the browser
// is holding it back until a tap. Not modal: the table stays usable under it.
const prefs = useMediaPrefsStore()
const { wantsSound } = useStageTarget()
const { blocked, turnSoundOn, turnSoundOff } = useSoundSwitch()

const asking = computed(() => wantsSound.value && prefs.sound === 'unset')
const paused = computed(() => wantsSound.value && prefs.sound === 'on' && blocked.value)

// The tap is the browser's gesture, so turning on is called straight from the click.
function turnOn() {
  void turnSoundOn()
}
</script>

<template>
  <div class="sound-prompt" role="status" aria-live="polite">
    <div v-if="asking || paused" class="sp-card">
      <AlertBanner tone="accent" stacked :announce="false">
        {{ asking ? t('stage.sound.promptUnset') : t('stage.sound.promptBlocked') }}
        <template #action>
          <div class="sp-actions">
            <Button variant="primary" size="sm" @click="turnOn">{{ t('stage.sound.turnOn') }}</Button>
            <Button v-if="asking" variant="ghost" size="sm" @click="turnSoundOff">{{ t('stage.sound.noSound') }}</Button>
          </div>
        </template>
      </AlertBanner>
    </div>
  </div>
</template>

<style scoped>
/* Bottom centre of the page between the side panels (GameLayout's insets; none on a phone, where the
   top-bar buttons are far above), so the panels, the dice bar and the top bars stay uncovered. */
.sound-prompt {
  position: fixed;
  left: max(var(--gl-inset-left, 0px), var(--s-4));
  right: max(var(--gl-inset-right, 0px), var(--s-4));
  bottom: calc(var(--s-4) + env(safe-area-inset-bottom, 0px));
  max-width: 440px;
  margin-inline: auto;
  z-index: 1;
  pointer-events: none;
}
.sound-prompt > * { pointer-events: auto; }
/* The banner's own tint is nearly clear; over a bright picture its text needs a solid ground. */
.sp-card {
  background: var(--vtt-bg-surface);
  border-radius: var(--r-sm);
}
.sp-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}
</style>
