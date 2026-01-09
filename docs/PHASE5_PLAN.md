# Phase 5: Subscriber Features - Implementation Plan

**Status:** 5B Trend Charts Complete
**Last Updated:** 2026-01-09

---

## Overview

Phase 5 adds the core subscriber features that differentiate paid tiers. The key principle is **tiered value** - both Starter and Pro should feel valuable, with Pro offering power-user capabilities.

---

## Tier Feature Matrix

| Feature | Free | Starter ($49) | Pro ($79) |
|---------|------|---------------|-----------|
| **5A: Editable Questions** | View only | Edit + Add 3 custom | Edit + Add 20 custom |
| **5B: Trend Charts** | No history | Full trends | Full trends |
| **5C: Action Plans** | Locked teaser | Full recommendations | Full recommendations |
| **5D: PRD Generation** | Locked teaser | Locked teaser | Full PRDs |

### Value Proposition Summary

**Starter** = "Business Owner" tier
- See your visibility trends over time
- Customize questions to match your priorities
- Get actionable recommendations to improve

**Pro** = "Developer/Vibe Coder" tier
- Everything in Starter, plus:
- 20 custom questions for deep analysis
- Claude Code-ready PRDs to implement fixes

---

## 5A: Editable Questions

### Requirements

1. **View questions** - All users can see the generated questions
2. **Edit questions** - Subscribers can modify question text
3. **Add questions** - Starter: +3 custom, Pro: +20 custom
4. **Question history** - See past versions, revert to previous
5. **Archive/restore** - Soft delete with ability to restore

### Database Schema

```sql
-- Custom questions per lead
CREATE TABLE subscriber_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  category TEXT DEFAULT 'custom',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_from UUID REFERENCES prompts(id), -- if edited from original
  version INT DEFAULT 1
);

-- Question history for reverting
CREATE TABLE question_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES subscriber_questions(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  version INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track question limits by tier
-- Starter: 3 custom questions max
-- Pro: 20 custom questions max
```

### API Routes

```
GET    /api/questions          - List questions for current user
POST   /api/questions          - Add new custom question
PUT    /api/questions/[id]     - Update question text
DELETE /api/questions/[id]     - Archive question (soft delete)
POST   /api/questions/[id]/restore - Restore archived question
GET    /api/questions/[id]/history - Get version history
POST   /api/questions/[id]/revert  - Revert to specific version
```

### UI Changes (SetupTab)

1. When `isSubscriber=true`:
   - Show edit icon on each question
   - Inline editing with save/cancel
   - "Add Question" button (respects tier limit)
   - Show count: "3/3 custom questions used" or "5/20 custom questions used"

2. Question history modal:
   - List of previous versions with timestamps
   - "Revert to this version" button
   - Preview of old text

3. Archived questions section:
   - Collapsed by default
   - Shows archived questions with restore option

### Feature Flag Updates

```typescript
// In flags.ts
editablePrompts: boolean      // Can edit existing questions
customQuestionLimit: number   // Max custom questions (0, 3, or 20)
```

### Files to Create/Modify

- `supabase/migrations/012_subscriber_questions.sql` (new)
- `src/app/api/questions/route.ts` (new)
- `src/app/api/questions/[id]/route.ts` (new)
- `src/app/api/questions/[id]/history/route.ts` (new)
- `src/app/api/questions/[id]/revert/route.ts` (new)
- `src/components/report/tabs/SetupTab.tsx` (modify - add editing UI)
- `src/lib/features/flags.ts` (modify - add customQuestionLimit)

---

## 5B: Trend Charts ✅ COMPLETE

### Requirements

1. **Historical data** - Store each scan run's scores ✅
2. **Line chart** - Show visibility score over time ✅
3. **Platform breakdown** - Per-platform mention counts ✅
4. **Empty state** - "No history yet" for new subscribers ✅
5. **Locked state** - Free users see "Subscribers Only" overlay ✅

### Implementation ✅

