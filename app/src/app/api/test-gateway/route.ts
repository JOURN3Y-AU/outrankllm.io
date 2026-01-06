import { NextResponse } from 'next/server'
import { generateText, createGateway } from 'ai'

export async function GET() {
  const apiKey = process.env.VERCEL_AI_GATEWAY_KEY || process.env.AI_GATEWAY_API_KEY || ''

  const diagnostics: Record<string, unknown> = {
    hasApiKey: !!apiKey,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'none',
    envVarName: process.env.VERCEL_AI_GATEWAY_KEY ? 'VERCEL_AI_GATEWAY_KEY' :
                 process.env.AI_GATEWAY_API_KEY ? 'AI_GATEWAY_API_KEY' : 'none',
  }

  try {
    const gateway = createGateway({ apiKey })

    const { text } = await generateText({
      model: gateway('openai/gpt-4o'),
      prompt: 'Say "Gateway working!" and nothing else.',
      maxOutputTokens: 50,
    })

    diagnostics.success = true
    diagnostics.response = text

    return NextResponse.json(diagnostics)
  } catch (error) {
    diagnostics.success = false
    diagnostics.errorName = error instanceof Error ? error.name : 'Unknown'
    diagnostics.errorMessage = error instanceof Error ? error.message : String(error)

    return NextResponse.json(diagnostics, { status: 500 })
  }
}
