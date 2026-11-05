<script setup lang="ts">
import { computed } from 'vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import NumberedName from '@/features/encounter/NumberedName.vue'
import { t } from '@/locales'
import type { RollRecord } from '@/types/dice'
import type { EncounterHit } from '@/types/encounter'
import { logTime, rollClasses, rollExpr, rollKindLabel, rollWeaponLabel } from '@/utils/rollDisplay'

const props = defineProps<{
  roll: RollRecord
  author: string
  /** Just arrived: the row flashes. */
  fresh?: boolean
  /** The master's selected target this roll can be applied to; the row then is a button that opens the popup. */
  applyTo?: string
  /** That popup is open on this row. */
  expanded?: boolean
  hits?: EncounterHit[]
}>()
const emit = defineEmits<{ (e: 'open', row: HTMLElement): void }>()

const applicable = computed(() => props.applyTo !== undefined)
const weapon = computed(() => rollWeaponLabel(props.roll))

// The two lines in full, for when the row cannot show them.
const fullText = computed(() => {
  const { roll } = props
  const meta = [rollKindLabel(roll), weapon.value, props.author].filter(Boolean).join(' · ')
  const formula = [
    rollExpr(roll),
    roll.dice.map(d => d.value).join(' + '),
    roll.discardedTotal !== undefined ? `${t('diceDrawer.mode.alt')} ${roll.discardedTotal}` : '',
  ].filter(Boolean).join(' · ')
  return `${meta}\n${formula}`
})

function isCut(body: HTMLElement) {
  return [...body.querySelectorAll('.dice-row-meta-weapon, .numbered-name-text, .dice-row-formula')]
    .some(el => el.scrollWidth > el.clientWidth)
}

function open(e: Event) {
  if (applicable.value) emit('open', e.currentTarget as HTMLElement)
}

function onKeydown(e: KeyboardEvent) {
  if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
  if (!applicable.value) return
  e.preventDefault()
  open(e)
}
</script>

<template>
  <div
    class="dice-row"
    :class="[rollClasses(roll), { 'is-fresh': fresh, 'is-applicable': applicable }]"
    :data-roll="roll.id"
    :role="applicable ? 'button' : undefined"
    :tabindex="applicable ? 0 : undefined"
    :aria-haspopup="applicable ? 'dialog' : undefined"
    :aria-expanded="applicable ? !!expanded : undefined"
    @click="open"
    @keydown="onKeydown"
  >
    <span class="dice-row-glyph" aria-hidden="true">
      <svg v-if="roll.purpose.kind === 'damage'" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1.5 C8 1.5 3 6.5 3 10 C3 12.761 5.239 15 8 15 C10.761 15 13 12.761 13 10 C13 6.5 8 1.5 8 1.5 Z"/>
      </svg>
      <svg v-else viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
        <path d="M8 1.5 L14 5 L14 11 L8 14.5 L2 11 L2 5 Z"/>
        <path d="M8 1.5 L8 8 M2 5 L8 8 M14 5 L8 8"/>
      </svg>
    </span>
    <Tooltip :text="fullText" :check="isCut" :tap="!applicable">
      <div class="dice-row-body">
        <div class="dice-row-meta">
          <b>{{ rollKindLabel(roll) }}</b>
          <span v-if="weapon" class="dice-row-meta-secondary"><span class="dot"></span><span class="dice-row-meta-weapon">{{ weapon }}</span></span>
          <span class="dot"></span><NumberedName class="dice-row-meta-author" :label="author" plain />
          <span class="dot"></span><span class="dice-row-meta-time">{{ logTime(roll.timestamp) }}</span>
        </div>
        <div class="dice-row-formula">
          <span class="f-expr">{{ rollExpr(roll) }}</span>
          <span v-if="roll.dice.length" class="f-rolls">
            ·&nbsp;
            <template v-for="(d, i) in roll.dice" :key="i">
              <em>{{ d.value }}</em><template v-if="i < roll.dice.length - 1"> + </template>
            </template>
          </span>
          <span v-if="roll.discardedTotal !== undefined" class="f-alt">
            · {{ t('diceDrawer.mode.alt') }} {{ roll.discardedTotal }}
          </span>
        </div>
      </div>
    </Tooltip>
    <div class="dice-row-result">{{ roll.total }}</div>
    <div v-if="applyTo" class="dice-row-go">→ <NumberedName :label="applyTo" /></div>
    <div v-if="hits?.length" class="dice-row-hits">
      <span v-for="hit in hits" :key="hit.id" class="dice-row-hit">→ <NumberedName :label="hit.target.name" /> <em>−{{ hit.amount }}</em></span>
    </div>
  </div>
</template>

