// In-memory stand-in for app/transport/pb.ts: writes succeed, reads return nothing, realtime is silent.
// Auth is in memory too: any code signs in except WRONG_CODE, and nothing is remembered across reloads.
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

class MockResponseError extends Error {
  constructor(public status: number) {
    super(`mock ${status}`)
  }
}

// One object per collection name, so stories can spy on its methods.
const collections = new Map<string, ReturnType<typeof makeCollection>>()

function collection(name = '') {
  let c = collections.get(name)
  if (!c) collections.set(name, c = makeCollection(name))
  return c
}

function makeCollection(name: string) {
  const base = {
    create: async <T extends Record<string, unknown>>(body: T) => ({ ...body, created: stamp(), updated: stamp() }),
    update: async <T extends Record<string, unknown>>(id: string, body: T) => {
      if (name === 'users' && authStore.record?.id === id) authStore.save(authStore.token, { ...authStore.record, ...body })
      return { id, ...body, updated: stamp() }
    },
    delete: async (id?: string) => {
      if (name === 'users' && authStore.record?.id === id) authStore.clear()
      return true
    },
    getFullList: async () => [],
    getList: async () => ({ page: 1, perPage: 0, totalItems: 0, totalPages: 0, items: [] }),
    subscribe: async () => async () => {},
    unsubscribe: async () => {},
  }
  return {
    ...base,
    requestOTP: async () => ({ otpId: 'otp-mock' }),
    authWithOTP: async (_otpId: string, code: string) => {
      if (code === WRONG_CODE) throw new MockResponseError(400)
      signInMock({ name: '', language: '' })
      return { token: authStore.token, record: authStore.record }
    },
    authRefresh: async () => ({ token: authStore.token, record: authStore.record }),
  }
}

export const pb = {
  collection,
  autoCancellation() {},
  authStore,
  health: { check: async () => ({ code: 200, message: 'ok', data: {} }) },
  realtime: {
    onDisconnect: undefined as ((subs: string[]) => void) | undefined,
    subscribe: async () => async () => {},
    unsubscribe: async () => {},
    disconnect() {},
  },
}
