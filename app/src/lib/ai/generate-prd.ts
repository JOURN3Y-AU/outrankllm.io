/**
 * AI-Powered PRD Generation
 *
 * Generates Claude Code / Cursor-ready PRD documents from action plans.
 * Each action plan item becomes a detailed implementation task with:
 * - Problem/solution format
 * - Acceptance criteria
 * - File paths to modify
 * - Code snippets
 * - Implementation notes
 *
 * Output is organized by priority: Quick Wins, Strategic, Backlog
 */

import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { trackCost } from './costs'
import { log } from '@/lib/logger'
import { type PlatformDataInput } from './generate-actions'

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================
// INPUT TYPES - From action plans
// ============================================

export interface ActionItemInput {
  id: string
  title: string
  description: string
  rationale: string | null
  sourceInsight: string | null
  priority: 'quick_win' | 'strategic' | 'backlog'
  category: string | null
  estimatedImpact: string | null
  estimatedEffort: string | null
  targetPage: string | null
  targetKeywords: string[] | null
  consensus: string[] | null
  implementationSteps: string[] | null
  expectedOutcome: string | null
}

export interface PageEditInput {
  page: string
  metaTitle: string | null
  metaDescription: string | null
  h1Change: string
  contentToAdd: string | null
}

export interface ActionPlanContext {
  executiveSummary: string | null
  actions: ActionItemInput[]
  pageEdits: PageEditInput[] | null
  keywordMap: Array<{
    keyword: string
    bestPage: string
    whereToAdd: string
    priority: string
  }> | null
}

export interface SiteContext {
  domain: string
  businessName: string | null
  businessType: string | null
  techStack: string[] | null  // Detected from crawl or default
  services: string[] | null
  platformData: PlatformDataInput | null  // Platform/technology detection
  visibilityScore: number | null  // Overall visibility score for context
}

// ============================================
// OUTPUT TYPES - PRD structure
// ============================================

export interface PrdTask {
  title: string
  description: string
  acceptanceCriteria: string[]
  section: 'quick_wins' | 'strategic' | 'backlog'
  category: string | null
  priority: number
  estimatedHours: number | null
  filePaths: string[] | null
  codeSnippets: Record<string, string> | null
  promptContext: string | null
  implementationNotes: string | null
  /** Content prompts for text that needs to be written separately (case studies, testimonials, etc.) */
  contentPrompts: ContentPrompt[] | null
  /** True if this task requires content to be written before code implementation */
  requiresContent: boolean
}

export interface ContentPrompt {
  /** What type of content this is (e.g., "Case Study", "Testimonial", "Service Description") */
  type: string
  /** The prompt to generate this content */
  prompt: string
  /** Where this content will be used in the code */
  usedIn: string
  /** Approximate word count needed */
  wordCount: number
}

export interface GeneratedPrd {
  title: string
  overview: string
  goals: string[]
  techStack: string[]
  targetPlatforms: string[]
  tasks: PrdTask[]
}

// ============================================
// PROMPT CONSTRUCTION
// ============================================

