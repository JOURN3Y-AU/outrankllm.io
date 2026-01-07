/**
 * Lightweight colored logger for local dev debugging
 * Usage: log.info(scanId, 'message') or log.step(scanId, 'Crawling', 'complete')
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
}

const platformColors: Record<string, string> = {
  chatgpt: colors.green,
  claude: colors.magenta,
  gemini: colors.blue,
  perplexity: colors.cyan,
}

// Track timing per scan
const scanTimers: Map<string, number> = new Map()

function getElapsed(scanId: string): string {
  const start = scanTimers.get(scanId)
  if (!start) return ''
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  return `${colors.gray}+${elapsed}s${colors.reset}`
}

function shortId(scanId: string): string {
  return scanId.slice(0, 8)
}

export const log = {
  /** Start timing a scan */
  start(scanId: string, domain: string) {
    scanTimers.set(scanId, Date.now())
    console.log(
      `\n${colors.bright}${colors.cyan}━━━ SCAN START ━━━${colors.reset}`,
      `${colors.yellow}${shortId(scanId)}${colors.reset}`,
      `${colors.bright}${domain}${colors.reset}\n`
    )
  },

  /** Log a major step starting */
  step(scanId: string, step: string, detail?: string) {
    const detailStr = detail ? ` ${colors.dim}${detail}${colors.reset}` : ''
    console.log(
      `${colors.cyan}▶${colors.reset}`,
      `${colors.yellow}[${shortId(scanId)}]${colors.reset}`,
      `${colors.bright}${step}${colors.reset}${detailStr}`,
      getElapsed(scanId)
    )
  },

  /** Log step completion */
  done(scanId: string, step: string, result?: string) {
    const resultStr = result ? ` → ${colors.green}${result}${colors.reset}` : ''
    console.log(
      `${colors.green}✓${colors.reset}`,
      `${colors.yellow}[${shortId(scanId)}]${colors.reset}`,
      `${step}${resultStr}`,
      getElapsed(scanId)
    )
  },

  /** Log info message */
  info(scanId: string, message: string) {
    console.log(
      `${colors.blue}ℹ${colors.reset}`,
      `${colors.yellow}[${shortId(scanId)}]${colors.reset}`,
      message,
      getElapsed(scanId)
    )
  },

  /** Log a warning */
  warn(scanId: string, message: string) {
    console.log(
      `${colors.yellow}⚠${colors.reset}`,
      `${colors.yellow}[${shortId(scanId)}]${colors.reset}`,
      `${colors.yellow}${message}${colors.reset}`,
      getElapsed(scanId)
    )
  },

  /** Log an error */
  error(scanId: string, message: string, error?: unknown) {
    console.log(
      `${colors.red}✗${colors.reset}`,
      `${colors.yellow}[${shortId(scanId)}]${colors.reset}`,
      `${colors.red}${message}${colors.reset}`,
      getElapsed(scanId)
    )
    if (error) {
      console.log(`  ${colors.dim}${error instanceof Error ? error.message : String(error)}${colors.reset}`)
    }
  },

  /** Log platform-specific activity (LLM queries) */
  platform(scanId: string, platform: string, message: string) {
    const color = platformColors[platform.toLowerCase()] || colors.gray
    console.log(
      `${color}●${colors.reset}`,
      `${colors.yellow}[${shortId(scanId)}]${colors.reset}`,
      `${color}${platform}${colors.reset}`,
      message,
      getElapsed(scanId)
    )
  },

  /** Log query progress */
  progress(_scanId: string, completed: number, total: number, label = 'queries') {
    const pct = Math.round((completed / total) * 100)
    const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5))
    console.log(
      `${colors.gray}  ${bar} ${pct}% (${completed}/${total} ${label})${colors.reset}`
    )
  },

  /** End timing a scan */
  end(scanId: string, success: boolean) {
    const elapsed = scanTimers.get(scanId)
    const duration = elapsed ? ((Date.now() - elapsed) / 1000).toFixed(1) : '?'
    scanTimers.delete(scanId)

    if (success) {
      console.log(
        `\n${colors.bright}${colors.green}━━━ SCAN COMPLETE ━━━${colors.reset}`,
        `${colors.yellow}${shortId(scanId)}${colors.reset}`,
        `${colors.dim}${duration}s${colors.reset}\n`
      )
    } else {
      console.log(
        `\n${colors.bright}${colors.red}━━━ SCAN FAILED ━━━${colors.reset}`,
        `${colors.yellow}${shortId(scanId)}${colors.reset}`,
        `${colors.dim}${duration}s${colors.reset}\n`
      )
    }
  },

  /** Log a data object (pretty printed) */
  data(_scanId: string, label: string, data: Record<string, unknown>) {
    console.log(
      `${colors.gray}  ${label}:${colors.reset}`
    )
    for (const [key, value] of Object.entries(data)) {
      const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value)
      console.log(`${colors.gray}    ${key}: ${colors.reset}${valStr}`)
    }
  },

  /** Log all questions at the start of a query phase */
  questions(scanId: string, phase: string, questions: string[]) {
    console.log(
      `\n${colors.cyan}┌─${colors.reset}`,
      `${colors.yellow}[${shortId(scanId)}]${colors.reset}`,
      `${colors.bright}${phase}${colors.reset}`,
      `${colors.dim}(${questions.length} questions)${colors.reset}`,
      getElapsed(scanId)
    )
    questions.forEach((q, i) => {
      const num = `${i + 1}`.padStart(2, ' ')
      const truncated = q.length > 80 ? q.slice(0, 77) + '...' : q
      console.log(
        `${colors.cyan}│${colors.reset}`,
        `${colors.gray}${num}.${colors.reset}`,
        `${colors.dim}${truncated}${colors.reset}`
      )
    })
    console.log(`${colors.cyan}└─${colors.reset}`)
  },

  /** Log current question being processed */
  questionStart(scanId: string, index: number, total: number, question: string) {
    const num = `${index + 1}/${total}`
    const truncated = question.length > 60 ? question.slice(0, 57) + '...' : question
    console.log(
      `${colors.yellow}▸${colors.reset}`,
      `${colors.yellow}[${shortId(scanId)}]${colors.reset}`,
      `${colors.bright}Q${num}${colors.reset}`,
      `${colors.dim}${truncated}${colors.reset}`,
      getElapsed(scanId)
    )
  },

  /** Log question completion with summary */
  questionDone(scanId: string, index: number, total: number, platforms: { name: string; mentioned: boolean }[]) {
    const num = `${index + 1}/${total}`
    const summary = platforms
      .map(p => {
        const color = platformColors[p.name.toLowerCase()] || colors.gray
        const icon = p.mentioned ? '✓' : '✗'
        return `${color}${p.name}:${icon}${colors.reset}`
      })
      .join(' ')
    console.log(
      `${colors.green}✓${colors.reset}`,
      `${colors.yellow}[${shortId(scanId)}]${colors.reset}`,
      `${colors.dim}Q${num}${colors.reset}`,
      summary,
      getElapsed(scanId)
    )
  },
}