import { ClientResponseError } from 'pocketbase'
import { pb } from '@/transport/pb'
import { BOOTSTRAP_TIMEOUT_MS } from './connection'
import { errorFromResponse, parseBody } from './responseError'

/**
 * Multipart create or update through XMLHttpRequest, because fetch reports no upload progress. Sends the
 * auth token like the SDK. Rejects with a `ClientResponseError` carrying the HTTP status (0 for a network
 * failure), or `Error('timeout')`, which the connection watcher counts as a network failure too.
 * The timeout is a silence limit: it restarts on every progress event while the body goes up, and
 * runs from the end of the upload for the server's answer, so a long upload on a slow line stays alive.
 * An aborted `signal` cancels the request and rejects with `isAbort` set, which is not a network failure.
 */
export function sendForm<T>(
  method: 'POST' | 'PATCH',
  path: string,
  form: FormData,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ClientResponseError({ url: path, status: 0, response: {}, isAbort: true }))
      return
    }
    const url = pb.baseURL.replace(/\/+$/, '') + path
    const xhr = new XMLHttpRequest()
    let timer: ReturnType<typeof setTimeout> | undefined
    const settle = (fn: () => void) => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      fn()
    }
    const onAbort = () => xhr.abort()
    const arm = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        reject(new Error('timeout'))
        xhr.abort()
      }, BOOTSTRAP_TIMEOUT_MS)
    }
    const failure = (status: number, isAbort = false) => new ClientResponseError({ url, status, response: {}, isAbort })

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
      if (xhr.status >= 200 && xhr.status < 300) resolve(parseBody(xhr.responseText) as T)
      else reject(errorFromResponse(url, xhr.status, xhr.responseText))
    })
    xhr.onerror = () => settle(() => reject(failure(0)))
    xhr.onabort = () => settle(() => reject(failure(0, true)))
    signal?.addEventListener('abort', onAbort, { once: true })
    arm()
    xhr.send(form)
  })
}