function buildSystemPrompt(): string {
  return `You are a senior technical product manager creating a Product Requirements Document (PRD) for AI coding assistants like Claude Code and Cursor.

Your task is to transform action plan items into detailed, implementable PRD tasks that developers can paste directly into their AI coding tools.

CRITICAL RULES:
1. Each task must be SELF-CONTAINED - include all context needed for implementation
2. Write in imperative voice: "Add schema markup to..." not "Should add..."
3. Include SPECIFIC file paths based on common Next.js/React patterns
4. Provide CODE SNIPPETS where applicable (JSON-LD, meta tags, component examples)
5. Acceptance criteria must be TESTABLE with clear pass/fail conditions
6. Format output as valid JSON matching the schema exactly
7. SEPARATE CODE FROM CONTENT - see content separation rules below

TASK SECTIONS:
- quick_wins: Low effort (1-4 hours), high impact tasks
- strategic: Medium effort (4-16 hours), significant impact tasks
- backlog: Higher effort (16+ hours) or lower priority tasks

ESTIMATED HOURS GUIDE (CODE ONLY, excludes content writing time):
- Meta tag changes: 1-2 hours
- Schema markup implementation: 2-4 hours
- New page structure (without content): 2-4 hours
- Component refactoring: 4-8 hours
- New feature/section structure: 4-8 hours

CODE SNIPPETS FORMAT:
- Use descriptive filenames: "schema.tsx", "meta-tags.tsx", "faq-section.tsx"
- Include necessary imports
- Show integration points with existing code
- For JSON-LD, include complete valid JSON
- CRITICAL: NEVER truncate code with "..." or "// more code". Every snippet must be complete and runnable.
- If a snippet would be too long, split into multiple smaller snippets with clear names
- Keep each snippet focused on ONE thing (e.g., separate "faq-schema.tsx" from "faq-data.ts")
- Use clear placeholder comments like {/* CONTENT: See content prompts below */} for content areas

SEPARATING CODE FROM CONTENT - CRITICAL:
Many tasks require both code implementation AND substantial content (testimonials, case studies, service descriptions, etc.). You MUST separate these concerns:

1. If a task requires content that would need to be written by a human or content AI:
   - Set "requiresContent": true
   - Add "contentPrompts" array with specific prompts for generating that content
   - In code snippets, use placeholder comments like:
     {/* CONTENT_PLACEHOLDER: testimonials - see contentPrompts[0] */}
     const testimonials = [] // Populate with content from contentPrompts

2. Content that ALWAYS requires contentPrompts:
   - Case studies with specific client results (needs real data or realistic examples)
   - Testimonials and reviews (even for schema markup)
   - Service descriptions over 100 words
   - FAQ content: The QUESTIONS can be in code, but ANSWERS must be content prompts (users know their real FAQs)
   - Page copy over 200 words
   - Any claims requiring proof points, statistics, or credentials
   - Bio text, team descriptions, company history

3. Content that can be inline in code:
   - Short meta descriptions (under 160 chars)
   - H1 headings and short titles
   - UI labels and button text
   - Schema markup with factual data (address, phone, etc.)
   - Brief feature lists

4. Each contentPrompt should include:
   - type: What kind of content (e.g., "Case Study", "Testimonial", "FAQ Answer")
   - prompt: A complete prompt that could be given to an AI writing assistant
   - usedIn: Which code file/component will use this content
   - wordCount: Approximate words needed

PROMPT CONTEXT:
For each task, provide a "promptContext" field that contains a natural language description of what needs to be done. This should be phrased as if you're instructing an AI coding assistant directly. Include:
- What the code should accomplish
- Key requirements and constraints
- Integration considerations
- Reference to contentPrompts if task requires content: "Note: This task requires content - see contentPrompts for text that needs to be written first."

Example promptContext for a task WITH content:
"Create a testimonials page component with a grid layout for client reviews. The component should accept a testimonials array prop and render review cards with rating, author, company, and review text. Include Review schema markup for SEO. Note: This task requires content - see contentPrompts for the testimonial text that needs to be written first. Use the placeholder data structure in the code."

Example promptContext for a task WITHOUT content:
"Create a Next.js component that generates Organization schema markup. The component should export a <Script> tag with type='application/ld+json'. Include the business name, URL, description, and contact info from the site config. Make sure the schema validates against Google's Rich Results Test."

STANDARD TASKS TO INCLUDE:
For service-based businesses, ALWAYS include these high-impact tasks if not already present:

1. **FAQ Schema** (quick_wins, 2-3 hours):
   - Every service-based business should have FAQ schema on key pages
   - Creates a reusable FAQSchema component
   - MUST set requiresContent: true with contentPrompts for FAQ answers
   - Questions can be generic service questions, but answers need business-specific content
   - Example task title: "Implement FAQ Schema for Service Pages"

2. **LocalBusiness Schema** (quick_wins, 1-2 hours) - if business has physical location:
   - Add LocalBusiness or ProfessionalService schema with address, hours, contact info
   - Helps AI platforms recognize the business for local queries

Only skip these if the action plan explicitly indicates they're already implemented.

PLATFORM-SPECIFIC IMPLEMENTATION GUIDANCE:
When platform/CMS data is provided, you MUST tailor code snippets and file paths to the specific technology stack:

For WordPress sites:
- Reference specific plugins with installation commands (e.g., "Install Yoast SEO via wp-admin > Plugins")
- Provide PHP snippets for functions.php when needed
- Use WordPress-specific paths: /wp-content/themes/[theme]/
- Reference Gutenberg blocks or classic editor as appropriate

For Webflow sites:
- Provide Custom Code snippets for Site Settings > Custom Code
- Reference Webflow's CMS collection structure
- Use embed elements for custom scripts
- Note: Webflow doesn't support custom JavaScript in most cases - suggest alternatives

For Squarespace sites:
- Provide Code Injection snippets (Settings > Advanced > Code Injection)
- Reference Squarespace template sections
- Note platform limitations (e.g., limited custom code placement)

For Shopify sites:
- Provide Liquid template code snippets
- Reference Shopify app alternatives for complex features
- Use paths like /snippets/, /sections/, theme.liquid
- Recommend JSON-LD for SEO app when schema is needed

For Wix sites:
- Reference Velo (Wix Code) for custom implementations
- Provide Wix Corvid API examples where applicable
- Note significant platform limitations
- Suggest Wix App Market alternatives

For Next.js / React sites:
- Provide full React component code with TypeScript
- Use next/head or next-seo for meta tags
- Include proper imports and exports
- Reference App Router or Pages Router patterns as appropriate
- Use proper file paths: /app/, /pages/, /components/, /lib/

For sites with AI READABILITY ISSUES:
- PRIORITIZE tasks that fix client-side rendering
- Include SSR/SSG migration code snippets
- Reference getServerSideProps, getStaticProps, or generateStaticParams
- This is CRITICAL - unreadable sites will never rank in AI assistants

For sites with AI-GENERATED CONTENT SIGNALS:
- Include content prompts that emphasize originality
- Add tasks for humanizing existing content
- Reference specific pages with AI-detected content

VISIBILITY SCORE CONTEXT:
Use accurate, calibrated language when referencing visibility scores:

| Score Range | Label      | Description                                    |
|-------------|------------|------------------------------------------------|
| 0-5%        | Critical   | Virtually invisible to AI assistants           |
| 5-15%       | Very Low   | Rarely mentioned by AI assistants              |
| 15-30%      | Low        | Occasionally mentioned but not prominent       |
| 30-50%      | Moderate   | Some presence but significant room to grow     |
| 50-70%      | Good       | Solid visibility with optimization potential   |
| 70-85%      | Strong     | Well-represented across AI platforms           |
| 85-100%     | Excellent  | Exceptional AI visibility                      |

- Frame the PRD overview in terms of opportunity, not criticism
- Focus on "improving from X to Y" rather than "fixing poor performance"
- Motivate implementation with potential gains`
}

