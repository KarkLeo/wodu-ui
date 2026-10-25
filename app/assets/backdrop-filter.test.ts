import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const appDir = resolve(__dirname, '..')

function styleFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return styleFiles(path)
    return /\.(vue|css)$/.test(entry.name) ? [path] : []
  })
}

// Lightning CSS (Vite 8's minifier) drops `backdrop-filter` when `-webkit-backdrop-filter`
// follows it in the same rule, leaving only the prefix that Chrome and Firefox ignore.
// The prefixed declaration has to come first.
describe('backdrop-filter declarations', () => {
  it('declare -webkit-backdrop-filter before backdrop-filter', () => {
    const offenders = styleFiles(appDir).flatMap((file) => {
      const lines = readFileSync(file, 'utf8').split('\n')
      return lines.flatMap((line, i) =>
        /^\s*backdrop-filter\s*:/.test(line) && /^\s*-webkit-backdrop-filter\s*:/.test(lines[i + 1] ?? '')
          ? [`${relative(appDir, file)}:${i + 1}`]
          : [],
      )
    })
    expect(offenders).toEqual([])
  })
})
