/**
 * HiringBrand PDF Export API
 * POST — Generates a branded one-page PDF for a specific tab
 * GET  — Generates a full multi-page PDF with all tabs
 * No auth required (report is public via token, same as viewing)
 */

export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { fetchHBReportData } from '@/lib/hiringbrand-report-data'
import { generateTabPdf, generateFullPdf } from '@/lib/pdf/generate-tab-pdf'
import type { HBTabId } from '@/app/hiringbrand/report/components/shared/types'

const EXPORTABLE_TABS: HBTabId[] = ['overview', 'responses', 'clippings', 'competitors', 'trends', 'actions']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const tab = body.tab as HBTabId

    if (!tab || !EXPORTABLE_TABS.includes(tab)) {
      return NextResponse.json(
        { error: `Invalid tab. Must be one of: ${EXPORTABLE_TABS.join(', ')}` },
        { status: 400 }
      )
    }

    const reportData = await fetchHBReportData(token)
    if (!reportData) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const pdfBuffer = await generateTabPdf(
      { ...reportData, trends: reportData.trends },
      tab
    )

    // Build filename
    const slug = reportData.company.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const tabSlug = tab.replace(/_/g, '-')
    const filename = `${slug}-${tabSlug}-hiringbrand.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('PDF export error:', error)
    const message = error instanceof Error ? error.message : 'Export failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * GET — Full report PDF (all tabs combined)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const reportData = await fetchHBReportData(token)
    if (!reportData) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const pdfBuffer = await generateFullPdf(
      { ...reportData, trends: reportData.trends }
    )

    const slug = reportData.company.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const filename = `${slug}-full-report-hiringbrand.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Full PDF export error:', error)
    const message = error instanceof Error ? error.message : 'Export failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
