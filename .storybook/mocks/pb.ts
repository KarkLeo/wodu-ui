// In-memory stand-in for app/transport/pb.ts: writes succeed, lists return nothing (except a game's library),
// realtime is silent.
// Records written (or seeded with seedRecords) are kept per collection, so getOne after a create or an
// update answers like the server would. Auth is in memory too: any code signs in except WRONG_CODE, and
// nothing is remembered across reloads.
const stamp = () => new Date().toISOString()

export const WRONG_CODE = '00000000'

type MockRecord = Record<string, unknown> & { id: string }
type AuthListener = (token: string, record: MockRecord | null) => void

const listeners = new Set<AuthListener>()

export const authStore = {
  token: '',
  record: null as MockRecord | null,
  get isValid() {
    return this.token !== ''
  },
  onChange(cb: AuthListener, fireImmediately = false) {
    listeners.add(cb)
    if (fireImmediately) cb(this.token, this.record)
    return () => listeners.delete(cb)
  },
  save(token: string, record: MockRecord | null) {
    this.token = token
    this.record = record
    for (const cb of listeners) cb(token, record)
  },
  clear() {
    this.save('', null)
  },
}

/** Signs the mock in as a verified user, for stories that start signed in. */
export function signInMock(fields: Partial<MockRecord> = {}) {
  authStore.save('mock-token', {
    id: 'user-mock',
    email: 'anna@mail.com',
    name: 'Anna',
    language: 'en',
    verified: true,
    ...fields,
  })
}

const records = new Map<string, Map<string, MockRecord>>()

function recordsOf(name: string) {
  let r = records.get(name)
  if (!r) records.set(name, r = new Map())
  return r
}

/** Puts records into a mock collection, e.g. the games a story starts with. */
export function seedRecords(name: string, rows: MockRecord[]) {
  const r = recordsOf(name)
  for (const row of rows) r.set(row.id, { ...row })
}

/** Replaces everything in a mock collection, so a story starts from its own rows whatever ran before it. */
export function resetRecords(name: string, rows: MockRecord[] = []) {
  recordsOf(name).clear()
  seedRecords(name, rows)
}

// Every call that would reach the server, as 'collection.method' (or 'realtime.subscribe', 'health.check'),
// so a story can prove a screen sends nothing, e.g. the offline table.
const requests: string[] = []

export function pbRequests(): readonly string[] {
  return requests
}

export function clearPbRequests(): void {
  requests.length = 0
}

function recorded<T extends Record<string, unknown>>(prefix: string, methods: T): T {
  for (const [key, value] of Object.entries(methods)) {
    if (typeof value !== 'function') continue
    ;(methods as Record<string, unknown>)[key] = (...args: unknown[]) => {
      requests.push(`${prefix}.${key}`)
      return (value as (...a: unknown[]) => unknown)(...args)
    }
  }
  return methods
}

// Server-generated ids for collections whose ids the client does not send (game_members).
const serverId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 15)

class MockResponseError extends Error {
  constructor(public status: number) {
    super(`mock ${status}`)
  }
}

const LIBRARY = new Set(['monsters', 'items'])

// One object per collection name, so stories can spy on its methods.
const collections = new Map<string, ReturnType<typeof makeCollection>>()

function collection(name = '') {
  let c = collections.get(name)
  if (!c) collections.set(name, c = makeCollection(name))
  return c
}

function makeCollection(name: string) {
  const base = {
    create: async <T extends Record<string, unknown>>(body: T) => {
      const row = { id: serverId(), ...body, created: stamp(), updated: stamp() }
      recordsOf(name).set(String(row.id), row)
      return row
    },
    update: async <T extends Record<string, unknown>>(id: string, body: T) => {
      if (name === 'users' && authStore.record?.id === id) authStore.save(authStore.token, { ...authStore.record, ...body })
      const row = { ...recordsOf(name).get(id), id, ...body, updated: stamp() }
      recordsOf(name).set(id, row)
      return row
    },
    delete: async (id?: string) => {
      if (name === 'users' && authStore.record?.id === id) authStore.clear()
      if (id) recordsOf(name).delete(id)
      return true
    },
    getOne: async (id: string) => {
      const row = recordsOf(name).get(id)
      if (!row) throw new MockResponseError(404)
      return { ...row }
    },
    getFirstListItem: async () => {
      throw new MockResponseError(404)
    },
    // Lists only the library collections, by the `game = "<id>"` filter they are loaded with.
    getFullList: async (options: { filter?: string } = {}) => {
      if (!LIBRARY.has(name)) return []
      const game = /^game = (".*")$/.exec(options.filter ?? '')
      const id = game ? JSON.parse(game[1]!) as string : null
      return [...recordsOf(name).values()].filter(r => r.game === id).map(r => structuredClone(r))
    },
    // Answers only the invite lookup (findGameByCode): records whose invite_code equals `query.code`.
    getList: async (_page?: number, _perPage?: number, options: { query?: Record<string, unknown> } = {}) => {
      const code = options.query?.code
      const items = typeof code === 'string'
        ? [...recordsOf(name).values()].filter(r => r.invite_code === code).map(r => ({ ...r }))
        : []
      return { page: 1, perPage: items.length, totalItems: items.length, totalPages: items.length ? 1 : 0, items }
    },
    subscribe: async () => async () => {},
    unsubscribe: async () => {},
  }
  return recorded(name, {
    ...base,
    requestOTP: async () => ({ otpId: 'otp-mock' }),
    authWithOTP: async (_otpId: string, code: string) => {
      if (code === WRONG_CODE) throw new MockResponseError(400)
      signInMock({ name: '', language: '' })
      return { token: authStore.token, record: authStore.record }
    },
    authRefresh: async () => ({ token: authStore.token, record: authStore.record }),
  })
}

export const pb = {
  collection,
  autoCancellation() {},
  // Same placeholder syntax as the SDK's pb.filter(): {:name} becomes the quoted value.
  filter(raw: string, params: Record<string, unknown> = {}) {
    return raw.replace(/\{:(\w+)\}/g, (_m, key: string) => JSON.stringify(params[key] ?? null))
  },
  authStore,
  // The SDK's raw request: unlike collection(...).delete() it leaves the auth store alone. Only record
  // deletes are answered (deleteOwnAccount).
  ...recorded('pb', {
    send: async (path: string, options: { method?: string } = {}) => {
      const match = /^\/api\/collections\/([^/]+)\/records\/([^/]+)$/.exec(path)
      if (!match || options.method !== 'DELETE') throw new MockResponseError(404)
      recordsOf(decodeURIComponent(match[1]!)).delete(decodeURIComponent(match[2]!))
      return null
    },
  }),
  health: recorded('health', { check: async () => ({ code: 200, message: 'ok', data: {} }) }),
  realtime: {
    onDisconnect: undefined as ((subs: string[]) => void) | undefined,
    ...recorded('realtime', {
      subscribe: async () => async () => {},
      unsubscribe: async () => {},
    }),
    disconnect() {},
  },
}
