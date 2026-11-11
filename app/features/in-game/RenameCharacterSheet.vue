<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import Button from '@/components/ui/Button.vue'
import TextField from '@/components/ui/TextField.vue'
import type { CharacterCommand } from '@/domain/commands'
import { useCharactersStore } from '@/stores/characters'
import { mode } from '@/transport/mode'
import { t } from '@/locales'

const props = defineProps<{ characterId: string }>()
const open = defineModel<boolean>('open', { required: true })

const characters = useCharactersStore()
const uid = useId()

const char = computed(() => characters.getById(props.characterId))
const name = ref('')
const trueName = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = char.value?.name ?? ''
  trueName.value = char.value?.trueName ?? ''
}, { immediate: true })

const canSave = computed(() => name.value.trim() !== '')

async function save() {
  const c = char.value
  if (!c || !canSave.value) return
  const nextName = name.value.trim()
  const nextTrueName = trueName.value.trim()
  const commands: CharacterCommand[] = []
  if (nextName !== c.name) commands.push({ type: 'SET_NAME', name: nextName })
  if (nextTrueName !== (c.trueName ?? '')) commands.push({ type: 'SET_TRUE_NAME', trueName: nextTrueName })
  open.value = false
  // One after the other: each write sends the whole character, so the second must start from the first.
  for (const cmd of commands) await characters.dispatch(c.id, cmd)
}
</script>

<template>
  <BottomSheet v-model:open="open" :title="t('inGame.rename.title', { name: char?.name ?? '' })" :max-width="420">
    <form :id="`${uid}-form`" class="rc-form" novalidate @submit.prevent="save">
      <TextField
        v-model="name"
        :label="t('inGame.rename.nameLabel')"
        :placeholder="t('characterCreation.identity.namePlaceholder')"
        :spellcheck="false"
      />
      <TextField
        v-model="trueName"
        secret
        :label="t('inGame.rename.trueNameLabel')"
        :optional="t('inGame.rename.trueNameOpt')"
        :placeholder="t('characterCreation.identity.trueNamePlaceholder')"
        :hint="mode === 'online' ? t('inGame.rename.trueNameHint') : undefined"
      />
    </form>

    <template #footer>
      <Button variant="ghost" @click="open = false">{{ t('common.cancel') }}</Button>
      <Button variant="hero" type="submit" :form="`${uid}-form`" :disabled="!canSave">
        {{ t('common.save') }}
      </Button>
    </template>
  </BottomSheet>
</template>

<style scoped>
.rc-form { display: flex; flex-direction: column; gap: 12px; }
</style>