Dual-axis trend chart showing:
- **Left axis**: AI Visibility Score (0-100)
- **Right axis**: Per-platform mention counts (ChatGPT, Perplexity, Gemini, Claude)

Legend grouped by axis: `— AI Visibility Score | Mentions: ● ChatGPT ● Perplexity ● Gemini ● Claude`

### Database Schema ✅

Migration `019_add_platform_mentions.sql` adds per-platform mention columns to `score_history`:
- `chatgpt_mentions INTEGER`
- `claude_mentions INTEGER`
- `gemini_mentions INTEGER`
- `perplexity_mentions INTEGER`

Updated `record_score_snapshot` function to accept new parameters.
Includes backfill query to populate existing data from `llm_responses`.

### API ✅

- `GET /api/trends` - Returns score history snapshots for subscribers
- `POST /api/trends` - Records score snapshot after scan completion

### Files Created/Modified ✅

- `supabase/migrations/013_score_history.sql` ✅ (base schema)
- `supabase/migrations/019_add_platform_mentions.sql` ✅ (platform mention columns)
- `src/app/api/trends/route.ts` ✅ (API endpoints)
- `src/app/api/process/route.ts` ✅ (extracts & saves platform mentions)
- `src/components/report/TrendChart.tsx` ✅ (dual-axis chart component)
- `src/components/report/tabs/MeasurementsTab.tsx` ✅ (integrated trend chart)

---

## 5C: Action Plans

### Requirements

1. **Both tiers get full recommendations** - Starter and Pro see the same rich action plans
2. **AI-generated from scan data** - Based on AI Readiness + AI Responses + Competitor data
3. **Comprehensive format** - Executive summary, prioritized actions, page-by-page edits, keyword map
4. **Grounded in findings** - Every recommendation links to specific detected issues
5. **Actionable implementation** - Step-by-step instructions for each action

### Output Format (Based on Reference)

The action plan should follow this comprehensive structure:

```markdown
# AI SEARCH OPTIMIZATION ACTION PLAN FOR [BUSINESS_NAME]

## EXECUTIVE SUMMARY
[2-3 sentence summary of current state, biggest gaps, and top opportunity]

## TOP 10 PRIORITY ACTIONS

### 1. [Action Title]
**Effort:** 🟢 Low | 🟡 Medium | 🔴 High
**Impact:** ⭐ | ⭐⭐ | ⭐⭐⭐
**Consensus:** [Which AIs flagged this - e.g., "All 4 AIs" or "ChatGPT + Claude"]
**Page:** [Target page/URL]

**Implementation:**
- Step 1: [Specific action]
- Step 2: [Specific action]
- Step 3: [Specific action]
- Step 4: [Specific action]

**Expected outcome:** [What improvement this will drive]

### 2. [Next Action]
...

## PAGE-BY-PAGE EDIT GUIDE

### /[page-path]
**Meta Title:** "[Optimized title]"
**Meta Description:** "[Optimized description]"
**H1 Change:** [Keep current | Change to "X"]

**Add to page:**
```markdown
## [New Section Heading]

[Specific content to add, with exact wording]
```

## CONTENT CREATION PRIORITIES

1. **[Content Piece Title]** - Effort: 🟡
   - Target question: "[The AI query this addresses]"
   - Suggested URL: /[path]
   - Key sections: [Section 1], [Section 2], [Section 3]

## KEYWORD INTEGRATION MAP

| Keyword/Phrase | Best Page | Where to Add | Priority |
|----------------|-----------|--------------|----------|
| [keyword] | /[page] | [Section name] | 🔴 High |
| [keyword] | /[page] | [Section name] | 🟡 Medium |
| [keyword] | /[page] | [Section name] | 🟢 Low |

## KEY TAKEAWAYS

1. **[Takeaway 1]:** [Explanation with data point]
2. **[Takeaway 2]:** [Explanation with data point]
3. **[Takeaway 3]:** [Explanation with data point]
```

### Database Schema

