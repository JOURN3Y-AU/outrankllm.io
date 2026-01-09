import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getFeatureFlags } from '@/lib/features/flags'

export interface ActionItem {
  id: string
  title: string
  description: string
  rationale: string | null
  priority: 'quick_win' | 'strategic' | 'backlog'
  category: string | null
  estimated_impact: string | null
  estimated_effort: string | null
  target_page: string | null
  target_element: string | null
  target_keywords: string[] | null
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed'
  completed_at: string | null
  sort_order: number
}

export interface ActionPlan {
  id: string
  run_id: string
  executive_summary: string | null
  total_actions: number
  quick_wins_count: number
  strategic_count: number
  backlog_count: number
  generated_at: string
  actions: ActionItem[]
}

/**
 * GET /api/actions
 * Get action plan for the current user's latest run
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()

    // Check feature flags
    const flags = await getFeatureFlags(session.tier)
    if (!flags.showActionPlans) {
      return NextResponse.json(
        { error: 'Upgrade to access action plans' },
        { status: 403 }
      )
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const runId = searchParams.get('run_id')

    // Get the action plan
    let planQuery = supabase
      .from('action_plans')
      .select('*')
      .eq('lead_id', session.lead_id)

    if (runId) {
      planQuery = planQuery.eq('run_id', runId)
    } else {
      planQuery = planQuery.order('created_at', { ascending: false }).limit(1)
    }

    const { data: plan, error: planError } = await planQuery.single()

    if (planError || !plan) {
      // No plan exists yet
      return NextResponse.json({
        plan: null,
        hasActions: false,
      })
    }

    // Get action items for this plan
    const { data: actions, error: actionsError } = await supabase
      .from('action_items')
      .select('*')
      .eq('plan_id', plan.id)
      .order('priority', { ascending: true })
      .order('sort_order', { ascending: true })

    if (actionsError) {
      console.error('Error fetching action items:', actionsError)
      return NextResponse.json(
        { error: 'Failed to fetch action items' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      plan: {
        ...plan,
        actions: actions || [],
      },
      hasActions: (actions?.length || 0) > 0,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in GET /api/actions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/actions/generate
 * Generate action plan for a specific run (or latest run)
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession()
    const supabase = createServiceClient()

    // Check feature flags
    const flags = await getFeatureFlags(session.tier)
    if (!flags.showActionPlans) {
      return NextResponse.json(
        { error: 'Upgrade to generate action plans' },
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

    // Check if plan already exists
    const { data: existingPlan } = await supabase
      .from('action_plans')
      .select('id')
      .eq('run_id', targetRunId)
      .single()

    if (existingPlan) {
      return NextResponse.json({
        generated: false,
        message: 'Action plan already exists for this run',
        plan_id: existingPlan.id,
      })
    }

    // Get scan data for generating actions
    const { data: analysis } = await supabase
      .from('site_analyses')
      .select('*')
      .eq('run_id', targetRunId)
      .single()

    const { data: responses } = await supabase
      .from('llm_responses')
      .select('*')
      .eq('run_id', targetRunId)

    const { data: prompts } = await supabase
      .from('scan_prompts')
      .select('*')
      .eq('run_id', targetRunId)

    // Generate actions based on scan data
    const actions = generateActionsFromScanData(analysis, responses, prompts)

    // Create the action plan
    const { data: plan, error: planError } = await supabase
      .from('action_plans')
      .insert({
        lead_id: session.lead_id,
        run_id: targetRunId,
        executive_summary: generateExecutiveSummary(analysis, responses),
        total_actions: actions.length,
        quick_wins_count: actions.filter(a => a.priority === 'quick_win').length,
        strategic_count: actions.filter(a => a.priority === 'strategic').length,
        backlog_count: actions.filter(a => a.priority === 'backlog').length,
      })
      .select()
      .single()

    if (planError || !plan) {
      console.error('Error creating action plan:', planError)
      return NextResponse.json(
        { error: 'Failed to create action plan' },
        { status: 500 }
      )
    }

    // Insert action items
    const actionsToInsert = actions.map((action, index) => ({
      plan_id: plan.id,
      ...action,
      sort_order: index,
    }))

    const { error: actionsError } = await supabase
      .from('action_items')
      .insert(actionsToInsert)

    if (actionsError) {
      console.error('Error inserting action items:', actionsError)
      // Don't fail - plan is created, just missing items
    }

    return NextResponse.json({
      generated: true,
      plan_id: plan.id,
      actions_count: actions.length,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in POST /api/actions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Generate executive summary based on scan data
 */
