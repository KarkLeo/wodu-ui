// Stand-in for app/transport/upload.ts: the multipart request goes to the in-memory collections, and what
// was sent is kept so a story can read the fields and each file's name, type and size.
import { errorFromResponse } from '@/transport/responseError'
import { seedRecords, storedRecords } from './pb'

export interface SentForm {
  method: 'POST' | 'PATCH'
  path: string
  fields: Record<string, string>
  files: Record<string, { name: string; type: string; size: number }>
}

const forms: SentForm[] = []

export function sentForms(): readonly SentForm[] {
  return forms
}

export function clearSentForms(): void {
  forms.length = 0
}

let gate: Promise<void> | null = null
let failure: number | null = null
let failureBody = ''

/** Keeps the next uploads half way (progress 0.4) until the returned function is called. */
export function holdUploads(): () => void {
  let release!: () => void
  const mine = new Promise<void>((resolve) => { release = resolve })
  gate = mine
  return () => {
    if (gate === mine) gate = null
    release()
  }
}

/**
 * Makes uploads fail with this HTTP status and raw response body until called with null. A body comes from
 * `RECORDED` (app/transport/recordedResponses.ts), so the error has the shape of a real one. Module-level state: a story that sets it
 * relies on `withScenes` (app/stories/scenes.ts) resetting it for the next one.
 */
export function failUploadsWith(status: number | null, body = ''): void {
  failure = status
  failureBody = body
}

export async function sendForm<T>(
  method: 'POST' | 'PATCH',
  path: string,
  form: FormData,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<T> {
  const sent: SentForm = { method, path, fields: {}, files: {} }
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') sent.fields[key] = value
    else sent.files[key] = { name: value.name, type: value.type, size: value.size }
  }
  forms.push(sent)
  if (gate) {
    onProgress?.(0.4)
    await gate
  }
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
  if (failure !== null) throw errorFromResponse(path, failure, failureBody || JSON.stringify({ data: {}, message: 'mock', status: failure }))
  onProgress?.(1)

  const match = /^\/api\/collections\/([^/]+)\/records(?:\/([^/]+))?$/.exec(path)
  if (!match) throw Object.assign(new Error('mock 404'), { status: 404 })
  const name = decodeURIComponent(match[1]!)
  const id = match[2] ? decodeURIComponent(match[2]) : sent.fields.id!
  const existing = storedRecords(name).find(r => r.id === id)
  if (method === 'PATCH' && !existing) throw Object.assign(new Error('mock 404'), { status: 404 })
  const row: Record<string, unknown> & { id: string } = { ...existing, id, updated: new Date().toISOString() }
  if (method === 'POST') Object.assign(row, { game: sent.fields.game, created: row.updated })
  if ('data' in sent.fields) row.data = JSON.parse(sent.fields.data!)
  for (const field of ['image', 'sound']) {
    if (sent.files[field]) row[field] = sent.files[field].name
    else if (field in sent.fields) row[field] = sent.fields[field]
    else if (method === 'POST') row[field] = ''
  }
  seedRecords(name, [row])
  return JSON.parse(JSON.stringify(row)) as T
}
