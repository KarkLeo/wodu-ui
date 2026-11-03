<script setup lang="ts">
import { ref, watch } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import Button from '@/components/ui/Button.vue'
import FormError from '@/components/ui/FormError.vue'
import TextField from '@/components/ui/TextField.vue'
import { useAccount } from '@/composables/useAccount'
import { NAME_MAX } from '@/transport/authHelpers'
import { t } from '@/locales'
import { accountErrorText } from './accountError'

const props = defineProps<{ name: string }>()
const open = defineModel<boolean>('open', { required: true })

const { rename } = useAccount()

const draft = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

watch(open, (isOpen) => {
  if (!isOpen) return
  draft.value = props.name
  error.value = null
}, { immediate: true })

async function save() {
  const name = draft.value.trim()
  if (!name) return
  busy.value = true
  error.value = null
  try {
    await rename(name)
    open.value = false
  } catch (err) {
    error.value = accountErrorText(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BottomSheet v-model:open="open" :title="t('profile.changeName')" :max-width="420">
    <form class="rs-form" @submit.prevent="save">
      <TextField
        v-model="draft"
        variant="underline"
        :label="t('auth.name.label')"
        :hint="t('auth.name.hint')"
        :maxlength="NAME_MAX"
        autocomplete="nickname"
        :spellcheck="false"
      />
      <FormError v-if="error" role="alert">{{ error }}</FormError>
      <Button type="submit" variant="hero" class="rs-save" :disabled="busy || !draft.trim()">
        {{ t('common.save') }}
      </Button>
    </form>
  </BottomSheet>
</template>

<style scoped>
.rs-form { display: flex; flex-direction: column; gap: var(--s-4); }
.rs-save { align-self: flex-end; }
</style>