function generateExecutiveSummary(
  analysis: { business_name?: string; business_type?: string; location?: string } | null,
  responses: { domain_mentioned: boolean; platform: string }[] | null
): string {
  if (!analysis || !responses) {
    return 'Based on your scan results, we\'ve identified key opportunities to improve your AI visibility.'
  }

  const totalResponses = responses.length
  const mentions = responses.filter(r => r.domain_mentioned).length
  const mentionRate = totalResponses > 0 ? Math.round((mentions / totalResponses) * 100) : 0

  const businessName = analysis.business_name || 'Your business'
  const businessType = analysis.business_type?.toLowerCase() || 'business'

  if (mentionRate < 20) {
    return `${businessName} has significant room to grow AI visibility (currently ${mentionRate}% mention rate). The actions below focus on establishing your presence across AI platforms through content optimization, technical improvements, and citation building.`
  } else if (mentionRate < 50) {
    return `${businessName} has moderate AI visibility (${mentionRate}% mention rate) with clear opportunities for improvement. These actions will help strengthen your positioning and expand your reach across AI platforms.`
  } else {
    return `${businessName} has strong AI visibility (${mentionRate}% mention rate). The actions below focus on maintaining and expanding this presence, with emphasis on competitive differentiation and authority building.`
  }
}

/**
 * Generate action items based on scan data analysis
 */
