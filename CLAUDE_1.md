# outrankllm.io - AI Search Visibility Platform

## Project Overview

outrankllm.io helps vibe coders make their websites visible to AI assistants (ChatGPT, Claude, Gemini). Users submit their domain, receive a free visibility report, then convert to paid subscriptions for ongoing monitoring and actionable recommendations.

**Core Value Proposition:** "Your vibe-coded site is invisible to ChatGPT. We fix that."

**Target Audience:** Vibe coders - developers who build sites using AI-assisted coding tools like Bolt.new, Lovable, Cursor, Replit, and v0.

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (auth, database, edge functions)
- **Hosting**: Vercel
- **AI APIs**: OpenAI (GPT-4o), Anthropic (Claude Sonnet), Google AI (Gemini)
- **Email**: Resend (or Supabase Edge Functions)
- **Domain**: outrankllm.io (Cloudflare DNS)

---

## Build Order

### Phase 1: Landing Page (START HERE)

Build a simple, high-converting landing page that captures email + domain.

**Deliverables:**
1. `app/page.tsx` - Landing page
2. `components/ghost/Ghost.tsx` - Animated ghost mascot
3. `components/landing/EmailForm.tsx` - Email + domain capture form
4. `components/landing/Platforms.tsx` - Platform indicators
5. `app/api/waitlist/route.ts` - Store submissions in Supabase
6. `app/globals.css` - Design system variables and ghost animations

**Requirements:**
- Ghost mascot with all animations (float, blink, fade, hover disappear)
- Headline: "Your site is invisible to AI" / Subhead: "We fix that."
- Email + domain form that submits to Supabase
- Platform indicators (ChatGPT, Claude, Gemini with colored pips)
- "Works with" section (Bolt.new, Lovable, Replit, v0)
- Footer with "Building in public" status
- Dark theme with grid background
- Floating pixel parallax effect

**Database table needed:**
```sql
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  domain TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### Phase 2: AI Visibility Engine (ADAPT FROM JOURN3Y)

**IMPORTANT: Do not rebuild from scratch.** The AI monitoring engine already exists in the JOURN3Y project. Extract and adapt this code.

**Source Code Location (JOURN3Y project):**
```
src/app/api/ai-monitor/
├── cron/route.ts          # Scheduled monitoring runs
├── run/route.ts           # Manual monitoring trigger
├── analyze/route.ts       # AI analysis generation
├── analyze-stream/route.ts # SSE streaming analysis
├── sitemap/route.ts       # Site discovery & crawling
├── analyses/route.ts      # Fetch analysis history
└── generate-prd/route.ts  # PRD task generation

src/lib/ai-monitor/
├── generatePRD.ts         # PRD task generation logic
└── costTracking.ts        # API cost calculations

src/components/admin/
└── AIMonitorDashboard.tsx # Dashboard UI (adapt for report view)
```

**What to copy and adapt:**

| JOURN3Y File | outrankllm Location | Changes Needed |
|--------------|---------------------|----------------|
| `api/ai-monitor/sitemap/route.ts` | `api/monitor/crawl/route.ts` | Make domain dynamic (from request) |
| `api/ai-monitor/run/route.ts` | `api/monitor/query/route.ts` | Multi-tenant, remove JOURN3Y hardcoding |
| `api/ai-monitor/analyze/route.ts` | `api/monitor/analyze/route.ts` | Generate report for any domain |
| `lib/ai-monitor/generatePRD.ts` | `lib/monitor/prd.ts` | Generic PRD generation |
| `lib/ai-monitor/costTracking.ts` | `lib/monitor/costs.ts` | Copy as-is |

**Key logic to preserve from JOURN3Y:**
1. **Site Crawling** - Sitemap parsing OR homepage link discovery
2. **Page Extraction** - Title, description, H1, headings, detected sections, key phrases
3. **AI Platform Queries** - Parallel queries to ChatGPT, Claude, Gemini
4. **Mention Detection** - Check if domain mentioned, track position, extract competitors
5. **Analysis Generation** - 3 AIs analyze gaps, synthesize recommendations
6. **PRD Generation** - Convert recommendations to coding tasks
7. **Cost Tracking** - Token usage and cost calculation per step

**Key changes for multi-tenant:**
```typescript
// JOURN3Y (hardcoded)
const TARGET_DOMAIN = 'journ3y.com.au'

