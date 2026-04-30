// Единая точка истины для адаптивных breakpoints.
// CSS @media-правила используют те же числа вручную (PostCSS @custom-media
// не подключён). Если меняешь значение — синхронно обнови все @media в
// src/assets/main.css и компонентах: see /BREAKPOINTS-ANCHOR/ комментарий
// в main.css для списка точек.
export const BP_MOBILE_MAX = 719  // включительно — телефон
export const BP_TABLET_MAX = 960  // включительно — планшет / узкий ландшафт

export const MQ_MOBILE = `(max-width: ${BP_MOBILE_MAX}px)`
export const MQ_TABLET = `(max-width: ${BP_TABLET_MAX}px)`
