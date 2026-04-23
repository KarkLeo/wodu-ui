# Миграция фронтенда на новый дизайн-систему (VTT)

## Context

Приложение — рабочий прототип character sheet для RPG World of Dungeons. Доменный слой и стейт (`src/domain/`, `src/stores/`, `src/composables/use{ActiveCharacter,Inventory,LevelUp}.ts`) стабильны и менять их задача не ставит. UI собран на plain CSS + scoped `<style>` с единственным глобальным файлом `src/assets/main.css` (одна тёмная палитра `--color-*`, шрифт Commissioner, радиус 2px, без библиотеки иконок).

В `docs/design/` лежит набор из 14 HTML-макетов, формирующих новый визуальный язык: палитра `--vtt-*` (4 уровня фона, золото `#D4A857`, ягодная опасность `#792B3B`, glow-эффекты), шрифты Spectral + Montserrat, радиусы 4–28px, многослойные тени, keyframe-анимации, новая компонентная иерархия (stat-chip как основной атом, status-header со sticky-коллапсом, unified dice-drawer, spirit/ritual-cards, 5-шаговый level-up и др.). ~410 inline SVG иконок уже нарисованы прямо в HTML-макетах со `stroke="currentColor"` — готовы к переносу.

Пользователь выбрал big-bang-миграцию **на отдельной ветке**: текущий прототип остаётся в `master`, полная переработка идёт параллельно, мерж — один коммит после готовности. Стратегический принцип: **дизайн — источник истины**, но в деталях допустимы отклонения; «стрёмные места» помечены в плане как точки консультации с пользователем.

## Ветка и общий подход

- Ветка: `redesign/vtt` от текущего `master`.
- Внутри ветки — последовательные шаги-коммиты (см. раздел «Шаги»), каждый шаг работоспособен в dev-режиме на своём участке. Гарантий «master не ломается» на ветке нет, но шаги мелкие — откат локален.
- Роутинг, доменная модель, стор, composables бизнес-логики — **не трогаем**. Редизайн затрагивает только слой представления: `src/views/`, `src/features/*/`, `src/components/`, `src/assets/main.css`, `src/App.vue`, `src/main.ts`, `index.html`.
- Старые `--color-*` удаляются полностью — без слоя алиасов (big-bang).
- Иконки вырезаются из HTML-макетов и оформляются как Vue-компоненты в `src/components/ui/icons/`. Каждая иконка — отдельный файл (`IconDice.vue`, `IconShield.vue`, …) с inline SVG и `stroke="currentColor"`. Библиотека не подключается.

## Шаги

### Шаг 1 — Фундамент: токены, шрифты, утилити-классы

- **Переписать** `src/assets/main.css`: полностью заменить `:root` на `--vtt-*` блок из `docs/design/palette.html` (цвета, шрифты, радиусы, тени, glow, motion, спейсинг `--s-1..--s-7`). Удалить `@import` Commissioner.
- **Подключить шрифты** через `@fontsource/spectral` + `@fontsource/montserrat` (`npm i @fontsource/spectral @fontsource/montserrat`), импорт весов 400/500/600 в `src/main.ts`. Self-host надёжнее для PWA и офлайн, чем Google Fonts CDN.
- **Утилити-классы** в `main.css`: `.eyebrow`, `.label-mono`, `.h-serif`, `.h-display`, `.divider-gold`, `body` background-gradient из `palette.html`. Это оправдано — пресетов мало, вынесение в компоненты избыточно.
- **Keyframes**: `tab-dot-pulse`, `dice-row-fresh`, `qs-pulse`, `lu-die-roll`, `crit-glow`. Все они — низкоуровневые, живут в `main.css`. Обернуть общим `@media (prefers-reduced-motion: reduce) { * { animation: none !important } }`.
- Проверка: `npm run dev`, страницы выглядят сломанными по цветам (это ожидаемо — старые классы ссылаются на удалённые переменные), но приложение компилируется и рендерится.

### Шаг 2 — Библиотека иконок

