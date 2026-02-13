/**
 * HiringBrand Report Types
 * Completely separate from outrankllm types
 */

// 4-tier sentiment system: strong (9-10), positive (6-8), mixed (4-5), negative (1-3)
export type HBSentimentCategory = 'strong' | 'positive' | 'mixed' | 'negative'

export interface HBSentimentCounts {
  strong: number
  positive: number
  mixed: number
  negative: number
}

// Employer topics for researchability tracking
export type HBEmployerTopic =
  | 'compensation'
  | 'benefits'
  | 'work_life_balance'
  | 'remote_policy'
  | 'growth'
  | 'culture'
  | 'leadership'
  | 'diversity'
  | 'perks'
  | 'interview_process'

// Topic with confidence level for detailed display
export interface HBTopicWithConfidence {
  topic: HBEmployerTopic
  confidence: 'high' | 'medium' | 'low' | 'none' // How well AI knows this topic
  mentions: number // How many times mentioned
}

export interface HBReportData {
  report: {
    id: string
    urlToken: string
    visibilityScore: number // Desirability score (sentiment-based)
    researchabilityScore: number | null // AI Awareness - how much AI knows
    differentiationScore: number | null // How unique the employer brand appears
    platformScores: Record<string, number>
    topCompetitors: Array<{ name: string; count: number }>
    topicsCovered: HBEmployerTopic[] // Topics AI knows about
    topicsMissing: HBEmployerTopic[] // Topics AI doesn't know about
    topicsWithConfidence: HBTopicWithConfidence[] // Detailed topic knowledge
    summary: string | null
    createdAt: string
    expiresAt: string | null
    competitorAnalysis: HBCompetitorAnalysis | null // AI-generated dimension comparison
    strategicSummary: HBStrategicSummary | null // AI-generated executive summary
    mentionStats: HBMentionStats | null // Web mention aggregate stats
    monitoredDomainId: string | null
  }
  sentimentCounts: HBSentimentCounts
  company: {
    name: string
    domain: string
    industry: string | null
    location: string | null
    commonRoles: string[]
    cultureKeywords: string[]
  }
  organization: {
    id: string
    name: string
    tier: string
    status: string
  } | null
  responses: HBResponse[]
  prompts: HBPrompt[]
  mentions: HBWebMention[]
}

// Enhanced analysis types
export type HBHedgingLevel = 'low' | 'medium' | 'high'
export type HBSourceQuality = 'none' | 'weak' | 'moderate' | 'strong'
export type HBResponseRecency = 'current' | 'recent' | 'dated' | 'unknown'

export interface HBResponse {
  id: string
  platform: HBPlatform
  promptText: string
  promptCategory: string
  responseText: string
  domainMentioned: boolean
  mentionPosition: number | null
  competitorsMentioned: Array<{ name: string; context?: string }>
  sources: Array<{ url: string; title?: string }> | null
  responseTimeMs: number | null
  // Sentiment (desirability)
  sentimentScore: number | null
  sentimentCategory: HBSentimentCategory | null
  sentimentPositivePhrases: string[] // Exact quotes that drove score up
  sentimentNegativePhrases: string[] // Exact quotes that drove score down
  // Researchability
  specificityScore: number | null
  confidenceScore: number | null
  topicsCovered: HBEmployerTopic[]
  // Enhanced analysis - key phrases
  positiveHighlights: string[]
  negativeHighlights: string[]
  redFlags: string[]
  greenFlags: string[]
  // Enhanced analysis - recommendation
  recommendationScore: number | null
  recommendationSummary: string | null
  // Enhanced analysis - confidence indicators
  hedgingLevel: HBHedgingLevel | null
  sourceQuality: HBSourceQuality | null
  responseRecency: HBResponseRecency | null
}

export interface HBPrompt {
  id: string
  promptText: string
  category: HBQuestionCategory
}

export type HBPlatform = 'chatgpt' | 'claude' | 'gemini' | 'perplexity'

export type HBQuestionCategory =
  | 'reputation'
  | 'culture'
  | 'compensation'
  | 'growth'
  | 'comparison'
  | 'industry'
  | 'balance'
  | 'leadership'

export type HBTabId = 'start' | 'overview' | 'responses' | 'clippings' | 'competitors' | 'trends' | 'actions' | 'setup'

export interface HBTab {
  id: HBTabId
  label: string
  icon: string
  premium?: boolean
}

// Competitor Analysis - apples-to-apples comparison on key dimensions
export type HBEmployerDimension = 'compensation' | 'culture' | 'growth' | 'balance' | 'leadership' | 'tech' | 'mission'

