import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendVerificationEmail } from '@/lib/email/resend';
import { z } from 'zod';
import crypto from 'crypto';

const RequestSchema = z.object({
  email: z.string().email(),
  runId: z.string().uuid().optional(),
});

// Rate limit: 1 request per 2 minutes per email
const RATE_LIMIT_MINUTES = 2;

/**
 * POST /api/resend-verification
 * Resend verification email - rate limited to prevent abuse
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = RequestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { email, runId } = result.data;
    const supabase = createServiceClient();

    // 1. Find the lead and their most recent unverified token
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, email_verified')
      .eq('email', email)
      .single();

    if (leadError || !lead) {
      // Don't reveal if email exists or not
      return NextResponse.json({
        success: true,
        message: 'If that email exists, a verification link has been sent.'
      });
    }

    // 2. If already verified, no need to resend
    if (lead.email_verified) {
      return NextResponse.json({
        success: true,
        message: 'Your email is already verified. Check your inbox for report links.'
      });
    }

    // 3. Check rate limit - look for recent tokens
    const rateLimitCutoff = new Date();
    rateLimitCutoff.setMinutes(rateLimitCutoff.getMinutes() - RATE_LIMIT_MINUTES);

    const { data: recentTokens } = await supabase
      .from('email_verification_tokens')
      .select('created_at')
      .eq('email', email)
      .gt('created_at', rateLimitCutoff.toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (recentTokens && recentTokens.length > 0) {
      const lastSent = new Date(recentTokens[0].created_at);
      const waitSeconds = Math.ceil((RATE_LIMIT_MINUTES * 60) - ((Date.now() - lastSent.getTime()) / 1000));

      return NextResponse.json(
        {
          error: 'Rate limited',
          message: `Please wait ${waitSeconds} seconds before requesting another verification email.`,
          retryAfter: waitSeconds
        },
        { status: 429 }
      );
    }

    // 4. Find the run to verify (use provided runId or most recent)
    let targetRunId = runId;

    if (!targetRunId) {
      const { data: latestRun } = await supabase
        .from('scan_runs')
        .select('id')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!latestRun) {
        return NextResponse.json(
          { error: 'No scan found for this email' },
          { status: 404 }
        );
      }
      targetRunId = latestRun.id;
    }

    // 5. Get domain from scan for email
    const { data: scanRun } = await supabase
      .from('scan_runs')
      .select(`
        id,
        lead:leads(domain)
      `)
      .eq('id', targetRunId)
      .single();

    const domain = (scanRun?.lead as { domain: string } | null)?.domain || 'your website';

    // 6. Generate new verification token
    const newToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // 7. Insert new token
    const { error: insertError } = await supabase
      .from('email_verification_tokens')
      .insert({
        lead_id: lead.id,
        run_id: targetRunId,
        token: newToken,
        email: email,
        expires_at: expiresAt.toISOString()
      });

    if (insertError) {
      console.error('Failed to create verification token:', insertError);
      return NextResponse.json(
        { error: 'Failed to create verification token' },
        { status: 500 }
      );
    }

    // 8. Send verification email
    const emailResult = await sendVerificationEmail(email, newToken, domain);

    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error);
      return NextResponse.json(
        { error: 'Failed to send email. Please try again.' },
        { status: 500 }
      );
    }

    // 9. Log the email
    await supabase.from('email_logs').insert({
      lead_id: lead.id,
      run_id: targetRunId,
      email_type: 'verification',
      recipient: email,
      resend_id: emailResult.messageId,
      status: 'sent'
    });

    return NextResponse.json({
      success: true,
      message: 'Verification email sent! Check your inbox.'
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
