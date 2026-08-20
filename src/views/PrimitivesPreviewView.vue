<script setup lang="ts">
import { ref } from 'vue'

import StatChip from '@/components/ui/StatChip.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import StatusChipTrio from '@/components/ui/StatusChipTrio.vue'
import HpBar from '@/components/ui/HpBar.vue'
import XpBar from '@/components/ui/XpBar.vue'
import SkillChip from '@/components/ui/SkillChip.vue'
import AbilityCard from '@/components/ui/AbilityCard.vue'
import Button from '@/components/ui/Button.vue'
import Stepper from '@/components/ui/Stepper.vue'
import SegmentedFilter from '@/components/ui/SegmentedFilter.vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import TabBar from '@/components/ui/TabBar.vue'

import IconDice from '@/components/ui/icons/IconDice.vue'
import IconHeart from '@/components/ui/icons/IconHeart.vue'
import IconBag from '@/components/ui/icons/IconBag.vue'
import IconFlask from '@/components/ui/icons/IconFlask.vue'
import IconStar from '@/components/ui/icons/IconStar.vue'
import IconPlus from '@/components/ui/icons/IconPlus.vue'
import IconLock from '@/components/ui/icons/IconLock.vue'

import { createLogger } from '@/utils/logger'

// Local inline icons (sword, coin) — not part of the icon library yet
const statStr = ref(1)
const editingStr = ref(false)

const skill1 = ref<'default' | 'selected'>('default')
const skill2 = ref<'default' | 'selected'>('selected')

const abilitySelected = ref(false)

const stepperValue = ref(3)
const filterValue = ref('all')
const bottomOpen = ref(false)
const tabTop = ref('main')
const tabBottom = ref('main')

const xpCurrent = ref(28)
const xpReady = ref(36)
const xpCap = ref(100)

const log = createLogger('preview').debug
</script>

