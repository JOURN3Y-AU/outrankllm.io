/**
 * Trends Tab PDF Generator
 * Score history line chart, competitive ranking
 */

import type { jsPDF } from 'jspdf'
import type { HBReportData, HBTrendsData } from '@/app/hiringbrand/report/components/shared/types'
import { renderLineChartPNG } from '../render-line-chart'
import {
  CONTENT, C, FONTS,
  drawSectionTitle, drawCard, getScoreColor,
  setColor, setFill, formatDate,
} from '../pdf-layout'

type ReportData = HBReportData & { trends: HBTrendsData }

export async function drawTrendsTab(doc: jsPDF, data: ReportData) {
  const { report, trends, company } = data
  let y = CONTENT.top

  // Current scores row
  const scores = [
    { label: 'Desirability', value: report.visibilityScore },
    { label: 'AI Awareness', value: report.researchabilityScore },
    { label: 'Differentiation', value: report.differentiationScore },
  ]

  const cardW = (CONTENT.w - 8) / 3
  for (let i = 0; i < 3; i++) {
    const s = scores[i]
    const cx = CONTENT.x + i * (cardW + 4)
    const color = getScoreColor(s.value || 0)

    drawCard(doc, cx, y, cardW, 18, { border: C.surfaceDim })
    doc.setFont(FONTS.display, 'bold')
    doc.setFontSize(18)
    setColor(doc, color)
    doc.text(`${s.value ?? '—'}`, cx + 4, y + 12)

    doc.setFont(FONTS.body, 'normal')
    doc.setFontSize(7)
    setColor(doc, C.slateMid)
    doc.text(s.label, cx + 30, y + 12)
  }
  y += 24

  if (!trends.hasTrends) {
    // Not enough data
    drawCard(doc, CONTENT.x, y, CONTENT.w, 30, { fill: C.surfaceDim })
    doc.setFont(FONTS.display, 'bold')
    doc.setFontSize(12)
    setColor(doc, C.slateMid)
    doc.text('Trends will appear after your next scan', CONTENT.x + (CONTENT.w / 2), y + 12, { align: 'center' })
    doc.setFont(FONTS.body, 'normal')
    doc.setFontSize(9)
    doc.text('Weekly scans build your employer brand timeline.', CONTENT.x + (CONTENT.w / 2), y + 20, { align: 'center' })
    return
  }

  // Score History Line Chart
  y = drawSectionTitle(doc, y, 'Score History')

  const history = trends.scoreHistory
  const xLabels = history.map(h => {
    const d = new Date(h.scanDate)
    return `${d.getDate()}/${d.getMonth() + 1}`
  })

  const chartPng = await renderLineChartPNG(
    [
      {
        label: 'Desirability',
        color: '#4ABDAC',
        data: history.map((h, i) => ({ x: i, y: h.desirabilityScore })),
      },
      {
        label: 'Awareness',
        color: '#F7B733',
        data: history.map((h, i) => ({ x: i, y: h.awarenessScore })),
      },
      {
        label: 'Differentiation',
        color: '#FC4A1A',
        data: history.map((h, i) => ({ x: i, y: h.differentiationScore })),
      },
    ],
    {
      width: 500,
      height: 240,
      yMin: 0,
      yMax: 100,
      xLabels,
    }
  )

  const chartW = CONTENT.w
  const chartH = 80
  doc.addImage(
    `data:image/png;base64,${chartPng}`,
    'PNG',
    CONTENT.x,
    y,
    chartW,
    chartH
  )
  y += chartH + 8

  // Competitive Ranking
  if (trends.competitorHistory.length > 0) {
    y = drawSectionTitle(doc, y, 'Competitive Position')

    const latest = trends.competitorHistory[trends.competitorHistory.length - 1]
    const targetEntry = latest?.employers.find(e => e.isTarget)

    if (targetEntry) {
      drawCard(doc, CONTENT.x, y, CONTENT.w, 18, { fill: C.tealLight })
      doc.setFont(FONTS.display, 'bold')
      doc.setFontSize(16)
      setColor(doc, C.tealDeep)
      doc.text(`#${targetEntry.rankByComposite}`, CONTENT.x + 6, y + 12)

      doc.setFont(FONTS.body, 'normal')
      doc.setFontSize(9)
      setColor(doc, C.slateMid)
      doc.text(`of ${latest.employers.length} employers tracked`, CONTENT.x + 22, y + 9)

      doc.setFont(FONTS.body, 'normal')
      doc.setFontSize(8)
      doc.text(
        `Composite score: ${targetEntry.compositeScore.toFixed(1)}`,
        CONTENT.x + 22,
        y + 14
      )
      y += 24

      // Ranking table
      const ranked = [...latest.employers].sort((a, b) => a.rankByComposite - b.rankByComposite)
      for (const emp of ranked.slice(0, 5)) {
        if (y > 270) break
        const isTarget = emp.isTarget
        if (isTarget) {
          setFill(doc, C.tealLight)
          doc.rect(CONTENT.x, y, CONTENT.w, 6, 'F')
        }

        doc.setFont(FONTS.body, isTarget ? 'bold' : 'normal')
        doc.setFontSize(8)
        setColor(doc, isTarget ? C.tealDeep : C.slate)
        doc.text(`#${emp.rankByComposite}`, CONTENT.x + 3, y + 4.5)
        doc.text(emp.name, CONTENT.x + 14, y + 4.5)

        doc.setFont(FONTS.body, 'normal')
        setColor(doc, C.slateMid)
        doc.text(`${emp.compositeScore.toFixed(1)}`, CONTENT.x + CONTENT.w - 10, y + 4.5)
        y += 7
      }
    }
  }
}
