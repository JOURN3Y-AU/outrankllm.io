import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { ReportClient } from './ReportClient'

interface ReportPageProps {
  params: Promise<{ token: string }>
}

// Fetch report data server-side
async function getReport(token: string) {
  const supabase = createServiceClient()

  // Fetch report by token
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select(`
      *,
      run:scan_runs(
        id,
        lead:leads(email, domain)
      )
    `)
    .eq('url_token', token)
    .single()

  if (reportError || !report) {
    return null
  }

  // Fetch site analysis for business info
  const { data: analysis } = await supabase
    .from('site_analyses')
    .select('business_type, business_name, services, location')
    .eq('run_id', report.run_id)
    .single()

  // Fetch a sample of LLM responses
  const { data: responses } = await supabase
    .from('llm_responses')
    .select(`
      platform,
      response_text,
      domain_mentioned,
      prompt:scan_prompts(prompt_text)
    `)
    .eq('run_id', report.run_id)
    .limit(6)

  return {
    report,
    analysis,
    responses,
    email: report.run?.lead?.email || '',
    domain: report.run?.lead?.domain || '',
  }
}

export default async function ReportPage({ params }: ReportPageProps) {
  const { token } = await params
  const data = await getReport(token)

  if (!data) {
    notFound()
  }

  return <ReportClient data={data} />
}

// Metadata
export async function generateMetadata({ params }: ReportPageProps) {
  const { token } = await params
  const data = await getReport(token)

  if (!data) {
    return {
      title: 'Report Not Found | outrankllm.io',
    }
  }

  return {
    title: `AI Visibility Report for ${data.domain} | outrankllm.io`,
    description: `Your site has a ${data.report.visibility_score}% AI visibility score. See how ChatGPT, Claude, and Gemini recommend your business.`,
  }
}
