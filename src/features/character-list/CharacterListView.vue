<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import { useCreationStore } from '@/stores/creation'
import { useCharacterCreation } from '@/composables/useCharacterCreation'
import { CLASSES } from '@/data/classes'

const router = useRouter()
const characters = useCharactersStore()
const creation = useCreationStore()
const { createDraft } = useCharacterCreation()

const activeChars = computed(() => characters.list.filter(c => c.status === 'active'))
const draftChars = computed(() => characters.list.filter(c => c.status === 'draft'))

const selected = ref<Set<string>>(new Set())

function toggleSelected(id: string, ev: Event) {
  ev.stopPropagation()
  if (selected.value.has(id)) selected.value.delete(id)
  else selected.value.add(id)
  selected.value = new Set(selected.value)
}

function openSelected() {
  const ids = activeChars.value.map(c => c.id).filter(id => selected.value.has(id))
  if (ids.length === 0) return
  router.push(`/party/${ids.join(',')}`)
}

function openCharacter(id: string) {
  router.push(`/party/${id}`)
}

function resumeCreation(id: string) {
  creation.setDraft(id)
  router.push('/character/new')
}

function startNew() {
  creation.reset()  // очищаем старый draftId если был
  createDraft()
  router.push('/character/new')
}

function hpPercent(current: number, max: number) {
  return Math.max(0, Math.min(100, (current / max) * 100))
}

function resetAllState() {
  if (!confirm('Удалить всех персонажей и очистить стейт? Действие необратимо.')) return
  characters.clearAll()
  creation.reset()
}
</script>

<template>
  <div class="content-wrap">
    <div class="list-header">
      <span class="label">Персонажи</span>
      <div class="list-header__actions">
        <button
          v-if="selected.size > 0"
          class="btn-primary"
          @click="openSelected"
        >Открыть ({{ selected.size }})</button>
        <button class="btn-primary" @click="startNew">+ Новый</button>
      </div>
    </div>

    <!-- Активные персонажи -->
    <div v-if="activeChars.length > 0" class="char-list">
      <button
        v-for="char in activeChars"
        :key="char.id"
        class="char-card"
        :class="{ 'char-card--selected': selected.has(char.id) }"
        @click="openCharacter(char.id)"
      >
        <div class="char-card__top">
          <div
            class="char-card__check"
            :class="{ 'char-card__check--on': selected.has(char.id) }"
            role="checkbox"
            :aria-checked="selected.has(char.id)"
            @click="toggleSelected(char.id, $event)"
          >{{ selected.has(char.id) ? '✓' : '' }}</div>
          <div class="char-card__title">
            <div class="char-card__name">{{ char.name }}</div>
            <div class="label">{{ char.classId === 'custom' ? (char.customClassName ?? 'Свой класс') : (CLASSES[char.classId]?.name ?? char.classId) }} · Уровень {{ char.level }}</div>
          </div>
          <div class="char-card__hp">
            <span class="label">HP</span>
            <span>{{ char.currentHp }} / {{ char.maxHp }}</span>
          </div>
        </div>
        <div class="char-card__hp-bar">
          <div
            class="char-card__hp-fill"
            :style="{ width: hpPercent(char.currentHp, char.maxHp) + '%' }"
          />
        </div>
      </button>
    </div>

    <!-- Черновики -->
    <div v-if="draftChars.length > 0" class="draft-section">
      <div class="label" style="padding: 12px 16px 8px">Не завершены</div>
      <button
        v-for="char in draftChars"
        :key="char.id"
        class="char-card char-card--draft"
        @click="resumeCreation(char.id)"
      >
        <div class="char-card__name">{{ char.name || 'Без имени' }}</div>
        <div class="label">Продолжить создание →</div>
      </button>
    </div>

    <!-- Пусто -->
    <div v-if="activeChars.length === 0 && draftChars.length === 0" class="empty-state">
      <p>Нет персонажей.</p>
      <p class="label" style="margin-top: 8px">Нажми «+ Новый» чтобы начать</p>
    </div>

    <div class="dev-tools">
      <button class="btn-danger" @click="resetAllState">Полный сброс стейта</button>
    </div>
  </div>
</template>

<style scoped>
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}
.char-list { display: flex; flex-direction: column; }
.char-card {
  width: 100%;
  background: none;
  border: none;
  border-bottom: 1px solid var(--color-border);
  padding: 14px 16px 10px;
  text-align: left;
  cursor: pointer;
  color: var(--color-text);
  font-family: inherit;
}
.char-card:hover { background: var(--color-bg-elevated); }
.char-card--draft { opacity: 0.6; }
.char-card__top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; gap: 10px; }
.char-card__title { flex: 1; min-width: 0; }
.char-card--selected { background: var(--color-bg-elevated); }
.char-card__check {
  width: 22px; height: 22px; border: 1px solid var(--color-border);
  border-radius: 3px; display: flex; align-items: center; justify-content: center;
  font-size: 14px; line-height: 1; color: var(--color-accent); flex-shrink: 0;
  margin-top: 2px;
}
.char-card__check--on { border-color: var(--color-accent); }
.list-header__actions { display: flex; gap: 8px; }
.char-card__name { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
.char-card__hp { text-align: right; font-size: 14px; }
.char-card__hp-bar { height: 4px; background: var(--color-bg-elevated); border-radius: 2px; overflow: hidden; }
.char-card__hp-fill { height: 100%; background: var(--color-accent); border-radius: 2px; transition: width 0.3s; }
.draft-section { border-top: 1px solid var(--color-border); }
.empty-state { padding: 48px 16px; text-align: center; color: var(--color-text-muted); font-size: 14px; }
.dev-tools { padding: 24px 16px; display: flex; justify-content: center; }
.btn-danger { background: none; border: 1px solid var(--color-danger, #e05252); color: var(--color-danger, #e05252); padding: 8px 14px; border-radius: 3px; font-family: inherit; font-size: 12px; cursor: pointer; }
.btn-danger:hover { background: var(--color-danger, #e05252); color: var(--color-bg-dark); }
</style>