```sql
CREATE TABLE action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  scan_run_id UUID REFERENCES scan_runs(id),

  -- Full action plan content
  executive_summary TEXT,
  priority_actions JSONB NOT NULL,      -- Array of top 10 actions
  page_edits JSONB,                      -- Page-by-page edit guide
  content_priorities JSONB,              -- Content creation list
  keyword_map JSONB,                     -- Keyword integration table
  key_takeaways JSONB,                   -- Summary takeaways

  -- Metadata
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  model_used TEXT,

  UNIQUE(lead_id, scan_run_id)
);

-- Priority Action structure:
-- {
--   "id": "uuid",
--   "rank": 1,
--   "title": "Add Geographic Authority to Service Pages",
--   "effort": "medium",        -- "low" | "medium" | "high"
--   "impact": 3,               -- 1, 2, or 3 stars
--   "consensus": ["chatgpt", "claude", "gemini"],
--   "targetPage": "/services",
--   "implementation": [
--     "Step 1: Add H2 'Serving Sydney & Melbourne' after intro",
--     "Step 2: Insert paragraph with suburb-specific mentions",
--     "Step 3: Add LocalBusiness schema with serviceArea",
--     "Step 4: Include location-specific testimonial quotes"
--   ],
--   "expectedOutcome": "Capture 15+ missed location-based queries",
--   "relatedFindings": ["no_location_schema", "missed_local_queries"]
-- }

-- Page Edit structure:
-- {
--   "page": "/services",
--   "metaTitle": "Services | Sydney & Melbourne | [Business]",
--   "metaDescription": "...",
--   "h1Change": "keep",
--   "contentToAdd": "## Serving Australia's Major Cities\n\n..."
-- }

-- Content Priority structure:
-- {
--   "title": "Location-Specific Landing Page",
--   "effort": "high",
--   "targetQuestion": "Who's an AI specialist in Sydney?",
--   "suggestedUrl": "/services/sydney",
--   "keySections": ["Local Market", "Sydney Success Stories", "Suburb Examples"]
-- }

-- Keyword Map structure:
-- {
--   "keyword": "AI consultant Sydney",
--   "bestPage": "/services",
--   "whereToAdd": "Geographic coverage section",
--   "priority": "high"
-- }
```

### AI Generation (generate-actions.ts)

```typescript
interface PriorityAction {
  id: string
  rank: number
  title: string
  effort: 'low' | 'medium' | 'high'
  impact: 1 | 2 | 3  // Star rating
  consensus: string[]  // Which AI platforms flagged this
  targetPage: string
  implementation: string[]
  expectedOutcome: string
  relatedFindings: string[]
}

interface PageEdit {
  page: string
  metaTitle?: string
  metaDescription?: string
  h1Change: 'keep' | string
  contentToAdd?: string
}

interface ContentPriority {
  title: string
  effort: 'low' | 'medium' | 'high'
  targetQuestion: string
  suggestedUrl: string
  keySections: string[]
}

interface KeywordEntry {
  keyword: string
  bestPage: string
  whereToAdd: string
  priority: 'high' | 'medium' | 'low'
}

interface ActionPlan {
  executiveSummary: string
  priorityActions: PriorityAction[]  // Top 10
  pageEdits: PageEdit[]
  contentPriorities: ContentPriority[]
  keywordMap: KeywordEntry[]
  keyTakeaways: string[]
}

async function generateActionPlan(
  analysis: SiteAnalysis,
  responses: LLMResponse[],
  readinessChecks: ReadinessCheck[],
  competitors: Competitor[],
  brandAwareness: BrandAwarenessResult[]
): Promise<ActionPlan>
```

### Prompt Strategy

The AI prompt must:
1. Receive ALL scan data (readiness issues, visibility scores, competitor mentions, brand awareness gaps)
2. Analyze which platforms mentioned what (for "Consensus" field)
3. Only suggest actions for DETECTED issues (never hypothetical)
4. Prioritize by realistic impact and effort
5. Include specific, copy-paste-ready implementation steps
6. Generate exact content/meta descriptions to add
7. Map missed queries to specific keywords and pages

