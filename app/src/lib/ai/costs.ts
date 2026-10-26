/**
 * AI Usage Cost Tracking
 * Tracks token usage and costs for each AI request
 * Uses the existing api_costs table from 001_initial_schema.sql
 */

import { createServiceClient } from '@/lib/supabase/server'

// Tavily pricing (per search, not per token)
// Source: https://tavily.com/pricing - ~$0.01 per search on paid plans
const TAVILY_COST_CENTS_PER_SEARCH = 1  // $0.01 = 1 cent

/**
 * OpenAI bills the built-in web_search tool per call, on top of tokens:
 * $10 per 1,000 calls = $0.01 = 1 cent.
 *
 * This was missing entirely until 2026-10-26, and it is the largest single
 * error in api_costs. The search model issues ~10 searches per query, so the
 * fee is roughly twice the token cost of the step it belongs to — the 18 Oct
 * batch recorded $10.81 for ChatGPT against a real ~$40. It also explains most
 * of the long-standing gap between the OpenAI invoice and what we record.
 *
 * Note the search *content* is already counted: results come back as billed
 * input tokens, which is why input is ~25k per call. This fee is the tool
 * invocation, not the content, so adding it is not double counting.
 */
const OPENAI_WEB_SEARCH_COST_CENTS_PER_CALL = 1

/**
 * Google Search grounding is NOT billed here, and that is correct today.
 *
 * Gemini 2.5 includes 1,500 grounded requests per day free, and search_gemini
 * issues roughly 50 on a batch day — so grounding costs nothing at current
 * volume. Recording a fee would overstate the bill.
 *
 * It is a cliff, not a discount. Past the free allowance Gemini 2.5 grounding
 * is $35 per 1,000 grounded prompts, which at ~200 prompts a week would be
 * ~$7/week against $0.58 of tokens — grounding would instantly become the
 * largest Gemini line. Gemini 3+ allows 5,000 free per month, then $14/1,000.
 *
 * If scan volume grows roughly 30x, or the model moves to a Gemini 3 line,
 * add the fee here the way estimateCostCents handles searchCalls.
 */

// Pricing per 1K tokens (as of Jan 2025)
// Source: https://vercel.com/docs/ai-gateway/pricing, https://openai.com/pricing, https://ai.google.dev/pricing
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  // o4-mini was deprecated by OpenAI on 2026-10-25. Kept priced so historical
  // api_costs rows still resolve; OPENAI_SEARCH_MODEL no longer points at it.
  'o4-mini': { input: 0.0011, output: 0.0044 },
  'o4-mini-search': { input: 0.0011, output: 0.0044 },
  'o3': { input: 0.002, output: 0.008 },  // Reasoning model — current OPENAI_SEARCH_MODEL
  // Token cost only. The web_search tool is billed separately per call, which
  // estimateCostCents adds via searchCalls — see OPENAI_WEB_SEARCH_COST_CENTS_PER_CALL.
  'o3-search': { input: 0.002, output: 0.008 },
  'gpt-4o-search': { input: 0.0025, output: 0.01 },  // gpt-4o with web search (outrankllm brand scans)
  // Anthropic
  // NOTE: when CLAUDE_MODEL changes in src/lib/ai/anthropic-model.ts, add the new
  // ID here too — an unpriced model silently tracks $0 cost.
  // $2/$10 per million. This was recorded at $3/$15 until 2026-10-26, which
  // overstated the biggest Anthropic line by 1.5x in every cost report.
  'claude-sonnet-5': { input: 0.002, output: 0.010 },
  // $0.10/$0.50 per million — 10x cheaper than Haiku 4.5 for the same job.
  // Used for the Claude platform simulation only (CLAUDE_SEARCH_MODEL).
  'claude-haiku-5-5': { input: 0.0001, output: 0.0005 },
  'claude-haiku-4-5': { input: 0.001, output: 0.005 },
  'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },  // retired 2026-06-15
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
  // Google — paid-tier rates from ai.google.dev/gemini-api/docs/pricing (2026-10-26).
  //
  // 2.5-flash was recorded at $0.15/$0.60 per million against a real
  // $0.30/$2.50, understating every Gemini line by 4.2x on output. Gemini is
  // output-heavy here (~1,200 tokens per grounded answer), so this was the
  // second-largest error in this file after the missing OpenAI search fee.
  //
  // Note on newer models: Gemini 3.x flash is NOT cheaper. gemini-3.6-flash and
  // gemini-3.8-flash are $0.75/$3.75 now and $1.50/$7.50 from 2027-01-01, and
  // gemini-3.5-flash-lite matches 2.5-flash exactly. The only cheaper option is
  // 2.5-flash-lite below.
  'gemini-2.0-flash': { input: 0.0001, output: 0.0004 },
  'gemini-2.5-flash': { input: 0.0003, output: 0.0025 },
  'gemini-2.5-flash-grounded': { input: 0.0003, output: 0.0025 },
  'gemini-2.5-flash-lite': { input: 0.0001, output: 0.0004 },
  'gemini-2.5-flash-lite-grounded': { input: 0.0001, output: 0.0004 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
  // Perplexity (sonar-pro pricing - includes search)
  'sonar-pro': { input: 0.003, output: 0.015 },
  'sonar': { input: 0.001, output: 0.001 },
}

