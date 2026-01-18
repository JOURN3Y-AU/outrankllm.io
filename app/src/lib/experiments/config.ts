/**
 * A/B Testing Configuration
 *
 * To change variants or weights, edit this file and deploy.
 * To end an experiment, set a single variant with weight 100.
 *
 * Example - adding a third variant:
 *   variants: [
 *     { id: 'control', weight: 34 },
 *     { id: 'variant-b', weight: 33 },
 *     { id: 'variant-c', weight: 33 },
 *   ]
 *
 * Example - ending experiment (picking winner):
 *   variants: [
 *     { id: 'variant-b', weight: 100 },
 *   ]
 */

export interface ExperimentVariant {
  id: string
  weight: number // Percentage (all weights should sum to 100)
}

export interface Experiment {
  id: string // Used in GA4 as experiment_id
  cookieName: string // Cookie to store assignment
  variants: ExperimentVariant[]
}

export const experiments: Record<string, Experiment> = {
  homepage: {
    id: 'homepage_jan2025',
    cookieName: 'exp-homepage',
    variants: [
      { id: 'control', weight: 50 },
      { id: 'variant-b', weight: 50 },
    ],
  },
}

/**
 * Select a variant based on weighted random selection
 */
export function selectVariant(experiment: Experiment): string {
  const random = Math.random() * 100
  let cumulative = 0

  for (const variant of experiment.variants) {
    cumulative += variant.weight
    if (random < cumulative) {
      return variant.id
    }
  }

  // Fallback to last variant (shouldn't happen if weights sum to 100)
  return experiment.variants[experiment.variants.length - 1].id
}