### API Routes

```
GET  /api/actions           - Get action plan for current user's latest scan
POST /api/actions/generate  - Regenerate action plan (uses AI credits)
```

### UI (ActionsTab.tsx)

Replace current LockedTab with comprehensive action plan view:

1. **Executive Summary Card**
   - Bold summary of current state
   - Key opportunity highlighted
   - "Last generated: X days ago" + Regenerate button

2. **Priority Actions List**
   - Numbered cards (1-10)
   - Effort/Impact badges (🟢🟡🔴 and ⭐⭐⭐)
   - Consensus indicator (which AIs agree)
   - Expandable implementation steps
   - "Generate PRD" button (Pro only)

3. **Page-by-Page Edits** (collapsible section)
   - Organized by page
   - Copy-ready meta titles/descriptions
   - Content blocks to add

4. **Content Creation Priorities** (collapsible section)
   - New content to create
   - Target questions each addresses
   - Effort indicators

5. **Keyword Integration Map** (collapsible section)
   - Sortable/filterable table
   - Priority column with color coding

6. **Key Takeaways** (footer section)
   - Bullet-point summary
   - Data-backed insights

### Files to Create/Modify

- `supabase/migrations/013_action_plans.sql` (new)
- `src/lib/ai/generate-actions.ts` (new)
- `src/app/api/actions/route.ts` (new)
- `src/app/api/actions/generate/route.ts` (new)
- `src/components/report/tabs/ActionsTab.tsx` (replace LockedTab usage)
- `src/components/report/ReportTabs.tsx` (modify to show real tab)

---

## 5D: PRD Generation (Pro Only)

### Requirements

1. **Pro-only feature** - Starter sees locked state with teaser
2. **Organized by priority** - Quick Wins, Strategic, Backlog sections (matching action plan)
3. **Claude Code format** - Paste-ready for vibe coding tools
4. **Copy to clipboard** - One-click copy with visual feedback
5. **Stored for reuse** - Don't regenerate unless requested

### PRD Categories (Matching Action Plan)

PRDs are organized into the same priority buckets as actions:

- **Quick Wins** - Low effort, high impact implementations
- **Strategic** - Medium-high effort, high impact implementations
- **Backlog** - Lower priority implementations

### Database Schema

```sql
-- Add to action_plans table
ALTER TABLE action_plans ADD COLUMN prd_outputs JSONB DEFAULT '{}';

-- PRD structure organized by priority:
-- {
--   "quickWins": [
--     {
--       "actionId": "uuid",
--       "actionRank": 1,
--       "prd": {
--         "title": "Add LocalBusiness Schema Markup",
--         "effort": "low",
--         "impact": 3,
--         "targetPage": "/services",
--         "problem": "AI assistants can't determine your service areas...",
--         "solution": "Implement JSON-LD LocalBusiness schema...",
--         "implementation": [
--           { "step": 1, "description": "Create schema component", "code": "..." },
--           { "step": 2, "description": "Add to page layout", "code": "..." }
--         ],
--         "acceptanceCriteria": [
--           "Schema validates in Google Rich Results Test",
--           "All service areas listed in serviceArea property",
--           "Business name matches site branding"
--         ],
--         "technicalNotes": "Use Next.js metadata API for JSON-LD injection...",
--         "generatedAt": "2026-01-09T..."
--       }
--     }
--   ],
--   "strategic": [...],
--   "backlog": [...]
-- }
```

### AI Generation (generate-prd.ts)