function buildPlatformSummary(platformData: PlatformDataInput | null): string {
  if (!platformData) {
    return 'Platform: Unknown (assume modern web stack)\nProvide Next.js/React code examples by default.'
  }

  let summary = ''

  // CMS/Platform
  if (platformData.cms) {
    const confidence = platformData.cmsConfidence ? ` (${platformData.cmsConfidence} confidence)` : ''
    summary += `Platform: ${platformData.cms}${confidence}\n`
  } else {
    summary += 'Platform: Custom build (no CMS detected)\n'
  }

  // Framework/tech stack
  const techParts: string[] = []
  if (platformData.framework) techParts.push(`Framework: ${platformData.framework}`)
  if (platformData.cssFramework) techParts.push(`CSS: ${platformData.cssFramework}`)
  if (platformData.hosting) techParts.push(`Hosting: ${platformData.hosting}`)
  if (platformData.ecommerce) techParts.push(`E-commerce: ${platformData.ecommerce}`)

  if (techParts.length > 0) {
    summary += `Tech Stack: ${techParts.join(', ')}\n`
  }

  // Analytics
  if (platformData.analytics && platformData.analytics.length > 0) {
    summary += `Analytics: ${platformData.analytics.join(', ')}\n`
  }

  // Lead capture tools
  if (platformData.leadCapture && platformData.leadCapture.length > 0) {
    summary += `Lead Capture: ${platformData.leadCapture.join(', ')}\n`
  }

  // Content sections
  const sections: string[] = []
  if (platformData.contentSections.hasBlog) sections.push('Blog')
  if (platformData.contentSections.hasCaseStudies) sections.push('Case Studies')
  if (platformData.contentSections.hasResources) sections.push('Resources')
  if (platformData.contentSections.hasFaq) sections.push('FAQ')
  if (platformData.contentSections.hasAboutPage) sections.push('About')
  if (platformData.contentSections.hasTeamPage) sections.push('Team')
  if (platformData.contentSections.hasTestimonials) sections.push('Testimonials')

  if (sections.length > 0) {
    summary += `Content Sections Present: ${sections.join(', ')}\n`
  }

  // E-commerce
  if (platformData.isEcommerce) {
    summary += 'E-commerce Site: Yes\n'
  }

  // AI Readability issues - CRITICAL
  if (platformData.hasAiReadabilityIssues) {
    summary += '\n⚠️ CRITICAL - AI READABILITY ISSUES:\n'
    if (platformData.rendersClientSide) {
      summary += '- Site renders client-side (JS required) - AI crawlers cannot read content!\n'
    }
    for (const issue of platformData.aiReadabilityIssues) {
      summary += `- ${issue}\n`
    }
    summary += 'PRIORITIZE fixing these issues - they block all AI visibility improvements.\n'
  }

  // AI-generated content signals
  if (platformData.likelyAiGenerated && platformData.aiSignals.length > 0) {
    summary += '\n⚠️ AI-GENERATED CONTENT DETECTED:\n'
    for (const signal of platformData.aiSignals) {
      summary += `- ${signal}\n`
    }
    summary += 'Include content prompts that emphasize humanization and originality.\n'
  }

  return summary
}

