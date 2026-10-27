<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from '@/components/ui/Button.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import RenameSheet from './RenameSheet.vue'
import { useAccount } from '@/composables/useAccount'
import { usePwaInstall } from '@/pwa/useInstall'
import { buildDate } from '@/utils/build'
import { t, currentLocale, LOCALES } from '@/locales'
import { accountErrorText } from './accountError'

const { user, setLanguage, signOut, deleteAccount } = useAccount()
const install = usePwaInstall()

const buildLine = computed(() => t('gameLayout.players.buildLine', { version: __APP_VERSION__, built: buildDate(currentLocale.value) }))

const renameOpen = ref(false)
const signOutOpen = ref(false)
const deleteOpen = ref(false)
const busy = ref(false)
const deleteError = ref<string | null>(null)

function openDelete() {
  deleteError.value = null
  deleteOpen.value = true
}

async function confirmSignOut() {
  signOutOpen.value = false
  await signOut()
}

async function confirmDelete() {
  busy.value = true
  deleteError.value = null
  try {
    await deleteAccount()
    deleteOpen.value = false
  } catch (err) {
    deleteError.value = accountErrorText(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <h1 class="eyebrow pf-heading">{{ t('profile.title') }}</h1>

  <template v-if="user">
    <section class="pf-card">
      <div class="pf-row">
        <span class="pf-key">{{ t('profile.name') }}</span>
        <span class="pf-value pf-value--name">{{ user.name || '—' }}</span>
        <Button variant="ghost" size="sm" :aria-label="t('profile.changeName')" @click="renameOpen = true">
          {{ t('profile.change') }}
        </Button>
      </div>

      <div class="pf-row">
        <span class="pf-key">{{ t('profile.email') }}</span>
        <span class="pf-value">{{ user.email }}</span>
      </div>

      <div class="pf-row">
        <span id="pf-language" class="pf-key">{{ t('profile.language') }}</span>
        <div class="pf-seg" role="group" aria-labelledby="pf-language">
          <button
            v-for="l in LOCALES"
            :key="l"
            type="button"
            :class="['pf-seg-btn', { 'is-active': currentLocale === l }]"
            :aria-pressed="currentLocale === l"
            @click="setLanguage(l)"
          >{{ l.toUpperCase() }}</button>
        </div>
      </div>

      <div v-if="install.canInstall.value || install.installed.value" class="pf-row">
        <span class="pf-key">{{ t('profile.app') }}</span>
        <span v-if="install.installed.value" class="pf-value">{{ t('profile.installed') }}</span>
        <Button v-else variant="ghost" size="sm" :aria-label="t('pwa.installCta')" @click="install.promptInstall()">
          {{ t('profile.install') }}
        </Button>
      </div>

      <div class="pf-row">
        <span class="pf-key">{{ t('profile.version') }}</span>
        <span class="pf-value pf-value--mono">{{ buildLine }}</span>
      </div>
    </section>

    <div class="pf-actions">
      <Button variant="ghost" size="lg" @click="signOutOpen = true">{{ t('profile.signOut') }}</Button>
      <Button variant="danger-ghost" size="lg" @click="openDelete">{{ t('profile.deleteAccount') }}</Button>
    </div>

    <RenameSheet v-model:open="renameOpen" :name="user.name" />

    <ConfirmSheet v-model:open="signOutOpen" :title="t('profile.signOutTitle')">
      <p>{{ t('profile.signOutBody') }}</p>
      <template #actions>
        <Button variant="hero" @click="confirmSignOut">{{ t('profile.signOutConfirm') }}</Button>
        <Button variant="ghost" @click="signOutOpen = false">{{ t('common.cancel') }}</Button>
      </template>
    </ConfirmSheet>

    <ConfirmSheet v-model:open="deleteOpen" variant="danger" :title="t('profile.deleteTitle')">
      <p>{{ t('profile.deleteBody') }}</p>
      <p v-if="deleteError" class="pf-error" role="alert">{{ deleteError }}</p>
      <template #actions>
        <Button variant="hero-danger" :disabled="busy" @click="confirmDelete">{{ t('profile.deleteConfirm') }}</Button>
        <Button variant="ghost" @click="deleteOpen = false">{{ t('common.cancel') }}</Button>
      </template>
    </ConfirmSheet>
  </template>
</template>

<style scoped>
.pf-heading { margin: 0; padding-left: 4px; }

.pf-card {
  display: flex;
  flex-direction: column;
  padding: var(--s-1) var(--s-4);
  background: var(--vtt-bg-surface);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-1);
}
.pf-row {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  min-height: 52px;
  padding: var(--s-2) 0;
  border-bottom: 1px solid var(--vtt-border-subtle);
}
.pf-row:last-child { border-bottom: none; }
.pf-key {
  flex: 0 0 auto;
  min-width: 96px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}
.pf-value {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-serif);
  font-size: 15px;
  color: var(--vtt-text-secondary);
}
.pf-value--name { font-size: 17px; color: var(--vtt-accent-soft); }
.pf-value--mono {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--vtt-text-muted);
}
.pf-row > :last-child:not(.pf-value):not(.pf-key) { margin-left: auto; }

.pf-seg {
  margin-left: auto;
  display: flex;
  border: 1px solid var(--vtt-border-strong);
  border-radius: var(--r-pill);
  overflow: hidden;
}
.pf-seg-btn {
  padding: 6px 12px;
  background: none;
  border: none;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--vtt-text-muted);
  cursor: pointer;
  transition: color var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
}
.pf-seg-btn:hover { color: var(--vtt-text-secondary); }
.pf-seg-btn:focus-visible { outline: 1px solid var(--vtt-border-gold); outline-offset: -2px; }
.pf-seg-btn.is-active { background: var(--vtt-bg-elevated); color: var(--vtt-accent-soft); }

.pf-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: var(--s-2);
}
.pf-actions > * { width: 100%; justify-content: center; }

.pf-error { margin: 0; font-family: var(--font-serif); font-size: 13px; color: var(--vtt-danger-bright); }
</style>