- Создать `src/components/ui/icons/` и Vue-компонент на каждую иконку, извлечённую из HTML-макетов: меч, щит, монета, шестерёнка, кубик d6, свиток, череп, сердце, крест (удалить/закрыть), галочка, стрелка-назад, карандаш-редактирование, плюс/минус, i-info, огонь/молния/камень/тайна/страх/тень (сферы магии), корона/глаз (уровень-ап), компас (навигация), книга (ритуалы).
- Один общий обёртывающий компонент `src/components/ui/Icon.vue` не обязателен — по макетам SVG вставляются как самостоятельные компоненты с props `size`, `stroke-width`.
- **Точка консультации**: если каких-то иконок не хватит (например, «броня-light/full» как отдельные глифы), решаем по месту — дорисовываем в макете или берём аналог из `tabler-icons` временно.

### Шаг 3 — Примитивы (атомы UI)

Все новые компоненты создаются в `src/components/ui/`. Существующие (`InfoPopover.vue` и три breakdown-поповера) **не удаляем на этом шаге** — панели пока на них ссылаются.

- `StatChip.vue` — базовый атом, варианты `v-row` / `v-hero` / `v-minimal`, slot для popover, поддержка `mod-badge` (+/-). Режимы `view` / `editing` (stepper). **Точка консультации**: как соотносятся inline-edit stepper и текущие breakdown-поповеры — принимаем дизайн как спецификацию (stepper становится основным способом правки), breakdown-контент переносим в slot popover-а внутри StatChip; обсудим живьём, когда дойдём до конкретных экранов.
- `StatusChip.vue` — младший чип (kinds: damage / armor / coin), размеры `sc-sm` / `sc-base` / `sc-lg`, поддержка trio с разделителем.
- `HpBar.vue`, `XpBar.vue` — grid label/track/value/ctrls, gradient fill, inset-shadow.
- `SkillChip.vue` — pill, состояния `is-auto` / `is-selected` / `is-locked`.
- `AbilityCard.vue` — mode `pick` (checkbox/radio) / `reference` (плоский), slots для заголовка/описания/actions.
- `Button.vue` — варианты `hero` (gold glow), `ghost`, `icon`, `roll`, `danger`.
- `Stepper.vue` — inline —/число/+ для правки чисел.
- `SegmentedFilter.vue` — переключатель (All · Weapons · Armor).
- `BottomSheet.vue` — обёртка над Reka UI `Dialog`, стили по макету.
- `TabBar.vue` — pill-табы с градиент-underline и dot-pulse индикаторами, вариант `variant-bottom` для mobile.

Каждый примитив реализуется по соответствующему `docs/design/components/*.html`, классы/стили — 1:1 с макета, Vue-логика минимальна (props + emits). Scoped `<style>` в каждом файле, плюс нескоупленная секция там, где контент портируется (`PopoverPortal` у Reka UI).

### Шаг 4 — AppShell и StatusHeader

- Создать `src/components/AppShell.vue` по `docs/design/components/app-shell.html`: sticky status-header (z:3) + sticky tab-bar (z:2) + scroll content + FAB кубика (z:5). Slots: `header`, `tabs`, default (content), `fab`.
- Создать `src/features/in-game/components/StatusHeader.vue` по `status-header.html` + `app-shell.html`: имя/класс/HP/XP + trio (Урон/Броня/Монеты), back-кнопка, истинное имя. Использует `useActiveCharacter`. Compact-collapse на скролле — реализуем через `IntersectionObserver` на sentinel-div (плавно на iOS, без throttle).
- Переписать `src/features/in-game/InGameView.vue` — рендерит `AppShell` + `StatusHeader` + `TabBar` + `<router-view/>`-подобный слот по активному табу.
- **Удалить** `src/features/in-game/components/HeaderStrip.vue` — полностью замещён `StatusHeader.vue`.
- **Точка консультации**: tab-bar — верхний (как сейчас) или нижний `variant-bottom` на mobile? Макет поддерживает оба. Решение — при первом запуске шага.

### Шаг 5 — Табы «Основное»: Stats / Skills / Abilities

