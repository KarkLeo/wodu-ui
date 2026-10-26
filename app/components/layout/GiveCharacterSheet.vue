<script setup lang="ts">
import { computed, ref } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import Button from '@/components/ui/Button.vue'
import { useGameAction } from '@/composables/useGameAction'
import { useCharactersStore } from '@/stores/characters'
import { useGamesStore } from '@/stores/games'
import { currentUser } from '@/transport/auth'
import { assignCharacter } from '@/transport/games'
import type { GameMember } from '@/types/game'
import { t } from '@/locales'
import './game.css'

const props = defineProps<{ characterId: string; gameId: string }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ given: [userId: string] }>()

const characters = useCharactersStore()
const games = useGamesStore()
const { busy, run } = useGameAction()

const name = computed(() => characters.getById(props.characterId)?.name ?? '')
const others = computed(() => games.membersOf(props.gameId).filter(m => m.user !== currentUser.value?.id))

// Kept after the confirmation closes, so its title does not go blank while it animates out.
const target = ref<GameMember | null>(null)
const confirmOpen = ref(false)

function displayName(m: GameMember): string {
  return m.name || t('games.table.unknownOwner')
}

function pick(member: GameMember) {
  target.value = member
  confirmOpen.value = true
}

async function confirmGive() {
  const member = target.value
  if (!member) return
  const ok = await run('assignCharacter', t('games.sheet.giveFailed'), () => assignCharacter(props.characterId, member.user))
  if (!ok) return
  confirmOpen.value = false
  open.value = false
  emit('given', member.user)
}
</script>

<template>
  <BottomSheet v-model:open="open" :title="t('games.sheet.giveTitle', { name })" :max-width="420">
    <div class="gs-stack">
      <p class="gs-hint">{{ t('games.sheet.giveHint') }}</p>
      <ul v-if="others.length" class="gs-list">
        <li v-for="m in others" :key="m.id">
          <button type="button" class="gs-row" :disabled="busy" @click="pick(m)">
            <span class="gs-avatar" aria-hidden="true">{{ m.name.trim().charAt(0).toUpperCase() || '?' }}</span>
            <span class="gs-body">
              <span class="gs-name">{{ displayName(m) }}</span>
            </span>
          </button>
        </li>
      </ul>
      <div v-else class="gs-empty">{{ t('games.sheet.giveEmpty') }}</div>
    </div>
  </BottomSheet>

  <ConfirmSheet
    v-model:open="confirmOpen"
    variant="danger"
    :title="t('games.sheet.giveConfirmTitle', { name, player: target ? displayName(target) : '' })"
  >
    <p>{{ t('games.sheet.giveConfirmBody', { player: target ? displayName(target) : '' }) }}</p>
    <template #actions>
      <Button variant="hero-danger" :disabled="busy" @click="confirmGive">{{ t('games.sheet.giveConfirm') }}</Button>
      <Button variant="ghost" @click="confirmOpen = false">{{ t('common.cancel') }}</Button>
    </template>
  </ConfirmSheet>
</template>
