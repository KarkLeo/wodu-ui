/**
 * `text` cut to at most `max` UTF-16 units. An emoji the limit would split is dropped whole: half of
 * one is a lone surrogate, and PocketBase refuses a body that holds it.
 */
export function cutText(text: string, max: number): string {
  if (text.length <= max) return text
  const last = text.charCodeAt(max - 1)
  const splitsPair = last >= 0xd800 && last <= 0xdbff
  return text.slice(0, splitsPair ? max - 1 : max)
}
