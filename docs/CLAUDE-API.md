# API & Database Reference

Reference documentation for API routes and database schemas. Read this file when working on APIs or database operations.

---

## API Routes

### Scan & Processing
| Route | Method | Description |
|-------|--------|-------------|
| `/api/scan` | POST | Initiate scan (sends to Inngest) |
| `/api/scan/status` | GET | Poll progress |
| `/api/verify` | GET | Email verification (magic link) |
| `/api/trends` | GET | Score history (subscribers only) |
| `/api/inngest` | GET | Inngest webhook handler |

### Authentication
| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/login` | POST | Email/password login |
| `/api/auth/logout` | POST | Clear session |
| `/api/auth/session` | GET | Get current session |
| `/api/auth/set-password` | POST | Set initial password |
| `/api/auth/forgot-password` | POST | Request reset email |
| `/api/auth/reset-password` | POST | Reset with token |

### Stripe
| Route | Method | Description |
|-------|--------|-------------|
| `/api/stripe/checkout` | POST | Create checkout session |
| `/api/stripe/webhook` | POST | Handle Stripe events |
| `/api/stripe/portal` | POST | Billing portal session |

### User
| Route | Method | Description |
|-------|--------|-------------|
| `/api/user/report` | GET | Get latest report token |
| `/api/user/schedule` | GET/PATCH | Scan schedule settings |

### Questions (Subscribers)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/questions` | GET/POST | List/create questions |
| `/api/questions/[id]` | PUT/DELETE | Update/archive question |

### Actions & PRD
| Route | Method | Description |
|-------|--------|-------------|
| `/api/actions` | GET | Get action plan |
| `/api/actions/[id]` | PATCH | Update action status |
| `/api/prd` | GET | Get PRD document |
| `/api/prd/[id]` | PATCH | Update task status |

### Other
| Route | Method | Description |
|-------|--------|-------------|
| `/api/feedback` | POST | Submit feedback |
| `/api/subscriptions` | GET/POST | Domain subscriptions |
| `/api/pricing/region-context` | GET | Australian signals |

---

## Database Schemas

### Core Tables

```sql
-- User accounts
leads
├── id, email, domain (legacy)
├── password_hash, verified
├── subscription_tier, stripe_customer_id
├── terms_accepted_at
└── created_at, updated_at

-- Multi-domain subscriptions
domain_subscriptions
├── id, lead_id, domain
├── tier, stripe_subscription_id
├── scan_schedule_day/hour/timezone
└── created_at

-- Scan execution
scan_runs
├── id, lead_id, domain_subscription_id
├── domain, status, progress
├── started_at, completed_at
└── error_message

-- Generated reports
reports
├── id, scan_run_id, lead_id
├── token (URL access)
├── visibility_score
└── created_at, expires_at
```

### Scan Data Tables

```sql
-- Website crawl data
site_analyses
├── scan_run_id, url, title
├── meta_description, headings[]
├── schema_types[], internal_links
└── word_count, load_time_ms

-- Crawled page details
crawled_pages
├── scan_run_id, path, url
├── title, h1, meta_description
├── headings[], word_count
├── schema_types[], schema_data
└── created_at

-- AI questions used
scan_prompts
├── scan_run_id, prompt_text
├── category, platform
└── created_at

-- AI responses
llm_responses
├── scan_run_id, platform
├── prompt_text, response_text
├── mentions_business, confidence_score
└── created_at
```

### Subscriber Tables

```sql
-- Editable questions
subscriber_questions
├── id, lead_id, domain_subscription_id
├── prompt_text, category
├── source ('ai_generated' | 'user_created')
├── is_active, is_archived, sort_order
└── created_at

-- Custom competitors
subscriber_competitors
├── id, lead_id, domain_subscription_id
├── competitor_domain, competitor_name
└── created_at

-- Score history for trends
score_history
├── scan_run_id, lead_id
├── visibility_score
├── chatgpt_mentions, claude_mentions
├── gemini_mentions, perplexity_mentions
└── recorded_at
```

### Action Plans

```sql
action_plans
├── id, lead_id, domain_subscription_id
├── scan_run_id
├── executive_summary
├── page_edits (JSONB)
├── keyword_map (JSONB)
├── key_takeaways (JSONB)
├── quick_win_count, strategic_count, backlog_count
└── created_at

action_items
├── id, action_plan_id
├── title, description
├── source_insight
├── priority ('quick_win' | 'strategic' | 'backlog')
├── category
├── consensus[] (platforms)
├── implementation_steps[]
├── expected_outcome
├── status ('pending' | 'completed' | 'dismissed')
└── sort_order

action_items_history
├── id, original_action_id
├── lead_id, domain_subscription_id
├── title, description, category
└── completed_at
```

### PRD Documents

```sql
prd_documents
├── id, lead_id, domain_subscription_id
├── action_plan_id
├── title, overview
├── goals[] (JSONB)
├── tech_stack[]
├── target_platforms[]
└── generated_at

prd_tasks
├── id, prd_document_id
├── title, description
├── acceptance_criteria[]
├── section ('quick_wins' | 'strategic' | 'backlog')
├── category ('technical' | 'content' | 'schema' | 'seo')
├── estimated_hours
├── file_paths[]
├── code_snippets (JSONB)
├── prompt_context
├── implementation_notes
├── requires_content (boolean)
├── content_prompts (JSONB)
├── status, sort_order
└── created_at

prd_tasks_history
├── id, original_task_id
├── lead_id, domain_subscription_id
├── title, description
└── completed_at
```

### Other Tables

```sql
-- Brand awareness results
brand_awareness_results
├── scan_run_id, lead_id, domain_subscription_id
├── platform, query_type
├── response_text, recognition_level
└── created_at

-- Competitive intelligence
competitive_analyses
├── scan_run_id, lead_id
├── competitor_domain
├── platform, analysis_text
├── positioning ('STRONGER' | 'WEAKER' | 'EQUAL')
└── created_at

-- User feedback
feedback
├── id, type ('bug' | 'feature' | 'feedback' | 'other')
├── message, page_url, user_agent
├── user_email, user_tier
├── status ('new' | 'reviewed' | 'resolved' | 'wont_fix')
└── created_at
```

---

## Environment Variables

```bash
# Auth
JWT_SECRET=<openssl rand -base64 32>

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs - Australian (AUD)
STRIPE_PRICE_STARTER_AU=price_...
STRIPE_PRICE_PRO_AU=price_...
STRIPE_PRICE_AGENCY_AU=price_...

# Stripe Price IDs - International (USD)
STRIPE_PRICE_STARTER_USD=price_...
STRIPE_PRICE_PRO_USD=price_...
STRIPE_PRICE_AGENCY_USD=price_...

# Inngest
INNGEST_SIGNING_KEY=signkey-...
INNGEST_EVENT_KEY=...
```
