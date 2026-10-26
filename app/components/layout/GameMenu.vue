<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from 'reka-ui'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import Button from '@/components/ui/Button.vue'
import IconMenu from '@/components/ui/icons/IconMenu.vue'
import InviteSheet from './InviteSheet.vue'
import MembersSheet from './MembersSheet.vue'
import BringCharacterSheet from './BringCharacterSheet.vue'
import { useGameAction } from '@/composables/useGameAction'
import { exitGameQuietly } from '@/composables/useRouteRecheck'
import { currentUser } from '@/transport/auth'
import { deleteGame, leaveGame } from '@/transport/games'
import type { Game } from '@/types/game'
import { isMaster } from '@/utils/permissions'
import { t } from '@/locales'
import './game.css'

const props = defineProps<{ game: Game }>()

const router = useRouter()
const { busy, run } = useGameAction()

const master = computed(() => isMaster(props.game, currentUser.value?.id ?? null))

const inviteOpen = ref(false)
const membersOpen = ref(false)
const bringOpen = ref(false)
const leaveOpen = ref(false)
const deleteOpen = ref(false)

// Losing the game unmounts this menu part-way, so its id is read before the write starts.
async function exit(what: string, failed: string, op: (gameId: string) => Promise<void>) {
  const gameId = props.game.id
  const ok = await run(what, failed, () => exitGameQuietly(gameId, () => op(gameId)))
  if (!ok) return
  leaveOpen.value = false
  deleteOpen.value = false
  void router.replace({ name: 'character-list' })
}

function goHome() {
  void router.push({ name: 'character-list' })
}
</script>

<template>
  <DropdownMenuRoot :modal="false">
    <DropdownMenuTrigger class="gm-trigger" :aria-label="t('games.table.menu')">
      <IconMenu :size="14" />
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent class="gm-menu" side="bottom" align="end" :side-offset="6">
        <DropdownMenuItem class="gm-item" @select="inviteOpen = true">{{ t('games.menu.invite') }}</DropdownMenuItem>
        <DropdownMenuItem class="gm-item" @select="membersOpen = true">{{ t('games.menu.members') }}</DropdownMenuItem>
        <DropdownMenuItem class="gm-item" @select="bringOpen = true">{{ t('games.menu.bring') }}</DropdownMenuItem>
        <DropdownMenuItem class="gm-item" @select="goHome">{{ t('games.menu.home') }}</DropdownMenuItem>
        <DropdownMenuSeparator class="gm-sep" />
        <DropdownMenuItem v-if="master" class="gm-item is-danger" @select="deleteOpen = true">{{ t('games.menu.delete') }}</DropdownMenuItem>
        <DropdownMenuItem v-else class="gm-item is-danger" @select="leaveOpen = true">{{ t('games.menu.leave') }}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>

  <InviteSheet v-model:open="inviteOpen" :game="game" />
  <MembersSheet v-model:open="membersOpen" :game="game" />
  <BringCharacterSheet v-model:open="bringOpen" :game-id="game.id" />

  <ConfirmSheet v-model:open="leaveOpen" variant="danger" :title="t('games.leave.title', { game: game.name })">
    <p>{{ t('games.leave.body') }}</p>
    <template #actions>
      <Button variant="hero-danger" :disabled="busy" @click="exit('leaveGame', t('games.leave.failed'), leaveGame)">
        {{ t('games.leave.confirm') }}
      </Button>
      <Button variant="ghost" @click="leaveOpen = false">{{ t('common.cancel') }}</Button>
    </template>
  </ConfirmSheet>

  <ConfirmSheet v-model:open="deleteOpen" variant="danger" :title="t('games.remove.title', { game: game.name })">
    <p>{{ t('games.remove.body') }}</p>
    <template #actions>
      <Button variant="hero-danger" :disabled="busy" @click="exit('deleteGame', t('games.remove.failed'), deleteGame)">
        {{ t('games.remove.confirm') }}
      </Button>
      <Button variant="ghost" @click="deleteOpen = false">{{ t('common.cancel') }}</Button>
    </template>
  </ConfirmSheet>
</template>