export interface HBCompetitorAnalysis {
  dimensions: HBEmployerDimension[]
  employers: Array<{
    name: string
    isTarget: boolean
    scores: Record<HBEmployerDimension, number>
    highlights: string[]
    differentiationScore: number // 0-100: how unique this employer's profile is
    strengthCount: number // How many dimensions are above group average
    weaknessCount: number // How many dimensions are below group average
  }>
  insights: {
    strengths: HBEmployerDimension[]
    weaknesses: HBEmployerDimension[]
    recommendations: string[]
  }
  generatedAt: string
}

// Strategic Summary - AI-generated executive summary for recruitment agents
export type HBEffortLevel = 'quick_win' | 'moderate' | 'significant'
export type HBImpactLevel = 'high' | 'medium' | 'low'
export type HBPriority = 'immediate' | 'short_term' | 'long_term'

export interface HBStrategicRecommendation {
  title: string
  description: string
  effort: HBEffortLevel
  impact: HBImpactLevel
  priority: HBPriority
  relatedDimension?: HBEmployerDimension
}

export interface HBStrengthInsight {
  dimension: HBEmployerDimension
  score: number
  competitorAvg: number
  headline: string // e.g., "Industry-leading work-life balance"
  leverageStrategy: string // How to amplify this in employer branding
}

export interface HBGapInsight {
  dimension: HBEmployerDimension
  score: number
  competitorAvg: number
  headline: string // e.g., "Compensation lags market"
  businessImpact: string // Why this matters for talent attraction
  topCompetitor: string // Who to learn from
}

export interface HBStrategicSummary {
  // Executive overview
  executiveSummary: string // 2-3 sentence overview for stakeholders
  competitivePositioning: string // One-liner positioning statement

  // Score interpretation
  scoreInterpretation: {
    desirability: string // What the score means
    awareness: string
    differentiation: string
    overallHealth: 'strong' | 'moderate' | 'needs_attention' | 'critical'
  }

  // Detailed insights
  strengths: HBStrengthInsight[] // 2-3 key strengths with leverage strategies
  gaps: HBGapInsight[] // 2-3 key gaps with business impact

  // Actionable recommendations
  recommendations: HBStrategicRecommendation[] // 5-7 prioritized actions

  // Context
  industryContext: string // How this compares to industry norms
  topTalentCompetitor: string // Primary competitor for talent

  generatedAt: string
}

// Web Mentions
export type HBMentionSourceType = 'press' | 'review_site' | 'blog' | 'news' | 'social' | 'jobs_board' | 'careers_page' | 'other'
export type HBMentionSentiment = 'positive' | 'negative' | 'neutral' | 'mixed'

export interface HBWebMention {
  id: string
  url: string
  title: string | null
  snippet: string | null
  publishedDate: string | null
  sourceType: HBMentionSourceType
  sentiment: HBMentionSentiment
  sentimentScore: number | null
  relevanceScore: number | null
  domainName: string | null
}

export interface HBMentionInsight {
  type: 'positive' | 'negative' | 'opportunity'
  text: string
}

export interface HBMentionStats {
  total: number
  bySentiment: Record<HBMentionSentiment, number>
  bySourceType: Record<HBMentionSourceType, number>
  topDomains: Array<{ domain: string; count: number; avgSentiment: number }>
  avgSentimentScore: number
  avgRelevanceScore: number
  insights?: HBMentionInsight[]
}

// Score History - for trends tracking
export interface HBScoreHistoryEntry {
  id: string
  scanDate: string
  desirabilityScore: number | null
  awarenessScore: number | null
  differentiationScore: number | null
  platformScores: Record<HBPlatform, number>
  competitorRank: number | null
  competitorCount: number | null
  dimensionScores: Record<HBEmployerDimension, number>
}

// Competitor History - for tracking competitors over time
export interface HBCompetitorHistoryEntry {
  id: string
  scanDate: string
  competitorName: string
  isTarget: boolean
  compositeScore: number | null
  differentiationScore: number | null
  dimensionScores: Record<HBEmployerDimension, number>
  rankByComposite: number | null
  rankByDifferentiation: number | null
}

// Grouped competitor history by scan date for line chart
export interface HBCompetitorHistorySnapshot {
  scanDate: string
  employers: Array<{
    name: string
    isTarget: boolean
    compositeScore: number
    rankByComposite: number
  }>
}

// Trends data passed to the report
export interface HBTrendsData {
  scoreHistory: HBScoreHistoryEntry[]
  competitorHistory: HBCompetitorHistorySnapshot[]
  hasTrends: boolean // True if we have more than 1 data point
}
