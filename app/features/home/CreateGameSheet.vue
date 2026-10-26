<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import Button from '@/components/ui/Button.vue'
import AuthField from '@/features/sign-in/AuthField.vue'
import { createGame } from '@/transport/games'
import type { Game } from '@/types/game'
import { t } from '@/locales'
import { createLogger } from '@/utils/logger'
import './home.css'

const NAME_MAX = 80

const log = createLogger('home:create-game')

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ created: [game: Game] }>()

const name = ref('')
const busy = ref(false)
const failed = ref(false)

const trimmed = computed(() => name.value.trim())
const tooLong = computed(() => trimmed.value.length > NAME_MAX)
const error = computed(() => {
  if (tooLong.value) return t('games.create.tooLong', { max: NAME_MAX })
  return failed.value ? t('games.create.failed') : null
})

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = ''
  failed.value = false
})
watch(name, () => {
  failed.value = false
})

async function submit() {
  if (busy.value || !trimmed.value || tooLong.value) return
  busy.value = true
  failed.value = false
  try {
    const game = await createGame(trimmed.value)
    open.value = false
    emit('created', game)
  } catch (err) {
    log.warn('createGame failed', { err })
    failed.value = true
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BottomSheet v-model:open="open" :title="t('games.create.title')" :max-width="420">
    <form class="hm-form" novalidate @submit.prevent="submit">
      <AuthField
        id="create-game-name"
        v-model="name"
        :label="t('games.create.label')"
        :placeholder="t('games.create.placeholder')"
        :hint="t('games.create.hint')"
        autocomplete="off"
      />
      <p v-if="error" class="hm-error" role="alert">{{ error }}</p>
      <Button type="submit" variant="hero" class="hm-submit" :disabled="busy || !trimmed || tooLong">
        {{ t('games.create.submit') }}
      </Button>
    </form>
  </BottomSheet>
</template>