// Map gateway model strings to pricing keys
const MODEL_MAP: Record<string, string> = {
  'openai/gpt-4o': 'gpt-4o',
  'openai/gpt-4o-mini': 'gpt-4o-mini',
  'openai/gpt-4-turbo': 'gpt-4-turbo',
  'openai/o4-mini': 'o4-mini',
  'openai/o4-mini-search': 'o4-mini-search',
  'openai/o3': 'o3',
  'openai/o3-search': 'o3-search',
  'openai/gpt-4o-search': 'gpt-4o-search',
  // Tavily fallback for the brand ChatGPT queries — a plain gpt-4o completion
  // over search results. Was unmapped, so every fallback tracked $0.
  'openai/gpt-4o-tavily': 'gpt-4o',
  'anthropic/claude-sonnet-5': 'claude-sonnet-5',
  'anthropic/claude-haiku-5-5': 'claude-haiku-5-5',
  'anthropic/claude-haiku-4-5': 'claude-haiku-4-5',
  'anthropic/claude-sonnet-4-20250514': 'claude-sonnet-4-20250514',
  'anthropic/claude-3-5-sonnet-20241022': 'claude-3-5-sonnet-20241022',
  'anthropic/claude-3-haiku-20240307': 'claude-3-haiku-20240307',
  'google/gemini-2.0-flash': 'gemini-2.0-flash',
  'google/gemini-2.5-flash': 'gemini-2.5-flash',
  'google/gemini-2.5-flash-grounded': 'gemini-2.5-flash-grounded',
  'google/gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
  'google/gemini-2.5-flash-lite-grounded': 'gemini-2.5-flash-lite-grounded',
  'google/gemini-1.5-pro': 'gemini-1.5-pro',
  // Perplexity
  'perplexity/sonar-pro': 'sonar-pro',
  'perplexity/sonar': 'sonar',
}

/**
 * Counts built-in web_search invocations in an AI SDK result so trackCost can
 * bill them. The SDK exposes one entry per tool call across `steps`; an older
 * SDK or a non-tool call has no steps, which correctly yields 0.
 */
export function countWebSearchCalls(result: unknown): number {
  const steps = (result as { steps?: Array<{ toolCalls?: unknown[] }> } | null)?.steps
  if (!Array.isArray(steps)) return 0
  return steps.reduce((n, step) => n + (Array.isArray(step?.toolCalls) ? step.toolCalls.length : 0), 0)
}

