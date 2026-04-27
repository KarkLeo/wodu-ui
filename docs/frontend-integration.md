# Инструкция для фронта: подключение к PocketBase-бэку

Этот файл — **исчерпывающее ТЗ** для того, кто будет на фронте заменять `pinia-plugin-persistedstate` на синхронизацию через PocketBase. Бэкенд уже готов и проверен (см. `backend-spec.md` § 12). Здесь только то, что нужно знать клиенту.

---

## 1. TL;DR

- **URL бэкенда (dev):** `http://127.0.0.1:8090`
- **SDK:** [`pocketbase`](https://github.com/pocketbase/js-sdk) (официальный JS SDK)
- **Auth:** **нет.** Не подключать `users` коллекцию, не вызывать `pb.collection('users').authWithPassword()` и т.п. Все запросы анонимные.
- **ID-формат:** `crypto.randomUUID()` (36 символов с дефисами) принимается напрямую. Менять текущий генератор `src/utils/ids.ts` не нужно.
- **Коллекции:** `characters`, `roll_events`, `change_events`. Все — публичные read/write.
- **Realtime:** SSE через `/api/realtime`, абстрагируется методом `pb.collection(...).subscribe('*', cb)`.

---

## 2. Установка и инициализация

```sh
npm i pocketbase
```

Создать один singleton-клиент и переиспользовать его везде:

```ts
// src/transport/pb.ts
import PocketBase from 'pocketbase'

const PB_URL = import.meta.env.VITE_PB_URL ?? 'http://127.0.0.1:8090'
export const pb = new PocketBase(PB_URL)

// Нужно, чтобы между табами/перезагрузками не текло «состояние»
// несуществующего auth — у нас auth нет, но SDK сохраняет authStore в localStorage.
pb.autoCancellation(false) // важно: иначе параллельные мутации одной коллекции отменяют друг друга
```

`autoCancellation(false)` — обязательно. Иначе если фронт быстро шлёт два `update(id, ...)` подряд (типичная ситуация при wizard-форме), второй отменит первый и SDK кинет `ClientResponseError 0`.

Добавить в `.env`:

```
VITE_PB_URL=http://127.0.0.1:8090
```

---

## 3. Схема коллекций (как они выглядят на проводе)

Бэкенд хранит **обёртки** вокруг доменных типов. Доменные типы (`Character`, `RollRecord`, `ChangeEntry`) идут целиком в поле `data` как JSON. Бэкенд их **не парсит и не валидирует** — отвечает за это фронт.

### 3.1. `characters`

| Поле      | Тип       | Кто пишет     | Содержимое                                    |
| --------- | --------- | ------------- | --------------------------------------------- |
| `id`      | string    | клиент (UUID) | Тот же что `Character.id` (дублируется).      |
| `data`    | object    | клиент        | Полный `Character` (см. `backend-spec.md` §4.1). |
| `created` | timestamp | бэк (auto)    | Не трогать.                                   |
| `updated` | timestamp | бэк (auto)    | Не трогать.                                   |

### 3.2. `roll_events` (append-only)

| Поле           | Тип       | Кто пишет     | Содержимое                                     |
| -------------- | --------- | ------------- | ---------------------------------------------- |
| `id`           | string    | клиент (UUID) | Тот же что `RollRecord.id`.                    |
| `data`         | object    | клиент        | Полный `RollRecord` (§4.2).                    |
| `character_id` | string    | клиент        | Дубль `RollRecord.characterId` (для индекса).  |
| `created`      | timestamp | бэк (auto)    |                                                |

**PATCH запрещён сервером** (вернёт 403). Если нужно «исправить» бросок — создать новую запись.

### 3.3. `change_events` (append-only)

| Поле           | Тип       | Кто пишет     | Содержимое                                       |
| -------------- | --------- | ------------- | ------------------------------------------------ |
| `id`           | string    | клиент (UUID) | Тот же что `ChangeEntry.id`.                     |
| `data`         | object    | клиент        | Полный `ChangeEntry` (§4.3).                     |
| `character_id` | string    | клиент        | Дубль `ChangeEntry.characterId`.                 |
| `created`      | timestamp | бэк (auto)    |                                                  |

PATCH запрещён, как у `roll_events`.

> **Важно:** обёртка `{ id, data, character_id }` — это **только формат БД**. В типы домена это просачиваться не должно. Все слои выше transport-слоя видят `Character`, `RollRecord`, `ChangeEntry` без обёрток.

---

## 4. CRUD: примеры кода

### 4.1. Загрузка всего при старте

```ts
import type { Character, RollRecord, ChangeEntry } from '@/domain/types'

type CharacterRow = { id: string; data: Character }
type RollRow = { id: string; data: RollRecord; character_id: string; created: string }
type ChangeRow = { id: string; data: ChangeEntry; character_id: string; created: string }

export async function loadInitialState() {
  const [chars, rolls, changes] = await Promise.all([
    pb.collection('characters').getFullList<CharacterRow>(),
    pb.collection('roll_events').getList<RollRow>(1, 200, { sort: '-created' }),
    pb.collection('change_events').getList<ChangeRow>(1, 200, { sort: '-created' }),
  ])

  return {
    characters: chars.map((r) => r.data),
    rolls: rolls.items.map((r) => r.data).reverse(),     // в хронологическом порядке
    changes: changes.items.map((r) => r.data).reverse(),
  }
}
```

Хвосты бросков и изменений ограничены 200 — больше для прототипа не нужно.

### 4.2. Создание персонажа

```ts
await pb.collection('characters').create({
  id: character.id,                  // тот же UUID что внутри data
  data: character,
})
```

### 4.3. Обновление персонажа (любая мутация листа)

```ts
await pb.collection('characters').update(character.id, { data: nextCharacter })
```

`updated` обновится автоматически. **LWW:** если два клиента обновят одновременно, побеждает последний пишущий — это сознательное ограничение прототипа (см. `backend-spec.md` §3.1).

### 4.4. Удаление персонажа

```ts
await pb.collection('characters').delete(character.id)
```

Связанные `roll_events` и `change_events` **не чистятся** (по дизайну — общий лог переживает удаление, см. §8.5 спеки).

### 4.5. Запись броска

```ts
await pb.collection('roll_events').create({
  id: roll.id,
  character_id: roll.characterId,
  data: roll,
})
```

### 4.6. Запись change-event

```ts
for (const entry of changes) {
  await pb.collection('change_events').create({
    id: entry.id,
    character_id: entry.characterId,
    data: entry,
  })
}
```

`applyCommand` возвращает массив `changes[]` — пишем все, в порядке возврата.

---

## 5. Realtime (SSE)

SDK сам открывает SSE-соединение и переподключается при разрыве. Подписка строкой `'*'` означает «все события коллекции» (create / update / delete).

### 5.1. Подписка на персонажей

```ts
pb.collection('characters').subscribe<CharacterRow>('*', (e) => {
  // e.action — 'create' | 'update' | 'delete'
  // e.record — полная строка из БД (а для delete — последняя известная строка)
  switch (e.action) {
    case 'create':
    case 'update':
      charactersStore.upsert(e.record.data)
      break
    case 'delete':
      charactersStore.removeById(e.record.id)
      break
  }
})
```

**Важно: фильтрация эха собственных мутаций.** PocketBase шлёт SSE-событие **всем** подписчикам, включая того, кто сделал мутацию. Это значит: после `update()` локальный клиент получит свой же `update`-event обратно. Для `characters` это безопасно (тот же объект в `data`), но если у тебя в Pinia есть оптимистичные обновления — после ответа от PB не нужно их повторно применять. Простейший вариант: source of truth = PB, локальный store обновляется только при получении SSE. Optimistic UI оставить на следующую итерацию.

### 5.2. Подписка на броски

```ts
pb.collection('roll_events').subscribe<RollRow>('*', (e) => {
  if (e.action !== 'create') return  // updates/deletes не ожидаются
  const record = e.record.data
  historyStore.addRecord(record)
  diceQueue.enqueue(record.dice)
})
```

3D-кубики в `diceQueue` будут проигрываться **у всех клиентов**, включая того, кто бросил. Это и есть «общий стол».

### 5.3. Подписка на изменения

```ts
pb.collection('change_events').subscribe<ChangeRow>('*', (e) => {
  if (e.action !== 'create') return
  changeLogStore.add(e.record.data)
})
```

### 5.4. Отписка при размонтировании

```ts
// ВНУТРИ Pinia action или плагина
const unsub = await pb.collection('characters').subscribe('*', cb)
// При SPA-переходе из приложения / pinia.dispose / hot reload:
await unsub()
// Или сразу всё:
await pb.collection('characters').unsubscribe()
```

При HMR Vite не отписаться = две подписки на одно событие = двойные обновления. Используй `import.meta.hot?.dispose(() => pb.collection(...).unsubscribe())` в transport-модуле.

---

## 6. Поток типичной мутации (например, `APPLY_DAMAGE`)

```ts
// До: всё локально, через pinia-plugin-persistedstate.
// После: вся мутация = одна транзакция в PB.

async function dispatch(cmd: CharacterCommand) {
  const char = charactersStore.byId(cmd.characterId)
  const { next, changes } = applyCommand(char, cmd)

  // 1. Записываем новое состояние персонажа
  await pb.collection('characters').update(char.id, { data: next })

  // 2. Записываем все ChangeEntry
  for (const entry of changes) {
    await pb.collection('change_events').create({
      id: entry.id,
      character_id: entry.characterId,
      data: entry,
    })
  }

  // ВСЁ. Локальный store не трогаем — обновится из SSE.
}
```

Для бросков отдельно — `roll_events` пишется **до** записи `characters` (бросок — независимый артефакт), а если бросок повлёк `applyCommand` (например, `hp-init`) — потом ещё `characters` + `change_events`.

---

## 7. Что фронт **обязан** соблюдать (контракт)

1. **`id` в `data` и `id` в записи БД должны совпадать.** Бэк это не валидирует — но если они разойдутся, любая фильтрация по `character_id` в событиях сломается.
2. **`character_id` в строках `roll_events` / `change_events` обязателен** и должен совпадать с `data.characterId`. Используется для индексов и будущего фильтра по кампаниям.
3. **Не пытаться PATCH-нуть `roll_events` / `change_events`** — вернётся 403. Если нужна правка — отдельный change-event с обратной поправкой.
4. **При создании character с draft-статусом** — слать так же, как обычно. Бэк не различает draft/active. Wizard может сохранять промежуточные состояния `update(id, { data })` — каждое сохранение раздаётся остальным клиентам, это by design.
5. **Никогда не использовать `pb.authStore`.** Сейчас auth нет; обращения к `authStore.token` могут выдать stale-данные с прошлой сессии (если кто-то когда-то логинился). На всякий случай: `pb.authStore.clear()` в инициализации.
6. **Все мутации только через одну точку** (Pinia action `dispatch`). Это критично — на следующей итерации сюда вешается auth/owner-check без переписывания компонентов.

---

## 8. Что фронт делать **не должен**

- Не валидировать схему ответа из PB на доменные инварианты — `data` приходит как `unknown` JSON, парсить через типы и **доверять**, что записал валидное состояние тот, кто его записывал. Если в `data` пришёл мусор от другого клиента — это всё равно баг другого клиента, его не починить разовой проверкой.
- Не реализовывать локальный кэш помимо Pinia — SDK в PB сам не кэширует, и не надо. Source of truth = PB + SSE.
- Не дёргать `getFullList` повторно после старта. После initial load всё приходит через SSE. Повторный `getFullList` оправдан только при потере соединения и явном reconnect-сценарии (на прототипе можно не делать — SDK сам переподключит SSE).
- Не делать optimistic UI на этой итерации (см. §5.1). Локальный store = зеркало PB.

---

## 9. Известные ограничения прототипа

Эти вещи **сознательно не сделаны** на бэке. Фронт должен с ними жить:

- **LWW при конкурентной записи характера.** Два клиента сохранили почти одновременно → побеждает последний. Лог изменений сохранит обе записи `change_events`, и пользователи увидят расхождение глазами.
- **Удаление character не каскадирует.** Связанные `roll_events`/`change_events` остаются. UI должен уметь рендерить событие персонажа, которого больше нет (имя берётся из `data.characterName`).
- **Нет миграций версий доменной модели.** Если изменишь `Character` — придётся либо писать ad-hoc миграцию данных на стороне фронта, либо просить бэк-разработчика обнулить `pb_data/`.
- **Нет фильтрации по «комнатам».** Все клиенты видят всех персонажей. Это базовая модель прототипа.

---

## 10. Чек-лист готовности фронта

- [ ] Установлен `pocketbase`, создан singleton `pb` с `autoCancellation(false)`.
- [ ] `VITE_PB_URL` в `.env` / `.env.local`.
- [ ] `pinia-plugin-persistedstate` удалён или отключён для всех stores, которые теперь живут в PB.
- [ ] Initial load: `getFullList('characters')` + `getList('roll_events', ...)` + `getList('change_events', ...)`.
- [ ] Три подписки: `characters`, `roll_events`, `change_events` — на старте приложения.
- [ ] HMR-cleanup: `unsubscribe()` в `import.meta.hot.dispose`.
- [ ] Все CRUD-операции уехали в transport-слой (`src/transport/pb.ts` или аналог), компоненты их не видят.
- [ ] Smoke-тест двумя вкладками: в одной создаёшь персонажа / кидаешь кубик / отнимаешь HP — во второй прилетает без перезагрузки.

---

## 11. Когда дойдёшь до деплоя

Production URL бэка нужно будет передать через `VITE_PB_URL`. **Realtime требует HTTPS** (WSS/SSE через TLS), иначе браузер будет резать смешанный контент. Локально для dev http://127.0.0.1 разрешён.

CORS: PocketBase из коробки разрешает все origins. Дополнительно настраивать ничего не нужно.
