# Спека бэкенда: shared character sheet (прототип)

Этот документ — вход для разработки **отдельного** репозитория с бэкендом на PocketBase. Реализация бэкенда живёт отдельно; фронтенд (этот репозиторий) подключается к нему по REST + Realtime через `pocketbase` JS SDK.

---

## 1. Контекст

### Что за продукт
Интерактивный лист персонажа для настольной RPG **World of Dungeons** (©1979 J.S. Harper). Mobile-first веб-приложение. Сейчас — чистый клиент на Vue 3 + Pinia, persisted state в localStorage. Каждое устройство хранит свою копию.

### Что мы делаем
Снимаем «однопользовательский» потолок: переводим хранение и реактивную раздачу состояния на **PocketBase**, чтобы несколько клиентов могли работать с одним и тем же набором персонажей одновременно — как с общим документом.

### Чем именно прототип ограничен (важно)
Это **первая итерация**. Намеренно упрощаем:
- **Нет аутентификации, нет пользователей.** Совсем. Любой, у кого есть URL бэкенда, читает и пишет всё.
- **Нет кампаний, комнат, овнеров.** Один глобальный «стол». Все персонажи — общие, все клиенты видят одно и то же.
- **Нет резолвинга конфликтов.** Last-write-wins на уровне записи character. На прототипе это приемлемо: клиенты вокруг одного стола физически видят, что делают другие.
- **Нет миграций версий схемы данных.** Если поменяется доменная модель — пересоздаём БД.

Эти ограничения **временные** и будут сняты на следующей итерации (auth + campaigns + ownerId + optimistic UI + конфликт-стратегия). Но архитектура текущего шага должна это принять без переписывания (см. §10).

---

## 2. Стек