export interface UsageData {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface CostRecord {
  runId: string
  step: string  // 'analyze', 'prompts', 'query_chatgpt', 'query_claude', 'query_gemini', 'competitors'
  model: string
  usage: UsageData
  /**
   * Number of built-in web_search calls the model made. Billed per call on top
   * of tokens, so leaving it unset under-reports an OpenAI search step by more
   * than its token cost. Count it from the AI SDK result's steps.
   */
  searchCalls?: number
}

interface ApiCostRow {
  id: string
  run_id: string
  step: string
  model: string | null
  input_tokens: number | null
  output_tokens: number | null
  cost_cents: number | string | null
  created_at: string
}

/**
 * Calculate estimated cost in cents based on token usage
 */
export function estimateCostCents(
  model: string,
  usage: UsageData,
  searchCalls = 0
): number {
  const pricingKey = MODEL_MAP[model] || model
  const pricing = MODEL_PRICING[pricingKey]

  if (!pricing) {
    console.warn(`No pricing found for model: ${model}`)
    return 0
  }

  // Pricing is in dollars per 1K tokens, convert to cents
  const inputCost = (usage.inputTokens / 1000) * pricing.input * 100
  const outputCost = (usage.outputTokens / 1000) * pricing.output * 100
  const searchCost = searchCalls * OPENAI_WEB_SEARCH_COST_CENTS_PER_CALL

  return inputCost + outputCost + searchCost
}

/**
 * Track Tavily search cost in the api_costs table
 * Tavily charges per search, not per token
 */
export async function trackTavilyCost(runId: string, step: string, searchCount: number = 1): Promise<void> {
  try {
    const supabase = createServiceClient()
    const costCents = TAVILY_COST_CENTS_PER_SEARCH * searchCount

    await supabase.from('api_costs').insert({
      run_id: runId,
      step,
      model: 'tavily/search',
      input_tokens: 0,
      output_tokens: 0,
      cost_cents: costCents,
    })
  } catch (error) {
    // Don't fail the request if cost tracking fails
    console.error('Failed to track Tavily cost:', error)
  }
}

/**
 * Track AI usage cost in the api_costs table
 */
export async function trackCost(record: CostRecord): Promise<void> {
  try {
    const supabase = createServiceClient()
    const costCents = estimateCostCents(record.model, record.usage, record.searchCalls ?? 0)

    await supabase.from('api_costs').insert({
      run_id: record.runId,
      step: record.step,
      model: record.model,
      input_tokens: record.usage.inputTokens,
      output_tokens: record.usage.outputTokens,
      cost_cents: costCents,
    })
  } catch (error) {
    // Don't fail the request if cost tracking fails
    console.error('Failed to track AI cost:', error)
  }
}

/**
 * Get cost summary for a run
 */
export async function getRunCostSummary(runId: string): Promise<{
  totalCostCents: number
  totalInputTokens: number
  totalOutputTokens: number
  requestCount: number
  byStep: Record<string, { costCents: number; inputTokens: number; outputTokens: number; count: number }>
} | null> {
  try {
    const supabase = createServiceClient()

    const { data } = await supabase
      .from('api_costs')
      .select('*')
      .eq('run_id', runId)

    if (!data || data.length === 0) {
      return null
    }

    const byStep: Record<string, { costCents: number; inputTokens: number; outputTokens: number; count: number }> = {}

    for (const row of data) {
      if (!byStep[row.step]) {
        byStep[row.step] = { costCents: 0, inputTokens: 0, outputTokens: 0, count: 0 }
      }
      byStep[row.step].costCents += Number(row.cost_cents) || 0
      byStep[row.step].inputTokens += row.input_tokens || 0
      byStep[row.step].outputTokens += row.output_tokens || 0
      byStep[row.step].count += 1
    }

    return {
      totalCostCents: data.reduce((sum: number, row: ApiCostRow) => sum + (Number(row.cost_cents) || 0), 0),
      totalInputTokens: data.reduce((sum: number, row: ApiCostRow) => sum + (row.input_tokens || 0), 0),
      totalOutputTokens: data.reduce((sum: number, row: ApiCostRow) => sum + (row.output_tokens || 0), 0),
      requestCount: data.length,
      byStep,
    }
  } catch (error) {
    console.error('Failed to get run cost summary:', error)
    return null
  }
}
