/**
 * Prompt Generator
 * Generates relevant prompts based on business analysis
 */

import { generateText, createGateway } from 'ai'
import type { BusinessAnalysis } from './analyze'
import { trackCost } from './costs'

// Initialize Vercel AI Gateway
const gateway = createGateway({
  apiKey: process.env.VERCEL_AI_GATEWAY_KEY || process.env.AI_GATEWAY_API_KEY || '',
})

export interface GeneratedPrompt {
  text: string
  category: 'general' | 'location' | 'service' | 'comparison' | 'recommendation'
}

const PROMPT_GENERATION_TEMPLATE = `You are helping generate search prompts to test if AI assistants (ChatGPT, Claude, Gemini) will recommend a specific business.

Business Details:
- Name: {businessName}
- Type: {businessType}
- Services: {services}
- Products: {products}
- Primary Location: {location}
- All Locations/Service Areas: {allLocations}
- Target Audience: {targetAudience}
- Industry: {industry}
- Key Phrases: {keyPhrases}

---

Generate exactly {promptCount} prompts that a potential customer might ask an AI assistant when looking for this type of business.

CRITICAL RULE - LOCATION IS MANDATORY:
If a location is provided above (not "Not specified"), you MUST include a location in EVERY SINGLE PROMPT.
- WRONG: "Who are the leading AI consulting firms for small businesses?"
- CORRECT: "Who are the leading AI consulting firms for small businesses in Sydney, Australia?"
- WRONG: "What companies offer web development services?"
- CORRECT: "What companies offer web development services in Melbourne?"

{multiLocationInstructions}

This is essential because AI assistants often give location-specific recommendations.

Categories to cover (distribute evenly across locations if multiple):
1. General discovery: "What companies offer X in [location]?"
2. Service-specific: "I need help with [specific service] in [location]"
3. Comparison: "What are the best [business type] companies in [location]?"
4. Recommendation: "Can you recommend a [business type] in [location]?"
5. Problem-solving: "I'm having trouble with [problem], who can help in [location]?"

Important:
- ALWAYS include location in every prompt (this cannot be overstated)
- Make prompts sound natural and conversational
- Focus on problems the business solves
- Vary the phrasing (don't always start with "Who" or "What")
- Include specific services AND products mentioned in the business details
- If location includes city AND country (e.g. "Sydney, Australia"), use both

Respond with a JSON array of objects, each with:
- text: The prompt text
- category: One of "general", "location", "service", "comparison", "recommendation"

Return ONLY valid JSON array, no other text.`

export async function generatePrompts(
  analysis: BusinessAnalysis,
  domain: string,
  runId?: string
): Promise<GeneratedPrompt[]> {
  try {
    // Combine all locations - primary + additional locations
    const allLocations: string[] = []
    if (analysis.location) {
      allLocations.push(analysis.location)
    }
    if (analysis.locations && analysis.locations.length > 0) {
      for (const loc of analysis.locations) {
        if (!allLocations.includes(loc)) {
          allLocations.push(loc)
        }
      }
    }

    // If multiple locations, generate more prompts to cover each
    const hasMultipleLocations = allLocations.length > 1
    const promptCount = hasMultipleLocations ? Math.min(15, 5 + allLocations.length * 2) : 10

    const multiLocationInstructions = hasMultipleLocations
      ? `MULTIPLE LOCATIONS: This business serves ${allLocations.length} locations: ${allLocations.join(', ')}.
         You MUST distribute prompts across these locations. For each location, generate at least 2 prompts.
         Mix up which location you use for each category.`
      : ''

    const prompt = PROMPT_GENERATION_TEMPLATE
      .replace('{businessName}', analysis.businessName || domain)
      .replace('{businessType}', analysis.businessType)
      .replace('{services}', analysis.services.join(', ') || 'Not specified')
      .replace('{products}', analysis.products?.join(', ') || 'Not specified')
      .replace('{location}', analysis.location || 'Not specified')
      .replace('{allLocations}', allLocations.length > 0 ? allLocations.join(', ') : 'Not specified')
      .replace('{targetAudience}', analysis.targetAudience || 'Not specified')
      .replace('{industry}', analysis.industry)
      .replace('{keyPhrases}', analysis.keyPhrases.join(', ') || 'None')
      .replace('{promptCount}', String(promptCount))
      .replace('{multiLocationInstructions}', multiLocationInstructions)

    const modelString = 'openai/gpt-4o'
    const result = await generateText({
      model: gateway(modelString),
      prompt,
      maxOutputTokens: 2000,
    })

    // Track cost if runId is provided
    if (runId && result.usage) {
      await trackCost({
        runId,
        step: 'prompts',
        model: modelString,
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
      })
    }

    const text = result.text

    // Parse JSON response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('No JSON array found in response')
    }

    const prompts = JSON.parse(jsonMatch[0]) as GeneratedPrompt[]

    // Validate and limit
    return prompts
      .filter((p) => p.text && p.category)
      .slice(0, promptCount)
      .map((p) => ({
        text: p.text,
        category: ['general', 'location', 'service', 'comparison', 'recommendation'].includes(
          p.category
        )
          ? (p.category as GeneratedPrompt['category'])
          : 'general',
      }))
  } catch (error) {
    console.error('Error generating prompts:', error)

    // Return fallback prompts on error
    return generateFallbackPrompts(analysis, domain)
  }
}

/**
 * Fallback prompts if LLM generation fails
 * Always includes location when available
 */
function generateFallbackPrompts(
  analysis: BusinessAnalysis,
  domain: string
): GeneratedPrompt[] {
  const businessType = analysis.businessType || 'business'
  const location = analysis.location || ''
  const service = analysis.services[0] || businessType
  const locationSuffix = location ? ` in ${location}` : ''

  const prompts: GeneratedPrompt[] = [
    {
      text: `What companies offer ${businessType} services${locationSuffix}?`,
      category: 'general',
    },
    {
      text: `Can you recommend a good ${businessType}${locationSuffix}?`,
      category: 'recommendation',
    },
    {
      text: `I'm looking for ${service} help${locationSuffix}. Who should I contact?`,
      category: 'service',
    },
    {
      text: `What are the best ${businessType} companies${locationSuffix}?`,
      category: 'comparison',
    },
    {
      text: `Who provides ${service} services${locationSuffix}?`,
      category: 'service',
    },
    {
      text: `Who is the leading ${businessType} provider${locationSuffix}?`,
      category: 'comparison',
    },
    {
      text: `I need help with ${service}${locationSuffix}. What are my options?`,
      category: 'service',
    },
    {
      text: `Which ${businessType} would you recommend${locationSuffix}?`,
      category: 'recommendation',
    },
    {
      text: `What should I look for when choosing a ${businessType}${locationSuffix}?`,
      category: 'general',
    },
    {
      text: `How do I find a reliable ${service} provider${locationSuffix}?`,
      category: 'recommendation',
    },
  ]

  return prompts.slice(0, 10)
}
