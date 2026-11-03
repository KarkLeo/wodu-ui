<script setup lang="ts">
import { ref } from 'vue'
import AuthScreen from '../AuthScreen.vue'
import TextField from '@/components/ui/TextField.vue'
import Button from '@/components/ui/Button.vue'
import FormError from '@/components/ui/FormError.vue'
import { NAME_MAX } from '@/transport/authHelpers'
import { t } from '@/locales'

const props = defineProps<{
  suggested: string
  busy: boolean
  error: string | null
}>()

const emit = defineEmits<{ save: [name: string] }>()

const name = ref(props.suggested)

function done() {
  emit('save', name.value.trim() || props.suggested)
}
</script>

<template>
  <AuthScreen :title="t('auth.name.heading')" :subtitle="t('auth.name.sub')" :card-title="t('auth.name.title')">
    <form class="ns-form" @submit.prevent="done">
      <TextField
        v-model="name"
        variant="underline"
        :label="t('auth.name.label')"
        :optional="t('auth.name.optional')"
        :hint="t('auth.name.hint')"
        :maxlength="NAME_MAX"
        autocomplete="nickname"
        :spellcheck="false"
      />
      <FormError v-if="error" role="alert">{{ error }}</FormError>
      <div class="ns-actions">
        <Button variant="ghost" size="lg" class="auth-wide" :disabled="busy" @click="emit('save', suggested)">
          {{ t('auth.name.later') }}
        </Button>
        <Button type="submit" variant="hero" size="lg" class="auth-wide" :disabled="busy">
          {{ t('auth.name.done') }}
        </Button>
      </div>
    </form>
  </AuthScreen>
</template>

<style scoped>
.ns-form { display: flex; flex-direction: column; gap: var(--s-3); }
.ns-actions { display: flex; gap: var(--s-2); margin-top: var(--s-1); }
</style>
