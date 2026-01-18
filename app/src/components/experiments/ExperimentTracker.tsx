'use client'

import { useEffect } from 'react'
import { experiments } from '@/lib/experiments/config'
import { getExperimentVariant, trackExperimentImpression } from '@/lib/analytics'

interface ExperimentTrackerProps {
  experimentName: keyof typeof experiments
}

/**
 * Tracks experiment impression to GA4 on mount
 * Place this component on pages participating in an experiment
 */
export function ExperimentTracker({ experimentName }: ExperimentTrackerProps) {
  useEffect(() => {
    const experiment = experiments[experimentName]
    if (!experiment) return

    const variant = getExperimentVariant(experiment.cookieName)
    if (variant) {
      trackExperimentImpression(experiment.id, variant)
    }
  }, [experimentName])

  return null
}