// outrankllm (dynamic)
const { domain } = await request.json()
const targetDomain = domain // From user input
```

---

### Phase 3: Scan Pipeline & Background Processing

Wire up the full scan flow:

1. `app/api/scan/route.ts` - Initiate scan (creates records, triggers background job)
2. `app/api/scan/[id]/status/route.ts` - Poll for progress
3. `app/api/monitor/process/route.ts` - Background worker that orchestrates:
   - Crawl site → Query AIs → Analyze → Generate report
4. Email notification when complete (Resend)

---

### Phase 4: Report View

1. `app/report/[id]/page.tsx` - Public report page
2. `components/report/VisibilityScore.tsx` - Overall score display
3. `components/report/PlatformBreakdown.tsx` - Per-platform results
4. `components/report/Recommendations.tsx` - Actionable insights
5. `components/report/PRDTasks.tsx` - Ready-to-ship tasks for AI coding tools
6. Conversion CTA - "Get ongoing monitoring"

---

### Phase 5: User Dashboard & Subscriptions

1. Auth flow (Supabase Auth)
2. Dashboard for returning users
3. Stripe integration for paid subscriptions
4. Scheduled monitoring for paid users

---

## Reference: JOURN3Y AI Monitor Architecture

The existing AI Monitor in JOURN3Y follows this pipeline:

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI Monitor Pipeline                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. QUESTION BANK          2. MONITORING RUN                    │
│  ┌─────────────────┐       ┌─────────────────────────┐         │
│  │ Questions by    │  ──>  │ Query ChatGPT, Claude,  │         │
│  │ category        │       │ Gemini with each Q      │         │
│  └─────────────────┘       └─────────────────────────┘         │
│                                     │                           │
│                                     v                           │
│  3. RESPONSE ANALYSIS       4. SITE DISCOVERY                   │
│  ┌─────────────────┐       ┌─────────────────────────┐         │
│  │ Track mentions, │       │ Crawl sitemap/homepage  │         │
│  │ competitors,    │       │ Extract page metadata,  │         │
│  │ positions       │       │ headings, sections      │         │
│  └─────────────────┘       └─────────────────────────┘         │
│           │                          │                          │
│           v                          v                          │
│  5. AI ANALYSIS             6. PRD GENERATION                   │
│  ┌─────────────────┐       ┌─────────────────────────┐         │
│  │ 3 AIs analyze   │  ──>  │ Convert to coding tasks │         │
│  │ gaps & give     │       │ for AI coding assistants│         │
│  │ recommendations │       │ (Claude Code, Cursor)   │         │
│  └─────────────────┘       └─────────────────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Detected content sections the crawler looks for:**
- `location-coverage` - Geographic service areas
- `faq` - FAQ sections
- `partner-credentials` - Certifications/partnerships
- `pricing` - Pricing information
- `testimonials` - Customer reviews
- `case-studies` - Success stories
- `how-it-works` - Process explanations
- `benefits` - Feature/benefit lists
- `cta` - Contact/booking sections
- `team-about` - Team/company info
- `industries` - Industry-specific content

**PRD Task Quality Rules (from JOURN3Y):**
1. Content-Aware - Compare recommendations against current page state
2. No Redundancy - Skip tasks for content that already exists
3. No Superlatives - Avoid risky claims like "#1" or "Best in Australia"
4. Dynamic Route Detection - Note when pages may be database-driven
5. Tech Stack Inference - Identify framework from URL patterns
6. Specific Copy - Provide exact text, not vague suggestions
7. Success Criteria - Include verification steps for each task

---

## Development Conventions

### Project Setup

```bash
# Create project
npx create-next-app@latest outrankllm --typescript --tailwind --eslint --app --src-dir

