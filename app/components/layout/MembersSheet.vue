<script setup lang="ts">
import { computed, ref } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import Button from '@/components/ui/Button.vue'
import { useGameAction } from '@/composables/useGameAction'
import { useGamesStore } from '@/stores/games'
import { currentUser } from '@/transport/auth'
import { removeMember } from '@/transport/games'
import type { Game, GameMember } from '@/types/game'
import { isMaster } from '@/utils/permissions'
import { t } from '@/locales'
import './game.css'

const props = defineProps<{ game: Game }>()
const open = defineModel<boolean>('open', { required: true })

const games = useGamesStore()
const { busy, run } = useGameAction()

const me = computed(() => currentUser.value?.id ?? null)
const master = computed(() => isMaster(props.game, me.value))

// The master first, then everyone else in the order they joined.
const members = computed(() => {
  const all = games.membersOf(props.game.id)
  return [...all.filter(m => m.user === props.game.master), ...all.filter(m => m.user !== props.game.master)]
})

// Kept after the confirmation closes, so its title does not go blank while it animates out.
const target = ref<GameMember | null>(null)
const confirmOpen = ref(false)

function askRemove(member: GameMember) {
  target.value = member
  confirmOpen.value = true
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

async function confirmRemove() {
  const member = target.value
  if (!member) return
  const ok = await run('removeMember', t('games.members.removeFailed'), () => removeMember(props.game.id, member.user))
  if (ok) confirmOpen.value = false
}
</script>

<template>
  <BottomSheet v-model:open="open" :title="t('games.members.title')" :max-width="420">
    <ul class="gs-list">
      <li v-for="m in members" :key="m.id" class="gs-row">
        <span class="gs-avatar" aria-hidden="true">{{ initial(m.name) }}</span>
        <span class="gs-body">
          <span class="gs-name">{{ m.name || t('games.table.unknownOwner') }}</span>
          <span class="gs-pills">
            <span v-if="m.user === game.master" class="gs-pill is-master">{{ t('games.members.master') }}</span>
            <span v-if="m.user === me" class="gs-pill">{{ t('games.members.you') }}</span>
          </span>
        </span>
        <Button
          v-if="master && m.user !== me"
          variant="danger-ghost"
          size="sm"
          :aria-label="t('games.members.removeLabel', { name: m.name })"
          @click="askRemove(m)"
        >{{ t('games.members.remove') }}</Button>
      </li>
    </ul>
  </BottomSheet>

  <ConfirmSheet
    v-model:open="confirmOpen"
    variant="danger"
    :title="t('games.members.removeTitle', { name: target?.name ?? '' })"
  >
    <p>{{ t('games.members.removeBody') }}</p>
    <template #actions>
      <Button variant="hero-danger" :disabled="busy" @click="confirmRemove">{{ t('games.members.removeConfirm') }}</Button>
      <Button variant="ghost" @click="confirmOpen = false">{{ t('common.cancel') }}</Button>
    </template>
  </ConfirmSheet>
</template>
