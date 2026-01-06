/**
 * Business Analyzer
 * Uses LLM to analyze website content and identify what the business does
 */

import { generateText, createGateway } from 'ai'
import { trackCost } from './costs'

// Initialize Vercel AI Gateway
const gateway = createGateway({
  apiKey: process.env.VERCEL_AI_GATEWAY_KEY || process.env.AI_GATEWAY_API_KEY || '',
})

export interface BusinessAnalysis {
  businessName: string | null
  businessType: string
  services: string[]
  location: string | null
  locations: string[]  // Multiple locations if business serves multiple areas
  targetAudience: string | null
  keyPhrases: string[]
  industry: string
  products: string[]  // Products extracted from schema or content
}

const ANALYSIS_PROMPT = `You are a business analyst. Analyze the following website content and extract key information about what this business does.

IMPORTANT: Pay special attention to any "LOCATIONS FROM SCHEMA MARKUP", "SERVICES FROM SCHEMA MARKUP", or "PRODUCTS FROM SCHEMA MARKUP" data at the top - this is structured data extracted from the website and should be prioritized.

Website Content:
{content}

{tldHint}
---

Respond with a JSON object containing:
- businessName: The name of the business (or null if not clear)
- businessType: A short description of what kind of business this is (e.g., "SEO consultancy", "plumbing services", "SaaS platform", "e-commerce store")
- services: An array of specific services offered (max 10). Include services from schema markup if available.
- products: An array of specific products offered (max 10). Include products from schema markup if available. Use empty array if none.
- location: The PRIMARY geographic location (e.g., "Sydney, Australia", "California, USA") or null
- locations: An array of ALL locations/service areas mentioned (e.g., ["Sydney, Australia", "Melbourne, Australia", "Brisbane, Australia"]). Include all locations from schema markup. Use empty array if only one location.
- targetAudience: Who the business serves (e.g., "small businesses", "enterprise companies", "homeowners")
- keyPhrases: Important phrases that describe what they do (max 10)
- industry: The broader industry category (e.g., "Marketing", "Home Services", "Technology", "Healthcare")

Return ONLY valid JSON, no other text.`

export async function analyzeWebsite(crawledContent: string, tldCountry: string | null = null, runId?: string): Promise<BusinessAnalysis> {
  try {
    const tldHint = tldCountry
      ? `Note: The website domain uses a ${tldCountry} country code TLD, suggesting this business may be located in or primarily serve ${tldCountry}. Look for location hints that confirm or clarify this.`
      : ''

    const prompt = ANALYSIS_PROMPT
      .replace('{content}', crawledContent.slice(0, 8000))
      .replace('{tldHint}', tldHint)

    const modelString = 'openai/gpt-4o'
    const result = await generateText({
      model: gateway(modelString),
      prompt,
      maxOutputTokens: 1000,
    })

    // Track cost if runId is provided
    if (runId && result.usage) {
      await trackCost({
        runId,
        step: 'analyze',
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
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const analysis = JSON.parse(jsonMatch[0]) as BusinessAnalysis

    // Validate and sanitize
    return {
      businessName: analysis.businessName || null,
      businessType: analysis.businessType || 'Unknown business type',
      services: Array.isArray(analysis.services) ? analysis.services.slice(0, 10) : [],
      products: Array.isArray(analysis.products) ? analysis.products.slice(0, 10) : [],
      location: analysis.location || null,
      locations: Array.isArray(analysis.locations) ? analysis.locations.slice(0, 10) : [],
      targetAudience: analysis.targetAudience || null,
      keyPhrases: Array.isArray(analysis.keyPhrases) ? analysis.keyPhrases.slice(0, 10) : [],
      industry: analysis.industry || 'General',
    }
  } catch (error) {
    console.error('Error analyzing website:', error)
    console.error('Gateway API key present:', !!(process.env.VERCEL_AI_GATEWAY_KEY || process.env.AI_GATEWAY_API_KEY))
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }

    // Return default analysis on error
    return {
      businessName: null,
      businessType: 'Business website',
      services: [],
      products: [],
      location: null,
      locations: [],
      targetAudience: null,
      keyPhrases: [],
      industry: 'General',
    }
  }
}
