/**
 * Server-side SVG Line Chart Renderer
 * Generates trend line chart PNGs for PDF export using resvg-js
 */

import { Resvg } from '@resvg/resvg-js'

interface LineChartSeries {
  label: string
  color: string
  data: Array<{ x: number; y: number | null }>
}

interface LineChartOptions {
  width: number
  height: number
  yMin?: number
  yMax?: number
  xLabels: string[]
}

function buildLineChartSVG(series: LineChartSeries[], opts: LineChartOptions): string {
  const { width, height, yMin = 0, yMax = 100, xLabels } = opts
  const padL = 36
  const padR = 16
  const padT = 16
  const padB = 40
  const chartW = width - padL - padR
  const chartH = height - padT - padB

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + 30}" viewBox="0 0 ${width} ${height + 30}">`
  svg += `<rect width="${width}" height="${height + 30}" fill="white" />`

  // Y-axis grid lines and labels
  const ySteps = 5
  for (let i = 0; i <= ySteps; i++) {
    const yVal = yMin + (i / ySteps) * (yMax - yMin)
    const py = padT + chartH - (i / ySteps) * chartH
    svg += `<line x1="${padL}" y1="${py}" x2="${padL + chartW}" y2="${py}" stroke="#E2E8F0" stroke-width="0.5" />`
    svg += `<text x="${padL - 6}" y="${py + 3}" text-anchor="end" font-family="Source Sans 3, Helvetica, sans-serif" font-size="9" fill="#94A3B8">${Math.round(yVal)}</text>`
  }

  // X-axis labels
  const xCount = xLabels.length
  for (let i = 0; i < xCount; i++) {
    const px = padL + (i / Math.max(xCount - 1, 1)) * chartW
    svg += `<text x="${px}" y="${padT + chartH + 16}" text-anchor="middle" font-family="Source Sans 3, Helvetica, sans-serif" font-size="8" fill="#94A3B8">${xLabels[i]}</text>`
  }

  // Lines
  for (const s of series) {
    const points = s.data
      .map((d, i) => {
        if (d.y === null) return null
        const px = padL + (i / Math.max(s.data.length - 1, 1)) * chartW
        const py = padT + chartH - ((d.y - yMin) / (yMax - yMin)) * chartH
        return `${px},${py}`
      })
      .filter(Boolean)

    if (points.length >= 2) {
      svg += `<polyline points="${points.join(' ')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`
    }

    // Data points
    for (let i = 0; i < s.data.length; i++) {
      const d = s.data[i]
      if (d.y === null) continue
      const px = padL + (i / Math.max(s.data.length - 1, 1)) * chartW
      const py = padT + chartH - ((d.y - yMin) / (yMax - yMin)) * chartH
      svg += `<circle cx="${px}" cy="${py}" r="3" fill="${s.color}" />`
    }
  }

  // Legend
  let legendX = padL
  const legendY = height + 12
  for (const s of series) {
    svg += `<line x1="${legendX}" y1="${legendY}" x2="${legendX + 12}" y2="${legendY}" stroke="${s.color}" stroke-width="2" />`
    svg += `<circle cx="${legendX + 6}" cy="${legendY}" r="2.5" fill="${s.color}" />`
    svg += `<text x="${legendX + 16}" y="${legendY + 3}" font-family="Source Sans 3, Helvetica, sans-serif" font-size="9" fill="#475569">${s.label}</text>`
    legendX += s.label.length * 5 + 30
  }

  svg += '</svg>'
  return svg
}

/**
 * Render a line chart to PNG base64
 */
export async function renderLineChartPNG(
  series: LineChartSeries[],
  opts: LineChartOptions
): Promise<string> {
  const svg = buildLineChartSVG(series, opts)

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width' as const, value: opts.width * 2 },
  })

  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()

  return Buffer.from(pngBuffer).toString('base64')
}