function generateActionsFromScanData(
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
    prompt_id: string
    competitors_mentioned?: string[]
  }[] | null,
  prompts: {
    id: string
    prompt_text: string
    category: string
  }[] | null
): Omit<ActionItem, 'id' | 'sort_order'>[] {
  const actions: Omit<ActionItem, 'id' | 'sort_order'>[] = []

  if (!analysis || !responses) {
    // Return generic actions if no data
    return getGenericActions()
  }

  const totalResponses = responses.length
  const mentions = responses.filter(r => r.domain_mentioned).length
  const mentionRate = totalResponses > 0 ? (mentions / totalResponses) * 100 : 0

  // Analyze which platforms are weakest
  const platformStats: Record<string, { total: number; mentioned: number }> = {}
  for (const r of responses) {
    if (!platformStats[r.platform]) {
      platformStats[r.platform] = { total: 0, mentioned: 0 }
    }
    platformStats[r.platform].total++
    if (r.domain_mentioned) {
      platformStats[r.platform].mentioned++
    }
  }

  // Find weakest platform
  let weakestPlatform = ''
  let lowestRate = 100
  for (const [platform, stats] of Object.entries(platformStats)) {
    const rate = stats.total > 0 ? (stats.mentioned / stats.total) * 100 : 0
    if (rate < lowestRate) {
      lowestRate = rate
      weakestPlatform = platform
    }
  }

  // Collect competitor mentions
  const competitorCounts: Record<string, number> = {}
  for (const r of responses) {
    if (r.competitors_mentioned) {
      for (const comp of r.competitors_mentioned) {
        competitorCounts[comp] = (competitorCounts[comp] || 0) + 1
      }
    }
  }
  const topCompetitors = Object.entries(competitorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name)

  // === QUICK WINS ===

  // 1. Schema markup
  actions.push({
    title: 'Add Organization Schema Markup',
    description: `Add structured data (JSON-LD) to your homepage with your business name, description, and contact information. This helps AI understand your business identity.`,
    rationale: 'AI platforms heavily rely on structured data to understand and recommend businesses.',
    priority: 'quick_win',
    category: 'technical',
    estimated_impact: 'high',
    estimated_effort: 'quick',
    target_page: '/',
    target_element: '<head>',
    target_keywords: null,
    status: 'pending',
    completed_at: null,
  })

  // 2. FAQ page
  if (analysis.services && analysis.services.length > 0) {
    actions.push({
      title: 'Create Comprehensive FAQ Section',
      description: `Build an FAQ page answering common questions about ${analysis.services.slice(0, 3).join(', ')}. Use conversational language that matches how people ask AI assistants.`,
      rationale: 'FAQs in natural language format are highly cited by AI when answering user questions.',
      priority: 'quick_win',
      category: 'content',
      estimated_impact: 'high',
      estimated_effort: 'moderate',
      target_page: '/faq',
      target_element: null,
      target_keywords: analysis.services.slice(0, 5),
      status: 'pending',
      completed_at: null,
    })
  }

  // 3. Meta descriptions
  actions.push({
    title: 'Optimize Meta Descriptions for AI',
    description: 'Rewrite meta descriptions to be factual statements rather than marketing copy. Include your business name, location, and primary service in a natural sentence.',
    rationale: 'AI platforms often use meta descriptions as a primary source for understanding page content.',
    priority: 'quick_win',
    category: 'technical',
    estimated_impact: 'medium',
    estimated_effort: 'quick',
    target_page: 'all pages',
    target_element: '<meta name="description">',
    target_keywords: null,
    status: 'pending',
    completed_at: null,
  })

  // === STRATEGIC ===

  // 4. Platform-specific optimization
  if (weakestPlatform && lowestRate < 30) {
    const platformName = weakestPlatform.charAt(0).toUpperCase() + weakestPlatform.slice(1)
    actions.push({
      title: `Improve ${platformName} Visibility`,
      description: `Your visibility on ${platformName} is only ${lowestRate.toFixed(0)}%. Focus on content that addresses questions ${platformName} commonly receives about ${analysis.business_type || 'your industry'}.`,
      rationale: `Different AI platforms have different content preferences. ${platformName} appears to be missing your business in its responses.`,
      priority: 'strategic',
      category: 'content',
      estimated_impact: 'high',
      estimated_effort: 'moderate',
      target_page: null,
      target_element: null,
      target_keywords: analysis.key_phrases?.slice(0, 3) || null,
      status: 'pending',
      completed_at: null,
    })
  }

  // 5. Service pages
  if (analysis.services && analysis.services.length > 2) {
    actions.push({
      title: 'Create Dedicated Service Pages',
      description: `Create individual pages for each major service: ${analysis.services.slice(0, 4).join(', ')}. Each page should comprehensively explain the service with use cases and benefits.`,
      rationale: 'Dedicated service pages help AI understand and recommend your specific offerings.',
      priority: 'strategic',
      category: 'content',
      estimated_impact: 'high',
      estimated_effort: 'significant',
      target_page: '/services/*',
      target_element: null,
      target_keywords: analysis.services,
      status: 'pending',
      completed_at: null,
    })
  }

  // 6. Local SEO (if location exists)
  if (analysis.location) {
    actions.push({
      title: 'Strengthen Local AI Presence',
      description: `Ensure your ${analysis.location} presence is clear. Add LocalBusiness schema, create location-specific content, and ensure NAP (Name, Address, Phone) consistency.`,
      rationale: 'AI platforms prioritize local businesses when users include location in their queries.',
      priority: 'strategic',
      category: 'technical',
      estimated_impact: 'high',
      estimated_effort: 'moderate',
      target_page: '/',
      target_element: null,
      target_keywords: [analysis.location],
      status: 'pending',
      completed_at: null,
    })
  }

  // 7. Competitor analysis
  if (topCompetitors.length > 0) {
    actions.push({
      title: 'Analyze Top Competitor Content',
      description: `Your top competitors mentioned by AI are: ${topCompetitors.join(', ')}. Analyze their content to identify what makes them AI-visible and create differentiated content.`,
      rationale: 'Understanding why competitors are mentioned helps you create content that addresses gaps.',
      priority: 'strategic',
      category: 'research',
      estimated_impact: 'medium',
      estimated_effort: 'moderate',
      target_page: null,
      target_element: null,
      target_keywords: null,
      status: 'pending',
      completed_at: null,
    })
  }

  // === BACKLOG ===

  // 8. Authority building
  actions.push({
    title: 'Build External Citations',
    description: 'Get mentioned on industry directories, write guest posts, and seek press coverage. External citations significantly impact AI recommendations.',
    rationale: 'AI platforms weight external mentions and citations when determining business authority.',
    priority: 'backlog',
    category: 'citations',
    estimated_impact: 'high',
    estimated_effort: 'significant',
    target_page: null,
    target_element: null,
    target_keywords: null,
    status: 'pending',
    completed_at: null,
  })

  // 9. Content freshness
  actions.push({
    title: 'Establish Content Update Schedule',
    description: 'Create a monthly schedule to update key pages with fresh information, recent statistics, and current trends in your industry.',
    rationale: 'AI platforms favor recently updated content and may deprioritize stale pages.',
    priority: 'backlog',
    category: 'content',
    estimated_impact: 'medium',
    estimated_effort: 'moderate',
    target_page: 'all pages',
    target_element: null,
    target_keywords: null,
    status: 'pending',
    completed_at: null,
  })

  // 10. Technical improvements
  actions.push({
    title: 'Improve Crawlability for AI',
    description: 'Ensure your robots.txt allows AI crawlers, add sitemap.xml, and improve page load speed. Fast, accessible sites are more likely to be indexed.',
    rationale: 'Technical accessibility affects whether AI platforms can effectively index your content.',
    priority: 'backlog',
    category: 'technical',
    estimated_impact: 'medium',
    estimated_effort: 'quick',
    target_page: '/robots.txt, /sitemap.xml',
    target_element: null,
    target_keywords: null,
    status: 'pending',
    completed_at: null,
  })

  return actions
}

