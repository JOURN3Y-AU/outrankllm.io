import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

async function deletePrd() {
  const runId = 'b12904d9-e7cf-4990-ae67-f1ad50feacb0'

  console.log('Deleting PRD for run:', runId)

  const { error } = await supabase
    .from('prd_documents')
    .delete()
    .eq('run_id', runId)

  if (error) {
    console.log('Delete error:', error)
  } else {
    console.log('PRD deleted successfully')
    console.log('You can now re-run the enrichment')
  }
}

deletePrd()