function buildUserPrompt(
  actionPlan: ActionPlanContext,
  siteContext: SiteContext,
  completedTaskTitles: string[] = []
): string {
  const businessName = siteContext.businessName || siteContext.domain
  const platformSummary = buildPlatformSummary(siteContext.platformData)

  // Build visibility score context
  let visibilityContext = ''
  if (siteContext.visibilityScore !== null && siteContext.visibilityScore !== undefined) {
    const score = siteContext.visibilityScore
    let label = 'moderate'
    if (score <= 5) label = 'critical'
    else if (score <= 15) label = 'very low'
    else if (score <= 30) label = 'low'
    else if (score <= 50) label = 'moderate'
    else if (score <= 70) label = 'good'
    else if (score <= 85) label = 'strong'
    else label = 'excellent'
    visibilityContext = `Current AI Visibility: ${score}% (${label})\n`
  }

  // Build actions summary
  const actionsSummary = actionPlan.actions.map((action, index) => {
    const consensus = action.consensus?.length ? `(Supported by: ${action.consensus.join(', ')})` : ''
    return `${index + 1}. [${action.priority.toUpperCase()}] ${action.title}
   Description: ${action.description}
   ${action.sourceInsight ? `Source: ${action.sourceInsight}` : ''}
   ${action.targetPage ? `Target page: ${action.targetPage}` : ''}
   ${action.implementationSteps?.length ? `Steps: ${action.implementationSteps.join(' → ')}` : ''}
   ${action.expectedOutcome ? `Expected outcome: ${action.expectedOutcome}` : ''}
   ${consensus}`
  }).join('\n\n')

  // Build page edits if available
  const pageEditsSummary = actionPlan.pageEdits?.length
    ? `\n\n## SUGGESTED PAGE EDITS\n${actionPlan.pageEdits.map(edit => `
- ${edit.page}:
  ${edit.metaTitle ? `Title: "${edit.metaTitle}"` : ''}
  ${edit.metaDescription ? `Description: "${edit.metaDescription}"` : ''}
  ${edit.h1Change !== 'keep' ? `H1: "${edit.h1Change}"` : ''}
  ${edit.contentToAdd ? `Add content: ${edit.contentToAdd.slice(0, 200)}...` : ''}`).join('\n')}`
    : ''

  // Build keyword map if available
  const keywordSummary = actionPlan.keywordMap?.length
    ? `\n\n## KEYWORD TARGETS\n${actionPlan.keywordMap.slice(0, 10).map(k => `- "${k.keyword}" → ${k.bestPage} (${k.whereToAdd})`).join('\n')}`
    : ''

  // Build previously completed tasks section
  const completedTasksSection = completedTaskTitles.length > 0
    ? `\n\n## PREVIOUSLY COMPLETED TASKS - DO NOT REGENERATE
The following tasks have already been completed by the user in previous scans. Do NOT generate tasks that are similar to these:
${completedTaskTitles.map(title => `- ${title}`).join('\n')}`
    : ''

  return `## BUSINESS CONTEXT

Business: ${businessName}
Domain: ${siteContext.domain}
Type: ${siteContext.businessType || 'Website'}
Services: ${siteContext.services?.join(', ') || 'Various services'}
${visibilityContext}
## PLATFORM & TECHNOLOGY

${platformSummary}

## EXECUTIVE SUMMARY

${actionPlan.executiveSummary || 'Improve AI visibility through technical and content optimizations.'}

## ACTION ITEMS TO CONVERT TO PRD TASKS

${actionsSummary}
${pageEditsSummary}
${keywordSummary}
${completedTasksSection}

---

Based on the above action plan, generate a comprehensive PRD document. You MUST respond with ONLY valid JSON matching this exact structure:

{
  "title": "AI Visibility PRD: ${businessName}",
  "overview": "2-3 sentence summary of what this PRD accomplishes",
  "goals": ["Goal 1 with measurable outcome", "Goal 2", "Goal 3"],
  "techStack": ["Next.js", "React", "TypeScript"],
  "targetPlatforms": ["Web"],
  "tasks": [
    {
      "title": "Specific task title",
      "description": "Detailed description of what to implement. 2-3 paragraphs explaining the problem and solution.",
      "acceptanceCriteria": [
        "Testable criterion 1",
        "Testable criterion 2",
        "Testable criterion 3"
      ],
      "section": "quick_wins|strategic|backlog",
      "category": "technical|content|schema|seo",
      "priority": 1,
      "estimatedHours": 2,
      "filePaths": ["src/components/SEO.tsx", "pages/index.tsx"],
      "codeSnippets": {
        "schema.tsx": "import Script from 'next/script'\\n\\nexport function OrganizationSchema() {\\n  return <Script ... />\\n}",
        "usage.tsx": "<OrganizationSchema />"
      },
      "promptContext": "Create a React component that generates Organization JSON-LD schema...",
      "implementationNotes": "Key considerations and integration notes",
      "requiresContent": false,
      "contentPrompts": null
    },
    {
      "title": "Task that requires content example",
      "description": "This task creates the page structure but requires content to be written separately.",
      "acceptanceCriteria": ["Structure renders correctly", "Content placeholders are clearly marked"],
      "section": "strategic",
      "category": "content",
      "priority": 2,
      "estimatedHours": 3,
      "filePaths": ["pages/testimonials/index.tsx"],
      "codeSnippets": {
        "testimonials-page.tsx": "// Testimonials data - populate from contentPrompts\\nconst testimonials: Testimonial[] = []\\n\\nexport default function TestimonialsPage() {\\n  return <TestimonialGrid testimonials={testimonials} />\\n}"
      },
      "promptContext": "Create testimonials page structure. Note: This task requires content - see contentPrompts for testimonial text.",
      "implementationNotes": "Run content prompts first, then populate the testimonials array.",
      "requiresContent": true,
      "contentPrompts": [
        {
          "type": "Client Testimonial",
          "prompt": "Write 3 client testimonials for a Brisbane digital marketing agency. Each should include: client name, company, specific results achieved (traffic increase %, conversion improvement, etc.), and a 2-3 sentence review. Make them specific and credible.",
          "usedIn": "testimonials-page.tsx - testimonials array",
          "wordCount": 300
        }
      ]
    },
    {
      "title": "FAQ Schema example (requires content for answers)",
      "description": "Add FAQ structured data to service pages. The schema component is ready but FAQ answers must be written by the business owner.",
      "acceptanceCriteria": ["FAQ schema validates in Rich Results Test", "Minimum 5 FAQs per page"],
      "section": "quick_wins",
      "category": "schema",
      "priority": 3,
      "estimatedHours": 2,
      "filePaths": ["src/components/FAQSchema.tsx"],
      "codeSnippets": {
        "faq-schema.tsx": "import Script from 'next/script'\\n\\ninterface FAQ { question: string; answer: string }\\n\\nexport function FAQSchema({ faqs }: { faqs: FAQ[] }) {\\n  const schema = {\\n    '@context': 'https://schema.org',\\n    '@type': 'FAQPage',\\n    mainEntity: faqs.map(f => ({\\n      '@type': 'Question',\\n      name: f.question,\\n      acceptedAnswer: { '@type': 'Answer', text: f.answer }\\n    }))\\n  }\\n  return <Script id='faq-schema' type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />\\n}",
        "usage.tsx": "import { FAQSchema } from '@/components/FAQSchema'\\n// Import FAQ data after generating content\\nimport { serviceFAQs } from '@/data/faqs'\\n\\n<FAQSchema faqs={serviceFAQs} />"
      },
      "promptContext": "Create a reusable FAQ schema component. Note: This task requires content - see contentPrompts for the FAQ questions and answers that need to be written first based on real customer questions.",
      "implementationNotes": "Generate FAQ content first using the content prompts, then implement the schema component.",
      "requiresContent": true,
      "contentPrompts": [
        {
          "type": "FAQ Questions and Answers",
          "prompt": "Write 5-7 frequently asked questions and detailed answers for [SERVICE_TYPE] services. Questions should reflect what real customers ask. Answers should be 2-4 sentences, helpful and specific. Include questions about: pricing/process, timelines, what's included, how it works, and results/guarantees.",
          "usedIn": "src/data/faqs.ts - serviceFAQs array",
          "wordCount": 500
        }
      ]
    }
  ]
}

Generate 8-15 tasks total, covering the most impactful items from the action plan. Prioritize quick wins first, then strategic items.

IMPORTANT REMINDERS:
- For FAQ schema tasks: ALWAYS set requiresContent: true and include a contentPrompt for the FAQ answers
- NEVER truncate code snippets - if too long, split into multiple files
- Every code snippet must be complete and copy-paste ready`
}

