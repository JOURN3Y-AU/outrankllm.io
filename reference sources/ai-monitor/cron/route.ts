import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Allow up to 5 minutes for cron job to process all questions
export const maxDuration = 300

// Create a Supabase client with service role key for cron jobs (bypasses RLS)
function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey)
}

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET

// Known competitors to look for in responses
const KNOWN_COMPETITORS = [
  'Accenture', 'Deloitte', 'PwC', 'KPMG', 'EY',
  'Thoughtworks', 'Slalom', 'Publicis Sapient',
  'Datacom', 'DXC Technology', 'Infosys', 'Wipro', 'TCS',
  'IBM', 'Microsoft', 'Google Cloud', 'AWS',
  'Avanade', 'Capgemini', 'Cognizant',
  'DiUS', 'Elabor8', 'Servian', 'Contino', 'Mantel Group',
  'Versent', 'CMD Solutions', 'Mechanical Rock',
  'Hivery', 'Canva', 'Atlassian', 'SafetyCulture'
]

function extractCompetitors(text: string): { name: string; context: string }[] {
  const competitors: { name: string; context: string }[] = []
  const lowerText = text.toLowerCase()

  for (const competitor of KNOWN_COMPETITORS) {
    const lowerCompetitor = competitor.toLowerCase()
    if (lowerText.includes(lowerCompetitor)) {
      const index = lowerText.indexOf(lowerCompetitor)
      const start = Math.max(0, index - 50)
      const end = Math.min(text.length, index + competitor.length + 50)
      const context = text.substring(start, end).trim()
      competitors.push({ name: competitor, context: `...${context}...` })
    }
  }

  return competitors
}

function checkJourn3yMention(text: string): { mentioned: boolean; position: number | null } {
  const lowerText = text.toLowerCase()
  const variations = ['journ3y', 'journey ai', 'journ3y.com.au', 'journ3y ai']

  for (const variation of variations) {
    const index = lowerText.indexOf(variation)
    if (index !== -1) {
      const position = Math.ceil((index / text.length) * 3)
      return { mentioned: true, position }
    }
  }

  return { mentioned: false, position: null }
}

async function queryOpenAI(question: string): Promise<{ response: string; timeMs: number; error?: string }> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    return { response: '', timeMs: 0, error: 'OpenAI API key not configured' }
  }

  const openai = new OpenAI({ apiKey: openaiKey })
  const startTime = Date.now()

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant providing information about businesses and services. Be specific and mention company names when relevant.'
        },
        { role: 'user', content: question }
      ],
      max_tokens: 1000
    })

    const response = completion.choices[0]?.message?.content || ''
    return { response, timeMs: Date.now() - startTime }
  } catch (error) {
    console.error('OpenAI error:', error)
    return { response: '', timeMs: Date.now() - startTime, error: String(error) }
  }
}

async function queryClaude(question: string): Promise<{ response: string; timeMs: number; error?: string }> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    return { response: '', timeMs: 0, error: 'Anthropic API key not configured' }
  }

  const anthropic = new Anthropic({ apiKey: anthropicKey })
  const startTime = Date.now()

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: question
        }
      ],
      system: 'You are a helpful assistant providing information about businesses and services. Be specific and mention company names when relevant.'
    })

    const response = message.content[0]?.type === 'text' ? message.content[0].text : ''
    return { response, timeMs: Date.now() - startTime }
  } catch (error) {
    console.error('Claude error:', error)
    return { response: '', timeMs: Date.now() - startTime, error: String(error) }
  }
}

async function queryGemini(question: string): Promise<{ response: string; timeMs: number; error?: string }> {
  const googleApiKey = process.env.GOOGLE_AI_API_KEY
  if (!googleApiKey) {
    return { response: '', timeMs: 0, error: 'Google AI API key not configured' }
  }

  const genAI = new GoogleGenerativeAI(googleApiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
  const startTime = Date.now()

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: `You are a helpful assistant providing information about businesses and services. Be specific and mention company names when relevant.\n\n${question}` }]
        }
      ],
      generationConfig: {
        maxOutputTokens: 1000
      }
    })

    const response = result.response.text()
    return { response, timeMs: Date.now() - startTime }
  } catch (error) {
    console.error('Gemini error:', error)
    return { response: '', timeMs: Date.now() - startTime, error: String(error) }
  }
}

