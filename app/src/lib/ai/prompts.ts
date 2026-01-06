/**
 * Prompt Generator
 * Generates relevant prompts based on business analysis
 */

import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import type { BusinessAnalysis } from './analyze'

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
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
- Location: {location}
- Target Audience: {targetAudience}
- Industry: {industry}
- Key Phrases: {keyPhrases}

---

Generate exactly 10 prompts that a potential customer might ask an AI assistant when looking for this type of business. The prompts should be natural questions someone would ask.

Categories to cover:
1. General discovery (2-3 prompts): "What companies offer X?"
2. Location-specific (2-3 prompts): "Who provides X in [location]?" (if location is known)
3. Service-specific (2-3 prompts): "I need help with [specific service]"
4. Comparison (1-2 prompts): "What are the best [business type] companies?"
5. Recommendation (1-2 prompts): "Can you recommend a [business type]?"

Important:
- Make prompts sound natural and conversational
- Include the location in relevant prompts if known
- Focus on problems the business solves
- Vary the phrasing (don't always start with "Who" or "What")

Respond with a JSON array of objects, each with:
- text: The prompt text
- category: One of "general", "location", "service", "comparison", "recommendation"

Return ONLY valid JSON array, no other text.`

export async function generatePrompts(
  analysis: BusinessAnalysis,
  domain: string
): Promise<GeneratedPrompt[]> {
  try {
    const prompt = PROMPT_GENERATION_TEMPLATE
      .replace('{businessName}', analysis.businessName || domain)
      .replace('{businessType}', analysis.businessType)
      .replace('{services}', analysis.services.join(', ') || 'Not specified')
      .replace('{location}', analysis.location || 'Not specified')
      .replace('{targetAudience}', analysis.targetAudience || 'Not specified')
      .replace('{industry}', analysis.industry)
      .replace('{keyPhrases}', analysis.keyPhrases.join(', ') || 'None')

    const { text } = await generateText({
      model: openai('gpt-4o'),
      prompt,
      maxOutputTokens: 1500,
    })

    // Parse JSON response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('No JSON array found in response')
    }

    const prompts = JSON.parse(jsonMatch[0]) as GeneratedPrompt[]

    // Validate and limit to 10
    return prompts
      .filter((p) => p.text && p.category)
      .slice(0, 10)
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
 */
function generateFallbackPrompts(
  analysis: BusinessAnalysis,
  domain: string
): GeneratedPrompt[] {
  const businessType = analysis.businessType || 'business'
  const location = analysis.location || ''
  const service = analysis.services[0] || businessType

  const prompts: GeneratedPrompt[] = [
    {
      text: `What companies offer ${businessType} services?`,
      category: 'general',
    },
    {
      text: `Can you recommend a good ${businessType}?`,
      category: 'recommendation',
    },
    {
      text: `I'm looking for ${service} help. Who should I contact?`,
      category: 'service',
    },
    {
      text: `What are the best ${businessType} companies?`,
      category: 'comparison',
    },
    {
      text: `Who provides ${service} services?`,
      category: 'service',
    },
  ]

  // Add location-specific prompts if we have location
  if (location) {
    prompts.push({
      text: `Who is the best ${businessType} in ${location}?`,
      category: 'location',
    })
    prompts.push({
      text: `Can you recommend ${service} providers in ${location}?`,
      category: 'location',
    })
    prompts.push({
      text: `I need a ${businessType} near ${location}`,
      category: 'location',
    })
  }

  // Add more general prompts
  prompts.push({
    text: `What should I look for when choosing a ${businessType}?`,
    category: 'general',
  })
  prompts.push({
    text: `How do I find a reliable ${service} provider?`,
    category: 'recommendation',
  })

  return prompts.slice(0, 10)
}
