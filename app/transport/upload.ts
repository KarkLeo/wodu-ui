import { ClientResponseError } from 'pocketbase'
import { pb } from '@/transport/pb'
import { BOOTSTRAP_TIMEOUT_MS } from './connection'

/**
 * Multipart create or update through XMLHttpRequest, because fetch reports no upload progress. Sends the
 * auth token like the SDK. Rejects with a `ClientResponseError` carrying the HTTP status (0 for a network
 * failure), or `Error('timeout')`, which the connection watcher counts as a network failure too.
 * The timeout is a silence limit: it restarts on every progress event while the body goes up, and
 * runs from the end of the upload for the server's answer, so a long upload on a slow line stays alive.
 */
export function sendForm<T>(
  method: 'POST' | 'PATCH',
  path: string,
  form: FormData,
  onProgress?: (fraction: number) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const url = pb.baseURL.replace(/\/+$/, '') + path
    const xhr = new XMLHttpRequest()
    let timer: ReturnType<typeof setTimeout> | undefined
    const settle = (fn: () => void) => {
      clearTimeout(timer)
      fn()
    }
    const arm = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        xhr.abort()
        reject(new Error('timeout'))
      }, BOOTSTRAP_TIMEOUT_MS)
    }
    const failure = (status: number, response: unknown, isAbort = false) =>
      new ClientResponseError({ url, status, response: response as Record<string, unknown>, isAbort })

    xhr.open(method, url)
    if (pb.authStore.token) xhr.setRequestHeader('Authorization', pb.authStore.token)
    xhr.responseType = 'text'
    xhr.upload.onprogress = (e) => {
      arm()
      if (e.lengthComputable && e.total > 0) onProgress?.(Math.min(1, e.loaded / e.total))
    }
    xhr.upload.onload = () => {
      onProgress?.(1)
      arm()
    }
    xhr.onload = () => settle(() => {
      let body: unknown = {}
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : {}
      } catch {
        body = {}
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as T)
      else reject(failure(xhr.status, body))
    })
    xhr.onerror = () => settle(() => reject(failure(0, {})))
    xhr.onabort = () => settle(() => reject(failure(0, {}, true)))
    arm()
    xhr.send(form)
  })
}