- `StatsPanel.vue` — 3×2 сетка `StatChip` с breakdown-popover и inline-edit stepper. Кнопка «бросить 2d6» в popover интегрируется с `useDiceRoller`.
- `SkillsPanel.vue` — список `SkillChip` (auto/selected/locked).
- `AbilitiesPanel.vue` — список `AbilityCard` в режиме `reference`.
- **Удалить старые** реализации этих панелей (их текущие пути — `src/features/in-game/components/*Panel.vue`, проверить точное имя при исполнении).
- На этом шаге **удалить** `HpBreakdownPopover.vue`, `DamageBreakdownPopover.vue`, `ArmorBreakdownPopover.vue`, `InfoPopover.vue` — их функциональность переезжает внутрь `StatChip` / `StatusChip`.

### Шаг 6 — Таб «Инвентарь»

- Переписать `InventoryPanel.vue` по `docs/design/components/inventory.html`:
  - `ItemIcon` (состояния: equipped / consumable), `InvItem`-ряды, `ItemStatChip`, `CoinBar`, `InvSection` c empty-state.
  - Каталог через `BottomSheet` + search + `SegmentedFilter` + список с buy-кнопками.
  - Inline-edit предметов (кастомных).
- `useInventory` не трогаем.
- **Точка консультации**: в дизайне каталог — полноэкранный `BottomSheet`; сейчас каталог в прототипе вписан в панель. Выбираем дизайн, обсудим переходы.

### Шаг 7 — Таб «Магия»

- Переписать `MagicPanel.vue` по `docs/design/components/magic.html`:
  - `SphereChip` (огонь/тень/камень/молния/тайны/страх, состояние `is-empty`).
  - `SpiritCard` (редактируемая: имя, появление, сферы). Состояния `is-empty`, `is-editing`.
  - `RitualCard` с tap-to-expand.
  - `CantripChip` (read-only, italic serif).
  - `QuicksilverCounter` — 62×62, состояние `is-overdose` с `qs-pulse`.
- **Точка консультации**: механика Quicksilver overdose в коде уже есть (`src/domain/`), UI-отображение из макета расширено — проверим, что визуальные состояния совпадают с реальными переходами.

### Шаг 8 — Таб «Заметки»

- `NotesPanel.vue` — минимальная правка: textarea в новой типографике, serif-заголовок.

### Шаг 9 — Character creation

- Переписать `src/features/character-creation/CharacterCreationView.vue` и `steps/Step*.vue` по `docs/design/components/character-creation.html`:
  - Shell 720×720 (на mobile — full-screen), топбар с back/step/close, stepper (3 кликабельных кружка), content-scroll, footer с кнопками.
  - Underline-input'ы, 3×2 грид атрибутов (`cc-attr`) с 2d6-логом, 3 карточки классов, список абилок с radio/checkbox, навыки-чипы, HP-карточка крупным serif'ом.
  - Модальная danger-sheet для подтверждения удаления/сброса.

### Шаг 10 — Level-up

- Переписать `src/features/level-up/LevelUpView.vue` и его шаги по `docs/design/components/level-up.html`:
  - 5-шаговый wizard: атрибуты → абилки → навыки → HP-кубики → итог.
  - `LuDie` 56×56 (состояния `is-kept` / `is-discarded` / `is-rolling` с keyframe `lu-die-roll`).
  - `LuHpResult`, `LuSummary` со строками награды и `lu-sum-pill`.
  - `sh-alert` header с gold-border.
- `useLevelUp` composable сохраняется.

### Шаг 11 — Dice drawer (unified log)

- Создать `src/components/DiceDrawer.vue` по `docs/design/components/dice-drawer.html`:
  - 340×640 sticky справа, backdrop-filter blur.
  - `DiceRow` с состояниями `is-crit` (glow золотом), `is-fail` (красный, dim).
  - `LogRow` — 12+ типов (HP damage/heal, XP, level-up, inventory, magic) с цветовой кодировкой border-left.
  - Segmented filter (Броски · Изменения · Всё), quick-rolls grid, formula-input + hero-кнопка «Бросить».
