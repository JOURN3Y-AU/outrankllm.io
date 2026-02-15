/**
 * Server-side SVG Score Ring Renderer
 * Generates score ring PNGs for PPTX export using resvg-js
 */

import { Resvg } from '@resvg/resvg-js'
import { RESVG_FONT_OPTS } from '@/lib/pdf/resvg-fonts'

const hbColors = {
  teal: '#4ABDAC',
  tealDeep: '#2D8A7C',
  gold: '#F7B733',
  coral: '#FC4A1A',
  slate: '#1E293B',
  surfaceDim: '#F1F5F9',
}

function getScoreColor(score: number): string {
  if (score >= 80) return hbColors.teal
  if (score >= 60) return hbColors.tealDeep
  if (score >= 40) return hbColors.gold
  return hbColors.coral
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  return 'Needs Improvement'
}

/**
 * Generate a score ring SVG string
 */
function buildScoreRingSVG(score: number, label: string, size: number): string {
  const stroke = Math.round(size * 0.067) // ~12px at 180
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference
  const cx = size / 2
  const cy = size / 2
  const color = getScoreColor(score)
  const scoreLabel = getScoreLabel(score)
  const fontSize = Math.round(size * 0.267) // ~48px at 180
  const labelFontSize = Math.round(size * 0.072) // ~13px at 180
  const bottomLabelSize = Math.round(size * 0.078) // ~14px at 180

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 40}" viewBox="0 0 ${size} ${size + 40}">
  <!-- Background ring -->
  <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${hbColors.surfaceDim}" stroke-width="${stroke}" transform="rotate(-90 ${cx} ${cy})" />
  <!-- Progress ring -->
  <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${strokeDashoffset}" transform="rotate(-90 ${cx} ${cy})" />
  <!-- Score number -->
  <text x="${cx}" y="${cy - 4}" text-anchor="middle" dominant-baseline="central" font-family="Outfit, Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="${hbColors.slate}">${score}</text>
  <!-- Score label (e.g. "Good") -->
  <text x="${cx}" y="${cy + fontSize * 0.45}" text-anchor="middle" dominant-baseline="central" font-family="Source Sans 3, Helvetica, Arial, sans-serif" font-size="${labelFontSize}" font-weight="500" fill="${color}">${scoreLabel}</text>
  <!-- Bottom label (e.g. "Desirability") -->
  <text x="${cx}" y="${size + 24}" text-anchor="middle" dominant-baseline="central" font-family="Source Sans 3, Helvetica, Arial, sans-serif" font-size="${bottomLabelSize}" font-weight="500" fill="#475569">${label}</text>
</svg>`
}

/**
 * Render a score ring to PNG base64 string
 */
export async function renderScoreRingPNG(
  score: number,
  label: string,
  size: number = 240
): Promise<string> {
  const svg = buildScoreRingSVG(score, label, size)

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width' as const, value: size * 2 }, // 2x for retina
    ...RESVG_FONT_OPTS,
  })

  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()

  return Buffer.from(pngBuffer).toString('base64')
}
