import { ref, watch, onBeforeUnmount, type Ref } from 'vue'

export interface DebouncedField {
  value: Ref<string>
  onInput: (v: string) => void
  flush: () => void
}

export function useDebouncedField(
  source: () => string,
  commit: (v: string) => void,
  delayMs = 300,
): DebouncedField {
  const value = ref(source())
  let timer: number | null = null
  let dirty = false

  watch(source, (next) => {
    if (!dirty) value.value = next
  })

  function clearTimer() {
    if (timer != null) {
      window.clearTimeout(timer)
      timer = null
    }
  }

  function flush() {
    clearTimer()
    if (!dirty) return
    dirty = false
    commit(value.value)
  }

  function onInput(v: string) {
    value.value = v
    dirty = true
    clearTimer()
    timer = window.setTimeout(() => {
      timer = null
      dirty = false
      commit(value.value)
    }, delayMs)
  }

  onBeforeUnmount(flush)

  return { value, onInput, flush }
}