# Install core dependencies
npm install @supabase/supabase-js @supabase/ssr
npm install zod                           # Validation (like Pydantic)
npm install lucide-react                  # Icons
npm install class-variance-authority clsx tailwind-merge  # Utility classes

# Install AI SDKs
npm install openai @anthropic-ai/sdk @google/generative-ai

# Install shadcn/ui
npx shadcn@latest init
npx shadcn@latest add button input card form label textarea

# Install email
npm install resend
```

### File Naming Conventions

- **Pages**: `page.tsx` (server component) + `PageClient.tsx` (client component if needed)
- **API Routes**: `route.ts` in `app/api/` directories
- **Components**: PascalCase (`Ghost.tsx`, `EmailForm.tsx`)
- **Utilities**: camelCase (`createClient.ts`, `sendEmail.ts`)
- **Types**: Define in component file or `types.ts` if shared

### Server vs Client Components

```tsx
// DEFAULT: Server Component (no directive needed)
// Use for: static content, data fetching, metadata
export default function Page() {
  return <div>Static content</div>
}

// CLIENT: Add 'use client' directive
// Use for: useState, useEffect, event handlers, browser APIs
'use client'
export default function InteractiveComponent() {
  const [state, setState] = useState()
  return <button onClick={() => {}}>Click</button>
}
```

### API Route Pattern

```typescript
// app/api/[resource]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Validation schema (like Pydantic)
const RequestSchema = z.object({
  email: z.string().email(),
  domain: z.string().min(3),
})

export async function POST(request: NextRequest) {
  try {
    // 1. Parse and validate
    const body = await request.json()
    const result = RequestSchema.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }
    
    // 2. Database operations
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('users')
      .insert({ email: result.data.email })
      .select()
      .single()
    
    if (error) throw error
    
    // 3. Return success
    return NextResponse.json({ success: true, data })
    
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Dynamic Route Parameters

```typescript
// app/api/scan/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const scanId = params.id
  // ...
}
```

### Supabase Client Setup

```typescript
// lib/supabase/client.ts (for client components)
import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// lib/supabase/server.ts (for server components & API routes)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}
```

### Background Processing Pattern

Vercel serverless functions have timeouts, so heavy work should be async:

```typescript
// 1. API route queues the job (fast, returns immediately)
// app/api/scan/route.ts
export async function POST(request: NextRequest) {
  const { email, domain } = await request.json()
  
  // Create pending scan record
  const { data: scan } = await supabase
    .from('scan_runs')
    .insert({ domain_id: domainId, status: 'pending' })
    .select()
    .single()
  
  // Trigger background processing (fire and forget)
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/monitor/process`, {
    method: 'POST',
    body: JSON.stringify({ scanId: scan.id }),
  })
  
  // Return immediately with scan ID for polling
  return NextResponse.json({ scanId: scan.id })
}

// 2. Background endpoint does the work
// app/api/monitor/process/route.ts
export const maxDuration = 60 // Vercel Pro: up to 60 seconds

export async function POST(request: NextRequest) {
  const { scanId } = await request.json()
  
  // Update status
  await supabase.from('scan_runs').update({ status: 'running' }).eq('id', scanId)
  
  // Do heavy work: crawl site, query AIs, analyze
  // ...
  
  // Update with results
  await supabase.from('scan_runs').update({ status: 'complete' }).eq('id', scanId)
}
```

### Error Handling

```typescript
// Consistent error response format
interface ApiError {
  error: string
  details?: unknown
  code?: string
}

// Helper function
function errorResponse(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status })
}
```

### TypeScript Strictness

Use strict typing. Define interfaces for all data structures:

```typescript
interface ScanRun {
  id: string
  domain_id: string
  status: 'pending' | 'crawling' | 'querying' | 'analyzing' | 'complete' | 'failed'
  progress: number
  started_at: string | null
  completed_at: string | null
  created_at: string
}

