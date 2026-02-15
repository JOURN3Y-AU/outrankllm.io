/**
 * Action Plan Tab PDF Generator
 * Executive summary, strengths/gaps, 90-day recommendation table
 */

import type { jsPDF } from 'jspdf'
import type { HBReportData, HBTrendsData } from '@/app/hiringbrand/report/components/shared/types'
import {
  CONTENT, C, FONTS,
  drawSectionTitle, drawCard, drawWrappedText,
  getHealthLabel, priorityLabel, effortLabel, priorityColor, dimensionLabels,
  truncate, setColor, setFill, drawBadge,
} from '../pdf-layout'

type ReportData = HBReportData & { trends: HBTrendsData }

export async function drawActionsTab(doc: jsPDF, data: ReportData) {
  const { report } = data
  const summary = report.strategicSummary
  let y = CONTENT.top

  if (!summary) {
    doc.setFont(FONTS.body, 'normal')
    doc.setFontSize(11)
    setColor(doc, C.slateMid)
    doc.text('No strategic summary available for this scan.', CONTENT.x, y + 10)
    return
  }

  // Health badge + executive summary
  const health = getHealthLabel(summary.scoreInterpretation.overallHealth)
  drawBadge(doc, CONTENT.x, y + 3, health.text, health.bgColor, health.color)

  doc.setFont(FONTS.body, 'normal')
  doc.setFontSize(8.5)
  setColor(doc, C.slate)
  y = drawWrappedText(doc, CONTENT.x, y + 14, summary.executiveSummary, CONTENT.w, 4.5)
  y += 4

  // Strengths & Gaps side by side
  const halfW = (CONTENT.w - 4) / 2

  // Strengths
  y = drawSectionTitle(doc, y, 'What to Amplify')
  const strengthsStartY = y

  for (const s of summary.strengths.slice(0, 3)) {
    if (y > 160) break
    drawCard(doc, CONTENT.x, y, halfW, 18, { fill: '#ECFDF5' })
    doc.setFont(FONTS.body, 'bold')
    doc.setFontSize(7.5)
    setColor(doc, C.green)
    doc.text(truncate(s.headline, 40), CONTENT.x + 3, y + 5)

    doc.setFont(FONTS.body, 'normal')
    doc.setFontSize(7)
    setColor(doc, C.slateMid)
    doc.text(`${dimensionLabels[s.dimension] || s.dimension}: ${s.score.toFixed(1)} vs avg ${s.competitorAvg.toFixed(1)}`, CONTENT.x + 3, y + 10)

    const lines = doc.splitTextToSize(s.leverageStrategy, halfW - 6)
    doc.text(lines.slice(0, 1), CONTENT.x + 3, y + 14.5)
    y += 20
  }

  // Gaps
  let gy = strengthsStartY
  for (const g of summary.gaps.slice(0, 3)) {
    if (gy > 160) break
    drawCard(doc, CONTENT.x + halfW + 4, gy, halfW, 18, { fill: C.coralLight })
    doc.setFont(FONTS.body, 'bold')
    doc.setFontSize(7.5)
    setColor(doc, C.coral)
    doc.text(truncate(g.headline, 40), CONTENT.x + halfW + 7, gy + 5)

    doc.setFont(FONTS.body, 'normal')
    doc.setFontSize(7)
    setColor(doc, C.slateMid)
    doc.text(`${dimensionLabels[g.dimension] || g.dimension}: ${g.score.toFixed(1)} vs avg ${g.competitorAvg.toFixed(1)}`, CONTENT.x + halfW + 7, gy + 10)

    const lines = doc.splitTextToSize(g.businessImpact, halfW - 6)
    doc.text(lines.slice(0, 1), CONTENT.x + halfW + 7, gy + 14.5)
    gy += 20
  }

  y = Math.max(y, gy) + 4

  // 90-Day Action Plan Table
  y = drawSectionTitle(doc, y, '90-Day Action Plan')

  // Table header
  const cols = {
    priority: { x: CONTENT.x, w: 22 },
    title: { x: CONTENT.x + 22, w: CONTENT.w - 52 },
    effort: { x: CONTENT.x + CONTENT.w - 30, w: 16 },
    impact: { x: CONTENT.x + CONTENT.w - 14, w: 14 },
  }

  drawCard(doc, CONTENT.x, y, CONTENT.w, 6, { fill: C.tealDeep })
  doc.setFont(FONTS.body, 'bold')
  doc.setFontSize(6.5)
  setColor(doc, C.surface)
  doc.text('Priority', cols.priority.x + 2, y + 4.2)
  doc.text('Action', cols.title.x + 2, y + 4.2)
  doc.text('Effort', cols.effort.x + 2, y + 4.2)
  doc.text('Impact', cols.impact.x + 2, y + 4.2)
  y += 7

  // Rows
  for (let i = 0; i < summary.recommendations.length; i++) {
    if (y > 270) break
    const rec = summary.recommendations[i]
    const isOdd = i % 2 === 0

    if (isOdd) {
      setFill(doc, C.surfaceDim)
      doc.rect(CONTENT.x, y, CONTENT.w, 10, 'F')
    }

    // Priority badge
    const pColor = priorityColor(rec.priority)
    drawBadge(doc, cols.priority.x + 2, y + 4, priorityLabel(rec.priority), pColor, C.surface)

    // Title + description
    doc.setFont(FONTS.body, 'bold')
    doc.setFontSize(7)
    setColor(doc, C.slate)
    doc.text(truncate(rec.title, 55), cols.title.x + 2, y + 4)

    doc.setFont(FONTS.body, 'normal')
    doc.setFontSize(6.5)
    setColor(doc, C.slateMid)
    doc.text(truncate(rec.description, 70), cols.title.x + 2, y + 8.5)

    // Effort
    doc.setFont(FONTS.body, 'normal')
    doc.setFontSize(6.5)
    setColor(doc, C.slateMid)
    doc.text(effortLabel(rec.effort), cols.effort.x + 2, y + 6)

    // Impact
    const impactColor = rec.impact === 'high' ? C.green : rec.impact === 'medium' ? C.gold : C.slateLight
    setColor(doc, impactColor)
    doc.text(rec.impact.charAt(0).toUpperCase() + rec.impact.slice(1), cols.impact.x + 2, y + 6)

    y += 11
  }
}