// ============================================
// MAIN GENERATION FUNCTION
// ============================================

/**
 * Generate PRD document from action plan
 *
 * Uses Claude with extended thinking for detailed technical output
 *
 * @param actionPlan - The action plan to convert to PRD tasks
 * @param siteContext - Site context (domain, business name, tech stack)
 * @param runId - Scan run ID for logging
 * @param completedTaskTitles - Previously completed task titles to exclude from generation
 */
export async function generatePrd(
  actionPlan: ActionPlanContext,
  siteContext: SiteContext,
  runId: string,
  completedTaskTitles: string[] = []
): Promise<GeneratedPrd> {
  log.step(runId, 'Generating PRD from action plan')

  // Build prompts
  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(actionPlan, siteContext, completedTaskTitles)

  if (completedTaskTitles.length > 0) {
    log.info(runId, `Excluding ${completedTaskTitles.length} previously completed tasks from PRD generation`)
  }

  log.info(runId, `PRD prompt: ~${Math.round(userPrompt.length / 4)} tokens input`)

  const startTime = Date.now()

  try {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: 16000, // Increased to prevent truncation of code snippets
      providerOptions: {
        anthropic: {
          // Enable extended thinking for detailed technical output
          thinking: {
            type: 'enabled',
            budgetTokens: 10000,
          },
        },
      },
    })

    const responseTimeMs = Date.now() - startTime
    log.info(runId, `PRD generated in ${(responseTimeMs / 1000).toFixed(1)}s`)

    // Track cost
    if (result.usage) {
      await trackCost({
        runId,
        step: 'generate_prd',
        model: 'anthropic/claude-sonnet-4-20250514',
        usage: {
          inputTokens: result.usage.inputTokens || 0,
          outputTokens: result.usage.outputTokens || 0,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        },
      })
    }

    // Log response length for debugging
    log.info(runId, `PRD response length: ${result.text.length} chars`)

    // Parse JSON response
    const prd = parsePrdResponse(result.text, runId, siteContext)

    // If parsing failed (empty tasks with error message), throw to make it visible
    if (prd.tasks.length === 0 && prd.overview.includes('encountered an error')) {
      throw new Error('PRD JSON parsing failed - check logs for response preview')
    }

    log.done(runId, 'PRD', `${prd.tasks.length} tasks generated`)

    return prd

  } catch (error) {
    log.error(runId, 'PRD generation failed', error instanceof Error ? error.message : 'Unknown error')
    throw error
  }
}