interface ScanResponse {
  id: string
  run_id: string
  question: string
  platform: 'chatgpt' | 'claude' | 'gemini'
  response: string
  mentioned: boolean
  mention_position: number | null
}
```

---

## Brand Design System

### Design Philosophy

Industrial-utilitarian meets developer aesthetic. Dark, grid-based themes that feel native to the vibe coder community. No gradients, no marketing fluff - just clean lines, purposeful color pops, and functional design.

**Key Principles:**
- Monochrome base with strategic color accents
- Hard edges, no gradients
- Typography-driven hierarchy
- Developer-authentic (feels like a tool, not a marketing site)
- The "invisible → visible" concept woven throughout

### Color Palette

```css
:root {
  /* Base Colors */
  --bg: #0a0a0a;           /* Near black background */
  --surface: #151515;       /* Elevated surfaces */
  --border: #2a2a2a;        /* Subtle borders */
  
  /* Text Hierarchy */
  --text: #f5f5f5;          /* Primary text (off-white) */
  --text-mid: #a3a3a3;      /* Secondary text */
  --text-dim: #666666;      /* Tertiary/muted text */
  
  /* Accent Colors */
  --green: #22c55e;         /* Primary accent (CTA, highlights) */
  --red: #ef4444;           /* ChatGPT indicator */
  --blue: #3b82f6;          /* Gemini indicator */
  --amber: #f59e0b;         /* Status/warning indicator */
}
```

### Typography

**Fonts:**
- **Outfit** - Display/headings (sans-serif, geometric, modern)
- **DM Mono** - Technical elements, logo, code, taglines (monospace)

```html
<!-- Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
```

**Type Scale:**
```css
/* Headlines */
h1 {
  font-family: 'Outfit', sans-serif;
  font-size: clamp(2.2rem, 6vw, 3.5rem);
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

/* Logo text */
.logo-text {
  font-family: 'DM Mono', monospace;
  font-size: 1.75rem;
  font-weight: 500;
  letter-spacing: -0.02em;
}

/* Taglines and technical text */
.tagline {
  font-family: 'DM Mono', monospace;
  font-size: 0.85rem;
  line-height: 1.7;
}

/* Small labels */
.label {
  font-family: 'DM Mono', monospace;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}
```

---

## Ghost Mascot & Animation System

The ghost represents things that are "invisible" becoming "visible" - perfectly aligned with the product's purpose. The animation system reinforces the brand story through motion.

### Ghost Design Principles

- Simple, clean silhouette (scales to 16px favicon)
- Sideways-looking eyes (curious, looking for something)
- No mouth for cleaner logo usage
- Works on both dark and light backgrounds

### Required Assets

Two image files needed (PNG or WebP):
- `ghost-eyes-open.png` - Default state with eyes open
- `ghost-eyes-closed.png` - Blink state with eyes closed

### Animation System Overview

The ghost has **4 distinct animations** that work together:

| Animation | Purpose | Duration | Effect |
|-----------|---------|----------|--------|
| **Float** | Hovering/alive feel | 3s loop | Subtle position drift + micro-rotation |
| **Blink** | Personality/life | 4s loop | Quick eye close (8% of cycle) |
| **Fade** | "Invisible → visible" story | 8s loop | Ghost fades to 15% opacity, pops back |
| **Hover Disappear** | Interactive easter egg | On hover | Ghost vanishes, shows "?" |

### Complete CSS Implementation

```css
/* ===================
   GHOST CONTAINER
   =================== */
.ghost {
  position: relative;
  width: 64px;
  height: 80px;
  cursor: pointer;
  transition: opacity 0.3s ease;
}

.ghost img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* ===================
   1. FLOAT ANIMATION
   Subtle hovering motion - ghost feels alive
   Duration: 3s loop
   =================== */
@keyframes float {
  0%, 100% { 
    transform: translate(0, 0) rotate(0deg); 
  }
  25% { 
    transform: translate(2px, -4px) rotate(0.5deg); 
  }
  50% { 
    transform: translate(-1px, -2px) rotate(-0.5deg); 
  }
  75% { 
    transform: translate(1px, -5px) rotate(0.3deg); 
  }
}

/* Apply float to container */
.ghost {
  animation: float 3s infinite ease-in-out;
}

/* ===================
   2. BLINK ANIMATION
   Quick eye close - adds personality
   Duration: 4s loop (eyes closed for ~8% of cycle)
   Requires two images: eyes-open and eyes-closed
   =================== */
@keyframes blink {
  0%, 90%, 100% { opacity: 0; }  /* eyes-closed hidden */
  92%, 98% { opacity: 1; }        /* eyes-closed shown briefly */
}

@keyframes blink-inverse {
  0%, 90%, 100% { opacity: 1; }  /* eyes-open shown */
  92%, 98% { opacity: 0; }        /* eyes-open hidden during blink */
}

/* ===================
   3. FADE ANIMATION
   Ghost fades to near-invisible, then pops back
   Reinforces the "invisible → visible" brand story
   Duration: 8s loop
   =================== */
@keyframes fade-visibility {
  0%, 70%, 100% { opacity: 1; }    /* Fully visible */
  80%, 90% { opacity: 0.15; }       /* Nearly invisible */
}

/* ===================
   4. HOVER DISAPPEAR
   Interactive easter egg - ghost vanishes on hover
   Shows "?" where ghost was
   =================== */
.ghost:hover {
  opacity: 0;
}

.ghost:hover::after {
  content: '?';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: 'DM Mono', monospace;
  font-size: 1.5rem;
  color: var(--text-dim);
  opacity: 1;
}

/* ===================
   COMBINED MODE (RECOMMENDED)
   All animations running together
   =================== */
.ghost.combined {
  animation: float 3s infinite ease-in-out;
}

.ghost.combined .eyes-open {
  animation: 
    blink-inverse 4s infinite,
    fade-visibility 8s infinite ease-in-out;
}

.ghost.combined .eyes-closed {
  opacity: 0;
  animation: blink 4s infinite;
}

/* ===================
   INDIVIDUAL MODES (for testing/customization)
   =================== */

/* Float only */
.ghost.float-only {
  animation: float 3s infinite ease-in-out;
}
.ghost.float-only .eyes-closed { display: none; }

/* Blink only */
.ghost.blink-only .eyes-open { animation: blink-inverse 4s infinite; }
.ghost.blink-only .eyes-closed { opacity: 0; animation: blink 4s infinite; }

/* Fade only */
.ghost.fade-only .eyes-closed { display: none; }
.ghost.fade-only .eyes-open { animation: fade-visibility 5s infinite ease-in-out; }
```

### HTML Structure

```html
<!-- Ghost with all animations combined (recommended) -->
<div class="ghost combined">
  <img src="/images/ghost-eyes-open.png" alt="Ghost" class="eyes-open">
  <img src="/images/ghost-eyes-closed.png" alt="Ghost blinking" class="eyes-closed">
</div>
```

### React Component Example

```tsx
// components/ghost/Ghost.tsx
'use client'

import { cn } from '@/lib/utils'
import Image from 'next/image'

interface GhostProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  animate?: boolean
}

