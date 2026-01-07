/**
 * AI Usage Cost Tracking
 * Tracks token usage and costs for each AI request
 * Uses the existing api_costs table from 001_initial_schema.sql
 */

import { createServiceClient } from '@/lib/supabase/server'

// Pricing per 1K tokens (as of Jan 2025)
// Source: https://vercel.com/docs/ai-gateway/pricing, https://openai.com/pricing, https://ai.google.dev/pricing
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'o4-mini': { input: 0.0011, output: 0.0044 },  // Reasoning model
  'o4-mini-search': { input: 0.0011, output: 0.0044 },  // o4-mini with web search
  // Anthropic
  'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
  // Google
  'gemini-2.0-flash': { input: 0.0001, output: 0.0004 },
  'gemini-2.5-flash': { input: 0.00015, output: 0.0006 },  // Newer flash model
  'gemini-2.5-flash-grounded': { input: 0.00015, output: 0.0006 },  // With search grounding
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
  'anthropic/claude-sonnet-4-20250514': 'claude-sonnet-4-20250514',
  'anthropic/claude-3-5-sonnet-20241022': 'claude-3-5-sonnet-20241022',
  'anthropic/claude-3-haiku-20240307': 'claude-3-haiku-20240307',
  'google/gemini-2.0-flash': 'gemini-2.0-flash',
  'google/gemini-2.5-flash': 'gemini-2.5-flash',
  'google/gemini-2.5-flash-grounded': 'gemini-2.5-flash-grounded',
  'google/gemini-1.5-pro': 'gemini-1.5-pro',
  // Perplexity
  'perplexity/sonar-pro': 'sonar-pro',
  'perplexity/sonar': 'sonar',
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
export function estimateCostCents(model: string, usage: UsageData): number {
  const pricingKey = MODEL_MAP[model] || model
  const pricing = MODEL_PRICING[pricingKey]

  if (!pricing) {
    console.warn(`No pricing found for model: ${model}`)
    return 0
  }

  // Pricing is in dollars per 1K tokens, convert to cents
  const inputCost = (usage.inputTokens / 1000) * pricing.input * 100
  const outputCost = (usage.outputTokens / 1000) * pricing.output * 100

  return inputCost + outputCost
}

/**
 * Track AI usage cost in the api_costs table
 */
export async function trackCost(record: CostRecord): Promise<void> {
  try {
    const supabase = createServiceClient()
    const costCents = estimateCostCents(record.model, record.usage)

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
