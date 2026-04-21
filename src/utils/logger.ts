type LogFn = (msg: string, data?: unknown) => void
export interface Logger {
  debug: LogFn
  info: LogFn
  warn: LogFn
  error: LogFn
}

const DEV = import.meta.env.DEV

const noop: LogFn = () => {}
const noopLogger: Logger = { debug: noop, info: noop, warn: noop, error: noop }

const NAMESPACE_COLORS: Record<string, string> = {
  'dice':              '#d4a853',
  'dice-box':          '#b8860b',
  'store:characters':  '#6aa84f',
  'store:creation':    '#38761d',
  'store:roll-history': '#93c47d',
  'domain':            '#c27ba0',
  'creation':          '#3d85c6',
  'levelup':           '#674ea7',
  'active-char':       '#0b5394',
  'router':            '#e69138',
}

function colorFor(ns: string): string {
  return NAMESPACE_COLORS[ns] ?? '#888'
}

function make(level: 'debug' | 'info' | 'warn' | 'error', ns: string): LogFn {
  const color = colorFor(ns)
  const prefix = `%c${ns}%c`
  const nsStyle = `color:${color};font-weight:bold`
  const reset = 'color:inherit;font-weight:normal'
  const fn = console[level].bind(console)
  return (msg, data) => {
    if (data === undefined) fn(prefix, nsStyle, reset, msg)
    else fn(prefix, nsStyle, reset, msg, data)
  }
}

export function createLogger(namespace: string): Logger {
  if (!DEV) return noopLogger
  return {
    debug: make('debug', namespace),
    info: make('info', namespace),
    warn: make('warn', namespace),
    error: make('error', namespace),
  }
}