const sizes = {
  sm: { width: 40, height: 50 },
  md: { width: 64, height: 80 },
  lg: { width: 96, height: 120 },
}

export function Ghost({ className, size = 'md', animate = true }: GhostProps) {
  const dimensions = sizes[size]
  
  return (
    <div 
      className={cn(
        'ghost relative cursor-pointer transition-opacity duration-300',
        animate && 'combined',
        className
      )}
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      <Image
        src="/images/ghost-eyes-open.png"
        alt="Ghost"
        fill
        className="eyes-open object-contain"
      />
      <Image
        src="/images/ghost-eyes-closed.png"
        alt="Ghost blinking"
        fill
        className="eyes-closed object-contain"
      />
    </div>
  )
}
```

### Animation Timing Notes

- **Float** (3s) and **Blink** (4s) have different durations intentionally - this prevents them from syncing up and looking mechanical
- **Fade** (8s) is slowest - the "invisible" moment should feel special, not constant
- The **hover disappear** uses CSS transition (0.3s) for smooth fade-out
- All timings use `ease-in-out` for natural, organic movement

### Alternative Interactions (Future Enhancements)

```css
/* Ghost slides away when clicked */
.ghost:active {
  transform: translateX(100px);
  opacity: 0;
  transition: all 0.5s ease;
}

