/**
 * AI Responses Tab PDF Generator
 * Platform breakdown, sentiment, top response quotes
 */

import type { jsPDF } from 'jspdf'
import type { HBReportData, HBTrendsData, HBPlatform } from '@/app/hiringbrand/report/components/shared/types'
import {
  CONTENT, C, FONTS,
  drawSectionTitle, drawCard, drawSentimentBar, drawSentimentLegend,
  drawWrappedText, truncate, setColor, setFill, drawBadge,
} from '../pdf-layout'

type ReportData = HBReportData & { trends: HBTrendsData }

const platformNames: Record<HBPlatform, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  claude: 'Claude',
}

export async function drawResponsesTab(doc: jsPDF, data: ReportData) {
  const { responses, sentimentCounts } = data
  let y = CONTENT.top

  // Stats row
  const platforms = new Set(responses.map(r => r.platform))
  const categories = new Set(responses.map(r => r.promptCategory))

  drawCard(doc, CONTENT.x, y, CONTENT.w, 14, { fill: C.surfaceDim })
  doc.setFont(FONTS.display, 'bold')
  doc.setFontSize(20)
  setColor(doc, C.slate)
  doc.text(`${responses.length}`, CONTENT.x + 6, y + 10)
  doc.setFont(FONTS.body, 'normal')
  doc.setFontSize(9)
  setColor(doc, C.slateMid)
  doc.text(`responses across ${platforms.size} platforms, ${categories.size} categories`, CONTENT.x + 24, y + 10)
  y += 20

  // Sentiment Distribution
  y = drawSectionTitle(doc, y, 'Sentiment Distribution')
  drawSentimentBar(doc, CONTENT.x, y, CONTENT.w, 6, sentimentCounts)
  y += 10
  drawSentimentLegend(doc, CONTENT.x, y, sentimentCounts)
  y += 12

  // Platform Breakdown
  y = drawSectionTitle(doc, y, 'Platform Coverage')

  const platformCounts: Record<string, { total: number; avgScore: number }> = {}
  for (const r of responses) {
    if (!platformCounts[r.platform]) platformCounts[r.platform] = { total: 0, avgScore: 0 }
    platformCounts[r.platform].total++
    platformCounts[r.platform].avgScore += (r.sentimentScore || 5)
  }

  const platCardW = (CONTENT.w - 6) / 4
  let px = CONTENT.x
  for (const plat of ['chatgpt', 'perplexity', 'gemini', 'claude'] as HBPlatform[]) {
    const pc = platformCounts[plat]
    if (!pc) { px += platCardW + 2; continue }

    const avg = Math.round((pc.avgScore / pc.total) * 10) / 10
    drawCard(doc, px, y, platCardW, 18, { border: C.surfaceDim })

    doc.setFont(FONTS.body, 'bold')
    doc.setFontSize(8)
    setColor(doc, C.slate)
    doc.text(platformNames[plat], px + 4, y + 6)

    doc.setFont(FONTS.body, 'normal')
    doc.setFontSize(7)
    setColor(doc, C.slateMid)
    doc.text(`${pc.total} responses`, px + 4, y + 11)
    doc.text(`Avg: ${avg}/10`, px + 4, y + 15)

    px += platCardW + 2
  }
  y += 24

  // Top Responses (best and worst)
  y = drawSectionTitle(doc, y, 'Standout AI Responses')

  // Get top 3 positive and top 1 negative
  const sorted = [...responses]
    .filter(r => r.sentimentScore != null)
    .sort((a, b) => (b.sentimentScore || 0) - (a.sentimentScore || 0))

  const topPositive = sorted.slice(0, 3)
  const topNegative = sorted.filter(r => (r.sentimentScore || 5) <= 4).slice(-1)
  const highlights = [...topPositive, ...topNegative].slice(0, 4)

  for (const r of highlights) {
    if (y > 262) break

    const score = r.sentimentScore || 5
    const isPositive = score >= 6
    const cardColor = isPositive ? C.greenLight : C.coralLight

    drawCard(doc, CONTENT.x, y, CONTENT.w, 24, { fill: cardColor })

    // Platform + score badge
    doc.setFont(FONTS.body, 'bold')
    doc.setFontSize(7)
    const badgeColor = isPositive ? C.green : C.coral
    drawBadge(doc, CONTENT.x + 4, y + 5, `${platformNames[r.platform]}  ${score}/10`, badgeColor, C.surface)

    // Question (truncated)
    doc.setFont(FONTS.body, 'bold')
    doc.setFontSize(8)
    setColor(doc, C.slate)
    doc.text(truncate(r.promptText, 90), CONTENT.x + 4, y + 12)

    // Response excerpt
    doc.setFont(FONTS.body, 'normal')
    doc.setFontSize(7.5)
    setColor(doc, C.slateMid)
    const excerpt = truncate(r.responseText.replace(/\n/g, ' '), 200)
    const lines = doc.splitTextToSize(`"${excerpt}"`, CONTENT.w - 8)
    doc.text(lines.slice(0, 2), CONTENT.x + 4, y + 17)

    y += 27
  }
}
