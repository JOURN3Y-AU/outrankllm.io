import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const runId = 'b12904d9-e7cf-4990-ae67-f1ad50feacb0'

  const { data: prd } = await supabase
    .from('prd_documents')
    .select('id')
    .eq('run_id', runId)
    .single()

  const { data: tasks } = await supabase
    .from('prd_tasks')
    .select('title, code_snippets')
    .eq('prd_id', prd!.id)

  tasks?.forEach((task) => {
    if (task.code_snippets) {
      Object.entries(task.code_snippets).forEach(([name, code]) => {
        const codeStr = code as string
        if (codeStr.includes('...') || codeStr.includes('// more') || codeStr.includes('/* more')) {
          console.log(`\n${'='.repeat(80)}`)
          console.log(`TASK: ${task.title}`)
          console.log(`FILE: ${name}`)
          console.log('='.repeat(80))
          console.log(codeStr)
        }
      })
    }
  })
}

main()
