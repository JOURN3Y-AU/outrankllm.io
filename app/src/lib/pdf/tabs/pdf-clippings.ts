/**
 * Clippings Tab PDF Generator
 * Web mention stats, key insights, top clippings
 */

import type { jsPDF } from 'jspdf'
import type { HBReportData, HBTrendsData } from '@/app/hiringbrand/report/components/shared/types'
import {
  CONTENT, C, FONTS,
  drawSectionTitle, drawCard, drawSentimentBar,
  truncate, setColor, setFill, drawBadge,
} from '../pdf-layout'

type ReportData = HBReportData & { trends: HBTrendsData }

const sentimentColors: Record<string, { bg: string; text: string }> = {
  positive: { bg: '#ECFDF5', text: '#059669' },
  negative: { bg: '#FFF0EC', text: '#FC4A1A' },
  neutral: { bg: '#F1F5F9', text: '#475569' },
  mixed: { bg: '#FEF9EC', text: '#F7B733' },
}

export async function drawClippingsTab(doc: jsPDF, data: ReportData) {
  const { mentions, report } = data
  const stats = report.mentionStats
  let y = CONTENT.top

  if (mentions.length === 0) {
    doc.setFont(FONTS.body, 'normal')
    doc.setFontSize(11)
    setColor(doc, C.slateMid)
    doc.text('No web clippings found for this scan.', CONTENT.x, y + 10)
    return
  }

  // Stats row
  drawCard(doc, CONTENT.x, y, CONTENT.w, 16, { fill: C.surfaceDim })
  doc.setFont(FONTS.display, 'bold')
  doc.setFontSize(20)
  setColor(doc, C.slate)
  doc.text(`${stats?.total || mentions.length}`, CONTENT.x + 6, y + 11)
  doc.setFont(FONTS.body, 'normal')
  doc.setFontSize(9)
  setColor(doc, C.slateMid)
  const avgText = stats ? `web clippings  |  Avg sentiment: ${stats.avgSentimentScore.toFixed(1)}/10` : 'web clippings'
  doc.text(avgText, CONTENT.x + 28, y + 11)
  y += 22

  // Sentiment split
  if (stats) {
    y = drawSectionTitle(doc, y, 'Sentiment Split')
    const sentCounts = {
      strong: 0,
      positive: stats.bySentiment.positive || 0,
      mixed: (stats.bySentiment.neutral || 0) + (stats.bySentiment.mixed || 0),
      negative: stats.bySentiment.negative || 0,
    }
    drawSentimentBar(doc, CONTENT.x, y, CONTENT.w, 5, sentCounts)
    y += 10

    // Legend
    const items = [
      { label: `Positive (${stats.bySentiment.positive || 0})`, color: C.teal },
      { label: `Neutral (${stats.bySentiment.neutral || 0})`, color: C.gold },
      { label: `Negative (${stats.bySentiment.negative || 0})`, color: C.coral },
    ]
    let lx = CONTENT.x
    doc.setFont(FONTS.body, 'normal')
    doc.setFontSize(7)
    for (const item of items) {
      setFill(doc, item.color)
      doc.circle(lx + 1.5, y - 1, 1.5, 'F')
      setColor(doc, C.slateMid)
      doc.text(item.label, lx + 5, y)
      lx += doc.getTextWidth(item.label) + 10
    }
    y += 8
  }

  // Key Insights
  if (stats?.insights && stats.insights.length > 0) {
    y = drawSectionTitle(doc, y, 'Key Insights')

    for (const insight of stats.insights.slice(0, 3)) {
      if (y > 240) break
      const colors = insight.type === 'positive'
        ? { dot: C.green, text: C.slate }
        : insight.type === 'negative'
          ? { dot: C.coral, text: C.slate }
          : { dot: C.gold, text: C.slate }

      setFill(doc, colors.dot)
      doc.circle(CONTENT.x + 2, y + 1, 1.5, 'F')
      doc.setFont(FONTS.body, 'normal')
      doc.setFontSize(8)
      setColor(doc, colors.text)
      const lines = doc.splitTextToSize(insight.text, CONTENT.w - 10)
      doc.text(lines.slice(0, 2), CONTENT.x + 6, y + 2.5)
      y += lines.slice(0, 2).length * 4 + 3
    }
    y += 4
  }

  // Top Clippings
  y = drawSectionTitle(doc, y, 'Top Clippings')

  const topMentions = mentions
    .filter(m => m.sentimentScore != null)
    .sort((a, b) => Math.abs((b.sentimentScore || 5) - 5) - Math.abs((a.sentimentScore || 5) - 5))
    .slice(0, 6)

  for (const m of topMentions) {
    if (y > 268) break

    const sent = m.sentiment || 'neutral'
    const colors = sentimentColors[sent] || sentimentColors.neutral

    drawCard(doc, CONTENT.x, y, CONTENT.w, 18, { fill: colors.bg })

    // Sentiment badge + domain
    doc.setFont(FONTS.body, 'bold')
    doc.setFontSize(7)
    const badgeW = drawBadge(doc, CONTENT.x + 3, y + 5, `${m.sentimentScore || '—'}/10`, colors.text, C.surface)

    doc.setFont(FONTS.body, 'normal')
    doc.setFontSize(7)
    setColor(doc, C.slateLight)
    doc.text(m.domainName || 'unknown', CONTENT.x + badgeW + 6, y + 5)

    // Title
    doc.setFont(FONTS.body, 'bold')
    doc.setFontSize(8)
    setColor(doc, C.slate)
    doc.text(truncate(m.title || m.url, 85), CONTENT.x + 3, y + 11)

    // Snippet
    if (m.snippet) {
      doc.setFont(FONTS.body, 'normal')
      doc.setFontSize(7)
      setColor(doc, C.slateMid)
      doc.text(truncate(m.snippet, 120), CONTENT.x + 3, y + 15.5)
    }

    y += 20
  }

  // Top Domains
  if (stats?.topDomains && stats.topDomains.length > 0 && y < 270) {
    doc.setFont(FONTS.body, 'bold')
    doc.setFontSize(7)
    setColor(doc, C.slateLight)
    doc.text('Top sources: ' + stats.topDomains.slice(0, 5).map(d => d.domain).join(', '), CONTENT.x, y + 4)
  }
}
