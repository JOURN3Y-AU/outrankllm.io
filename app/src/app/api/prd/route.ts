import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getFeatureFlags } from '@/lib/features/flags'

export interface PrdTask {
  id: string
  title: string
  description: string
  acceptance_criteria: string[] | null
  section: 'quick_wins' | 'strategic' | 'backlog'
  category: string | null
  priority: number
  estimated_hours: number | null
  file_paths: string[] | null
  code_snippets: Record<string, string> | null
  prompt_context: string | null
  implementation_notes: string | null
  sort_order: number
}

export interface PrdDocument {
  id: string
  run_id: string
  title: string
  overview: string | null
  goals: string[] | null
  tech_stack: string[] | null
  target_platforms: string[] | null
  generated_at: string
  tasks: PrdTask[]
}

/**
 * GET /api/prd
 * Get PRD document for the current user's latest run
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()

    // Check feature flags - PRD requires Pro or Agency
    const flags = await getFeatureFlags(session.tier)
    if (!flags.showPrdTasks) {
      return NextResponse.json(
        { error: 'Upgrade to Pro to access PRD generation' },
        { status: 403 }
      )
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const runId = searchParams.get('run_id')

    // Get the PRD document
    let prdQuery = supabase
      .from('prd_documents')
      .select('*')
      .eq('lead_id', session.lead_id)

    if (runId) {
      prdQuery = prdQuery.eq('run_id', runId)
    } else {
      prdQuery = prdQuery.order('created_at', { ascending: false }).limit(1)
    }

    const { data: prd, error: prdError } = await prdQuery.single()

    if (prdError || !prd) {
      return NextResponse.json({
        prd: null,
        hasPrd: false,
      })
    }

    // Get tasks for this PRD
    const { data: tasks, error: tasksError } = await supabase
      .from('prd_tasks')
      .select('*')
      .eq('prd_id', prd.id)
      .order('section', { ascending: true })
      .order('sort_order', { ascending: true })

    if (tasksError) {
      console.error('Error fetching PRD tasks:', tasksError)
      return NextResponse.json(
        { error: 'Failed to fetch PRD tasks' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      prd: {
        ...prd,
        tasks: tasks || [],
      },
      hasPrd: true,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in GET /api/prd:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/prd
 * Generate PRD document for a specific run
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()

    // Check feature flags - PRD requires Pro or Agency
    const flags = await getFeatureFlags(session.tier)
    if (!flags.showPrdTasks) {
      return NextResponse.json(
        { error: 'Upgrade to Pro to generate PRDs' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { run_id } = body

    // Get run_id if not provided
    let targetRunId = run_id
    if (!targetRunId) {
      const { data: latestRun } = await supabase
        .from('scan_runs')
        .select('id')
        .eq('lead_id', session.lead_id)
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!latestRun) {
        return NextResponse.json(
          { error: 'No completed scans found' },
          { status: 404 }
        )
      }
      targetRunId = latestRun.id
    }

    // Check if PRD already exists
    const { data: existingPrd } = await supabase
      .from('prd_documents')
      .select('id')
      .eq('run_id', targetRunId)
      .single()

    if (existingPrd) {
      return NextResponse.json({
        generated: false,
        message: 'PRD already exists for this run',
        prd_id: existingPrd.id,
      })
    }

    // Get scan data for generating PRD
    const { data: analysis } = await supabase
      .from('site_analyses')
      .select('*')
      .eq('run_id', targetRunId)
      .single()

    const { data: responses } = await supabase
      .from('llm_responses')
      .select('*')
      .eq('run_id', targetRunId)

    // Get action plan if it exists
    const { data: actionPlan } = await supabase
      .from('action_plans')
      .select('*, action_items(*)')
      .eq('run_id', targetRunId)
      .single()

    // Generate PRD
    const prdContent = generatePrdFromData(analysis, responses, actionPlan)

    // Create the PRD document
    const { data: prd, error: prdError } = await supabase
      .from('prd_documents')
      .insert({
        lead_id: session.lead_id,
        run_id: targetRunId,
        title: prdContent.title,
        overview: prdContent.overview,
        goals: prdContent.goals,
        tech_stack: prdContent.tech_stack,
        target_platforms: prdContent.target_platforms,
      })
      .select()
      .single()

    if (prdError || !prd) {
      console.error('Error creating PRD:', prdError)
      return NextResponse.json(
        { error: 'Failed to create PRD' },
        { status: 500 }
      )
    }

    // Insert tasks
    const tasksToInsert = prdContent.tasks.map((task, index) => ({
      prd_id: prd.id,
      ...task,
      sort_order: index,
    }))

    const { error: tasksError } = await supabase
      .from('prd_tasks')
      .insert(tasksToInsert)

    if (tasksError) {
      console.error('Error inserting PRD tasks:', tasksError)
    }

    return NextResponse.json({
      generated: true,
      prd_id: prd.id,
      tasks_count: prdContent.tasks.length,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in POST /api/prd:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

interface PrdContent {
  title: string
  overview: string
  goals: string[]
  tech_stack: string[]
  target_platforms: string[]
  tasks: Omit<PrdTask, 'id' | 'sort_order'>[]
}

/**
 * Generate PRD content from scan data
 */