export async function GET(request: Request) {
  try {
    // Vercel cron jobs are automatically secured - they add CRON_SECRET to the request
    // For manual testing, we also accept Authorization header
    const authHeader = request.headers.get('authorization')
    const vercelCronSecret = request.headers.get('x-vercel-cron-secret')

    // Allow if: Vercel cron (no auth needed in production), or valid CRON_SECRET header
    const isVercelCron = process.env.VERCEL === '1'
    const hasValidSecret = CRON_SECRET && (
      authHeader === `Bearer ${CRON_SECRET}` ||
      vercelCronSecret === CRON_SECRET
    )

    if (!isVercelCron && !hasValidSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use service role client for cron jobs (bypasses RLS since no user session)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let supabase
    try {
      supabase = createServiceClient() as any
    } catch (e) {
      console.error('Failed to create Supabase client:', e)
      return NextResponse.json({ error: 'Failed to create database client', details: String(e) }, { status: 500 })
    }

    // Get active questions
    const { data: questions, error: questionsError } = await supabase
      .from('ai_monitor_questions')
      .select('id, question')
      .eq('is_active', true)

    if (questionsError) {
      console.error('Error fetching questions:', questionsError)
      return NextResponse.json({ error: 'Database error fetching questions', details: questionsError.message }, { status: 500 })
    }

    if (!questions || questions.length === 0) {
      return NextResponse.json({ error: 'No active questions found' }, { status: 400 })
    }

    // Create a new run
    const { data: run, error: runError } = await supabase
      .from('ai_monitor_runs')
      .insert({
        triggered_by: 'cron',
        status: 'running'
      })
      .select()
      .single()

    if (runError || !run) {
      console.error('Error creating run:', runError)
      return NextResponse.json({ error: 'Failed to create run', details: runError?.message }, { status: 500 })
    }

    // Process all questions
    const responses: Array<{
      run_id: string
      question_id: string
      platform: 'chatgpt' | 'claude' | 'gemini'
      response_text: string | null
      journ3y_mentioned: boolean
      journ3y_position: number | null
      competitors_mentioned: { name: string; context: string }[]
      response_time_ms: number | null
      error_message: string | null
    }> = []

    for (const q of questions) {
      // Query ChatGPT, Claude, and Gemini in parallel for faster processing
      const [chatgptResult, claudeResult, geminiResult] = await Promise.all([
        queryOpenAI(q.question),
        queryClaude(q.question),
        queryGemini(q.question)
      ])

      // Process ChatGPT result
      const chatgptMention = checkJourn3yMention(chatgptResult.response)
      const chatgptCompetitors = extractCompetitors(chatgptResult.response)

      responses.push({
        run_id: run.id,
        question_id: q.id,
        platform: 'chatgpt',
        response_text: chatgptResult.response || null,
        journ3y_mentioned: chatgptMention.mentioned,
        journ3y_position: chatgptMention.position,
        competitors_mentioned: chatgptCompetitors,
        response_time_ms: chatgptResult.timeMs,
        error_message: chatgptResult.error || null
      })

      // Process Claude result
      const claudeMention = checkJourn3yMention(claudeResult.response)
      const claudeCompetitors = extractCompetitors(claudeResult.response)

      responses.push({
        run_id: run.id,
        question_id: q.id,
        platform: 'claude',
        response_text: claudeResult.response || null,
        journ3y_mentioned: claudeMention.mentioned,
        journ3y_position: claudeMention.position,
        competitors_mentioned: claudeCompetitors,
        response_time_ms: claudeResult.timeMs,
        error_message: claudeResult.error || null
      })

      // Process Gemini result
      const geminiMention = checkJourn3yMention(geminiResult.response)
      const geminiCompetitors = extractCompetitors(geminiResult.response)

      responses.push({
        run_id: run.id,
        question_id: q.id,
        platform: 'gemini',
        response_text: geminiResult.response || null,
        journ3y_mentioned: geminiMention.mentioned,
        journ3y_position: geminiMention.position,
        competitors_mentioned: geminiCompetitors,
        response_time_ms: geminiResult.timeMs,
        error_message: geminiResult.error || null
      })

      // Small delay between questions to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Insert all responses
    const { error: insertError } = await supabase
      .from('ai_monitor_responses')
      .insert(responses)

    if (insertError) {
      console.error('Error inserting responses:', insertError)
      await supabase
        .from('ai_monitor_runs')
        .update({ status: 'failed', error_message: insertError.message, completed_at: new Date().toISOString() })
        .eq('id', run.id)
      return NextResponse.json({ error: 'Failed to save responses' }, { status: 500 })
    }

    // Mark run as complete
    await supabase
      .from('ai_monitor_runs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', run.id)

    return NextResponse.json({
      success: true,
      runId: run.id,
      questionsProcessed: questions.length,
      responsesCreated: responses.length
    })
  } catch (error) {
    console.error('AI Monitor cron error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
