/**
 * Email Sending via Supabase
 * Sends transactional emails using Supabase's built-in email functionality
 * or falls back to a simple logging approach for development
 */

import { createServiceClient } from '@/lib/supabase/server'

/**
 * Send the "Report Ready" email
 */
export async function sendReportReadyEmail(
  email: string,
  domain: string,
  reportUrl: string,
  visibilityScore: number
): Promise<boolean> {
  try {
    // For now, we'll log the email details
    // In production, you'd integrate with Resend, SendGrid, or Supabase Auth emails
    console.log('=== EMAIL NOTIFICATION ===')
    console.log(`To: ${email}`)
    console.log(`Subject: Your AI Visibility Report for ${domain} is Ready`)
    console.log(`Report URL: ${reportUrl}`)
    console.log(`Visibility Score: ${visibilityScore}%`)
    console.log('=== END EMAIL ===')

    // Store email record in database for tracking (optional)
    const supabase = createServiceClient()

    // You could create an email_logs table to track sent emails
    // For MVP, we'll just log it

    // In production, uncomment and configure one of these:

    // Option 1: Use Resend
    // await sendWithResend(email, domain, reportUrl, visibilityScore)

    // Option 2: Use Supabase Edge Function
    // await triggerSupabaseEmailFunction(email, domain, reportUrl, visibilityScore)

    return true
  } catch (error) {
    console.error('Failed to send email:', error)
    return false
  }
}

/**
 * Generate the email HTML template
 */
export function generateEmailHtml(
  domain: string,
  reportUrl: string,
  visibilityScore: number
): string {
  const scoreColor = visibilityScore >= 50 ? '#22c55e' : visibilityScore >= 25 ? '#f59e0b' : '#ef4444'
  const scoreDescription =
    visibilityScore >= 70 ? 'Great' :
    visibilityScore >= 40 ? 'Good' :
    visibilityScore >= 20 ? 'Needs Work' :
    'Critical'

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your AI Visibility Report is Ready</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-width: 100%; background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <span style="font-family: 'Courier New', monospace; font-size: 24px; color: #fafafa; letter-spacing: -0.02em;">
                outrank<span style="color: #22c55e;">llm</span>
              </span>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td style="background-color: #141414; border: 1px solid #262626; padding: 40px;">

              <!-- Headline -->
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 500; color: #fafafa; text-align: center;">
                Your Report is Ready
              </h1>

              <!-- Domain -->
              <p style="margin: 0 0 32px 0; font-family: 'Courier New', monospace; font-size: 14px; color: #a3a3a3; text-align: center;">
                ${domain}
              </p>

              <!-- Score -->
              <div style="text-align: center; margin-bottom: 32px;">
                <div style="display: inline-block; width: 100px; height: 100px; border-radius: 50%; background: conic-gradient(${scoreColor} ${visibilityScore * 3.6}deg, #262626 0deg); position: relative;">
                  <div style="position: absolute; inset: 8px; border-radius: 50%; background-color: #141414; display: flex; align-items: center; justify-content: center;">
                    <span style="font-family: 'Courier New', monospace; font-size: 28px; font-weight: 500; color: #fafafa;">${visibilityScore}</span>
                  </div>
                </div>
                <p style="margin: 12px 0 0 0; font-family: 'Courier New', monospace; font-size: 11px; color: #525252; text-transform: uppercase; letter-spacing: 0.1em;">
                  AI Visibility Score
                </p>
                <p style="margin: 4px 0 0 0; font-family: 'Courier New', monospace; font-size: 14px; color: ${scoreColor};">
                  ${scoreDescription}
                </p>
              </div>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${reportUrl}" style="display: inline-block; background-color: #22c55e; color: #0a0a0a; font-family: 'Courier New', monospace; font-size: 14px; font-weight: 500; text-decoration: none; padding: 14px 32px;">
                      View Full Report →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- What's included -->
              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #262626;">
                <p style="margin: 0 0 12px 0; font-family: 'Courier New', monospace; font-size: 11px; color: #525252; text-transform: uppercase; letter-spacing: 0.1em;">
                  Your report includes
                </p>
                <ul style="margin: 0; padding: 0 0 0 16px; color: #a3a3a3; font-size: 14px; line-height: 1.8;">
                  <li>Visibility across ChatGPT, Claude & Gemini</li>
                  <li>Competitors being recommended instead</li>
                  <li>Sample AI responses for your niche</li>
                </ul>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 24px; text-align: center;">
              <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 12px; color: #525252;">
                outrankllm.io — GEO for Vibe Coders
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

/**
 * Generate plain text version of email
 */
export function generateEmailText(
  domain: string,
  reportUrl: string,
  visibilityScore: number
): string {
  return `
Your AI Visibility Report for ${domain} is Ready

AI Visibility Score: ${visibilityScore}%

View your full report here:
${reportUrl}

Your report includes:
- Visibility across ChatGPT, Claude & Gemini
- Competitors being recommended instead
- Sample AI responses for your niche

---
outrankllm.io — GEO for Vibe Coders
`.trim()
}