- **PocketBase** (последний стабильный релиз, ≥ 0.22).
- Запускаем единственный бинарник `./pocketbase serve`.
- Схема коллекций задаётся через **migrations** (`pb_migrations/*.js`). Никаких правок через админку «руками без сохранения миграции» — иначе клиент не сможет повторно поднять окружение.
- Клиент использует официальный SDK [`pocketbase`](https://github.com/pocketbase/js-sdk).
- Хостинг прототипа — на усмотрение разработчика бэкенда (Fly.io / Railway / VPS / локально). На уровне спеки — single-process.

### Почему PocketBase
- Из коробки даёт REST CRUD + Realtime subscriptions поверх SQLite.
- Минимум ceremonии для прототипа (нет нужды поднимать Postgres + WS-сервер + auth-сервис).
- Когда дойдём до auth/owners/campaigns — встроенные `users` коллекции и API rules покрывают нужный объём.

---

## 3. Модель данных

Доменная модель уже стабилизирована на фронте. Бэкенду **не нужно** парсить или валидировать её внутреннюю структуру. Бэкенд хранит:

1. **Персонажей** — состояние листа.
2. **Roll events** — события бросков кубиков (broadcast-канал «что кинули за столом»).
3. **Change events** — события изменения персонажей (broadcast-канал «что произошло с листом»).

### 3.1. Принципиальное решение: state-based, не event-sourced

На клиенте есть чистый редьюсер `applyCommand(char, cmd)` (см. `src/domain/reducer.ts`). Можно было бы синхронизировать **поток команд** (event sourcing), но для прототипа это перебор. Вместо этого:

- Клиент применяет команду локально → получает новый `Character`.
- Клиент **записывает целиком новую версию** в коллекцию `characters` PocketBase (PATCH/PUT).
- PocketBase раздаёт обновление по Realtime → остальные клиенты подменяют у себя локальную копию.
- Параллельно клиент **публикует** соответствующее `ChangeEntry` в коллекцию `change_events` (для общего лога) и `RollRecord` в `roll_events`, если был бросок.

Сервер **ничего не знает** про команды и редьюсер. Он — тупое хранилище + реалтайм-фанаут.

**Последствия (намеренные на прототипе):**
- Конфликт = два клиента сохранили разные версии почти одновременно. Побеждает последний пишущий. Лог изменений сохранит обе записи об изменении — пользователи увидят расхождение и вручную разрулят.
- Это допустимо ровно потому, что сценарий — стол с живыми людьми, которые не давят кнопки одновременно в один и тот же лист.

### 3.2. Поля «как есть» — JSON blob

Доменные типы (`Character`, `RollRecord`, `ChangeEntry`) сложные и со временем будут меняться. Раскладывать каждое поле в колонку SQLite дорого по времени и не даёт ни одной выгоды для прототипа (мы по этим колонкам не запрашиваем, не индексируем, не агрегируем).

**Решение:** поля хранятся как PocketBase-тип `json`. Клиент отправляет/получает их в исходной форме TypeScript-типов (см. §4 — типы целиком).

---

## 4. Доменные типы (источник истины — фронт)

Эти типы клиент шлёт и ждёт обратно. Бэкенд **обращается с ними как с непрозрачным JSON**, но они приведены здесь, чтобы было понятно, что внутри.

### 4.1. `Character`

```ts
export type StatKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
export type Stats = Record<StatKey, number>

export interface StatModifier {
  id: string
  statKey: StatKey
  amount: number
  label: string
}

export type ItemDescriptor =
  | { kind: 'weapon'; melee: true }
  | { kind: 'weapon'; melee: false }
  | { kind: 'armor'; class: 'none' | 'light' | 'full' }
  | { kind: 'shield' }
  | { kind: 'gear'; consumable?: boolean }
  | { kind: 'tool' }
  | { kind: 'occult'; consumable?: boolean }
  | { kind: 'custom'; consumable?: boolean }

export interface InventoryItem {
  id: string
  templateId?: string
  name: string
  descriptor: ItemDescriptor
  price?: number
  damage?: string
  notes?: string
  equipped?: boolean
  quantity?: number
}

export interface Spirit {
  id: string
  name: string
  appearance: string
  sphere1: string
  sphere2: string
}

export interface Ritual { name: string; description: string }

export interface Magic {
  spirits: Spirit[]
  rituals: Ritual[]
  cantrips: string[]
}

export type CharacterStatus = 'draft' | 'active'
export type ClassId = 'fighter' | 'thief' | 'cleric' | 'wizard' | 'ranger' | 'custom'
export type SkillId = string   // фиксированный enum на фронте, бэк не валидирует
export type AbilityId = string // фиксированный enum на фронте, бэк не валидирует

export interface Character {
  id: string                   // UUID, генерится клиентом
  createdAt: number            // unix ms
  status: CharacterStatus

  name: string
  trueName?: string
  classId: ClassId
  customClassName?: string
  level: number
  xp: number

  stats: Stats
  statRolls: Record<StatKey, number>
  hitDice: number
  currentHp: number
  maxHp: number
  tempHp?: number
  armorMod?: number
  damageMod?: number
  hpHistory?: { level: number; roll: number; source: 'dice' | 'sturdy' }[]

  skillIds: string[]
  abilityIds: string[]

  modifiers?: StatModifier[]

  inventory: InventoryItem[]
  coins: number

  magic?: Magic
  quicksilverCount?: number

  damageBonusDice: number
  notes: string
}
```

### 4.2. `RollRecord` (бросок кубиков)

```ts
export type DieSize = 4 | 6 | 8 | 10 | 12 | 20 | 100
export interface DieResult { sides: DieSize; value: number }

export type RollPurpose =
  | { kind: 'stat'; statKey: StatKey; statBonus: number }
  | { kind: 'damage'; weaponName: string; formula: string }
  | { kind: 'free'; notation: string }
  | { kind: 'hp-init'; level: number; numDice: number; kept: number }
  | { kind: 'hit-dice'; fromLevel: number; toLevel: number; numDice: number; kept: number }

export interface RollRecord {
  id: string                   // UUID, генерится клиентом
  timestamp: number            // unix ms
  notation: string             // например "2d6+1"
  dice: DieResult[]
  diceTotal: number
  modifier: number
  total: number
  label: string
  purpose: RollPurpose
  characterId: string          // ссылка на characters.id (но НЕ FK на уровне БД)
  characterName?: string
}
```

### 4.3. `ChangeEntry` (запись в общем логе)

```ts
export type ChangePayload =
  | { kind: 'hp-damage'; amount: number; tempBefore: number; tempAfter: number; hpBefore: number; hpAfter: number }
  | { kind: 'hp-heal'; amount: number; before: number; after: number }
  | { kind: 'hp-temp'; before: number; after: number }
  | { kind: 'armor-mod'; before: number; after: number }
  | { kind: 'damage-mod'; before: number; after: number }
  | { kind: 'xp-gain'; before: number; after: number }
  | { kind: 'level-up'; before: number; after: number }
  | { kind: 'stats'; changes: { key: StatKey; before: number; after: number }[] }
  | { kind: 'inventory-add'; itemName: string; cost?: number; source: 'buy' | 'receive' | 'custom' }
  | { kind: 'inventory-remove'; itemName: string }
  | { kind: 'inventory-use'; itemName: string; quantityBefore: number; quantityAfter: number }
  | { kind: 'inventory-edit'; itemName: string }
  | { kind: 'equip'; itemName: string }
  | { kind: 'unequip'; itemName: string }
  | { kind: 'coins'; before: number; after: number }
  | { kind: 'magic' }
  | { kind: 'modifier-add'; statKey: StatKey; label: string; amount: number }
  | { kind: 'modifier-remove'; statKey: StatKey; label: string; amount: number }
  | { kind: 'modifier-clear'; statKey?: StatKey; count: number }
  | { kind: 'quicksilver-reset'; before: number }
  | { kind: 'create'; characterName: string }

export interface ChangeEntry {
  id: string                   // UUID, генерится клиентом
  timestamp: number            // unix ms
  characterId: string
  characterName: string
  payload: ChangePayload
  sourceCommand: string        // имя CharacterCommand, например 'APPLY_DAMAGE'
}
```

---

## 5. Схема PocketBase

Три коллекции. Все — `base` (не `auth`, не `view`).

### 5.1. Коллекция `characters`

| Поле           | Тип      | Required | Примечание                                          |
| -------------- | -------- | -------- | --------------------------------------------------- |
| `id`           | string   | yes      | **Клиентский UUID.** См. §5.4 про настройку ID.     |
| `data`         | json     | yes      | Полный объект `Character` (см. 4.1).                |
| `created`      | autodate | auto     | PB-built-in.                                        |
| `updated`      | autodate | auto     | PB-built-in.                                        |

Индексы — нет (прототип, объёмов не предвидится).

API rules:
```
listRule:   ""
viewRule:   ""
createRule: ""
updateRule: ""
deleteRule: ""
```
(пустая строка = публично, см. §6).

### 5.2. Коллекция `roll_events`

Append-only поток. Никто не редактирует, не удаляет (кроме служебной чистки).

| Поле           | Тип      | Required | Примечание                          |
| -------------- | -------- | -------- | ----------------------------------- |
| `id`           | string   | yes      | Клиентский UUID.                    |
| `data`         | json     | yes      | Полный `RollRecord` (см. 4.2).      |
| `character_id` | string   | yes      | Дублируется наружу из `data` для удобства фильтрации (не FK). |
| `created`      | autodate | auto     |                                     |

Индексы:
- `created` (DESC) — для пагинации хвоста.
- `character_id` — на будущее.

API rules:
```
listRule:   ""
viewRule:   ""
createRule: ""
updateRule: null  // запрещено
deleteRule: ""    // оставляем для ручной чистки
```

### 5.3. Коллекция `change_events`

Аналогично `roll_events`, тот же шаблон:

| Поле           | Тип      | Required | Примечание                          |
| -------------- | -------- | -------- | ----------------------------------- |
| `id`           | string   | yes      | Клиентский UUID.                    |
| `data`         | json     | yes      | Полный `ChangeEntry` (см. 4.3).     |
| `character_id` | string   | yes      | Денормализация для фильтра.         |
| `created`      | autodate | auto     |                                     |

Индексы:
- `created` (DESC).
- `character_id`.

API rules: те же, что у `roll_events`.

### 5.4. Про ID-формат

Фронт уже генерит `crypto.randomUUID()` (формат `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`, 36 символов с дефисами). PocketBase по умолчанию принимает только 15-символьные ID без дефисов.

**Что нужно сделать в миграции:**
- Для всех трёх коллекций задать **custom ID rule**, разрешающий клиентский ID и снимающий ограничение на длину/формат.
- В PocketBase 0.22+ это делается через `collection.options` / при создании коллекции в миграции — указать `system` и `id` field с `required = true` без авто-генерации.

Альтернатива (запасная, если custom-ID ломает текущие версии PB): фронт переключится на 15-символьные ID. Это локальный однострочник в `src/utils/ids.ts` (новый, см. §10), и доменные типы это переживут — `Character.id: string`.

**Решение принимает разработчик бэкенда** в зависимости от версии PB и удобства реализации. Какое бы решение ни было — **зафиксировать его явно** в README бэкенд-репозитория, чтобы фронт мог подстроиться одним правилом генерации ID.

---

## 6. Авторизация (точнее — её отсутствие)

Все правила = `""` (anyone). Это значит: любой клиент с URL бэкенда может читать, создавать, обновлять и удалять что угодно.

Это **сознательно**. Это прототип. Перед любым публичным деплоем — закрыть. Но архитектура клиента готова к закрытию: все мутации идут через единственную точку (Pinia action `dispatch`), её несложно обвернуть guard-ом.

**Что разработчик бэкенда должен сделать прямо сейчас:**
- В README бэк-репозитория пометить **большим жирным предупреждением**: «Прототип, без auth. Не разворачивать на публичный домен без `<...>`».
- Опционально (приветствуется): включить в `.env` тривиальный shared-secret header, без которого бэк отшивает всё. Это не auth, но фильтрует «случайных гостей». Если делать — описать формат заголовка, чтобы фронт мог его слать.

---

## 7. Реалтайм

PocketBase Realtime раздаёт события создания/обновления/удаления записей по подписке `pb.collection('<name>').subscribe('*', cb)`. Из коробки — никаких настроек не требуется.

**На что подписывается фронт:**
- `pb.collection('characters').subscribe('*', cb)` — для синхронизации листов между клиентами.
- `pb.collection('roll_events').subscribe('*', cb)` — для общего фида бросков (3D-кубики у всех клиентов проигрывают одну и ту же анимацию).
- `pb.collection('change_events').subscribe('*', cb)` — для общего лога изменений.

Бэкенду от этого ничего дополнительного не нужно — это поведение PocketBase по умолчанию.

---

## 8. Сценарии

### 8.1. Запуск нового клиента

1. Клиент при старте делает `pb.collection('characters').getFullList()` — забирает всех персонажей.
2. Подписывается на три коллекции (см. §7).
3. Подгружает хвост `roll_events` и `change_events` (последние ~200 записей через `getList(1, 200, { sort: '-created' })`).

### 8.2. Создание персонажа

1. Клиент локально собирает `Character` (`status: 'draft'` → `'active'`).
2. На каждом этапе wizard'а — `pb.collection('characters').update(id, { data: nextCharacter })` (или create на первом).
3. Параллельно — публикация `change_events` (`kind: 'create'` после финализации).

### 8.3. Геймплейная мутация (например, `APPLY_DAMAGE`)

1. Клиент: `applyCommand(char, { type: 'APPLY_DAMAGE', amount: 5 })` → `nextChar` + `changes[]`.
2. Клиент: `pb.collection('characters').update(id, { data: nextChar })`.
3. Клиент: для каждого `change` из `changes` — `pb.collection('change_events').create({ id, character_id, data: entry })`.
4. PocketBase раздаёт оба события. Остальные клиенты:
   - Получают новое состояние персонажа → подменяют у себя.
   - Получают `ChangeEntry` → добавляют в общий лог.

### 8.4. Бросок кубика (после рефакторинга dice по `docs/dice-system-plan.md`)

1. Клиент кидает локально: `DiceEngine.rollNotation(notation)` → `RollRecord`.
2. Клиент: `pb.collection('roll_events').create({ id, character_id, data: record })`.
3. Клиент локально: `diceQueue.enqueue(record.dice)` → анимация у себя.
4. PocketBase раздаёт. Остальные клиенты:
   - Получают `RollRecord` → `historyStore.addRecord(record)` + `diceQueue.enqueue(record.dice)`.
   - Видят те же кубы, тот же результат.

### 8.5. Удаление персонажа

1. `pb.collection('characters').delete(id)`.
2. Клиент локально дёргает `pb.collection('change_events').getList(...)` / `roll_events` для удаления связанных событий — **или** оставляет их (по дизайну общий лог переживает удаление персонажа). Решение прототипа: **не чистим** связанные события автоматически. Это упрощение, понятный недостаток, документированно.

---

## 9. Что бэкенд **НЕ** должен делать

- Не интерпретирует доменную модель. `data` — непрозрачный JSON.
- Не реализует `applyCommand`, не валидирует переходы состояний.
- Не делает CRDT, не делает merge. LWW по умолчанию PB достаточно.
- Не делает auth.
- Не пишет в коллекции по своей инициативе. Все записи приходят от клиентов.
- Не делает кастомные роуты / hooks / расширения. Чистый PocketBase + миграции.

---

## 10. Что должно быть в бэкенд-репозитории

Структура минимальная:

```
backend/
├── README.md                 # как запустить + предупреждение про отсутствие auth
├── pocketbase                # бинарник (gitignore) или Dockerfile, см. ниже
├── pb_migrations/            # JS-миграции схемы — единственный источник истины
│   ├── 1700000000_init_characters.js
│   ├── 1700000100_init_roll_events.js
│   └── 1700000200_init_change_events.js
├── pb_hooks/                 # пустая директория, на будущее
├── Dockerfile                # для деплоя
├── docker-compose.yml        # опционально
└── .gitignore                # pb_data/, pocketbase бинарник
```

### Требования к репозиторию

- `README.md` объясняет:
  - Как поднять локально (одна команда — `./pocketbase serve` или `docker compose up`).
  - URL по умолчанию (`http://localhost:8090`).
  - Куда смотреть админке (`/_/`).
  - **Большое предупреждение**: «без auth, не для публичного интернета».
  - Что фронт ожидает от ID-формата (см. §5.4).
- Все коллекции **создаются миграциями**, не админкой. Развернуть с нуля = `./pocketbase serve` и миграции применяются автоматически.
- Никаких сидов с тестовыми данными в миграциях (фронт сам наполнит).
- `pb_data/` в `.gitignore`.

### Требования к деплою

- Любой single-process хостинг с persistent storage для `pb_data/` (Fly.io volume / Railway volume / VPS-объём).
- HTTPS обязателен (Realtime через WSS).
- Если выбрана опция shared-secret header (см. §6) — ENV-переменная `BACKEND_TOKEN`, fail-fast если не задана.

---

## 11. На что закладываемся в будущей итерации (не делать сейчас, но не закрывать дверь)

Этот раздел — для контекста. Бэкенд-разработчик **не реализует** ничего из перечисленного, но **не должен** строить решение, которое блокирует это.

- **Auth.** Перейдём на встроенную PB-коллекцию `users` (email/password или OAuth). Все API rules перейдут с `""` на `@request.auth.id != ""`.
- **Кампании / комнаты.** Появится коллекция `campaigns` и поле `campaign_id` во всех трёх коллекциях. Подписки начнут фильтроваться по `campaign_id`.
- **Owner / role-based access.** Поле `owner_id` в `characters`. Update будет разрешён владельцу + ГМу кампании.
- **Команды как события (event sourcing).** Возможно добавим коллекцию `commands` — хранилище потока `CharacterCommand` для replay/undo. Но не на этой итерации.
- **TTL для событий.** Пройдёмся cron-ом / PB hook'ом по `roll_events` и `change_events` старше N дней.

Бэкенд-разработчик: ничего «на вырост» делать **не нужно**. Просто иметь это в голове, чтобы не вкладываться в решения, противоречащие этому направлению.

---

## 12. Чек-лист готовности

- [ ] PocketBase запущен, версия зафиксирована в README.
- [ ] Три коллекции (`characters`, `roll_events`, `change_events`) созданы миграциями.
- [ ] Все API rules = `""`.
- [ ] ID-формат согласован (custom UUID в PB **или** фронт переключается на 15-символьные ID; решение зафиксировано в README).
- [ ] `pb_data/` в gitignore.
- [ ] README содержит: запуск, URL, ID-формат, предупреждение про отсутствие auth.
- [ ] Realtime работает: `pb.collection('characters').subscribe('*', ...)` отрабатывает на тесте «обновил из второго клиента — первый получил».
- [ ] Dockerfile / способ деплоя описан.

После закрытия чек-листа — фронт подключается одной заменой transport-слоя на месте `pinia-plugin-persistedstate`.
