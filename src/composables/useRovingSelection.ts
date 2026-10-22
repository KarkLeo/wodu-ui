import { nextTick, type Ref } from 'vue'

interface RovingItem<T> {
  value: T
  disabled?: boolean
}

const NEXT_KEYS = ['ArrowRight', 'ArrowDown']
const PREV_KEYS = ['ArrowLeft', 'ArrowUp']

// Single-select widgets (tabs, radio groups): one tab stop on the selected item,
// arrow keys / Home / End move and select, skipping disabled items.
export function useRovingSelection<T>(items: () => RovingItem<T>[], model: Ref<T>) {
  function enabled(): T[] {
    return items().filter((i) => !i.disabled).map((i) => i.value)
  }

  function tabIndexFor(value: T): 0 | -1 {
    const values = enabled()
    const current = values.includes(model.value) ? model.value : values[0]
    return value === current ? 0 : -1
  }

  function onKeydown(e: KeyboardEvent) {
    const values = enabled()
    if (!values.length) return
    const i = values.indexOf(model.value)
    let next: T | undefined
    if (NEXT_KEYS.includes(e.key)) next = values[(i + 1) % values.length]
    else if (PREV_KEYS.includes(e.key)) next = values[(i - 1 + values.length) % values.length]
    else if (e.key === 'Home') next = values[0]
    else if (e.key === 'End') next = values[values.length - 1]
    if (next === undefined) return

    e.preventDefault()
    model.value = next
    const group = (e.currentTarget as HTMLElement).parentElement
    void nextTick(() => {
      group?.querySelector<HTMLElement>('[tabindex="0"]')?.focus()
    })
  }

  return { tabIndexFor, onKeydown }
}