/**
 * Parse and validate PRD JSON response
 * Uses multiple strategies to extract JSON from potentially malformed responses
 */
function parsePrdResponse(
  text: string,
  runId: string,
  siteContext: SiteContext
): GeneratedPrd {
  let jsonStr = text.trim()

  // Strategy 1: Extract from markdown code blocks (most common)
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim()
  }

  // Strategy 2: Find JSON object boundaries more carefully
  // This handles cases where there's text before or after the JSON
  const firstBrace = jsonStr.indexOf('{')
  const lastBrace = jsonStr.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1)
  }

  // Strategy 3: Try to fix common JSON issues before parsing
  // Remove trailing commas before } or ]
  jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1')

  // Try to parse with multiple strategies
  const parseAttempts = [
    // Attempt 1: Parse as-is
    () => JSON.parse(jsonStr),
    // Attempt 2: Try relaxed JSON parsing (handle unescaped newlines in strings)
    () => {
      // Replace unescaped newlines inside strings with \\n
      const relaxed = jsonStr.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) => {
        return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
      })
      return JSON.parse(relaxed)
    },
  ]

  let parsed: GeneratedPrd | null = null
  let lastError: Error | null = null

  for (const attempt of parseAttempts) {
    try {
      parsed = attempt() as GeneratedPrd
      break
    } catch (e) {
      lastError = e instanceof Error ? e : new Error('Parse error')
    }
  }

  if (parsed) {
    // Validate required fields
    if (!parsed.title) {
      parsed.title = `AI Visibility PRD: ${siteContext.businessName || siteContext.domain}`
    }
    if (!parsed.overview) {
      parsed.overview = 'Technical implementation plan to improve AI assistant visibility.'
    }
    if (!Array.isArray(parsed.goals)) {
      parsed.goals = ['Improve AI visibility', 'Implement structured data', 'Optimize content for AI discovery']
    }
    if (!Array.isArray(parsed.techStack)) {
      parsed.techStack = siteContext.techStack || ['Next.js', 'React', 'TypeScript']
    }
    if (!Array.isArray(parsed.targetPlatforms)) {
      parsed.targetPlatforms = ['Web']
    }
    if (!Array.isArray(parsed.tasks)) {
      parsed.tasks = []
    }

    // Validate and normalize tasks
    parsed.tasks = parsed.tasks.map((task, index) => ({
      title: task.title || 'Untitled Task',
      description: task.description || '',
      acceptanceCriteria: Array.isArray(task.acceptanceCriteria) ? task.acceptanceCriteria : [],
      section: normalizeSection(task.section),
      category: task.category || 'technical',
      priority: typeof task.priority === 'number' ? task.priority : index + 1,
      estimatedHours: typeof task.estimatedHours === 'number' ? task.estimatedHours : null,
      filePaths: Array.isArray(task.filePaths) ? task.filePaths : null,
      codeSnippets: task.codeSnippets && typeof task.codeSnippets === 'object' ? task.codeSnippets : null,
      promptContext: task.promptContext || null,
      implementationNotes: task.implementationNotes || null,
      requiresContent: task.requiresContent === true,
      contentPrompts: Array.isArray(task.contentPrompts) ? task.contentPrompts : null,
    }))

    log.info(runId, `PRD parsed successfully: ${parsed.tasks.length} tasks`)
    return parsed
  }

  // All parsing attempts failed - log detailed debug info
  log.error(runId, 'Failed to parse PRD JSON after all attempts', lastError?.message || 'Unknown error')
  log.error(runId, 'Original response length', String(text.length))
  log.error(runId, 'Processed JSON length', String(jsonStr.length))
  log.error(runId, 'Response preview (first 1000 chars)', text.slice(0, 1000))
  log.error(runId, 'Response preview (last 500 chars)', text.slice(-500))

  // Return minimal valid structure
  return {
    title: `AI Visibility PRD: ${siteContext.businessName || siteContext.domain}`,
    overview: 'PRD generation encountered an error. Please try regenerating.',
    goals: ['Generation encountered a parsing error - please regenerate'],
    techStack: siteContext.techStack || ['Next.js', 'React', 'TypeScript'],
    targetPlatforms: ['Web'],
    tasks: [],
  }
}

function normalizeSection(section: unknown): 'quick_wins' | 'strategic' | 'backlog' {
  if (section === 'quick_wins' || section === 'strategic' || section === 'backlog') {
    return section
  }
  return 'strategic'
}
