import { nextTick, watch, type Ref } from 'vue'

type Focusable = Ref<{ $el: HTMLElement } | null>

/** A disabled button drops the focus, so a keyboard user gets it back on the same button when the change is over. */
export function useBusyFocus(busy: () => boolean, buttons: Focusable[]) {
  let focused: { $el: HTMLElement } | null = null
  watch(busy, async (now) => {
    if (now) {
      const active = document.activeElement
      focused = buttons.map(r => r.value).find(r => r?.$el === active) ?? null
      return
    }
    const target = focused
    focused = null
    await nextTick()
    if (target?.$el.isConnected && (!document.activeElement || document.activeElement === document.body)) target.$el.focus()
  })
}