function generatePrdFromData(
  analysis: {
    business_name?: string
    business_type?: string
    location?: string
    services?: string[]
    key_phrases?: string[]
  } | null,
  responses: {
    domain_mentioned: boolean
    platform: string
  }[] | null,
  actionPlan: {
    action_items?: {
      title: string
      description: string
      category: string
      priority: string
      target_page?: string
      target_keywords?: string[]
    }[]
  } | null
): PrdContent {
  const businessName = analysis?.business_name || 'Your Business'
  const businessType = analysis?.business_type || 'website'

  const totalResponses = responses?.length || 0
  const mentions = responses?.filter(r => r.domain_mentioned).length || 0
  const mentionRate = totalResponses > 0 ? Math.round((mentions / totalResponses) * 100) : 0

  const tasks: Omit<PrdTask, 'id' | 'sort_order'>[] = []

  // === QUICK WINS ===

  // Schema markup task
  tasks.push({
    title: 'Implement Organization Schema Markup',
    description: `Add JSON-LD structured data to the homepage to help AI platforms understand ${businessName}'s identity and services.`,
    acceptance_criteria: [
      'JSON-LD script added to <head> of homepage',
      'Schema validates with Google Rich Results Test',
      'Includes @type Organization with name, description, url',
      'Includes contactPoint and address if applicable',
    ],
    section: 'quick_wins',
    category: 'technical',
    priority: 1,
    estimated_hours: 2,
    file_paths: ['pages/index.tsx', 'components/SEO.tsx'],
    code_snippets: {
      'schema-example.json': `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "${businessName}",
  "url": "https://example.com",
  "description": "${analysis?.services?.[0] || 'Professional services'}",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "${analysis?.location || 'City'}"
  }
}`,
    },
    prompt_context: 'This is a Next.js application. Add the schema to the Head component or create a reusable SEO component.',
    implementation_notes: 'Use next/head or a custom SEO component to inject the JSON-LD script.',
  })

  // Meta descriptions task
  tasks.push({
    title: 'Optimize Meta Descriptions for AI Discovery',
    description: 'Rewrite meta descriptions to be factual, AI-friendly statements rather than marketing copy.',
    acceptance_criteria: [
      'Each page has unique meta description',
      'Descriptions are 150-160 characters',
      'Include business name and primary service',
      'Use natural language, not keyword stuffing',
    ],
    section: 'quick_wins',
    category: 'seo',
    priority: 2,
    estimated_hours: 3,
    file_paths: ['pages/*.tsx', 'components/SEO.tsx'],
    code_snippets: null,
    prompt_context: 'Focus on factual descriptions that AI can cite. Avoid superlatives and marketing language.',
    implementation_notes: 'Create a mapping of page-specific meta descriptions and update the SEO component.',
  })

  // FAQ page task
  if (analysis?.services && analysis.services.length > 0) {
    tasks.push({
      title: 'Create Comprehensive FAQ Page',
      description: `Build an FAQ page with questions and answers about ${analysis.services.slice(0, 3).join(', ')} using conversational language.`,
      acceptance_criteria: [
        'FAQ page exists at /faq',
        'Minimum 10 questions covering main services',
        'Questions written in natural, conversational tone',
        'FAQPage schema markup implemented',
        'Answers are detailed (2-3 paragraphs each)',
      ],
      section: 'quick_wins',
      category: 'content',
      priority: 1,
      estimated_hours: 4,
      file_paths: ['pages/faq.tsx'],
      code_snippets: {
        'faq-schema.json': `{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "What services does ${businessName} offer?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "We offer ${analysis.services.slice(0, 3).join(', ')}..."
    }
  }]
}`,
      },
      prompt_context: 'Create questions that match how people ask AI assistants. Use "How do I...", "What is the best...", "Where can I find..." formats.',
      implementation_notes: 'Include FAQPage schema markup for better AI visibility.',
    })
  }

  // === STRATEGIC ===

  // Service pages task
  if (analysis?.services && analysis.services.length > 2) {
    tasks.push({
      title: 'Create Dedicated Service Landing Pages',
      description: `Create individual pages for each major service: ${analysis.services.slice(0, 4).join(', ')}.`,
      acceptance_criteria: [
        'Each service has dedicated page at /services/[service-slug]',
        'Pages include Service schema markup',
        'Each page has 800+ words of unique content',
        'Include use cases, benefits, and process sections',
        'Internal linking between related services',
      ],
      section: 'strategic',
      category: 'content',
      priority: 1,
      estimated_hours: 16,
      file_paths: ['pages/services/[slug].tsx', 'content/services/*.md'],
      code_snippets: null,
      prompt_context: 'Create comprehensive service pages that can be cited by AI. Focus on answering common questions about each service.',
      implementation_notes: 'Consider using MDX for content management. Include testimonials or case studies if available.',
    })
  }

  // Local SEO task
  if (analysis?.location) {
    tasks.push({
      title: 'Implement Local Business Schema',
      description: `Add LocalBusiness schema markup to improve ${analysis.location} area visibility.`,
      acceptance_criteria: [
        'LocalBusiness schema added to homepage',
        'NAP (Name, Address, Phone) consistent across site',
        'Google Business Profile linked',
        'Service area defined in schema',
      ],
      section: 'strategic',
      category: 'technical',
      priority: 2,
      estimated_hours: 3,
      file_paths: ['components/SEO.tsx', 'pages/contact.tsx'],
      code_snippets: {
        'local-business-schema.json': `{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "${businessName}",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "${analysis.location}"
  },
  "areaServed": "${analysis.location}"
}`,
      },
      prompt_context: 'Local business visibility is crucial for AI recommendations in location-based queries.',
      implementation_notes: 'Ensure contact page has matching address information.',
    })
  }

  // Content freshness task
  tasks.push({
    title: 'Implement Content Update System',
    description: 'Create a system to track and update content freshness, showing AI platforms that content is maintained.',
    acceptance_criteria: [
      'dateModified field added to all content pages',
      'Automated sitemap updates on content changes',
      'Last updated date visible on pages',
      'Blog or news section for regular updates',
    ],
    section: 'strategic',
    category: 'technical',
    priority: 3,
    estimated_hours: 8,
    file_paths: ['components/ArticleMeta.tsx', 'lib/sitemap.ts'],
    code_snippets: null,
    prompt_context: 'AI platforms favor recently updated content. Show clear update timestamps.',
    implementation_notes: 'Consider automating content audits to flag stale pages.',
  })

  // === BACKLOG ===

  // Citation building task
  tasks.push({
    title: 'Build External Citation Strategy',
    description: 'Develop a plan for earning mentions and citations from authoritative external sources.',
    acceptance_criteria: [
      'List of 20+ target directories/publications identified',
      'Guest post opportunities researched',
      'Press release strategy defined',
      'Monitoring for brand mentions set up',
    ],
    section: 'backlog',
    category: 'citations',
    priority: 1,
    estimated_hours: 20,
    file_paths: null,
    code_snippets: null,
    prompt_context: 'External citations significantly impact AI recommendation likelihood.',
    implementation_notes: 'This is an ongoing effort. Prioritize industry-specific directories first.',
  })

  // robots.txt optimization
  tasks.push({
    title: 'Optimize robots.txt for AI Crawlers',
    description: 'Ensure robots.txt allows AI crawlers while blocking unnecessary pages.',
    acceptance_criteria: [
      'GPTBot, Claude-Web, and other AI crawlers allowed',
      'Admin/utility pages blocked',
      'Sitemap reference included',
      'Crawl-delay appropriate for server capacity',
    ],
    section: 'backlog',
    category: 'technical',
    priority: 2,
    estimated_hours: 1,
    file_paths: ['public/robots.txt'],
    code_snippets: {
      'robots.txt': `User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: Claude-Web
Allow: /

Sitemap: https://example.com/sitemap.xml`,
    },
    prompt_context: 'Some sites inadvertently block AI crawlers. Ensure explicit allow rules.',
    implementation_notes: 'Test with robots.txt tester tools after updating.',
  })

  // Monitoring task
  tasks.push({
    title: 'Set Up AI Visibility Monitoring',
    description: 'Implement ongoing monitoring to track AI visibility changes over time.',
    acceptance_criteria: [
      'Weekly automated scans scheduled',
      'Alerting for significant score changes',
      'Competitor tracking enabled',
      'Monthly report generation',
    ],
    section: 'backlog',
    category: 'monitoring',
    priority: 3,
    estimated_hours: 4,
    file_paths: null,
    code_snippets: null,
    prompt_context: 'Regular monitoring helps identify what content changes impact AI visibility.',
    implementation_notes: 'Use OutrankLLM scheduled scans feature for automated monitoring.',
  })

  return {
    title: `AI Visibility PRD: ${businessName}`,
    overview: `This PRD outlines technical implementation tasks to improve ${businessName}'s visibility in AI assistants (ChatGPT, Claude, Gemini, Perplexity). Current visibility rate is ${mentionRate}%. Tasks are prioritized by impact and effort.`,
    goals: [
      `Increase AI mention rate from ${mentionRate}% to ${Math.min(mentionRate + 30, 80)}%`,
      'Implement structured data for better AI understanding',
      'Create AI-friendly content that can be cited in responses',
      'Build external citations to improve authority signals',
    ],
    tech_stack: ['Next.js', 'React', 'TypeScript'],
    target_platforms: ['Web'],
    tasks,
  }
}
