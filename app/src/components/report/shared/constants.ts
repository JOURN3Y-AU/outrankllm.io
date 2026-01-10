import {
  Compass,
  Settings,
  Shield,
  MessageSquare,
  BarChart3,
  Users,
  Brain,
  Lightbulb,
  FileCode,
} from 'lucide-react'
import type { Tab } from './types'

export const tabs: Tab[] = [
  { id: 'startHere', label: 'Start Here', icon: Compass },
  { id: 'setup', label: 'Setup', icon: Settings },
  { id: 'readiness', label: 'AI Readiness', icon: Shield },
  { id: 'responses', label: 'AI Responses', icon: MessageSquare },
  { id: 'measurements', label: 'Measurements', icon: BarChart3 },
  { id: 'competitors', label: 'Competitors', icon: Users },
  { id: 'brandAwareness', label: 'Brand Awareness', icon: Brain },
  { id: 'actions', label: 'Action Plans', icon: Lightbulb, locked: true, premium: true, lockMessage: 'Subscribers get personalized action plans' },
  { id: 'prd', label: 'PRD & Specs', icon: FileCode, locked: true, premium: true, lockMessage: 'Subscribers get ready-to-ship PRDs' },
]

export const platformColors: Record<string, string> = {
  chatgpt: 'var(--red)',
  claude: 'var(--green)',
  gemini: 'var(--blue)',
  perplexity: '#1FB8CD',
}

export const platformNames: Record<string, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
}

export const categoryLabels: Record<string, string> = {
  // New research-based categories
  finding_provider: 'Finding a Provider',
  product_specific: 'Product Search',
  service: 'Service Search',
  comparison: 'Comparison',
  review: 'Reviews & Ratings',
  how_to: 'How-To',
  other: 'Other',
  // Legacy categories (for backward compatibility)
  general: 'General',
  location: 'Location-Based',
  recommendation: 'Recommendation',
  custom: 'Custom',
}

export const categoryColors: Record<string, string> = {
  // New research-based categories
  finding_provider: 'var(--green)',
  product_specific: 'var(--amber)',
  service: 'var(--blue)',
  comparison: 'var(--red)',
  review: 'var(--text-mid)',
  how_to: 'var(--text-dim)',
  other: 'var(--text-mid)',
  // Legacy categories
  general: 'var(--blue)',
  location: 'var(--green)',
  recommendation: 'var(--text-mid)',
  custom: 'var(--text-mid)',
}

// Categories available for user selection when adding/editing questions
export const selectableCategories = [
  { value: 'finding_provider', label: 'Finding a Provider' },
  { value: 'product_specific', label: 'Product Search' },
  { value: 'service', label: 'Service Search' },
  { value: 'comparison', label: 'Comparison' },
  { value: 'review', label: 'Reviews & Ratings' },
  { value: 'how_to', label: 'How-To' },
  { value: 'other', label: 'Other' },
]
