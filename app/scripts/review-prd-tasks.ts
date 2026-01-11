import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const runId = 'b12904d9-e7cf-4990-ae67-f1ad50feacb0'

  // Get the PRD document for this run
  const { data: prd, error: prdError } = await supabase
    .from('prd_documents')
    .select('id, title, overview')
    .eq('run_id', runId)
    .single()

  if (prdError) {
    console.error('PRD error:', prdError)
    return
  }

  console.log('PRD:', prd.title)
  console.log('Overview:', prd.overview)
  console.log('\n' + '='.repeat(80) + '\n')

  // Get all tasks
  const { data: tasks, error: tasksError } = await supabase
    .from('prd_tasks')
    .select('*')
    .eq('prd_id', prd.id)
    .order('sort_order', { ascending: true })

  if (tasksError) {
    console.error('Tasks error:', tasksError)
    return
  }

  console.log(`Total tasks: ${tasks.length}`)

  // Count content prompts
  const tasksWithContent = tasks.filter(t => t.requires_content)
  const totalContentPrompts = tasks.reduce((sum, t) => {
    return sum + (t.content_prompts?.length || 0)
  }, 0)

  console.log(`Tasks requiring content: ${tasksWithContent.length}`)
  console.log(`Total content prompts: ${totalContentPrompts}`)
  console.log('\n' + '='.repeat(80) + '\n')

  // Analyze each task
  tasks.forEach((task, i) => {
    console.log(`\n${'─'.repeat(80)}`)
    console.log(`TASK ${i + 1}: ${task.title}`)
    console.log(`Section: ${task.section} | Category: ${task.category} | Est: ${task.estimated_hours}h`)
    console.log(`${'─'.repeat(80)}`)

    console.log('\nDescription:')
    console.log(task.description?.slice(0, 300) + (task.description?.length > 300 ? '...' : ''))

    console.log('\nAcceptance Criteria:')
    task.acceptance_criteria?.forEach((c: string, j: number) => {
      console.log(`  ${j + 1}. ${c}`)
    })

    console.log('\nFile Paths:', task.file_paths?.join(', ') || 'None')

    console.log('\nCode Snippets:', task.code_snippets ? Object.keys(task.code_snippets).join(', ') : 'None')

    // Show snippet preview
    if (task.code_snippets) {
      Object.entries(task.code_snippets).forEach(([name, code]) => {
        const codeStr = code as string
        const lines = codeStr.split('\n').length
        const truncated = codeStr.length > 200
        console.log(`  - ${name}: ${lines} lines${truncated ? ' (truncated in code?)' : ''}`)
        // Check for truncation markers
        if (codeStr.includes('...') || codeStr.includes('// more') || codeStr.includes('/* more')) {
          console.log(`    ⚠️  WARNING: Contains truncation markers!`)
        }
      })
    }

    console.log('\nRequires Content:', task.requires_content ? 'YES' : 'No')

    if (task.content_prompts && task.content_prompts.length > 0) {
      console.log('Content Prompts:')
      task.content_prompts.forEach((p: { type: string; prompt: string; usedIn: string; wordCount: number }, j: number) => {
        console.log(`  ${j + 1}. [${p.type}] ~${p.wordCount} words`)
        console.log(`     Used in: ${p.usedIn}`)
        console.log(`     Prompt: ${p.prompt.slice(0, 100)}...`)
      })
    }

    console.log('\nPrompt Context:', task.prompt_context ? 'Present' : 'Missing')
    if (task.prompt_context) {
      console.log(`  "${task.prompt_context.slice(0, 150)}..."`)
    }

    console.log('\nImplementation Notes:', task.implementation_notes ? 'Present' : 'None')
  })
}

main()
