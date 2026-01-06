import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://outrankllm.io';

/**
 * GET /api/verify?token=xxx
 * Magic link verification - validates token, marks email as verified, redirects to report
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/verify-error?reason=missing_token', APP_URL));
  }

  const supabase = createServiceClient();

  try {
    // 1. Look up the verification token
    const { data: verification, error: verifyError } = await supabase
      .from('email_verification_tokens')
      .select(`
        id,
        lead_id,
        run_id,
        email,
        verified_at,
        expires_at
      `)
      .eq('token', token)
      .single();

    if (verifyError || !verification) {
      console.error('Token lookup failed:', verifyError);
      return NextResponse.redirect(new URL('/verify-error?reason=invalid_token', APP_URL));
    }

    // 2. Check if already verified
    if (verification.verified_at) {
      // Already verified - just redirect to the report
      const { data: report } = await supabase
        .from('reports')
        .select('url_token')
        .eq('run_id', verification.run_id)
        .single();

      if (report?.url_token) {
        return createVerifiedRedirect(report.url_token, verification.email);
      }
      return NextResponse.redirect(new URL('/verify-error?reason=report_not_found', APP_URL));
    }

    // 3. Check if token has expired (24 hours)
    const expiresAt = new Date(verification.expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.redirect(new URL('/verify-error?reason=expired', APP_URL));
    }

    // 4. Mark the token as verified
    const { error: updateTokenError } = await supabase
      .from('email_verification_tokens')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', verification.id);

    if (updateTokenError) {
      console.error('Failed to update token:', updateTokenError);
    }

    // 5. Mark the lead as verified
    const { error: updateLeadError } = await supabase
      .from('leads')
      .update({
        email_verified: true,
        verified_at: new Date().toISOString()
      })
      .eq('id', verification.lead_id);

    if (updateLeadError) {
      console.error('Failed to update lead:', updateLeadError);
    }

    // 6. Get the report URL token
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('url_token')
      .eq('run_id', verification.run_id)
      .single();

    if (reportError || !report?.url_token) {
      // Report might not be ready yet - check scan status
      const { data: scanRun } = await supabase
        .from('scan_runs')
        .select('status')
        .eq('id', verification.run_id)
        .single();

      if (scanRun?.status !== 'complete') {
        // Scan still processing - redirect to a waiting page
        return NextResponse.redirect(
          new URL(`/report-pending?email=${encodeURIComponent(verification.email)}`, APP_URL)
        );
      }

      return NextResponse.redirect(new URL('/verify-error?reason=report_not_found', APP_URL));
    }

    // 7. Redirect to the report with verification cookie
    return createVerifiedRedirect(report.url_token, verification.email);

  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.redirect(new URL('/verify-error?reason=server_error', APP_URL));
  }
}

/**
 * Create a redirect response with a verification cookie
 */
function createVerifiedRedirect(reportToken: string, email: string): NextResponse {
  const response = NextResponse.redirect(new URL(`/report/${reportToken}`, APP_URL));

  // Set a cookie to remember verification (30 days)
  // Hash the email to create a unique but non-identifying cookie name
  const emailHash = Buffer.from(email).toString('base64').slice(0, 8);
  response.cookies.set(`outrankllm-verified-${emailHash}`, 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/'
  });

  return response;
}
