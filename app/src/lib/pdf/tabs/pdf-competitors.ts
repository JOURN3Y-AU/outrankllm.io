/**
 * Competitors Tab PDF Generator
 * Dimension table, radar chart, strengths/weaknesses
 */

import type { jsPDF } from 'jspdf'
import type { HBReportData, HBTrendsData, HBEmployerDimension } from '@/app/hiringbrand/report/components/shared/types'
import { renderRadarChartPNG } from '../render-radar-chart'
import {
  CONTENT, C, FONTS,
  drawSectionTitle, drawCard,
  setColor, setFill, setDraw, dimensionLabels,
} from '../pdf-layout'

type ReportData = HBReportData & { trends: HBTrendsData }

export async function drawCompetitorsTab(doc: jsPDF, data: ReportData) {
  const { report, company } = data
  const analysis = report.competitorAnalysis
  let y = CONTENT.top

  if (!analysis) {
    doc.setFont(FONTS.body, 'normal')
    doc.setFontSize(11)
    setColor(doc, C.slateMid)
    doc.text('No competitor analysis available for this scan.', CONTENT.x, y + 10)
    return
  }

  const target = analysis.employers.find(e => e.isTarget)
  const competitors = analysis.employers.filter(e => !e.isTarget).slice(0, 3)
  const allEmployers = target ? [target, ...competitors] : competitors

  // Companies analysed
  doc.setFont(FONTS.body, 'normal')
  doc.setFontSize(8)
  setColor(doc, C.slateMid)
  doc.text(`Comparing ${company.name} against ${competitors.map(c => c.name).join(', ')}`, CONTENT.x, y + 4)
  y += 10

  // Radar chart
  y = drawSectionTitle(doc, y, 'Dimension Comparison')

  const radarPng = await renderRadarChartPNG(
    allEmployers.map(e => ({
      name: e.name,
      isTarget: e.isTarget,
      scores: e.scores,
    })),
    analysis.dimensions,
    360
  )

  const chartW = 90
  const chartH = 100
  doc.addImage(
    `data:image/png;base64,${radarPng}`,
    'PNG',
    CONTENT.x + (CONTENT.w - chartW) / 2,
    y,
    chartW,
    chartH
  )
  y += chartH + 6

  // Dimension scores table
  y = drawSectionTitle(doc, y, 'Dimension Scores')

  const colW = (CONTENT.w - 40) / allEmployers.length
  const tableX = CONTENT.x

  // Header row
  drawCard(doc, tableX, y, CONTENT.w, 7, { fill: C.tealDeep })
  doc.setFont(FONTS.body, 'bold')
  doc.setFontSize(7)
  setColor(doc, C.surface)
  doc.text('Dimension', tableX + 3, y + 5)
  allEmployers.forEach((emp, i) => {
    const label = emp.isTarget ? `${emp.name} ★` : emp.name
    doc.text(label.slice(0, 14), tableX + 40 + i * colW, y + 5)
  })
  y += 8

  // Data rows
  for (const dim of analysis.dimensions) {
    const isOdd = analysis.dimensions.indexOf(dim) % 2 === 0
    if (isOdd) {
      setFill(doc, C.surfaceDim)
      doc.rect(tableX, y, CONTENT.w, 6, 'F')
    }

    doc.setFont(FONTS.body, 'normal')
    doc.setFontSize(7)
    setColor(doc, C.slate)
    doc.text(dimensionLabels[dim] || dim, tableX + 3, y + 4.5)

    allEmployers.forEach((emp, i) => {
      const score = emp.scores[dim as HBEmployerDimension] || 0
      const targetScore = target?.scores[dim as HBEmployerDimension] || 0
      const color = emp.isTarget
        ? C.slate
        : score > targetScore ? C.coral : score < targetScore ? C.green : C.slateMid
      setColor(doc, color)
      doc.setFont(FONTS.body, emp.isTarget ? 'bold' : 'normal')
      doc.text(`${score.toFixed(1)}`, tableX + 40 + i * colW, y + 4.5)
    })
    y += 6.5
  }
  y += 6

  // Strengths & Weaknesses
  if (y < 256 && analysis.insights) {
    const halfW = (CONTENT.w - 4) / 2

    // Strengths
    drawCard(doc, CONTENT.x, y, halfW, 22, { fill: '#ECFDF5' })
    doc.setFont(FONTS.body, 'bold')
    doc.setFontSize(8)
    setColor(doc, C.green)
    doc.text('Strengths', CONTENT.x + 4, y + 6)
    doc.setFont(FONTS.body, 'normal')
    doc.setFontSize(7)
    setColor(doc, C.slate)
    analysis.insights.strengths.forEach((s, i) => {
      doc.text(`• ${dimensionLabels[s] || s}`, CONTENT.x + 4, y + 12 + i * 4)
    })

    // Weaknesses
    drawCard(doc, CONTENT.x + halfW + 4, y, halfW, 22, { fill: C.coralLight })
    doc.setFont(FONTS.body, 'bold')
    doc.setFontSize(8)
    setColor(doc, C.coral)
    doc.text('Opportunities', CONTENT.x + halfW + 8, y + 6)
    doc.setFont(FONTS.body, 'normal')
    doc.setFontSize(7)
    setColor(doc, C.slate)
    analysis.insights.weaknesses.forEach((w, i) => {
      doc.text(`• ${dimensionLabels[w] || w}`, CONTENT.x + halfW + 8, y + 12 + i * 4)
    })
  }
}
