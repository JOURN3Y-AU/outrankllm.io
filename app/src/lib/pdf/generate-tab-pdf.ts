/**
 * HiringBrand Per-Tab PDF Generator
 * Dispatches to the correct tab generator and returns a PDF buffer
 */

import { jsPDF } from 'jspdf'
import { registerFonts } from './pdf-fonts'
import { drawHeader, drawFooter, formatDate } from './pdf-layout'
import { drawSummaryTab } from './tabs/pdf-summary'
import { drawResponsesTab } from './tabs/pdf-responses'
import { drawClippingsTab } from './tabs/pdf-clippings'
import { drawCompetitorsTab } from './tabs/pdf-competitors'
import { drawTrendsTab } from './tabs/pdf-trends'
import { drawActionsTab } from './tabs/pdf-actions'
import type { HBReportData, HBTrendsData, HBTabId } from '@/app/hiringbrand/report/components/shared/types'

type ReportData = HBReportData & { trends: HBTrendsData }

const TAB_TITLES: Partial<Record<HBTabId, string>> = {
  overview: 'Summary',
  responses: 'AI Responses',
  clippings: 'Clippings',
  competitors: 'Competitors',
  trends: 'Trends',
  actions: 'Action Plan',
}

/**
 * Generate a single-page branded PDF for a specific tab
 */
export async function generateTabPdf(
  data: ReportData,
  tab: HBTabId
): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  // Register custom fonts
  registerFonts(doc)

  // Draw header
  const tabTitle = TAB_TITLES[tab] || tab
  const scanDate = formatDate(data.report.createdAt)
  drawHeader(doc, data.company.name, tabTitle, scanDate)

  // Draw footer
  const reportUrl = `hiringbrand.io/report/${data.report.urlToken}`
  drawFooter(doc, reportUrl)

  // Dispatch to tab-specific generator
  switch (tab) {
    case 'overview':
      await drawSummaryTab(doc, data)
      break
    case 'responses':
      await drawResponsesTab(doc, data)
      break
    case 'clippings':
      await drawClippingsTab(doc, data)
      break
    case 'competitors':
      await drawCompetitorsTab(doc, data)
      break
    case 'trends':
      await drawTrendsTab(doc, data)
      break
    case 'actions':
      await drawActionsTab(doc, data)
      break
    default:
      throw new Error(`Tab "${tab}" is not exportable`)
  }

  // Return as buffer
  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}

const EXPORTABLE_TABS: HBTabId[] = ['overview', 'responses', 'clippings', 'competitors', 'trends', 'actions']

const TAB_DRAWERS: Record<string, (doc: jsPDF, data: ReportData) => Promise<void>> = {
  overview: drawSummaryTab,
  responses: drawResponsesTab,
  clippings: drawClippingsTab,
  competitors: drawCompetitorsTab,
  trends: drawTrendsTab,
  actions: drawActionsTab,
}

/**
 * Generate a full multi-page PDF with all exportable tabs (one page per tab)
 */
export async function generateFullPdf(data: ReportData): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  registerFonts(doc)

  const scanDate = formatDate(data.report.createdAt)
  const reportUrl = `hiringbrand.io/report/${data.report.urlToken}`

  for (let i = 0; i < EXPORTABLE_TABS.length; i++) {
    const tab = EXPORTABLE_TABS[i]
    if (i > 0) doc.addPage()

    drawHeader(doc, data.company.name, TAB_TITLES[tab] || tab, scanDate)
    drawFooter(doc, reportUrl)
    await TAB_DRAWERS[tab](doc, data)
  }

  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}