<template>
  <div class="preview-page">
    <header class="preview-head">
      <p class="eyebrow">Step 3 · dev preview</p>
      <h1 class="preview-title">UI Primitives</h1>
      <p class="preview-lead">
        Preview of every VTT design atom. The <code>/_preview</code> route is temporary
        and gets removed in step 13 (Cleanup).
      </p>
    </header>

    <!-- ================= StatChip ================= -->
    <section class="section">
      <h2 class="section-title">StatChip</h2>

      <div class="stage">
        <p class="stage-title">Variants</p>
        <div class="row">
          <StatChip label="STR" :value="1" dice="2d6" state="positive" />
          <StatChip label="DEX" :value="0" dice="2d6" state="zero" />
          <StatChip label="CON" :value="3" dice="2d6" state="high" />
          <StatChip label="INT" :value="2" dice="2d6" variant="row" />
          <StatChip label="WIS" :value="1" variant="hero" roll-hint="Roll" />
          <StatChip label="CHA" :value="0" variant="minimal" />
        </div>
      </div>

      <div class="stage">
        <p class="stage-title">Sizes</p>
        <div class="row">
          <StatChip label="STR" :value="1" size="sm" />
          <StatChip label="STR" :value="1" size="base" dice="2d6" />
          <StatChip label="STR" :value="1" size="lg" dice="2d6" />
        </div>
      </div>

      <div class="stage">
        <p class="stage-title">With modifier</p>
        <div class="row">
          <StatChip label="CON" :value="3" :mod="2" :base="1" dice="2d6" />
          <StatChip label="DEX" :value="-1" :mod="-2" :base="1" dice="2d6" />
        </div>
      </div>

      <div class="stage">
        <p class="stage-title">Editing mode</p>
        <div class="row">
          <StatChip
            label="STR"
            v-model:value="statStr"
            :editing="editingStr"
            editable
            @toggle-edit="editingStr = !editingStr"
          />
          <Button variant="ghost" size="sm" @click="editingStr = !editingStr">
            {{ editingStr ? 'Close' : 'Edit' }}
          </Button>
          <span class="value-hint">value: {{ statStr }}</span>
        </div>
      </div>

      <div class="stage">
        <p class="stage-title">With popover (tap)</p>
        <div class="row">
          <StatChip
            label="STR"
            :value="1"
            dice="2d6"
            has-popover
            @open="(o) => log('statchip popover', o)"
          >
            <template #popover>
              <div class="pop-head">
                <span class="pop-title">Strength</span>
                <span class="pop-sub">2d6 + 1</span>
              </div>
              <button type="button" class="pop-hero" @click="log('roll 2d6+1')">
                Roll 2d6 + 1
              </button>
              <div class="pop-divider" />
              <div class="pop-section-head">
                <span class="pop-sub">Effects</span>
              </div>
              <div class="pop-effect">
                <span class="pop-effect-delta is-buff">+1</span>
                <div class="pop-effect-name">
                  Potion of strength
                  <span class="pop-effect-meta">2 turns</span>
                </div>
                <button type="button" class="pop-effect-remove" aria-label="Remove">×</button>
              </div>
              <div class="pop-actions">
                <button type="button" class="pop-btn" @click="log('add effect')">+ effect</button>
                <button type="button" class="pop-btn" @click="log('edit base')">Fix base</button>
              </div>
            </template>
          </StatChip>
        </div>
      </div>
    </section>

    <!-- ================= StatusChip ================= -->
    <section class="section">
      <h2 class="section-title">StatusChip</h2>

      <div class="stage">
        <p class="stage-title">Kinds</p>
        <div class="row">
          <StatusChip kind="damage" label="Damage" value="d6" meta="weapon">
            <template #symbol>
              <svg viewBox="0 0 24 24"><path d="M3 21l7-7M10 14l4-4m-4 4l-3-3m13-8l3 3-9 9-3-3z"/></svg>
            </template>
          </StatusChip>
          <StatusChip kind="armor" label="Armor" value="3" meta="full + shield">
            <template #symbol>
              <svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 4.5-3 8-8 10-5-2-8-5.5-8-10V6l8-3z"/></svg>
            </template>
          </StatusChip>
          <StatusChip kind="coin" label="Coins" value="450" meta="purse">
            <template #symbol>
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 7v10M9 10h6M9 14h6"/></svg>
            </template>
          </StatusChip>
          <StatusChip kind="dim" label="Damage" value="—" meta="no weapon" />
        </div>
      </div>

      <div class="stage">
        <p class="stage-title">Sizes</p>
        <div class="row">
          <StatusChip kind="damage" label="Damage" value="d6" size="sm" />
          <StatusChip kind="damage" label="Damage" value="d6" meta="weapon" />
          <StatusChip kind="damage" label="Damage" value="d6+1" meta="weapon + strength" size="lg" />
        </div>
      </div>

      <div class="stage">
        <p class="stage-title">With modifier</p>
        <div class="row">
          <StatusChip kind="damage" label="Damage" value="d6" mod="+d2" meta="weapon" />
          <StatusChip kind="armor" label="Armor" value="2" mod="−1" meta="no shield" />
        </div>
      </div>

      <div class="stage">
        <p class="stage-title">Trio (framed)</p>
        <StatusChipTrio>
          <StatusChip kind="damage" label="Damage" value="d6+1" has-popover>
            <template #symbol>
              <svg viewBox="0 0 24 24"><path d="M3 21l7-7M10 14l4-4m-4 4l-3-3m13-8l3 3-9 9-3-3z"/></svg>
            </template>
            <template #popover>
              <div class="pop-head">
                <span class="pop-title">Damage</span>
                <span class="pop-sub">breakdown</span>
              </div>
              <div class="breakdown">
                <div class="breakdown-row">
                  <div>
                    <div class="br-name">Sword</div>
                    <div class="br-source">weapon</div>
                  </div>
                  <div class="br-value">d6</div>
                </div>
                <div class="breakdown-row">
                  <div>
                    <div class="br-name">Strength</div>
                    <div class="br-source">stat</div>
                  </div>
                  <div class="br-value is-buff">+1</div>
                </div>
              </div>
              <div class="breakdown-total">
                <span class="bt-label">Total</span>
                <span class="bt-value">d6+1</span>
              </div>
              <button type="button" class="pop-hero-roll" @click="log('roll damage')">
                Roll d6+1
              </button>
            </template>
          </StatusChip>
          <StatusChip kind="armor" label="Armor" value="3" has-popover>
            <template #symbol>
              <svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 4.5-3 8-8 10-5-2-8-5.5-8-10V6l8-3z"/></svg>
            </template>
            <template #popover>
              <div class="pop-head">
                <span class="pop-title">Armor</span>
              </div>
              <div class="breakdown">
                <div class="breakdown-row">
                  <div><div class="br-name">Full armor</div></div>
                  <div class="br-value">+2</div>
                </div>
                <div class="breakdown-row">
                  <div><div class="br-name">Shield</div></div>
                  <div class="br-value">+1</div>
                </div>
              </div>
              <div class="breakdown-total">
                <span class="bt-label">Total</span>
                <span class="bt-value">3</span>
              </div>
            </template>
          </StatusChip>
          <StatusChip kind="coin" label="Coins" value="450" />
        </StatusChipTrio>
      </div>

      <div class="stage">
        <p class="stage-title">Trio (no-frame)</p>
        <StatusChipTrio no-frame>
          <StatusChip kind="damage" label="Damage" value="d6" size="sm" />
          <StatusChip kind="armor" label="Armor" value="3" size="sm" />
          <StatusChip kind="coin" label="Coins" value="450" size="sm" />
        </StatusChipTrio>
      </div>
    </section>

    <!-- ================= HpBar ================= -->
    <section class="section">
      <h2 class="section-title">HpBar</h2>

      <div class="stage">
        <p class="stage-title">States</p>
        <div class="stack">
          <HpBar :current="8" :max="8" @apply-damage="(v) => log('damage', v)" @heal="(v) => log('heal', v)" />
          <HpBar :current="6" :max="8" :temp="2" :effects="[{ label: 'Blessing', kind: 'hot', meta: '+1/turn' }]" />
          <HpBar :current="4" :max="8" :effects="[{ label: 'Poison', kind: 'dot', meta: '−1/turn' }, { label: 'Weakened', kind: 'warn' }]" />
          <HpBar :current="2" :max="8" />
          <HpBar :current="0" :max="8" />
        </div>
      </div>

      <div class="stage">
        <p class="stage-title">Sizes</p>
        <div class="stack">
          <HpBar :current="5" :max="8" size="sm" />
          <HpBar :current="5" :max="8" size="base" />
          <HpBar :current="5" :max="8" size="lg" />
        </div>
      </div>
    </section>

    <!-- ================= XpBar ================= -->
    <section class="section">
      <h2 class="section-title">XpBar</h2>
      <div class="stage">
        <p class="stage-title">States</p>
        <div class="stack">
          <XpBar v-model:current="xpCurrent" :max="50" hint="to lvl 2 · 22" @level-up="log('levelUp')" />
          <XpBar :current="45" :max="50" hint="almost!" />
          <XpBar
            v-model:current="xpReady"
            :max="36"
            is-ready
            hint="ready!"
            @level-up="log('levelUp ready')"
          />
          <XpBar :current="xpCap" :max="100" is-cap hint="max lvl" />
        </div>
      </div>
    </section>

    <!-- ================= SkillChip ================= -->
    <section class="section">
      <h2 class="section-title">SkillChip</h2>

      <div class="stage">
        <p class="stage-title">States (display)</p>
        <div class="row wrap">
          <SkillChip label="Athletics" />
          <SkillChip label="Stealth" state="auto" :icon="IconLock" />
          <SkillChip label="Thievery" state="selected" />
          <SkillChip label="Navigation" state="locked" />
          <SkillChip label="More" mode="add" :icon="IconPlus" />
        </div>
      </div>

      <div class="stage">
        <p class="stage-title">Picker multi</p>
        <div class="row wrap">
          <SkillChip label="Fire magic" mode="pick-multi" :state="skill1" @toggle="skill1 = skill1 === 'selected' ? 'default' : 'selected'" />
          <SkillChip label="Shadow magic" mode="pick-multi" :state="skill2" @toggle="skill2 = skill2 === 'selected' ? 'default' : 'selected'" />
          <SkillChip label="Arcane magic" mode="pick-multi" />
        </div>
      </div>

      <div class="stage">
        <p class="stage-title">Picker single</p>
        <div class="row wrap">
          <SkillChip label="Sword" mode="pick-single" state="selected" />
          <SkillChip label="Axe" mode="pick-single" />
          <SkillChip label="Spear" mode="pick-single" />
        </div>
      </div>
    </section>

    <!-- ================= AbilityCard ================= -->
    <section class="section">
      <h2 class="section-title">AbilityCard</h2>

      <div class="stage">
        <p class="stage-title">Default (display)</p>
        <div class="stack narrow">
          <AbilityCard title="Fighting style" level="lvl 1">
            <p class="ability-body-text">Pick a fighting style: two-handed, shield + weapon, or ranged.</p>
            <template #actions>
              <button type="button" class="ability-btn is-hero">Roll</button>
              <button type="button" class="ability-btn">Edit</button>
            </template>
          </AbilityCard>

          <AbilityCard title="Second attack" level="lvl 3" :state="'selected'">
            <p class="ability-body-text">After a successful attack in combat you may attack again.</p>
          </AbilityCard>

          <AbilityCard title="Aura of protection" level="lvl 5" :state="'locked'">
            <p class="ability-body-text">Not available at this level.</p>
          </AbilityCard>
        </div>
      </div>

      <div class="stage">
        <p class="stage-title">Picker single</p>
        <div class="stack narrow">
          <AbilityCard
            title="Lightning strike"
            level="0"
            mode="pick-single"
            :state="abilitySelected ? 'selected' : 'default'"
            @toggle="abilitySelected = !abilitySelected"
          >
            <p class="ability-body-text">Once per fight — +d6 damage on the next attack.</p>
          </AbilityCard>
          <AbilityCard title="Shield stance" level="0" mode="pick-single">
            <p class="ability-body-text">While a shield is held — armor +1.</p>
          </AbilityCard>
        </div>
      </div>

      <div class="stage">
        <p class="stage-title">Variant reference</p>
        <div class="stack narrow">
          <AbilityCard variant="reference" title="Stealth">
            <p class="ability-body-text">A short excerpt from the reference.</p>
          </AbilityCard>
          <AbilityCard variant="reference" title="Thievery">
            <p class="ability-body-text">Another entry in reference mode.</p>
          </AbilityCard>
        </div>
      </div>
    </section>

    <!-- ================= Button ================= -->
    <section class="section">
      <h2 class="section-title">Button</h2>
      <div class="stage">
        <p class="stage-title">Variants</p>
        <div class="row wrap">
          <Button variant="primary">Primary</Button>
          <Button variant="hero">Hero</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger-ghost" :icon-left="IconPlus">Delete</Button>
          <Button variant="icon" :icon-left="IconPlus" aria-label="Add" />
        </div>
      </div>
      <div class="stage">
        <p class="stage-title">Sizes</p>
        <div class="row">
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" size="base">Base</Button>
          <Button variant="primary" size="lg">Large</Button>
        </div>
      </div>
      <div class="stage">
        <p class="stage-title">With icons</p>
        <div class="row">
          <Button variant="hero" :icon-left="IconDice">Roll</Button>
          <Button variant="ghost" :icon-left="IconHeart">Heal</Button>
          <Button variant="primary" :icon-right="IconStar">Favorite</Button>
        </div>
      </div>
    </section>

    <!-- ================= Stepper ================= -->
    <section class="section">
      <h2 class="section-title">Stepper</h2>
      <div class="stage">
        <p class="stage-title">Basic (min=0, max=20)</p>
        <div class="row">
          <Stepper v-model="stepperValue" :min="0" :max="20" />
          <span class="value-hint">value: {{ stepperValue }}</span>
        </div>
      </div>
      <div class="stage">
        <p class="stage-title">Sz sm</p>
        <div class="row">
          <Stepper v-model="stepperValue" size="sm" :min="0" />
        </div>
      </div>
    </section>

    <!-- ================= SegmentedFilter ================= -->
    <section class="section">
      <h2 class="section-title">SegmentedFilter</h2>
      <div class="stage">
        <SegmentedFilter
          v-model="filterValue"
          :options="[
            { value: 'all', label: 'All' },
            { value: 'weapon', label: 'Weapons' },
            { value: 'armor', label: 'Armor' },
          ]"
        />
        <p class="value-hint">selected: {{ filterValue }}</p>
      </div>
    </section>

    <!-- ================= BottomSheet ================= -->
    <section class="section">
      <h2 class="section-title">BottomSheet</h2>
      <div class="stage">
        <Button variant="hero" @click="bottomOpen = true">Open catalog</Button>
      </div>
      <BottomSheet v-model:open="bottomOpen" title="Catalog — placeholder">
        <div class="sheet-search">
          <input class="sheet-search-input" type="text" placeholder="Search: sword, armor, bandage…" />
        </div>
        <SegmentedFilter
          v-model="filterValue"
          :options="[
            { value: 'all', label: 'All' },
            { value: 'weapon', label: 'Weapons' },
            { value: 'armor', label: 'Armor' },
          ]"
        />
        <ul class="sheet-list">
          <li v-for="n in 6" :key="n" class="sheet-item">
            <span class="sheet-item-name">Item #{{ n }}</span>
            <span class="sheet-item-price">{{ n * 25 }} c.</span>
          </li>
        </ul>
        <template #footer>
          <Button variant="ghost" @click="bottomOpen = false">Close</Button>
          <Button variant="hero">Buy selected</Button>
        </template>
      </BottomSheet>
    </section>

    <!-- ================= TabBar ================= -->
    <section class="section">
      <h2 class="section-title">TabBar</h2>
      <div class="stage">
        <p class="stage-title">Variant top</p>
        <TabBar
          v-model="tabTop"
          :tabs="[
            { value: 'main', label: 'Main' },
            { value: 'inv', label: 'Inventory', badge: 12 },
            { value: 'magic', label: 'Magic', icon: IconFlask, dot: 'accent' },
            { value: 'notes', label: 'Notes' },
            { value: 'locked', label: 'Level up', disabled: true },
          ]"
        />
      </div>
      <div class="stage">
        <p class="stage-title">Variant bottom</p>
        <div class="bottom-preview">
          <TabBar
            v-model="tabBottom"
            variant="bottom"
            :tabs="[
              { value: 'main', label: 'Main', icon: IconStar },
              { value: 'inv', label: 'Inventory', icon: IconBag, badge: 3 },
              { value: 'magic', label: 'Magic', icon: IconFlask, dot: 'accent' },
              { value: 'notes', label: 'Notes', icon: IconHeart, dot: 'danger' },
            ]"
          />
        </div>
      </div>
    </section>

    <footer class="preview-foot">
      <p>Dev-only preview. Removed in step 13, Cleanup.</p>
    </footer>
  </div>
