import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin'
import { CLAUDE_MODEL, CLAUDE_GATEWAY_MODEL } from '@/lib/ai/anthropic-model'

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

/** Every model the pipeline calls, and how it is addressed. */
const CHECKS = [
  { platform: 'claude', model: CLAUDE_MODEL, via: 'anthropic' as const },
  { platform: 'claude', model: CLAUDE_GATEWAY_MODEL, via: 'gateway' as const },
  { platform: 'chatgpt', model: 'openai/gpt-4o', via: 'gateway' as const },
  { platform: 'gemini', model: 'google/gemini-2.0-flash', via: 'gateway' as const },
  { platform: 'perplexity', model: 'perplexity/sonar-pro', via: 'gateway' as const },
]

interface ModelStatus {
  platform: string
  model: string
  via: 'anthropic' | 'gateway'
  ok: boolean
  status: number | null
  error: string | null
}

/** Cheapest possible round trip that still proves the model ID resolves. */
async function ping(check: (typeof CHECKS)[number]): Promise<ModelStatus> {
  const base: Omit<ModelStatus, 'ok' | 'status' | 'error'> = {
    platform: check.platform,
    model: check.model,
    via: check.via,
  }

  try {
    const response =
      check.via === 'anthropic'
        ? await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': process.env.ANTHROPIC_API_KEY || '',
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: check.model,
              max_tokens: 1,
              messages: [{ role: 'user', content: 'ping' }],
            }),
          })
        : await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
            method: 'POST',
            headers: {
              authorization: `Bearer ${process.env.VERCEL_AI_GATEWAY_KEY || process.env.AI_GATEWAY_API_KEY || ''}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: check.model,
              max_tokens: 1,
              messages: [{ role: 'user', content: 'ping' }],
            }),
          })

    if (response.ok) {
      return { ...base, ok: true, status: response.status, error: null }
    }

    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null

    return {
      ...base,
      ok: false,
      status: response.status,
      error: body?.error?.message ?? `HTTP ${response.status}`,
    }
  } catch (error) {
    return {
      ...base,
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : 'Request failed',
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