/* Ghost glitches on hover */
.ghost.glitch:hover {
  animation: glitch 0.3s steps(2) infinite;
}

@keyframes glitch {
  0% { transform: translate(0); }
  25% { transform: translate(-2px, 1px); }
  50% { transform: translate(2px, -1px); }
  75% { transform: translate(-1px, -2px); }
  100% { transform: translate(1px, 2px); }
}

/* Ghost leaves outline when it disappears */
.ghost.outline:hover::before {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px dashed var(--text-dim);
  opacity: 0.5;
}
```

---

## Landing Page Components

### Background

Dark grid with subtle scanlines and floating colored pixels that respond to mouse movement (parallax effect).

```css
/* Grid background */
body {
  background-color: var(--bg);
  background-image: 
    linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
  background-size: 32px 32px;
}

/* Floating pixels */
.pixel {
  position: fixed;
  width: 4px;
  height: 4px;
  pointer-events: none;
  z-index: 0;
}

.pixel.red { background: var(--red); }
.pixel.green { background: var(--green); }
.pixel.blue { background: var(--blue); }
.pixel.amber { background: var(--amber); }
```

```javascript
// Parallax on mouse move
document.addEventListener('mousemove', (e) => {
  const pixels = document.querySelectorAll('.pixel');
  const x = (e.clientX / window.innerWidth - 0.5) * 2;
  const y = (e.clientY / window.innerHeight - 0.5) * 2;
  
  pixels.forEach((pixel, i) => {
    const speed = ((i % 4) + 1) * 8;
    pixel.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
  });
});
```

### Logo Section

Ghost centered above wordmark, simple divider below.

```html
<div class="logo">
  <div class="ghost">
    <img src="ghost-eyes-open.png" alt="Ghost" class="eyes-open">
    <img src="ghost-eyes-closed.png" alt="Ghost blinking" class="eyes-closed">
  </div>
  <div class="logo-text">outrank<span class="mark">llm</span></div>
  <div class="logo-sub">GEO for Vibe Coders</div>
</div>

<div class="divider"></div>
```

```css
.logo-text .mark {
  color: var(--green);
}

.divider {
  width: 60px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--green), transparent);
  margin: 32px 0;
}
```

### Headline & Messaging

```html
<h1>Your site is invisible<br>to <span class="em">AI</span></h1>
<p class="subhead">We fix that.</p>
<p class="tagline">
  Turn AI blindspots into <strong>ready-to-ship PRDs</strong> for Cursor, Claude Code, and Windsurf.
</p>
```

```css
h1 .em { color: var(--green); }
```

### Email Capture Form

Simple, focused - just email and domain.

```html
<div class="form-wrap">
  <form class="form" onsubmit="handleSubmit(event)">
    <input type="email" placeholder="you@company.com" required>
    <input type="text" placeholder="yourdomain.com" required>
    <button type="submit">Get Free Report →</button>
  </form>
</div>
```

```css
.form {
  display: flex;
  border: 1px solid var(--border);
  background: var(--surface);
  transition: border-color 0.2s;
}

.form:focus-within {
  border-color: var(--green);
}

.form input {
  flex: 1;
  background: transparent;
  border: none;
  border-right: 1px solid var(--border);
  padding: 14px 16px;
  color: var(--text);
  font-family: 'DM Mono', monospace;
  font-size: 0.85rem;
  outline: none;
}