- **View-model composable** `src/composables/useUnifiedLog.ts` — мержит существующие `rollHistory` и `changeLog` по timestamp. Домен не трогаем.
- **Удалить** `DicePanel.vue`. `DiceOverlay.vue` (canvas `DiceBox`) остаётся — это поверхностный слой над всем UI, стили минимальны.
- **Rail-режим (48px свёрнутый)** — **откладываем** в отдельную задачу после v1, помечено в макете, но не в первой итерации. Пометка: в шаге реализуем только полный drawer + кнопку закрытия.

### Шаг 12 — Character list

- Переписать `src/features/character-list/CharacterListView.vue` в той же палитре и типографике. В макетах отдельный спек на этот экран не выделен — используем общие примитивы (карточки как `AbilityCard` в reference-режиме, hero-кнопка «Создать»).
- **Точка консультации**: как выглядят тайлы персонажей — предложу черновик на шаге, согласуем.

### Шаг 13 — Cleanup

- Удалить остатки старых стилей и emoji по `grep -r '🎲\|ⓘ\|✶\|✕' src`.
- Удалить неиспользуемые компоненты (`HeaderStrip.vue`, `DicePanel.vue`, `InfoPopover.vue` и три breakdown-поповера — проверить отсутствие импортов).
- Переименовать любые оставшиеся `--color-*` в прямые `--vtt-*` (должно быть уже 0 упоминаний).
- `npm run build` — type-check + prod-сборка без ошибок.
- Ручная проверка на мобильном Safari: iOS-рубберy scroll header, backdrop-filter перф в stat-popover, touch-target для кнопок ≥ 44px.

### Шаг 14 (отложено, в этот план не входит)

- Desktop `game-layout.html` (3-колонный multi-character со scroll-snap центром) — **отдельная задача после мерджа v1**. Помечаем в `docs/ideas.md` новым пунктом.
- Dice-drawer rail-режим.

## Точки консультации (места, где дизайн и код расходятся)

1. **Шаг 3 / Шаг 5** — stat-chip inline-edit vs breakdown popover. Принято: breakdown-контент переезжает в slot внутри StatChip popover; inline-edit stepper — основной способ правки.
2. **Шаг 4** — tab-bar верхний vs нижний на mobile.
3. **Шаг 6** — UX каталога инвентаря (BottomSheet full-screen vs inline-panel).
4. **Шаг 7** — соответствие визуальных состояний Quicksilver реальным переходам в домене.
5. **Шаг 12** — визуальный язык тайлов в character list (макета нет).

Эти пункты не блокируют начало работы — решаются по мере подхода к соответствующему шагу.

## Критические файлы

**Правятся:**

- `/Users/karkleo/Documents/pro/character-sheet-v1/src/assets/main.css` — полная замена.
- `/Users/karkleo/Documents/pro/character-sheet-v1/src/main.ts` — добавление импорта шрифтов.
- `/Users/karkleo/Documents/pro/character-sheet-v1/src/App.vue` — если там есть layout-обёртка, совместимая с новым `AppShell`.
- `/Users/karkleo/Documents/pro/character-sheet-v1/src/features/in-game/InGameView.vue` — переход на `AppShell`.
- `/Users/karkleo/Documents/pro/character-sheet-v1/src/features/character-creation/CharacterCreationView.vue` + `steps/*`.
- `/Users/karkleo/Documents/pro/character-sheet-v1/src/features/level-up/LevelUpView.vue` + компоненты шагов.
- `/Users/karkleo/Documents/pro/character-sheet-v1/src/features/character-list/CharacterListView.vue`.
- `/Users/karkleo/Documents/pro/character-sheet-v1/src/features/in-game/components/*.vue` — все панели.
- `/Users/karkleo/Documents/pro/character-sheet-v1/package.json` — новые зависимости (`@fontsource/spectral`, `@fontsource/montserrat`).

**Удаляются:**

- `/Users/karkleo/Documents/pro/character-sheet-v1/src/features/in-game/components/HeaderStrip.vue`.
- `/Users/karkleo/Documents/pro/character-sheet-v1/src/components/ui/InfoPopover.vue`.
- `/Users/karkleo/Documents/pro/character-sheet-v1/src/components/ui/HpBreakdownPopover.vue`.
- `/Users/karkleo/Documents/pro/character-sheet-v1/src/components/ui/DamageBreakdownPopover.vue`.
- `/Users/karkleo/Documents/pro/character-sheet-v1/src/components/ui/ArmorBreakdownPopover.vue`.
- `src/components/DicePanel.vue` (точный путь уточнить при исполнении).

