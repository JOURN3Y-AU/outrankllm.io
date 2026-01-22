import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'reports@outrankllm.io'

// Email recipients for feedback notifications
const FEEDBACK_RECIPIENTS = [
  'adam.king@journ3y.com.au',
  'kevin.morrell@journ3y.com.au',
]

type FeedbackType = 'bug' | 'feature' | 'feedback' | 'other'

const TYPE_LABELS: Record<FeedbackType, string> = {
  bug: 'Bug Report',
  feature: 'Feature Request',
  feedback: 'General Feedback',
  other: 'Other',
}

interface FeedbackBody {
  type: FeedbackType
  message: string
  pageUrl?: string
  userAgent?: string
}

/**
 * POST /api/feedback
 * Submit user feedback, bug reports, or feature requests
 */
export async function POST(request: Request) {
  try {
    const supabase = createServiceClient()

    // Get session (optional - anonymous feedback allowed)
    const session = await getSession().catch(() => null)

    // Parse body
    const body: FeedbackBody = await request.json()
    const { type, message, pageUrl, userAgent } = body

    // Validate required fields
    if (!type || !['bug', 'feature', 'feedback', 'other'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid feedback type' },
        { status: 400 }
      )
    }

    if (!message || message.trim().length < 10) {
      return NextResponse.json(
        { error: 'Message must be at least 10 characters' },
        { status: 400 }
      )
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: 'Message must be less than 5000 characters' },
        { status: 400 }
      )
    }

    // Get user context if logged in
    let userEmail: string | null = null
    let userTier: string | null = null
    let leadId: string | null = null

    if (session) {
      leadId = session.lead_id
      userTier = session.tier

      // Get email from lead
      const { data: lead } = await supabase
        .from('leads')
        .select('email')
        .eq('id', session.lead_id)
        .single()

      if (lead) {
        userEmail = lead.email
      }
    }

    // Insert into database
    const { data: feedback, error: insertError } = await supabase
      .from('feedback')
      .insert({
        lead_id: leadId,
        user_email: userEmail,
        user_tier: userTier,
        type,
        message: message.trim(),
        page_url: pageUrl,
        user_agent: userAgent,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting feedback:', insertError)
      return NextResponse.json(
        { error: 'Failed to submit feedback' },
        { status: 500 }
      )
    }

    // Send email notification
    const typeLabel = TYPE_LABELS[type]
    const messagePreview = message.length > 50 ? message.slice(0, 50) + '...' : message
    const timestamp = new Date().toLocaleString('en-AU', {
      timeZone: 'Australia/Sydney',
      dateStyle: 'medium',
      timeStyle: 'short',
    })

    const emailHtml = generateFeedbackEmailHtml({
      type: typeLabel,
      message,
      email: userEmail,
      tier: userTier,
      pageUrl,
      userAgent,
      timestamp,
      feedbackId: feedback.id,
    })

    const emailText = generateFeedbackEmailText({
      type: typeLabel,
      message,
      email: userEmail,
      tier: userTier,
      pageUrl,
      userAgent,
      timestamp,
      feedbackId: feedback.id,
    })

    try {
      await resend.emails.send({
        from: `outrankllm <${FROM_EMAIL}>`,
        to: FEEDBACK_RECIPIENTS,
        subject: `[outrankLLM Feedback] ${typeLabel}: ${messagePreview}`,
        html: emailHtml,
        text: emailText,
      })
      console.log('[Feedback] Email notification sent')
    } catch (emailError) {
      // Don't fail the request if email fails - feedback is already saved
      console.error('[Feedback] Failed to send email notification:', emailError)
    }

    return NextResponse.json({
      success: true,
      id: feedback.id,
    })
  } catch (error) {
    console.error('Error in POST /api/feedback:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

interface EmailTemplateData {
  type: string
  message: string
  email: string | null
  tier: string | null
  pageUrl?: string
  userAgent?: string
  timestamp: string
  feedbackId: string
}

function generateFeedbackEmailHtml(data: EmailTemplateData): string {
  const { type, message, email, tier, pageUrl, userAgent, timestamp, feedbackId } = data

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Feedback - outrankllm</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0c1525; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0c1525;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #111c30; border: 1px solid #1e3a5f; border-radius: 8px;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #1e3a5f;">
              <div style="font-family: 'Courier New', monospace; font-size: 24px; font-weight: 500; color: #fafafa;">
                outrank<span style="color: #40F16C;">llm</span>
              </div>
              <div style="font-family: 'Courier New', monospace; font-size: 11px; color: #8b939e; margin-top: 4px; letter-spacing: 0.1em;">
                NEW FEEDBACK RECEIVED
              </div>
            </td>
          </tr>

          <!-- Type Badge -->
          <tr>
            <td style="padding: 24px 32px 0;">
              <span style="display: inline-block; padding: 6px 12px; background-color: ${getTypeColor(type)}; color: #0c1525; font-family: 'Courier New', monospace; font-size: 12px; font-weight: 500; border-radius: 4px;">
                ${type.toUpperCase()}
              </span>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td style="padding: 16px 32px 24px;">
              <div style="background-color: #162340; border: 1px solid #1e3a5f; border-radius: 6px; padding: 20px;">
                <p style="margin: 0; font-size: 14px; color: #c9c9c9; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(message)}</p>
              </div>
            </td>
          </tr>

          <!-- Context -->
          <tr>
            <td style="padding: 0 32px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px;">
                <tr>
                  <td style="padding: 8px 0; color: #8b939e; width: 80px;">From:</td>
                  <td style="padding: 8px 0; color: #c9c9c9;">${email || 'Anonymous'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #8b939e;">Tier:</td>
                  <td style="padding: 8px 0; color: #c9c9c9;">${tier || 'Not logged in'}</td>
                </tr>
                ${pageUrl ? `
                <tr>
                  <td style="padding: 8px 0; color: #8b939e;">Page:</td>
                  <td style="padding: 8px 0; color: #c9c9c9;">${escapeHtml(pageUrl)}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0; color: #8b939e;">Time:</td>
                  <td style="padding: 8px 0; color: #c9c9c9;">${timestamp}</td>
                </tr>
                ${userAgent ? `
                <tr>
                  <td style="padding: 8px 0; color: #8b939e; vertical-align: top;">Device:</td>
                  <td style="padding: 8px 0; color: #8b939e; font-size: 11px; word-break: break-all;">${escapeHtml(userAgent)}</td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #1e3a5f; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #8b939e;">
                Feedback ID: ${feedbackId}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

function generateFeedbackEmailText(data: EmailTemplateData): string {
  const { type, message, email, tier, pageUrl, userAgent, timestamp, feedbackId } = data

  return `
outrankllm - New Feedback Received

Type: ${type}

Message:
${message}

---
From: ${email || 'Anonymous'}
Tier: ${tier || 'Not logged in'}
${pageUrl ? `Page: ${pageUrl}` : ''}
Time: ${timestamp}
${userAgent ? `Device: ${userAgent}` : ''}

Feedback ID: ${feedbackId}
  `.trim()
}

function getTypeColor(type: string): string {
  switch (type.toLowerCase()) {
    case 'bug report':
      return '#ef4444'
    case 'feature request':
      return '#40F16C'
    case 'general feedback':
      return '#3b82f6'
    default:
      return '#8b939e'
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
