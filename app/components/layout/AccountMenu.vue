<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from 'reka-ui'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import Button from '@/components/ui/Button.vue'
import AuthField from '@/features/sign-in/AuthField.vue'
import { useAccount } from '@/composables/useAccount'
import { NAME_MAX } from '@/transport/authHelpers'
import type { UserRecord } from '@/transport/auth'
import { t } from '@/locales'
import { createLogger } from '@/utils/logger'

const props = defineProps<{ user: UserRecord }>()

const log = createLogger('account')
const { rename, signOut, deleteAccount } = useAccount()

const initial = computed(() => (props.user.name.trim().charAt(0) || props.user.email.charAt(0) || '?').toUpperCase())

const renameOpen = ref(false)
const draftName = ref('')
const deleteOpen = ref(false)
const busy = ref(false)

function openRename() {
  draftName.value = props.user.name
  renameOpen.value = true
}

async function act(action: () => Promise<void>) {
  busy.value = true
  try {
    await action()
  } catch (err) {
    log.warn('account action failed', { err })
  } finally {
    busy.value = false
  }
}

function saveName() {
  const name = draftName.value.trim()
  if (!name) return
  void act(async () => {
    await rename(name)
    renameOpen.value = false
  })
}

function confirmDelete() {
  void act(async () => {
    await deleteAccount()
    deleteOpen.value = false
  })
}
</script>

<template>
  <DropdownMenuRoot :modal="false">
    <DropdownMenuTrigger class="am-row">
      <span class="am-avatar" aria-hidden="true">{{ initial }}</span>
      <span class="am-body">
        <span class="am-name">{{ user.name || user.email }}</span>
        <span class="am-email">{{ user.email }}</span>
      </span>
      <span class="am-chev" aria-hidden="true">⌃</span>
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent class="am-menu" side="top" align="start" :side-offset="6">
        <DropdownMenuLabel class="am-menu-head">
          <span class="am-name">{{ user.name || user.email }}</span>
          <span class="am-email">{{ user.email }}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator class="am-sep" />
        <DropdownMenuItem class="am-item" @select="openRename">{{ t('auth.menu.changeName') }}</DropdownMenuItem>
        <DropdownMenuItem class="am-item" @select="signOut">{{ t('auth.menu.signOut') }}</DropdownMenuItem>
        <DropdownMenuItem class="am-item is-danger" @select="deleteOpen = true">{{ t('auth.menu.deleteAccount') }}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>

  <BottomSheet v-model:open="renameOpen" :title="t('auth.menu.changeName')" :max-width="420">
    <form class="am-form" @submit.prevent="saveName">
      <AuthField
        id="account-name"
        v-model="draftName"
        :label="t('auth.name.label')"
        :hint="t('auth.name.hint')"
        :maxlength="NAME_MAX"
        autocomplete="nickname"
      />
      <Button type="submit" variant="hero" class="am-save" :disabled="busy || !draftName.trim()">
        {{ t('common.save') }}
      </Button>
    </form>
  </BottomSheet>

  <ConfirmSheet v-model:open="deleteOpen" variant="danger" :title="t('auth.menu.deleteTitle')">
    <p>{{ t('auth.menu.deleteBody') }}</p>
    <template #actions>
      <Button variant="hero-danger" :disabled="busy" @click="confirmDelete">{{ t('auth.menu.deleteConfirm') }}</Button>
      <Button variant="ghost" @click="deleteOpen = false">{{ t('common.cancel') }}</Button>
    </template>
  </ConfirmSheet>
</template>

<style scoped>
.am-row {
  width: 100%;
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 10px;
  padding: 6px 8px;
  border-radius: var(--r-md);
  border: 1px solid var(--vtt-border-subtle);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
}
.am-row:hover,
.am-row[data-state='open'] { border-color: var(--vtt-border-strong); background: rgba(212, 168, 87, 0.05); }
.am-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-serif);
  font-size: 14px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  background: linear-gradient(135deg, rgba(58, 45, 33, 0.9) 0%, rgba(26, 21, 16, 0.9) 100%);
  box-shadow: inset 0 0 0 1px rgba(228, 201, 160, 0.12);
}
.am-body { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.am-name {
  font-family: var(--font-serif);
  font-size: 14px;
  color: var(--vtt-accent-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.am-email {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--vtt-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.am-chev { color: var(--vtt-text-muted); font-size: 12px; }

.am-form { display: flex; flex-direction: column; gap: var(--s-4); }
.am-save { align-self: flex-end; }
</style>

<!-- The menu is portalled to <body>, out of reach of the scoped styles above. -->
<style>
.am-menu {
  z-index: 60;
  min-width: 232px;
  padding: 6px;
  border: 1px solid var(--vtt-border-gold);
  border-radius: var(--r-md);
  background: rgba(26, 21, 16, 0.98);
  box-shadow: var(--shadow-3);
}
.am-menu-head {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 8px 10px 10px;
}
.am-menu-head .am-name { font-family: var(--font-serif); font-size: 15px; color: var(--vtt-accent-soft); }
.am-menu-head .am-email { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em; color: var(--vtt-text-muted); }
.am-sep { height: 1px; margin: 0 4px 4px; background: var(--vtt-border-subtle); }
.am-item {
  padding: 10px;
  border-radius: var(--r-sm);
  font-family: var(--font-serif);
  font-size: 15px;
  color: var(--vtt-text-secondary);
  cursor: pointer;
  outline: none;
}
.am-item[data-highlighted] { background: rgba(212, 168, 87, 0.06); color: var(--vtt-accent-soft); }
.am-item.is-danger { color: var(--vtt-danger-bright); }
</style>
