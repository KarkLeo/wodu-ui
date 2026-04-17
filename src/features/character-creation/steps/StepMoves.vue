<script setup lang="ts">
import { ref, computed } from 'vue'
import fighter, { signatureWeaponOptions } from '@/data/classes/fighter'
import type { Character, Move, SignatureWeapon } from '@/types/character'
import MoveDescription from '@/components/ui/MoveDescription.vue'

const props = defineProps<{ draft: Character }>()
const emit = defineEmits<{
  patch: [data: Partial<Character>]
  next: []
}>()

const REQUIRED_COUNT = 1
const AUTO_GRANTED = ['fighter_signature_weapon', 'fighter_armored']

const selectableMoves = computed(() =>
  fighter.moves.filter(m =>
    m.type === 'starting' &&
    !m.id.startsWith('fighter_race_') &&
    !AUTO_GRANTED.includes(m.id)
  )
)

const selected = ref<string[]>([...props.draft.startingMoveIds])

function toggle(move: Move) {
  const idx = selected.value.indexOf(move.id)
  if (idx !== -1) {
    selected.value.splice(idx, 1)
  } else if (selected.value.length < REQUIRED_COUNT) {
    selected.value.push(move.id)
  }
}

const expanded = ref<string | null>(null)
function toggleExpand(id: string) {
  expanded.value = expanded.value === id ? null : id
}

// ── Знаковое оружие ────────────────────────────────────────────────────────
const weapon = ref<SignatureWeapon>({
  base:         props.draft.signatureWeapon?.base         ?? '',
  range:        props.draft.signatureWeapon?.range        ?? '',
  enhancements: props.draft.signatureWeapon?.enhancements ? [...props.draft.signatureWeapon.enhancements] : [],
  appearance:   props.draft.signatureWeapon?.appearance   ?? '',
})

function toggleEnhancement(id: string) {
  const idx = weapon.value.enhancements.indexOf(id)
  if (idx !== -1) {
    weapon.value.enhancements.splice(idx, 1)
  } else if (weapon.value.enhancements.length < 2) {
    weapon.value.enhancements.push(id)
  }
}

const weaponComplete = computed(() =>
  !!weapon.value.base &&
  !!weapon.value.range &&
  weapon.value.enhancements.length === 2 &&
  !!weapon.value.appearance
)

const canProceed = computed(() => selected.value.length === REQUIRED_COUNT && weaponComplete.value)

function proceed() {
  emit('patch', { startingMoveIds: [...selected.value], signatureWeapon: { ...weapon.value, enhancements: [...weapon.value.enhancements] } })
  emit('next')
}
</script>

<template>
  <div class="step-wrap">
    <h2 class="step-title">Стартовые ходы</h2>

    <!-- Знаковое оружие -->
    <div class="weapon-block">
      <div class="weapon-block__header">
        <span class="weapon-block__title">Знаковое оружие</span>
        <span class="weapon-block__hint">автоматический ход Воина</span>
      </div>

      <!-- Основа -->
      <div class="weapon-section">
        <div class="weapon-section__label">Выберите оружие из списка <span class="weapon-section__sub">каждое имеет вес 2</span></div>
        <div class="chip-grid">
          <button
            v-for="b in signatureWeaponOptions.bases"
            :key="b.id"
            class="chip"
            :class="{ 'chip--active': weapon.base === b.id }"
            @click="weapon.base = b.id"
          >{{ b.name }}</button>
        </div>
      </div>

      <!-- Длина -->
      <div class="weapon-section">
        <div class="weapon-section__label">Выберите подходящую длину вашего оружия</div>
        <div class="chip-grid">
          <button
            v-for="r in signatureWeaponOptions.ranges"
            :key="r.id"
            class="chip"
            :class="{ 'chip--active': weapon.range === r.id }"
            @click="weapon.range = r.id"
          >{{ r.name }}</button>
        </div>
      </div>

      <!-- Особые свойства -->
      <div class="weapon-section">
        <div class="weapon-section__label">
          Выберите два особых свойства
          <span class="weapon-section__counter" :class="{ 'weapon-section__counter--done': weapon.enhancements.length === 2 }">
            {{ weapon.enhancements.length }}/2
          </span>
        </div>
        <div class="enh-list">
          <button
            v-for="e in signatureWeaponOptions.enhancements"
            :key="e.id"
            class="enh-item"
            :class="{
              'enh-item--active': weapon.enhancements.includes(e.id),
              'enh-item--disabled': !weapon.enhancements.includes(e.id) && weapon.enhancements.length >= 2,
            }"
            @click="toggleEnhancement(e.id)"
          >
            <span class="enh-item__check">{{ weapon.enhancements.includes(e.id) ? '✓' : '' }}</span>
            <span class="enh-item__name">{{ e.name }}</span>
            <span class="enh-item__desc">{{ e.desc }}</span>
          </button>
        </div>
      </div>

      <!-- Внешний вид -->
      <div class="weapon-section">
        <div class="weapon-section__label">Выберите, как оно выглядит</div>
        <div class="chip-grid">
          <button
            v-for="a in signatureWeaponOptions.appearances"
            :key="a.id"
            class="chip"
            :class="{ 'chip--active': weapon.appearance === a.id }"
            @click="weapon.appearance = a.id"
          >{{ a.name }}</button>
        </div>
      </div>
    </div>

    <!-- Дополнительные ходы -->
    <p class="hint">Выбери {{ REQUIRED_COUNT }} из {{ selectableMoves.length }} ходов ({{ selected.length }}/{{ REQUIRED_COUNT }})</p>

    <div class="moves-list">
      <div
        v-for="move in selectableMoves"
        :key="move.id"
        class="move-item"
        :class="{
          'move-item--selected': selected.includes(move.id),
          'move-item--disabled': !selected.includes(move.id) && selected.length >= REQUIRED_COUNT,
        }"
      >
        <div class="move-item__header" @click="toggle(move)">
          <div class="move-item__check">
            <span v-if="selected.includes(move.id)">✓</span>
          </div>
          <span class="move-item__name">{{ move.name }}</span>
          <button class="move-item__expand" @click.stop="toggleExpand(move.id)">
            {{ expanded === move.id ? '▲' : '▼' }}
          </button>
        </div>
        <div v-if="expanded === move.id" class="move-item__desc">
          <MoveDescription :move="move" />
        </div>
      </div>
    </div>

    <div class="step-footer">
      <button class="btn-primary" :disabled="!canProceed" @click="proceed">Далее →</button>
    </div>
  </div>
