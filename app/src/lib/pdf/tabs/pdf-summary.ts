/**
 * Summary Tab PDF Generator
 * Score rings, executive summary, sentiment distribution
 */

import type { jsPDF } from 'jspdf'
import type { HBReportData, HBTrendsData } from '@/app/hiringbrand/report/components/shared/types'
import { renderScoreRingPNG } from '@/lib/pptx/render-score-ring'
import {
  CONTENT, C, FONTS,
  drawSectionTitle, drawCard, drawSentimentBar, drawSentimentLegend,
  drawWrappedText, getHealthLabel, setColor, setFill,
} from '../pdf-layout'

type ReportData = HBReportData & { trends: HBTrendsData }

export async function drawSummaryTab(doc: jsPDF, data: ReportData) {
  const { report, sentimentCounts, company } = data
  const summary = report.strategicSummary
  let y = CONTENT.top

  // Health badge (if strategic summary exists)
  if (summary) {
    const health = getHealthLabel(summary.scoreInterpretation.overallHealth)
    setFill(doc, health.bgColor)
    doc.setFont(FONTS.body, 'bold')
    doc.setFontSize(8)
    const badgeText = health.text
    const badgeW = doc.getTextWidth(badgeText) + 8
    doc.roundedRect(CONTENT.x, y, badgeW, 6, 2, 2, 'F')
    setColor(doc, health.color)
    doc.text(badgeText, CONTENT.x + 4, y + 4.2)
    y += 12
  }

  // Score rings (3 side by side)
  y = drawSectionTitle(doc, y, 'Your Employer Brand Scores')

  const ringSize = 120
  const scores = [
    { score: report.visibilityScore, label: 'Desirability' },
    { score: report.researchabilityScore ?? 0, label: 'AI Awareness' },
    { score: report.differentiationScore ?? 0, label: 'Differentiation' },
  ]

  const ringWidth = CONTENT.w / 3
  const ringPngs = await Promise.all(
    scores.map(s => renderScoreRingPNG(s.score, s.label, ringSize))
  )

  // Score ring SVG is size x (size+40), so preserve aspect ratio
  const imgW = 28
  const imgH = imgW * (ringSize + 40) / ringSize
  for (let i = 0; i < 3; i++) {
    const rx = CONTENT.x + i * ringWidth + (ringWidth - imgW) / 2
    doc.addImage(
      `data:image/png;base64,${ringPngs[i]}`,
      'PNG',
      rx,
      y,
      imgW,
      imgH
    )
  }
  y += imgH + 4

  // Score interpretations
  if (summary) {
    const interpretations = [
      summary.scoreInterpretation.desirability,
      summary.scoreInterpretation.awareness,
      summary.scoreInterpretation.differentiation,
    ]

    doc.setFont(FONTS.body, 'normal')
    doc.setFontSize(7)
    setColor(doc, C.slateMid)

    for (let i = 0; i < 3; i++) {
      const ix = CONTENT.x + i * ringWidth
      const lines = doc.splitTextToSize(interpretations[i], ringWidth - 4)
      doc.text(lines.slice(0, 2), ix + 2, y)
    }
    y += 12
  }

  // Executive Summary
  if (summary) {
    y = drawSectionTitle(doc, y + 2, 'Executive Summary')
    drawCard(doc, CONTENT.x, y, CONTENT.w, 28, { fill: C.tealLight })

    doc.setFont(FONTS.body, 'normal')
    doc.setFontSize(9)
    setColor(doc, C.slate)
    y = drawWrappedText(doc, CONTENT.x + 4, y + 5, summary.executiveSummary, CONTENT.w - 8, 4.5)
    y += 6
  }

  // Competitive Positioning
  if (summary?.competitivePositioning) {
    drawCard(doc, CONTENT.x, y, CONTENT.w, 12, { fill: C.surfaceDim })
    doc.setFont(FONTS.body, 'bold')
    doc.setFontSize(8)
    setColor(doc, C.tealDeep)
    doc.text(summary.competitivePositioning, CONTENT.x + 4, y + 7)
    y += 18
  }

  // Sentiment Distribution
  y = drawSectionTitle(doc, y, 'Sentiment Distribution')

  const total = sentimentCounts.strong + sentimentCounts.positive + sentimentCounts.mixed + sentimentCounts.negative
  doc.setFont(FONTS.body, 'normal')
  doc.setFontSize(8)
  setColor(doc, C.slateMid)
  doc.text(`${total} AI responses across 4 platforms`, CONTENT.x, y + 3)
  y += 8

  drawSentimentBar(doc, CONTENT.x, y, CONTENT.w, 6, sentimentCounts)
  y += 10
  drawSentimentLegend(doc, CONTENT.x, y, sentimentCounts)
  y += 10

  // Topic Coverage (if space)
  if (y < 240 && (report.topicsCovered.length > 0 || report.topicsMissing.length > 0)) {
    y = drawSectionTitle(doc, y + 4, 'Topic Coverage')

    if (report.topicsCovered.length > 0) {
      doc.setFont(FONTS.body, 'bold')
      doc.setFontSize(8)
      setColor(doc, C.green)
      doc.text('Covered: ', CONTENT.x, y + 3)
      doc.setFont(FONTS.body, 'normal')
      setColor(doc, C.slateMid)
      doc.text(report.topicsCovered.map(t => t.replace(/_/g, ' ')).join(', '), CONTENT.x + doc.getTextWidth('Covered: '), y + 3)
      y += 6
    }

    if (report.topicsMissing.length > 0) {
      doc.setFont(FONTS.body, 'bold')
      doc.setFontSize(8)
      setColor(doc, C.coral)
      doc.text('Missing: ', CONTENT.x, y + 3)
      doc.setFont(FONTS.body, 'normal')
      setColor(doc, C.slateMid)
      doc.text(report.topicsMissing.map(t => t.replace(/_/g, ' ')).join(', '), CONTENT.x + doc.getTextWidth('Missing: '), y + 3)
    }
  }
}