</template>

<style scoped>
.preview-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 40px 24px 80px;
  font-family: var(--font-sans);
  color: var(--vtt-text-primary);
}

.preview-head { margin-bottom: 40px; }
.eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
  margin-bottom: 8px;
}
.preview-title {
  font-family: var(--font-serif);
  font-size: 40px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  letter-spacing: 0.01em;
  margin-bottom: 8px;
}
.preview-lead {
  color: var(--vtt-text-secondary);
  font-size: 14px;
  line-height: 1.6;
  max-width: 680px;
}
.preview-lead code {
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 1px 6px;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-xs);
  color: var(--vtt-accent-soft);
}

.section {
  padding: 24px 0;
  border-top: 1px solid var(--vtt-border-subtle);
}
.section-title {
  font-family: var(--font-serif);
  font-size: 22px;
  color: var(--vtt-accent);
  margin-bottom: 16px;
  letter-spacing: 0.01em;
}

.stage { margin-bottom: 22px; }
.stage-title {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
  margin-bottom: 10px;
}

.row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: nowrap;
  overflow-x: auto;
  padding: 8px 0;
}
.row.wrap { flex-wrap: wrap; }
.stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0;
}
.stack.narrow { max-width: 520px; }

.value-hint {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--vtt-text-muted);
}