</template>

<style scoped>
.step-wrap { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.step-title { font-size: 20px; font-weight: 700; border-bottom: 1px solid var(--color-border); padding-bottom: 12px; }
.hint { font-size: 12px; color: var(--color-text-muted); }

/* Блок знакового оружия */
.weapon-block {
  border: 1px solid var(--color-accent);
  border-radius: var(--border-radius);
  overflow: hidden;
}
.weapon-block__header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 10px 12px;
  background: var(--color-bg-elevated);
  border-bottom: 1px solid var(--color-border);
}
.weapon-block__title { font-size: 14px; font-weight: 700; }
.weapon-block__hint { font-size: 11px; color: var(--color-text-muted); }

.weapon-section { padding: 10px 12px; border-bottom: 1px solid var(--color-border); }
.weapon-section:last-child { border-bottom: none; }
.weapon-section__label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.weapon-section__sub { font-weight: 400; text-transform: none; letter-spacing: 0; }
.weapon-section__counter { font-weight: 700; color: var(--color-text-muted); }
.weapon-section__counter--done { color: var(--color-accent); }

/* Чипы (основа, длина, вид) */
.chip-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  padding: 5px 12px;
  border: 1px solid var(--color-border);
  border-radius: 20px;
  background: none;
  color: var(--color-text);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.chip:hover { border-color: var(--color-accent); }
.chip--active { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 12%, transparent); color: var(--color-accent); font-weight: 600; }

/* Особые свойства */
.enh-list { display: flex; flex-direction: column; gap: 4px; }
.enh-item {
  display: grid;
  grid-template-columns: 18px 1fr;
  grid-template-rows: auto auto;
  column-gap: 8px;
  padding: 7px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background: none;
  color: var(--color-text);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s;
}
.enh-item:hover { border-color: var(--color-accent); }
.enh-item--active { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 8%, transparent); }
.enh-item--disabled { opacity: 0.35; cursor: default; }
.enh-item--disabled:hover { border-color: var(--color-border); }
.enh-item__check {
  grid-row: 1 / 3;
  width: 18px;
  height: 18px;
  border: 1px solid var(--color-border);
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--color-accent);
  flex-shrink: 0;
  align-self: center;
}
.enh-item--active .enh-item__check { border-color: var(--color-accent); }
.enh-item__name { font-size: 13px; font-weight: 600; line-height: 1.3; }
.enh-item__desc { font-size: 11px; color: var(--color-text-muted); line-height: 1.4; }

/* Список ходов */
.moves-list { display: flex; flex-direction: column; gap: 6px; }
.move-item { border: 1px solid var(--color-border); border-radius: var(--border-radius); overflow: hidden; }
.move-item--selected { border-color: var(--color-accent); }
.move-item--disabled { opacity: 0.4; }
.move-item__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  background: var(--color-bg-elevated);
}
.move-item__check {
  width: 18px;
  height: 18px;
  border: 1px solid var(--color-border);
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--color-accent);
  flex-shrink: 0;
}
.move-item--selected .move-item__check { border-color: var(--color-accent); }
.move-item__name { flex: 1; font-size: 14px; font-weight: 600; }
.move-item__expand { background: none; border: none; color: var(--color-text-muted); cursor: pointer; font-size: 10px; }
.move-item__desc { padding: 10px 12px; font-size: 12px; color: var(--color-text-muted); line-height: 1.6; border-top: 1px solid var(--color-border); }
.step-footer { display: flex; justify-content: flex-end; padding-top: 8px; }
</style>