.form input::placeholder {
  color: var(--text-dim);
}

.form button {
  background: var(--green);
  color: var(--bg);
  border: none;
  padding: 14px 20px;
  font-family: 'DM Mono', monospace;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}

.form button:hover {
  opacity: 0.85;
}
```

### Platform Indicators

Show which AI platforms are monitored.

```html
<div class="platforms">
  <div class="platform"><div class="pip r"></div>ChatGPT</div>
  <div class="platform"><div class="pip g"></div>Claude</div>
  <div class="platform"><div class="pip b"></div>Gemini</div>
</div>
```

```css
.platforms {
  display: flex;
  gap: 24px;
  margin-bottom: 32px;
}

.platform {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'DM Mono', monospace;
  font-size: 0.7rem;
  color: var(--text-dim);
}

.platform .pip {
  width: 6px;
  height: 6px;
}

.platform .pip.r { background: var(--red); }
.platform .pip.g { background: var(--green); }
.platform .pip.b { background: var(--blue); }
```

### Works With Section

Show compatibility with vibe coding tools.

```html
<div class="works-with">
  Works with <span>Bolt.new</span> · <span>Lovable</span> · <span>Replit</span> · <span>v0</span>
</div>
```

### Footer

```html
<footer class="foot">
  <div class="status"><div class="blink"></div>Building in public</div>
  <div>© 2025</div>
</footer>
```

```css
.foot {
  position: fixed;
  bottom: 24px;
  left: 24px;
  right: 24px;
  display: flex;
  justify-content: space-between;
  font-family: 'DM Mono', monospace;
  font-size: 0.7rem;
  color: var(--text-dim);
}

