import { NextRequest, NextResponse } from 'next/server'
import { generateText, createGateway } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createPerplexity } from '@ai-sdk/perplexity'
import { getAdminSession } from '@/lib/admin'
import {
  CLAUDE_MODEL,
  CLAUDE_GATEWAY_MODEL,
  CLAUDE_PROVIDER_OPTIONS,
  isModelUnavailableError,
} from '@/lib/ai/anthropic-model'

// Constructed exactly as in src/lib/ai/search-providers.ts, so this checks what
// the scan actually runs rather than an approximation of it.
const gateway = createGateway({
  apiKey: process.env.VERCEL_AI_GATEWAY_KEY || process.env.AI_GATEWAY_API_KEY || '',
})
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY || '',
})
const perplexity = createPerplexity({ apiKey: process.env.PERPLEXITY_API_KEY || '' })

/**
 * Admin endpoint that pings every model the scan pipeline depends on.
 *
 * Exists because `claude-sonnet-4-20250514` was retired on 2026-06-15 and every
 * Claude query 404'd for two months without anyone noticing — the errors were
 * recorded as ordinary results. Hit this after any model change, or when a
 * platform's results start looking wrong.
 *
 * Auth matches /api/admin/rescan: an `x-admin-secret` header for programmatic
 * checks (CI, deploy smoke test), or an admin session cookie for the admin UI.
 *
 * GET /api/admin/model-health
 *   → 200 { healthy: true,  models: [...] }
 *   → 503 { healthy: false, models: [...] }   (at least one model is unreachable)
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Every model the scan pipeline actually calls.
 *
 * Most of the pipeline (src/lib/ai/search-providers.ts, brand-awareness.ts) uses
 * the vendor SDKs directly; only a few paths go through the Vercel AI Gateway.
 * Both are checked, because a model ID can be retired from either independently.
 */
const CHECKS = [
  // search-providers.ts — the main scan
  { platform: 'chatgpt', model: 'gpt-4o-mini', via: 'openai' as const },
  { platform: 'chatgpt', model: 'o4-mini', via: 'openai' as const },
  { platform: 'claude', model: CLAUDE_MODEL, via: 'anthropic' as const },
  { platform: 'gemini', model: 'gemini-2.5-flash', via: 'google' as const },
  { platform: 'perplexity', model: 'sonar-pro', via: 'perplexity' as const },
  // brand-awareness.ts / query-research.ts / employer-research.ts
  { platform: 'chatgpt', model: 'gpt-4o', via: 'openai' as const },
  { platform: 'claude', model: CLAUDE_GATEWAY_MODEL, via: 'gateway' as const },
]

type Via = 'openai' | 'anthropic' | 'google' | 'perplexity' | 'gateway'

interface ModelStatus {
  platform: string
  model: string
  via: Via
  ok: boolean
  error: string | null
  /** True when the failure is a retired/inaccessible model ID, not a transient error. */
  unavailable?: boolean
}

/**
 * Cheapest round trip that still proves the model ID resolves.
 *
 * Deliberately goes through the same `ai` SDK providers the scan pipeline uses,
 * rather than raw fetch. The gateway authenticates via Vercel OIDC when no
 * explicit key is set, so a hand-rolled Bearer request reports a false failure
 * in production while the real scan path works fine.
 */
async function ping(check: (typeof CHECKS)[number]): Promise<ModelStatus> {
  const base: Omit<ModelStatus, 'ok' | 'error'> = {
    platform: check.platform,
    model: check.model,
    via: check.via,
  }

  const providers: Record<Via, (id: string) => Parameters<typeof generateText>[0]['model']> = {
    openai: (id) => openai(id),
    anthropic: (id) => anthropic(id),
    google: (id) => google(id),
    perplexity: (id) => perplexity(id),
    gateway: (id) => gateway(id),
  }

  try {
    await generateText({
      model: providers[check.via](check.model),
      prompt: 'Say OK.',
      // OpenAI and Perplexity both reject a max-token cap below 16.
      maxOutputTokens: 16,
      providerOptions: CLAUDE_PROVIDER_OPTIONS,
    })
    return { ...base, ok: true, error: null }
  } catch (error) {
    return {
      ...base,
      ok: false,
      error: error instanceof Error ? error.message : 'Request failed',
      unavailable: isModelUnavailableError(error),
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const adminSecret = request.headers.get('x-admin-secret')
    const hasValidSecret = !!adminSecret && adminSecret === process.env.ADMIN_SECRET
    const adminSession = await getAdminSession()

    if (!hasValidSecret && !adminSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const models = await Promise.all(CHECKS.map(ping))
    const unhealthy = models.filter((m) => !m.ok)

    if (unhealthy.length > 0) {
      console.error(
        `🚨 [MODEL_HEALTH] ${unhealthy.length} of ${models.length} models unreachable: ` +
          unhealthy.map((m) => `${m.model} (${m.via}) → ${m.error}`).join('; ')
      )
    }

    return NextResponse.json(
      {
        healthy: unhealthy.length === 0,
        checkedAt: new Date().toISOString(),
        models,
        hint:
          unhealthy.length > 0
            ? 'Update CLAUDE_MODEL in src/lib/ai/anthropic-model.ts and add pricing in src/lib/ai/costs.ts.'
            : undefined,
      },
      { status: unhealthy.length === 0 ? 200 : 503 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
