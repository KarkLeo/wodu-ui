// In-memory stand-in for app/transport/pb.ts: writes succeed, reads return nothing, realtime is silent.
const stamp = () => new Date().toISOString()

function collection() {
  return {
    create: async <T extends Record<string, unknown>>(body: T) => ({ ...body, created: stamp(), updated: stamp() }),
    update: async <T extends Record<string, unknown>>(id: string, body: T) => ({ id, ...body, updated: stamp() }),
    delete: async () => true,
    getFullList: async () => [],
    getList: async () => ({ page: 1, perPage: 0, totalItems: 0, totalPages: 0, items: [] }),
    subscribe: async () => async () => {},
    unsubscribe: async () => {},
  }
}

export const pb = {
  collection,
  autoCancellation() {},
  authStore: { clear() {} },
  health: { check: async () => ({ code: 200, message: 'ok', data: {} }) },
  realtime: {
    onDisconnect: undefined as ((subs: string[]) => void) | undefined,
    subscribe: async () => async () => {},
    unsubscribe: async () => {},
    disconnect() {},
  },
}