.foot .status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.foot .blink {
  width: 6px;
  height: 6px;
  background: var(--amber);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
```

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Landing page (email + domain capture)
│   ├── report/[id]/page.tsx        # Public report view
│   ├── dashboard/                  # Authenticated user dashboard
│   │   ├── page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── scan/route.ts           # Initiate visibility scan
│       ├── scan/[id]/status/route.ts
│       ├── report/[id]/route.ts
│       └── monitor/
│           ├── crawl/route.ts      # Site discovery
│           ├── query/route.ts      # Query AI platforms
│           └── analyze/route.ts    # Generate recommendations
├── components/
│   ├── ui/                         # shadcn components
│   ├── landing/
│   │   ├── Hero.tsx
│   │   ├── EmailForm.tsx
│   │   └── Platforms.tsx
│   ├── report/
│   │   ├── VisibilityScore.tsx
│   │   ├── Recommendations.tsx
│   │   └── PRDTasks.tsx
│   └── ghost/
│       └── Ghost.tsx               # Animated ghost mascot
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── monitor/
│   │   ├── crawl.ts               # Site crawling logic
│   │   ├── query.ts               # AI platform queries
│   │   ├── analyze.ts             # Analysis logic
│   │   └── prd.ts                 # PRD generation
│   └── email/
│       └── send.ts
└── hooks/
    └── useGhostAnimation.ts
```

---

## Database Schema (Supabase)

```sql
-- Users who've submitted domains
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  email_verified BOOLEAN DEFAULT false,
  subscription_status TEXT DEFAULT 'free' -- free, trial, paid, cancelled
);

-- Domains being monitored
CREATE TABLE domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  domain TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, domain)
);

-- Visibility scan runs
CREATE TABLE scan_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID REFERENCES domains(id),
  status TEXT DEFAULT 'pending', -- pending, crawling, querying, analyzing, complete, failed
  progress INTEGER DEFAULT 0,     -- 0-100
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- AI responses per question
CREATE TABLE scan_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES scan_runs(id),
  question TEXT NOT NULL,
  category TEXT,
  platform TEXT NOT NULL,         -- chatgpt, claude, gemini
  response TEXT,
  mentioned BOOLEAN,
  mention_position INTEGER,       -- 1st, 2nd, 3rd in response
  competitors_mentioned JSONB,    -- [{name, context}]
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Question bank
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  category TEXT,                  -- general, location, industry
  variables JSONB,                -- {domain}, {location}, etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Crawled pages for domain
CREATE TABLE site_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID REFERENCES domains(id),
  url TEXT NOT NULL,
  path TEXT,
  title TEXT,
  description TEXT,
  h1 TEXT,
  headings TEXT[],                -- H2/H3 headings
  detected_sections TEXT[],       -- faq, pricing, testimonials, etc.
  key_phrases TEXT[],
  schema_types TEXT[],            -- JSON-LD types found
  word_count INTEGER,
  crawled_at TIMESTAMPTZ,
  UNIQUE(domain_id, url)
);

-- Generated reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES scan_runs(id),
  visibility_score INTEGER,       -- 0-100
  platform_scores JSONB,          -- {chatgpt: 40, claude: 60, gemini: 30}
  summary TEXT,
  recommendations JSONB,          -- [{title, description, priority, effort}]
  prd_tasks JSONB,                -- [{title, context, goal, changes, success_criteria}]
  created_at TIMESTAMPTZ DEFAULT now()
);

-- API cost tracking
CREATE TABLE api_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES scan_runs(id),
  step TEXT,                      -- crawl, query_chatgpt, query_claude, analyze
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd DECIMAL(10, 6),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## User Flow

1. **Landing Page**: User enters email + domain
2. **Validation**: Verify email format, check domain is reachable
3. **Queue Scan**: Create user, domain, scan_run records
4. **Background Processing** (async):
   - Crawl site (sitemap or homepage discovery)
   - Query AI platforms with templated questions
   - Analyze responses and generate visibility score
   - Create recommendations and PRD tasks
5. **Email Notification**: Send "Your report is ready" email with link
6. **Report View**: User clicks link, sees results
7. **Conversion**: Prompt to sign up for ongoing monitoring

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scan` | POST | Initiate new scan (email + domain) |
| `/api/scan/[id]/status` | GET | Check scan progress (polling) |
| `/api/report/[id]` | GET | Fetch report data |
| `/api/monitor/crawl` | POST | Crawl a domain's pages |
| `/api/monitor/query` | POST | Query AI platforms |
| `/api/monitor/analyze` | POST | Generate recommendations |

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# AI APIs
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=AI...

# Email (Resend)
RESEND_API_KEY=re_...

# App
NEXT_PUBLIC_APP_URL=https://outrankllm.io
```

---

## JOURN3Y Project Reference

When implementing Phase 2, you will need access to the JOURN3Y project codebase. The AI Monitor code is located at:

**Repository context:** The JOURN3Y project contains a working AI visibility monitoring tool built for journ3y.com.au. The outrankllm.io project adapts this for multi-tenant use.

**Key files to study in JOURN3Y before adapting:**
- Read `CLAUDE.md` in JOURN3Y for the full AI Monitor documentation
- Study `src/app/api/ai-monitor/` for API implementation patterns
- Review `src/lib/ai-monitor/generatePRD.ts` for PRD generation logic
- Check database schema in Supabase for table structures

See **Phase 2** in Build Order above for specific adaptation instructions.

---

## Key Principles

1. **Simple UX**: Minimize friction to capture email + domain
2. **Speed**: Show progress quickly, even if full report takes time
3. **Value First**: Free report must deliver genuine, actionable insights
4. **Clear CTA**: Every page leads to conversion or next step
5. **Developer Authentic**: Speak the language of vibe coders
6. **No Superlatives**: Avoid risky claims like "#1" or "Best"

---

## Messaging Guidelines

**Do say:**
- "Your site is invisible to AI. We fix that."
- "Turn AI blindspots into ready-to-ship PRDs"
- "GEO for Vibe Coders"
- "Works with Bolt.new, Lovable, Cursor, Replit, v0"

**Don't say:**
- Generic SEO language
- Marketing buzzwords
- Claims about being "#1" or "best"
- Anything that sounds like traditional SEO tools
