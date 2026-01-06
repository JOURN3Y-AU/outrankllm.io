import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Allow up to 5 minutes for manual run to process all questions
export const maxDuration = 300

// Known competitors to look for in responses
const KNOWN_COMPETITORS = [
  'Accenture', 'Deloitte', 'PwC', 'KPMG', 'EY',
  'Thoughtworks', 'Slalom', 'Publicis Sapient',
  'Datacom', 'DXC Technology', 'Infosys', 'Wipro', 'TCS',
  'IBM', 'Microsoft', 'Google Cloud', 'AWS',
  'Avanade', 'Capgemini', 'Cognizant',
  // Add Australian-specific consultancies
  'DiUS', 'Elabor8', 'Servian', 'Contino', 'Mantel Group',
  'Versent', 'CMD Solutions', 'Mechanical Rock',
  // AI-specific
  'Hivery', 'Canva', 'Atlassian', 'SafetyCulture'
]

function extractCompetitors(text: string): { name: string; context: string }[] {
  const competitors: { name: string; context: string }[] = []
  const lowerText = text.toLowerCase()

  for (const competitor of KNOWN_COMPETITORS) {
    const lowerCompetitor = competitor.toLowerCase()
    if (lowerText.includes(lowerCompetitor)) {
      // Extract context around the mention
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
      // Calculate rough position (1st third, 2nd third, 3rd third)
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

export async function POST(request: Request) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createClient() as any

    // Verify authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get active questions
    const { data: questions, error: questionsError } = await supabase
      .from('ai_monitor_questions')
      .select(`
        id,
        question,
        group:ai_monitor_question_groups(id, name)
      `)
      .eq('is_active', true)

    if (questionsError || !questions || questions.length === 0) {
      return NextResponse.json({ error: 'No active questions found' }, { status: 400 })
    }

    // Create a new run
    const { data: run, error: runError } = await supabase
      .from('ai_monitor_runs')
      .insert({
        triggered_by: 'manual',
        status: 'running'
      })
      .select()
      .single()

    if (runError || !run) {
      return NextResponse.json({ error: 'Failed to create run' }, { status: 500 })
    }

    // Process questions synchronously (required for serverless)
    await processQuestions(supabase, run.id, questions)

    return NextResponse.json({
      success: true,
      runId: run.id,
      message: `Completed monitoring ${questions.length} questions across ChatGPT, Claude, and Gemini`
    })
  } catch (error) {
    console.error('AI Monitor error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function processQuestions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  runId: string,
  questions: Array<{ id: string; question: string }>
) {
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
      run_id: runId,
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
      run_id: runId,
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
      run_id: runId,
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
      .eq('id', runId)
    return
  }

  // Mark run as complete
  await supabase
    .from('ai_monitor_runs')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', runId)
}
