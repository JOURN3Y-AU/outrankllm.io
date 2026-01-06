/**
 * Business Analyzer
 * Uses LLM to analyze website content and identify what the business does
 */

import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

// Initialize OpenAI via Vercel AI Gateway
const openai = createOpenAI({
  // Vercel AI Gateway will handle the API key
  apiKey: process.env.OPENAI_API_KEY || '',
})

export interface BusinessAnalysis {
  businessName: string | null
  businessType: string
  services: string[]
  location: string | null
  targetAudience: string | null
  keyPhrases: string[]
  industry: string
}

const ANALYSIS_PROMPT = `You are a business analyst. Analyze the following website content and extract key information about what this business does.

Website Content:
{content}

---

Respond with a JSON object containing:
- businessName: The name of the business (or null if not clear)
- businessType: A short description of what kind of business this is (e.g., "SEO consultancy", "plumbing services", "SaaS platform", "e-commerce store")
- services: An array of specific services or products offered (max 10)
- location: Geographic location if mentioned (e.g., "Sydney, Australia", "California, USA") or null
- targetAudience: Who the business serves (e.g., "small businesses", "enterprise companies", "homeowners")
- keyPhrases: Important phrases that describe what they do (max 10)
- industry: The broader industry category (e.g., "Marketing", "Home Services", "Technology", "Healthcare")

Return ONLY valid JSON, no other text.`

export async function analyzeWebsite(crawledContent: string): Promise<BusinessAnalysis> {
  try {
    const prompt = ANALYSIS_PROMPT.replace('{content}', crawledContent.slice(0, 8000))

    const { text } = await generateText({
      model: openai('gpt-4o'),
      prompt,
      maxOutputTokens: 1000,
    })

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
      location: analysis.location || null,
      targetAudience: analysis.targetAudience || null,
      keyPhrases: Array.isArray(analysis.keyPhrases) ? analysis.keyPhrases.slice(0, 10) : [],
      industry: analysis.industry || 'General',
    }
  } catch (error) {
    console.error('Error analyzing website:', error)

    // Return default analysis on error
    return {
      businessName: null,
      businessType: 'Business website',
      services: [],
      location: null,
      targetAudience: null,
      keyPhrases: [],
      industry: 'General',
    }
  }
}
