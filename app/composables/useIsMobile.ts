import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { MQ_MOBILE } from './breakpoints'

export function useIsMobile(): Ref<boolean> {
  const isMobile = ref(false)

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return isMobile
  }

  const mql = window.matchMedia(MQ_MOBILE)
  const update = () => {
    isMobile.value = mql.matches
  }

  onMounted(() => {
    update()
    mql.addEventListener('change', update)
  })
  onBeforeUnmount(() => {
    mql.removeEventListener('change', update)
  })

  return isMobile
}