<style scoped>
.dice-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  column-gap: 10px;
  align-items: center;
  padding: 10px 12px;
  background: var(--vtt-elevated-a55);
  border-radius: var(--r-md);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  transition: background var(--t-fast) var(--ease);
}
.dice-row:hover { background: var(--vtt-elevated-a72); }
.dice-row-glyph {
  width: 24px; height: 24px;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--vtt-text-muted);
  flex-shrink: 0;
}
.dice-row-glyph svg { width: 16px; height: 16px; }
.dice-row-body { min-width: 0; }
.dice-row-meta {
  display: flex; gap: 8px; align-items: center;
  font-family: var(--font-mono); font-size: 10px;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--vtt-text-muted);
  margin-bottom: 2px;
  min-width: 0;
  white-space: nowrap;
}
.dice-row-meta b { color: var(--vtt-accent-deep); font-weight: 500; flex-shrink: 0; }
/* The weapon gives way first, its dot with it: who rolled is what the row is read for, and the tooltip names the weapon. */
.dice-row-meta-secondary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  min-width: 0;
  flex-shrink: 1000;
}
.dice-row-meta-weapon {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.dice-row-meta-author {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex-shrink: 1;
}
.dice-row-meta-time { flex-shrink: 0; white-space: nowrap; }
.dice-row-meta .dot {
  width: 3px; height: 3px; border-radius: var(--r-pill);
  background: var(--vtt-text-muted); opacity: 0.6;
  flex-shrink: 0;
}
.dice-row-formula {
  font-family: var(--font-serif);
  font-size: 14px;
  color: var(--vtt-text-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dice-row-formula .f-expr { color: var(--vtt-text-primary); font-weight: 500; }
.dice-row-formula .f-rolls { color: var(--vtt-text-muted); font-style: italic; margin: 0 4px; }
.dice-row-formula .f-rolls em { color: var(--vtt-text-secondary); font-style: normal; }
.dice-row-formula .f-alt {
  color: var(--vtt-text-muted);
  font-style: italic;
  margin-left: 4px;
  font-size: 12px;
}
.dice-row-result {
  min-width: 40px;
  height: 40px; padding: 0 8px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--vtt-sunken-a45);
  border-radius: var(--r-md);
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  line-height: 1;
  flex-shrink: 0;
}
.dice-row.is-crit {
  background: linear-gradient(to right, var(--vtt-gold-a20), var(--vtt-elevated-a55) 60%);
  box-shadow: inset 0 0 0 1px var(--vtt-accent-a25);
}
.dice-row.is-crit .dice-row-result {
  background: var(--vtt-accent);
  color: var(--vtt-bg-base);
  box-shadow: 0 0 14px var(--vtt-accent-a35);
}
.dice-row.is-crit .dice-row-glyph { color: var(--vtt-accent); }
.dice-row.is-success {
  outline: 1px solid var(--vtt-accent-a25);
  outline-offset: -1px;
}
.dice-row.is-success .dice-row-result {
  color: var(--vtt-accent);
}
.dice-row.is-success .dice-row-glyph { color: var(--vtt-accent); opacity: 0.85; }
.dice-row.is-fail { background: var(--vtt-danger-a18); }
.dice-row.is-fail .dice-row-result {
  color: var(--vtt-danger-bright);
  background: var(--vtt-danger-a18);
}
.dice-row.is-fail .dice-row-glyph { color: var(--vtt-danger-bright); opacity: 0.75; }
.dice-row.is-damage .dice-row-glyph { color: var(--vtt-danger-bright); }
.dice-row.is-advantage .dice-row-glyph { color: var(--vtt-accent); }
.dice-row.is-advantage .dice-row-meta b { color: var(--vtt-accent); }
.dice-row.is-disadvantage .dice-row-glyph { color: var(--vtt-warning, var(--vtt-danger-bright)); }
.dice-row.is-disadvantage .dice-row-meta b { color: var(--vtt-warning, var(--vtt-danger-bright)); }
.dice-row.is-fresh { animation: dice-row-fresh 1600ms var(--ease); }
.dice-row.is-applicable {
  cursor: pointer;
  box-shadow: inset 0 0 0 1px var(--vtt-accent-a45);
}
.dice-row.is-applicable:hover { background: var(--vtt-accent-a18); }
.dice-row.is-applicable:focus-visible { outline: 2px solid var(--vtt-accent); outline-offset: 2px; }
.dice-row-go {
  grid-column: 1 / -1;
  display: flex;
  gap: 6px;
  min-width: 0;
  margin-top: 6px;
  font-size: 12px;
  color: var(--vtt-accent);
}
.dice-row-hits {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 6px;
  padding-top: 5px;
  border-top: 1px dashed var(--vtt-border-strong);
}
.dice-row-hit {
  display: flex;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  color: var(--vtt-text-secondary);
}
.dice-row-hit em {
  flex-shrink: 0;
  font-style: normal;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--vtt-danger-bright);
}
</style>