**Создаются:**

- `/Users/karkleo/Documents/pro/character-sheet-v1/src/components/AppShell.vue`.
- `/Users/karkleo/Documents/pro/character-sheet-v1/src/components/DiceDrawer.vue`.
- `/Users/karkleo/Documents/pro/character-sheet-v1/src/components/ui/{StatChip,StatusChip,HpBar,XpBar,SkillChip,AbilityCard,Button,Stepper,SegmentedFilter,BottomSheet,TabBar}.vue`.
- `/Users/karkleo/Documents/pro/character-sheet-v1/src/components/ui/icons/Icon*.vue` — ~25–35 штук.
- `/Users/karkleo/Documents/pro/character-sheet-v1/src/features/in-game/components/StatusHeader.vue`.
- `/Users/karkleo/Documents/pro/character-sheet-v1/src/composables/useUnifiedLog.ts`.

## Переиспользование существующего

- `src/composables/useActiveCharacter.ts`, `useInventory.ts`, `useLevelUp.ts`, `useDiceRoller.ts` — без изменений, но становятся единственным источником состояния для новых компонентов.
- `src/utils/derived.ts` — `totalArmor`, `damageFormula`, `hpBreakdownLines`, `damageBreakdownLines`, `armorBreakdownLines`, `isReadyToLevelUp`, `rollHitDice`, `statBonusFrom2d6` — всё используется новыми StatChip/StatusChip popover'ами и level-up шагами.
- `src/domain/` — commands + reducer без изменений.
- `src/stores/characters.ts`, `creation.ts` — без изменений.
- Reka UI (2.9.6) — базис для `BottomSheet`, popover-обёрток StatChip, диалогов удаления; a11y/focus-trap бесплатно.
- `src/services/DiceBoxService.ts` + `DiceOverlay.vue` — сохраняются как есть.
- `src/locales/ru.ts` — все новые строки проходят через `t()`, ключи `section.subsection.name` в camelCase; добавляются по мере появления новых UI-элементов (существующее правило из CLAUDE.md).

## Верификация

На каждом шаге:

1. `npm run dev` — приложение запускается, страница соответствующего шага визуально совпадает с макетом (допустимы согласованные отклонения).
2. `npm run build` — `vue-tsc` + Vite prod-сборка без ошибок.
3. Ручной smoke-test соответствующего флоу:
   - **Шаг 4–5**: открыть персонажа, увидеть новый header + табы, открыть StatChip popover, потыкать stepper, бросить 2d6.
   - **Шаг 6**: добавить/удалить предмет, экипировать броню, проверить что `totalArmor` корректен в header'е.
   - **Шаг 7**: у мага проверить все состояния Quicksilver, редактирование духа.
   - **Шаг 9**: пройти создание персонажа целиком от начала до `/character/:id`.
   - **Шаг 10**: сымитировать level-up (в dev-режиме через стор), пройти 5 шагов, проверить `hpHistory` запись.
   - **Шаг 11**: сделать несколько бросков разных типов + несколько изменений (HP, XP, инвентарь), проверить unified log.
4. На iPhone Safari (реальное устройство или Xcode Simulator) проверить: sticky-header collapse, backdrop-filter перф, touch-target ≥ 44px, `prefers-reduced-motion`.
5. Тесты `src/domain/reducer.test.ts` и `src/utils/derived.test.ts` продолжают проходить (`npm run test` если настроен; иначе прямым запуском vitest). Код этих тестов не должен затрагиваться — UI-слой не влияет на домен.

## Финальная проверка перед мержем

- `grep -rE '#[0-9a-fA-F]{6}' src --include='*.vue' --include='*.css'` — только осмысленные hex (например, в SVG-иконках).
- `grep -r 'var(--color-' src` — пустой результат.
- `grep -r 'Commissioner' src index.html` — пустой результат.
- Все пункты «точек консультации» закрыты решениями, зафиксированными в коммитах/комментариях к PR.
