/** When this build was made, in the reader's locale; shown next to the version. */
export function buildDate(locale: string): string {
  return new Date(__BUILD_TIMESTAMP__).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
