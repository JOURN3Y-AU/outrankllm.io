/**
 * Server-side SVG Radar Chart Renderer
 * Generates radar chart PNGs for PDF export using resvg-js
 */

import { Resvg } from '@resvg/resvg-js'

const COLORS = ['#4ABDAC', '#FC4A1A', '#F7B733', '#2D8A7C', '#94A3B8']

interface RadarEmployer {
  name: string
  isTarget: boolean
  scores: Record<string, number>
}

/**
 * Build a radar chart SVG with 7 axes
 */
function buildRadarSVG(
  employers: RadarEmployer[],
  dimensions: string[],
  size: number
): string {
  const cx = size / 2
  const cy = size / 2
  const maxR = size / 2 - 40 // Padding for labels
  const n = dimensions.length
  const angleStep = (2 * Math.PI) / n

  // Labels for dimensions
  const dimLabels: Record<string, string> = {
    compensation: 'Compensation',
    culture: 'Culture',
    growth: 'Growth',
    balance: 'Balance',
    leadership: 'Leadership',
    tech: 'Tech',
    mission: 'Mission',
  }

  // Calculate vertex positions
  function vertex(dimIdx: number, value: number): { x: number; y: number } {
    const angle = -Math.PI / 2 + dimIdx * angleStep
    const r = (value / 10) * maxR
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    }
  }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 50}" viewBox="0 0 ${size} ${size + 50}">`

  // Background
  svg += `<rect width="${size}" height="${size + 50}" fill="white" />`

  // Guide rings (at 2, 4, 6, 8, 10)
  for (const level of [2, 4, 6, 8, 10]) {
    const points = dimensions.map((_, i) => {
      const v = vertex(i, level)
      return `${v.x},${v.y}`
    }).join(' ')
    svg += `<polygon points="${points}" fill="none" stroke="#E2E8F0" stroke-width="0.5" />`
  }

  // Axis lines from center to each vertex
  for (let i = 0; i < n; i++) {
    const v = vertex(i, 10)
    svg += `<line x1="${cx}" y1="${cy}" x2="${v.x}" y2="${v.y}" stroke="#E2E8F0" stroke-width="0.5" />`
  }

  // Axis labels
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + i * angleStep
    const labelR = maxR + 18
    const lx = cx + labelR * Math.cos(angle)
    const ly = cy + labelR * Math.sin(angle)
    const label = dimLabels[dimensions[i]] || dimensions[i]
    const anchor = Math.abs(Math.cos(angle)) < 0.1 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end'
    svg += `<text x="${lx}" y="${ly + 3}" text-anchor="${anchor}" font-family="Source Sans 3, Helvetica, sans-serif" font-size="10" fill="#475569">${label}</text>`
  }

  // Employer polygons (target last so it's on top)
  const sortedEmployers = [...employers].sort((a, b) => (a.isTarget ? 1 : 0) - (b.isTarget ? 1 : 0))

  sortedEmployers.forEach((emp, empIdx) => {
    const color = emp.isTarget ? COLORS[0] : COLORS[(empIdx % (COLORS.length - 1)) + 1]
    const opacity = emp.isTarget ? 0.25 : 0.1
    const strokeOpacity = emp.isTarget ? 1 : 0.6
    const strokeWidth = emp.isTarget ? 2 : 1

    const points = dimensions.map((dim, i) => {
      const score = emp.scores[dim] || 0
      const v = vertex(i, score)
      return `${v.x},${v.y}`
    }).join(' ')

    svg += `<polygon points="${points}" fill="${color}" fill-opacity="${opacity}" stroke="${color}" stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}" />`

    // Score dots
    dimensions.forEach((dim, i) => {
      const score = emp.scores[dim] || 0
      const v = vertex(i, score)
      svg += `<circle cx="${v.x}" cy="${v.y}" r="${emp.isTarget ? 3 : 2}" fill="${color}" />`
    })
  })

  // Legend at bottom
  let legendX = 20
  const legendY = size + 20
  sortedEmployers.forEach((emp, empIdx) => {
    const color = emp.isTarget ? COLORS[0] : COLORS[(empIdx % (COLORS.length - 1)) + 1]
    const name = emp.isTarget ? `${emp.name} (You)` : emp.name
    svg += `<rect x="${legendX}" y="${legendY - 4}" width="8" height="8" rx="2" fill="${color}" fill-opacity="${emp.isTarget ? 0.8 : 0.5}" />`
    svg += `<text x="${legendX + 12}" y="${legendY + 3}" font-family="Source Sans 3, Helvetica, sans-serif" font-size="9" fill="#475569">${name}</text>`
    legendX += name.length * 5 + 24
  })

  svg += '</svg>'
  return svg
}

/**
 * Render radar chart to PNG base64
 */
export async function renderRadarChartPNG(
  employers: RadarEmployer[],
  dimensions: string[],
  size: number = 400
): Promise<string> {
  const svg = buildRadarSVG(employers, dimensions, size)

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width' as const, value: size * 2 },
  })

  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()

  return Buffer.from(pngBuffer).toString('base64')
}
