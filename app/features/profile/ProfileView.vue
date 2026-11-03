<script setup lang="ts">
import { computed, ref } from 'vue'
import ScreenHeader from '@/components/layout/ScreenHeader.vue'
import Button from '@/components/ui/Button.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import FormError from '@/components/ui/FormError.vue'
import KeyValueRow from '@/components/ui/KeyValueRow.vue'
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
  <ScreenHeader variant="eyebrow" :title="t('profile.title')" />

  <template v-if="user">
    <section class="pf-card">
      <KeyValueRow :label="t('profile.name')">
        <span class="pf-name">{{ user.name || '—' }}</span>
        <template #action>
          <Button variant="ghost" size="sm" :aria-label="t('profile.changeName')" @click="renameOpen = true">
            {{ t('profile.change') }}
          </Button>
        </template>
      </KeyValueRow>

      <KeyValueRow :label="t('profile.email')">{{ user.email }}</KeyValueRow>

      <KeyValueRow :label="t('profile.language')" label-id="pf-language">
        <template #action>
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
        </template>
      </KeyValueRow>

      <KeyValueRow v-if="install.canInstall.value || install.installed.value" :label="t('profile.app')">
        <template v-if="install.installed.value" #default>{{ t('profile.installed') }}</template>
        <template v-else #action>
          <Button variant="ghost" size="sm" :aria-label="t('pwa.installCta')" @click="install.promptInstall()">
            {{ t('profile.install') }}
          </Button>
        </template>
      </KeyValueRow>

      <KeyValueRow :label="t('profile.version')">
        <span class="pf-version">{{ buildLine }}</span>
      </KeyValueRow>
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
      <FormError v-if="deleteError" role="alert">{{ deleteError }}</FormError>
      <template #actions>
        <Button variant="hero-danger" :disabled="busy" @click="confirmDelete">{{ t('profile.deleteConfirm') }}</Button>
        <Button variant="ghost" @click="deleteOpen = false">{{ t('common.cancel') }}</Button>
      </template>
    </ConfirmSheet>
  </template>
</template>

<style scoped>
.pf-card {
  display: flex;
  flex-direction: column;
  padding: var(--s-1) var(--s-4);
  background: var(--vtt-bg-surface);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-1);
}
.pf-name { font-size: 17px; color: var(--vtt-accent-soft); }
.pf-version {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--vtt-text-muted);
}

.pf-seg {
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
</style>
