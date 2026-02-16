/**
 * HiringBrand Design Tokens & Constants
 * Extracted from docs/hiringbrand-design-system.css
 */

import type { HBTab, HBPlatform, HBQuestionCategory, HBJobFamily } from './types'

// Design Tokens
export const hbColors = {
  // Primary - Fresh Teal
  teal: '#4ABDAC',
  tealDeep: '#2D8A7C',
  tealLight: '#E8F7F5',
  tealGlow: 'rgba(74, 189, 172, 0.15)',

  // Accent - Coral (CTAs)
  coral: '#FC4A1A',
  coralLight: '#FFF0EC',

  // Highlight - Gold (Premium)
  gold: '#F7B733',
  goldLight: '#FEF9EC',

  // Neutrals
  slate: '#1E293B',
  slateMid: '#475569',
  slateLight: '#94A3B8',

  // Surfaces
  surface: '#FFFFFF',
  surfaceRaised: '#FAFBFC',
  surfaceDim: '#F1F5F9',

  // Semantic
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
}

export const hbFonts = {
  display: "'Outfit', system-ui, sans-serif",
  body: "'Source Sans 3', system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
}

export const hbShadows = {
  sm: '0 1px 3px rgba(0, 0, 0, 0.04)',
  md: '0 4px 12px rgba(0, 0, 0, 0.05)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.04)',
  teal: '0 4px 12px rgba(74, 189, 172, 0.15)',
  tealLg: '0 4px 20px rgba(74, 189, 172, 0.25)',
  coral: '0 4px 14px rgba(252, 74, 26, 0.25)',
  coralLg: '0 8px 20px rgba(252, 74, 26, 0.35)',
}

export const hbRadii = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '20px',
  '3xl': '24px',
  full: '100px',
}

// Platform configuration with icon sizing
// ChatGPT needs larger dimensions due to its logo design
export const hbPlatformConfig: Record<
  HBPlatform,
  {
    name: string
    color: string
    weight: number
    icon: string
    iconPath: string
    iconSize: { width: number; height: number }
  }
> = {
  chatgpt: {
    name: 'ChatGPT',
    color: '#10A37F',
    weight: 10, // 80% market share
    icon: '🤖',
    iconPath: '/images/ChatGPT-Logo.png',
    iconSize: { width: 32, height: 32 }, // Larger for ChatGPT logo
  },
  claude: {
    name: 'Claude',
    color: '#D97706',
    weight: 1, // 1% market share
    icon: '🧠',
    iconPath: '/images/Claude_AI_symbol.svg.png',
    iconSize: { width: 20, height: 20 },
  },
  gemini: {
    name: 'Gemini',
    color: '#4285F4',
    weight: 2, // 5% market share
    icon: '✨',
    iconPath: '/images/Google_Gemini_icon_2025.svg.png',
    iconSize: { width: 20, height: 20 },
  },
  perplexity: {
    name: 'Perplexity',
    color: '#6366F1',
    weight: 4, // 12% market share
    icon: '🔍',
    iconPath: '/images/perplexity-color.png',
    iconSize: { width: 20, height: 20 },
  },
}

// Question categories
export const hbCategoryConfig: Record<HBQuestionCategory, { label: string; color: string }> = {
  reputation: { label: 'Reputation', color: hbColors.teal },
  culture: { label: 'Culture & Values', color: '#8B5CF6' },
  compensation: { label: 'Compensation', color: hbColors.gold },
  growth: { label: 'Career Growth', color: '#10B981' },
  comparison: { label: 'Comparison', color: '#EC4899' },
  industry: { label: 'Industry', color: '#6366F1' },
  balance: { label: 'Work-Life Balance', color: '#14B8A6' },
  leadership: { label: 'Leadership', color: '#F97316' },
  role_insights: { label: 'Role-Specific Insights', color: '#9333EA' }, // Purple for role-specific questions
}

// Job family configuration for role-specific analysis
export const hbRoleFamilyConfig: Record<
  HBJobFamily,
  {
    label: string
    description: string
    color: string
    lightColor: string
    keywords: string[]
  }
> = {
  engineering: {
    label: 'Engineering & Tech',
    description: 'Software engineers, data scientists, DevOps, IT',
    color: hbColors.teal, // Teal (primary)
    lightColor: hbColors.tealLight,
    keywords: ['engineer', 'developer', 'data scientist', 'devops', 'sre', 'architect', 'programmer', 'software', 'tech'],
  },
  business: {
    label: 'Sales & Business',
    description: 'Sales, marketing, product management, customer success',
    color: hbColors.coral, // Coral (accent)
    lightColor: hbColors.coralLight,
    keywords: ['sales', 'marketing', 'product', 'account', 'customer success', 'business development', 'growth'],
  },
  operations: {
    label: 'Operations & Supply Chain',
    description: 'Operations, logistics, supply chain, procurement',
    color: hbColors.gold, // Gold (highlight)
    lightColor: hbColors.goldLight,
    keywords: ['operations', 'logistics', 'supply', 'procurement', 'warehouse', 'fulfillment', 'inventory'],
  },
  creative: {
    label: 'Creative & Design',
    description: 'Designers, content creators, UX/UI, brand',
    color: '#9333EA', // Purple
    lightColor: '#F3E8FF',
    keywords: ['design', 'creative', 'ux', 'ui', 'content', 'brand', 'graphic', 'visual', 'writer'],
  },
  corporate: {
    label: 'Corporate Functions',
    description: 'Finance, HR, legal, administration',
    color: '#3B82F6', // Blue
    lightColor: '#EFF6FF',
    keywords: ['finance', 'hr', 'legal', 'admin', 'accounting', 'compliance', 'people', 'talent'],
  },
  general: {
    label: 'General',
    description: 'Roles that apply across all functions',
    color: hbColors.slateLight, // Slate Light
    lightColor: hbColors.surfaceDim,
    keywords: [],
  },
}

// Tab configuration
export const hbTabs: HBTab[] = [
  { id: 'start', label: 'Start Here', icon: 'compass' },
  { id: 'overview', label: 'Summary', icon: 'chart' },
  { id: 'responses', label: 'AI Responses', icon: 'message' },
  { id: 'clippings', label: 'Clippings', icon: 'globe' },
  { id: 'roles', label: 'Role Insights', icon: 'briefcase' },
  { id: 'competitors', label: 'Competitors', icon: 'users' },
  { id: 'trends', label: 'Trends', icon: 'trending' },
  { id: 'actions', label: 'Action Plan', icon: 'lightbulb' },
  { id: 'setup', label: 'Setup', icon: 'settings' },
]

// Score thresholds
export const hbScoreThresholds = {
  excellent: 80,
  good: 60,
  fair: 40,
  poor: 0,
}

export function getScoreColor(score: number): string {
  if (score >= hbScoreThresholds.excellent) return hbColors.teal
  if (score >= hbScoreThresholds.good) return hbColors.tealDeep
  if (score >= hbScoreThresholds.fair) return hbColors.gold
  return hbColors.coral
}

export function getScoreLabel(score: number): string {
  if (score >= hbScoreThresholds.excellent) return 'Excellent'
  if (score >= hbScoreThresholds.good) return 'Good'
  if (score >= hbScoreThresholds.fair) return 'Fair'
  return 'Needs Improvement'
}
