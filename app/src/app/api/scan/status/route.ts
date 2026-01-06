import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Status messages for user-friendly display
const STATUS_MESSAGES: Record<string, string> = {
  pending: 'Queued for processing...',
  crawling: 'Crawling your website...',
  analyzing: 'Analyzing your content...',
  generating: 'Generating questions for AI...',
  querying: 'Querying AI assistants...',
  complete: 'Report ready!',
  failed: 'Something went wrong'
};

// Estimated time remaining in seconds based on status
const ESTIMATED_TIME: Record<string, number> = {
  pending: 300,
  crawling: 240,
  analyzing: 180,
  generating: 150,
  querying: 90,
  complete: 0,
  failed: 0
};

/**
 * GET /api/scan/status?id=xxx
 * Returns current scan status and progress for polling
 */
export async function GET(request: NextRequest) {
  const scanId = request.nextUrl.searchParams.get('id');

  if (!scanId) {
    return NextResponse.json(
      { error: 'Missing scan ID' },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  try {
    // Fetch scan run with related data
    const { data: scanRun, error } = await supabase
      .from('scan_runs')
      .select(`
        id,
        status,
        progress,
        error_message,
        started_at,
        completed_at,
        created_at,
        lead:leads(email, domain)
      `)
      .eq('id', scanId)
      .single();

    if (error || !scanRun) {
      return NextResponse.json(
        { error: 'Scan not found' },
        { status: 404 }
      );
    }

    const status = scanRun.status || 'pending';
    const progress = scanRun.progress || 0;

    // Calculate estimated time remaining
    let estimatedTimeRemaining = ESTIMATED_TIME[status] || 0;

    // Adjust based on progress if in querying phase
    if (status === 'querying' && progress > 50) {
      const queryProgress = (progress - 50) / 35; // 50-85% is querying phase
      estimatedTimeRemaining = Math.ceil(90 * (1 - queryProgress));
    }

    // Get report token if complete
    let reportToken: string | null = null;
    if (status === 'complete') {
      const { data: report } = await supabase
        .from('reports')
        .select('url_token')
        .eq('run_id', scanId)
        .single();

      reportToken = report?.url_token || null;
    }

    const response = {
      id: scanRun.id,
      status,
      progress,
      statusMessage: STATUS_MESSAGES[status] || 'Processing...',
      estimatedTimeRemaining,
      isComplete: status === 'complete',
      isFailed: status === 'failed',
      errorMessage: status === 'failed' ? scanRun.error_message : null,
      reportToken,
      domain: (scanRun.lead as { domain: string } | null)?.domain,
      startedAt: scanRun.started_at,
      completedAt: scanRun.completed_at
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}
