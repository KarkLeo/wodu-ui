<script setup lang="ts">
import { computed, ref } from 'vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import Button from '@/components/ui/Button.vue'
import { useGameAction } from '@/composables/useGameAction'
import { useGamesStore } from '@/stores/games'
import { useToastsStore } from '@/stores/toasts'
import { currentUser } from '@/transport/auth'
import { removeMember, transferMaster } from '@/transport/games'
import type { Game, GameMember } from '@/types/game'
import { isMaster } from '@/utils/permissions'
import { t } from '@/locales'
import './game.css'

const props = defineProps<{ game: Game }>()
const emit = defineEmits<{ transferred: [member: GameMember] }>()

const games = useGamesStore()
const { busy, run } = useGameAction()

const me = computed(() => currentUser.value?.id ?? null)
const master = computed(() => isMaster(props.game, me.value))

// The master first, then everyone else in the order they joined.
const members = computed(() => {
  const all = games.membersOf(props.game.id)
  return [...all.filter(m => m.user === props.game.master), ...all.filter(m => m.user !== props.game.master)]
})

// Kept after a confirmation closes, so its title does not go blank while it animates out.
const target = ref<GameMember | null>(null)
const removeOpen = ref(false)
const transferOpen = ref(false)

function askRemove(member: GameMember) {
  target.value = member
  removeOpen.value = true
}

function askTransfer(member: GameMember) {
  target.value = member
  transferOpen.value = true
}

function displayName(m: GameMember): string {
  return m.name || t('games.table.unknownOwner')
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

async function confirmRemove() {
  const member = target.value
  if (!member) return
  const ok = await run('removeMember', t('games.members.removeFailed'), () => removeMember(props.game.id, member.user))
  if (ok) removeOpen.value = false
}

async function confirmTransfer() {
  const member = target.value
  if (!member) return
  const ok = await run('transferMaster', t('games.members.transferFailed'), () => transferMaster(props.game.id, member.user))
  if (!ok) return
  transferOpen.value = false
  useToastsStore().push(t('games.members.transferred', { name: displayName(member) }), 'info')
  emit('transferred', member)
}
</script>

<template>
  <ul class="gs-list">
    <li v-for="m in members" :key="m.id" class="gs-row">
      <span class="gs-avatar" aria-hidden="true">{{ initial(m.name) }}</span>
      <span class="gs-body">
        <span class="gs-name">{{ displayName(m) }}</span>
        <span class="gs-pills">
          <span v-if="m.user === game.master" class="gs-pill is-master">{{ t('games.members.master') }}</span>
          <span v-if="m.user === me" class="gs-pill">{{ t('games.members.you') }}</span>
        </span>
      </span>
      <span v-if="master && m.user !== me" class="gs-row-actions">
        <Button
          variant="ghost"
          size="sm"
          :aria-label="t('games.members.transferLabel', { name: displayName(m) })"
          @click="askTransfer(m)"
        >{{ t('games.members.transfer') }}</Button>
        <Button
          variant="danger-ghost"
          size="sm"
          :aria-label="t('games.members.removeLabel', { name: displayName(m) })"
          @click="askRemove(m)"
        >{{ t('games.members.remove') }}</Button>
      </span>
    </li>
  </ul>

  <ConfirmSheet
    v-model:open="removeOpen"
    variant="danger"
    :title="t('games.members.removeTitle', { name: target ? displayName(target) : '' })"
  >
    <p>{{ t('games.members.removeBody') }}</p>
    <template #actions>
      <Button variant="hero-danger" :disabled="busy" @click="confirmRemove">{{ t('games.members.removeConfirm') }}</Button>
      <Button variant="ghost" @click="removeOpen = false">{{ t('common.cancel') }}</Button>
    </template>
  </ConfirmSheet>

  <ConfirmSheet
    v-model:open="transferOpen"
    variant="danger"
    :title="t('games.members.transferTitle', { name: target ? displayName(target) : '' })"
  >
    <p>{{ t('games.members.transferBody') }}</p>
    <template #actions>
      <Button variant="hero-danger" :disabled="busy" @click="confirmTransfer">{{ t('games.members.transferConfirm') }}</Button>
      <Button variant="ghost" @click="transferOpen = false">{{ t('common.cancel') }}</Button>
    </template>
  </ConfirmSheet>
</template>