```typescript
interface PRDImplementationStep {
  step: number
  description: string
  code?: string  // Optional code snippet
}

interface PRDTask {
  actionId: string
  actionRank: number
  title: string
  effort: 'low' | 'medium' | 'high'
  impact: 1 | 2 | 3
  targetPage: string
  problem: string
  solution: string
  implementation: PRDImplementationStep[]
  acceptanceCriteria: string[]
  technicalNotes: string
  generatedAt: string
}

interface PRDOutput {
  quickWins: PRDTask[]
  strategic: PRDTask[]
  backlog: PRDTask[]
}

async function generatePRD(
  action: PriorityAction,
  context: SiteAnalysis,
  category: 'quickWins' | 'strategic' | 'backlog'
): Promise<PRDTask>

async function generateAllPRDs(
  actionPlan: ActionPlan,
  context: SiteAnalysis
): Promise<PRDOutput>
```

### PRD Output Format (Claude Code Ready)

The generated PRD should be formatted for direct pasting into Claude Code or any vibe coding tool:

```markdown
# Quick Win: Add LocalBusiness Schema Markup

**Effort:** 🟢 Low | **Impact:** ⭐⭐⭐ | **Page:** /services

## Problem

AI assistants currently can't determine your service areas because your site lacks
LocalBusiness schema markup. This resulted in 0 mentions for location-based queries
like "AI consultant Sydney" and "small business AI Melbourne".

## Solution

Implement JSON-LD LocalBusiness schema with comprehensive serviceArea properties
covering Sydney, Melbourne, and Gold Coast regions.

## Implementation Steps

### Step 1: Create Schema Component

Create a new component to generate the LocalBusiness JSON-LD:

```typescript
// components/LocalBusinessSchema.tsx
export function LocalBusinessSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "JOURN3Y",
    "url": "https://journ3y.com.au",
    "serviceArea": [
      { "@type": "City", "name": "Sydney" },
      { "@type": "City", "name": "Melbourne" },
      { "@type": "City", "name": "Gold Coast" }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

### Step 2: Add to Layout

Import and add the schema component to your root layout:

```typescript
// app/layout.tsx
import { LocalBusinessSchema } from '@/components/LocalBusinessSchema';

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <LocalBusinessSchema />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### Step 3: Validate Schema

Test your implementation using Google's Rich Results Test tool.

## Acceptance Criteria

- [ ] Schema validates without errors in Google Rich Results Test
- [ ] All three service areas (Sydney, Melbourne, Gold Coast) appear in schema
- [ ] Business name in schema matches site header/branding
- [ ] Schema appears in page source on all pages

## Technical Notes

- Use Next.js metadata API for cleaner JSON-LD injection in Next.js 14+
- Consider adding more specific serviceArea entries for suburbs
- LocalBusiness can be extended to ProfessionalService for consulting businesses
```

### API Routes

```
GET  /api/prd                  - Get all PRDs for current user's latest scan
GET  /api/prd/[actionId]       - Get PRD for specific action
POST /api/prd/[actionId]       - Generate/regenerate PRD for specific action
POST /api/prd/generate-all     - Generate PRDs for all actions (batch)
```

### UI (PRDTab.tsx)

**For Pro users:**

1. **Category Tabs/Sections**
   - Quick Wins (🟢 Low effort, high impact)
   - Strategic (🟡 Medium effort, high impact)
   - Backlog (🔴 Higher effort or lower priority)

2. **PRD Cards**
   - Title with effort/impact badges
   - Target page indicator
   - "View Full PRD" expand button
   - "Copy to Clipboard" button
   - "Regenerate" button (rate limited)

3. **Full PRD View**
   - Modal or expanded card
   - Formatted markdown with code blocks
   - Syntax highlighting for code snippets
   - Large "Copy All" button at top

4. **Batch Actions**
   - "Generate All PRDs" button (if none exist)
   - Progress indicator during generation

**For Starter users:**

1. **Locked State**
   - Show existing LockedTab component
   - Preview of PRD format (blurred/partial)
   - "Unlock with Pro" upgrade CTA
   - Value proposition: "Get copy-paste-ready code for Claude Code"

**Copy Functionality:**

- "Copy to Clipboard" copies full markdown-formatted PRD
- Visual feedback: button text changes to "Copied!" for 2 seconds
- Toast notification: "PRD copied - paste into Claude Code"
- Format preserved perfectly for vibe coding tools

### Files to Create/Modify

- `supabase/migrations/013_action_plans.sql` (include prd_outputs column)
- `src/lib/ai/generate-prd.ts` (new)
- `src/app/api/prd/route.ts` (new)
- `src/app/api/prd/[actionId]/route.ts` (new)
- `src/app/api/prd/generate-all/route.ts` (new)
- `src/components/report/tabs/PRDTab.tsx` (new - replace LockedTab usage)
- `src/components/report/ReportTabs.tsx` (modify)

---

## Implementation Order

### Sprint 3: Questions & Trends

1. **5A: Editable Questions** ⏳ PENDING
   - Migration + API routes
   - SetupTab editing UI
   - Question history/revert

2. **5B: Trend Charts** ✅ COMPLETE
   - score_history table with platform mentions
   - Dual-axis TrendChart component (score + mentions)
   - MeasurementsTab integration with locked state for free users

### Sprint 4: Actions & PRDs (1-2 weeks)

3. **5C: Action Plans**
   - Migration + AI generation
   - ActionsTab full implementation
   - Category filtering

4. **5D: PRD Generation**
   - PRD AI generation
   - PRDTab implementation
   - Copy-to-clipboard

---

## Feature Flag Updates

```typescript
// Updated flags.ts

interface FeatureFlags {
  // Existing
  isSubscriber: boolean
  tier: Tier
  blurCompetitors: boolean
  showAllCompetitors: boolean

  // 5A: Questions
  editablePrompts: boolean       // Can edit questions
  customQuestionLimit: number    // 0, 3, or 20

  // 5C/5D: Actions & PRD
  showActionPlans: boolean       // Show real actions (not teaser)
  showPrdTasks: boolean          // Can generate PRDs

  // Existing
  geoEnhancedPrompts: boolean
  unlimitedScans: boolean
  exportReports: boolean
  multiDomain: boolean
}

function getFlagsForTier(tier: Tier): FeatureFlags {
  switch (tier) {
    case 'starter':
      return {
        // ...existing
        editablePrompts: true,
        customQuestionLimit: 3,
        showActionPlans: true,
        showPrdTasks: false,  // Starter can't generate PRDs
      }

    case 'pro':
      return {
        // ...existing
        editablePrompts: true,
        customQuestionLimit: 20,
        showActionPlans: true,
        showPrdTasks: true,
      }

    case 'agency':
      return {
        // ...existing (same as pro for these features)
        editablePrompts: true,
        customQuestionLimit: 20,
        showActionPlans: true,
        showPrdTasks: true,
      }
  }
}
```

---

## Testing Checklist

### 5A: Editable Questions
- [ ] Free user sees questions read-only
- [ ] Starter can edit + add up to 3 custom
- [ ] Pro can edit + add up to 20 custom
- [ ] Question history saves on each edit
- [ ] Revert to previous version works
- [ ] Archive/restore works
- [ ] Custom questions used in next scan

### 5B: Trend Charts ✅
- [x] Free users see locked "Subscribers Only" overlay
- [x] Subscribers see dual-axis trend chart
- [x] AI Visibility Score on left axis (0-100)
- [x] Per-platform mention counts on right axis
- [x] Legend grouped by axis type

### 5C: Action Plans
- [ ] Free user sees locked teaser
- [ ] Starter sees full action plans
- [ ] Pro sees full action plans
- [ ] Actions grounded in actual findings
- [ ] Category filter works
- [ ] Regenerate button works (rate limited)

### 5D: PRD Generation
- [ ] Starter sees locked teaser on PRD tab
- [ ] Pro can generate PRDs
- [ ] PRD format correct for vibe coding
- [ ] Copy to clipboard works
- [ ] PRD stored and retrievable

---

## Notes

- All AI generation uses Claude via Vercel AI SDK
- Rate limiting on regenerate buttons to prevent abuse
- PRD format tested with Claude Code paste workflow
- Consider adding "Mark as Complete" for actions (future enhancement)
