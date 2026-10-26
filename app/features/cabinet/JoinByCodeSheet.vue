<script setup lang="ts">
import { ref, watch } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import Button from '@/components/ui/Button.vue'
import AuthField from '@/features/sign-in/AuthField.vue'
import { normalizeInviteCode } from '@/utils/inviteCode'
import { t } from '@/locales'
import './cabinet.css'

const open = defineModel<boolean>('open', { required: true })
/** The normalised code; joining itself happens on the invite route. */
const emit = defineEmits<{ submit: [code: string] }>()

const input = ref('')
const invalid = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  input.value = ''
  invalid.value = false
})
watch(input, () => {
  invalid.value = false
})

function submit() {
  const code = normalizeInviteCode(input.value)
  if (!code) {
    invalid.value = true
    return
  }
  open.value = false
  emit('submit', code)
}
</script>

<template>
  <BottomSheet v-model:open="open" :title="t('games.joinByCode.title')" :max-width="420">
    <form class="hm-form" novalidate @submit.prevent="submit">
      <AuthField
        id="join-code"
        v-model="input"
        :label="t('games.joinByCode.label')"
        :placeholder="t('games.joinByCode.placeholder')"
        :hint="t('games.joinByCode.hint')"
        autocomplete="off"
      />
      <p v-if="invalid" class="hm-error" role="alert">{{ t('games.joinByCode.invalid') }}</p>
      <Button type="submit" variant="hero" class="hm-submit" :disabled="!input.trim()">
        {{ t('games.joinByCode.submit') }}
      </Button>
    </form>
  </BottomSheet>
</template>