/**
 * Generic actions when scan data is unavailable
 */
function getGenericActions(): Omit<ActionItem, 'id' | 'sort_order'>[] {
  return [
    {
      title: 'Add Organization Schema Markup',
      description: 'Add structured data (JSON-LD) to your homepage with business information.',
      rationale: 'AI platforms rely on structured data to understand businesses.',
      priority: 'quick_win',
      category: 'technical',
      estimated_impact: 'high',
      estimated_effort: 'quick',
      target_page: '/',
      target_element: '<head>',
      target_keywords: null,
      status: 'pending',
      completed_at: null,
    },
    {
      title: 'Create Comprehensive FAQ Section',
      description: 'Build an FAQ page answering common questions about your services.',
      rationale: 'FAQs are highly cited by AI when answering user questions.',
      priority: 'quick_win',
      category: 'content',
      estimated_impact: 'high',
      estimated_effort: 'moderate',
      target_page: '/faq',
      target_element: null,
      target_keywords: null,
      status: 'pending',
      completed_at: null,
    },
    {
      title: 'Build External Citations',
      description: 'Get mentioned on industry directories and relevant publications.',
      rationale: 'External citations significantly impact AI recommendations.',
      priority: 'strategic',
      category: 'citations',
      estimated_impact: 'high',
      estimated_effort: 'significant',
      target_page: null,
      target_element: null,
      target_keywords: null,
      status: 'pending',
      completed_at: null,
    },
  ]
}