.ability-body-text {
  margin: 0 0 10px;
  font-size: 13px;
  line-height: 1.6;
}

.ability-btn {
  padding: 7px 14px;
  background: transparent;
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  color: var(--vtt-text-secondary);
  font-family: var(--font-sans);
  font-size: 12px;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all var(--t-fast) var(--ease);
}
.ability-btn:hover {
  border-color: var(--vtt-border-strong);
  color: var(--vtt-accent-soft);
}
.ability-btn.is-hero {
  background: #A6833E;
  border-color: #8C6A3A;
  color: #1a1205;
  font-weight: 600;
  letter-spacing: 0.02em;
  filter: drop-shadow(0 0 10px rgba(140, 106, 58, 0.35));
}
.ability-btn.is-hero:hover {
  background: #BF9A4C;
  border-color: #A6833E;
  filter: drop-shadow(0 0 14px rgba(140, 106, 58, 0.5));
}

.sheet-search { margin-bottom: 10px; }
.sheet-search-input {
  width: 100%;
  padding: 9px 12px;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  color: var(--vtt-text-primary);
  font-family: var(--font-sans);
  font-size: 13px;
  outline: none;
}
.sheet-search-input::placeholder { color: var(--vtt-text-muted); }
.sheet-search-input:focus {
  border-color: var(--vtt-border-gold);
  box-shadow: 0 0 0 2px rgba(140, 106, 58, 0.15);
}

.sheet-list {
  list-style: none;
  padding: 12px 0 0;
  margin: 0;
}
.sheet-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-top: 1px solid var(--vtt-border-subtle);
  font-size: 13px;
}
.sheet-item:first-child { border-top: 0; }
.sheet-item-name { color: var(--vtt-text-primary); }
.sheet-item-price {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--vtt-accent);
}

.bottom-preview {
  background: var(--vtt-bg-base);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-md);
  overflow: hidden;
}

.preview-foot {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--vtt-border-subtle);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--vtt-text-muted);
  letter-spacing: 0.08em;
}
</style>
