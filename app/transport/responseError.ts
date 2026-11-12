import { ClientResponseError } from 'pocketbase'

/**
 * The error `sendForm` rejects with for a non-2xx answer: what the SDK itself would build, with the parsed JSON
 * body as `response`. PocketBase puts the field errors of a refused write at `response.data.<field>.code`;
 * `err.data` is the SDK's getter for the same whole body, not for its `data` member.
 */
export function errorFromResponse(url: string, status: number, bodyText: string): ClientResponseError {
  return new ClientResponseError({ url, status, response: parseBody(bodyText) })
}

export function parseBody(text: string): Record<string, unknown> {
  try {
    const body: unknown = text ? JSON.parse(text) : {}
    return typeof body === 'object' && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : {}
  } catch {
    return {}
  }
}
