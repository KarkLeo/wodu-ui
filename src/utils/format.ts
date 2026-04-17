const TIER_RE = /(На\s+10\+:?|На\s+7[–-]9:?|На\s+провале:?)/g

export function wrapRoll(text: string): string {
  return text.replace(/(брось(?:те)?[+]\S+)/g, '<span class="fmt-roll">$1</span>')
}

// Fallback для ходов без структурированных полей: разбивает тиры через regex
export function formatMove(text: string): string {
  const parts = text.split(TIER_RE)

  if (parts.length <= 1) return wrapRoll(text)

  const trigger = wrapRoll(parts[0].trimEnd())
  let html = `<span class="fmt-trigger">${trigger}</span><ul class="fmt-tiers">`

  for (let i = 1; i < parts.length; i += 2) {
    const marker = parts[i]
    const body = wrapRoll((parts[i + 1] ?? '').trim())
    const cls = marker.includes('10+') ? 'fmt-success'
              : marker.includes('провале') ? 'fmt-fail'
              : 'fmt-partial'
    html += `<li><span class="${cls}">${marker}</span> ${body}</li>`
  }

  return html + '</ul>'
}
