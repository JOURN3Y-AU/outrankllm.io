import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'reports@outrankllm.io';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://outrankllm.io';

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send verification email with magic link
 */
export async function sendVerificationEmail(
  email: string,
  verificationToken: string,
  domain: string
): Promise<EmailResult> {
  const verificationUrl = `${APP_URL}/api/verify?token=${verificationToken}`;

  try {
    const { data, error } = await resend.emails.send({
      from: `outrankllm <${FROM_EMAIL}>`,
      to: email,
      subject: `Verify your email to see your AI visibility report for ${domain}`,
      html: generateVerificationEmailHtml(domain, verificationUrl),
      text: generateVerificationEmailText(domain, verificationUrl),
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error('Failed to send verification email:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

/**
 * Send report ready email (after verification, if needed for re-notification)
 */
export async function sendReportReadyEmail(
  email: string,
  reportToken: string,
  domain: string,
  score: number
): Promise<EmailResult> {
  const reportUrl = `${APP_URL}/report/${reportToken}`;

  try {
    const { data, error } = await resend.emails.send({
      from: `outrankllm <${FROM_EMAIL}>`,
      to: email,
      subject: `Your AI Visibility Report is ready - ${domain}`,
      html: generateReportReadyEmailHtml(domain, reportUrl, score),
      text: generateReportReadyEmailText(domain, reportUrl, score),
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error('Failed to send report ready email:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

// ============================================
// EMAIL TEMPLATES
// ============================================

function generateVerificationEmailHtml(domain: string, verificationUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email - outrankllm</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" style="max-width: 480px; background-color: #141414; border: 1px solid #262626; border-radius: 8px;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #262626;">
              <div style="font-family: 'Courier New', monospace; font-size: 24px; font-weight: 500; color: #fafafa;">
                outrank<span style="color: #22c55e;">llm</span>
              </div>
              <div style="font-family: 'Courier New', monospace; font-size: 11px; color: #8a8a8a; margin-top: 4px; letter-spacing: 0.1em;">
                GEO FOR VIBE CODERS
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 500; color: #fafafa; line-height: 1.4;">
                Your AI visibility report is almost ready
              </h1>

              <p style="margin: 0 0 24px; font-size: 14px; color: #d4d4d4; line-height: 1.6;">
                Click the button below to verify your email and view your report for <strong style="color: #fafafa;">${domain}</strong>
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${verificationUrl}"
                       style="display: inline-block; padding: 14px 32px; background-color: #22c55e; color: #0a0a0a; font-family: 'Courier New', monospace; font-size: 14px; font-weight: 500; text-decoration: none; border-radius: 4px;">
                      Verify &amp; View Report →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- What's included -->
              <div style="background-color: #1a1a1a; border: 1px solid #262626; border-radius: 6px; padding: 20px;">
                <div style="font-family: 'Courier New', monospace; font-size: 11px; color: #8a8a8a; letter-spacing: 0.1em; margin-bottom: 12px;">
                  WHAT'S IN YOUR REPORT
                </div>
                <ul style="margin: 0; padding: 0 0 0 16px; color: #d4d4d4; font-size: 13px; line-height: 1.8;">
                  <li>AI Visibility Score across ChatGPT, Claude &amp; Gemini</li>
                  <li>Top competitors mentioned by AI</li>
                  <li>Sample AI responses about your business</li>
                  <li>Generated questions used to test visibility</li>
                </ul>
              </div>

              <!-- Expiry notice -->
              <p style="margin: 24px 0 0; font-size: 12px; color: #8a8a8a; text-align: center;">
                This link expires in 24 hours
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #262626; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #525252;">
                You're receiving this because you requested an AI visibility report.<br>
                If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>

        <!-- Bottom link -->
        <p style="margin: 24px 0 0; font-size: 11px; color: #525252;">
          <a href="${APP_URL}" style="color: #525252; text-decoration: none;">outrankllm.io</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function generateVerificationEmailText(domain: string, verificationUrl: string): string {
  return `
outrankllm - GEO for Vibe Coders

Your AI visibility report is almost ready

Click the link below to verify your email and view your report for ${domain}:

${verificationUrl}

What's in your report:
- AI Visibility Score across ChatGPT, Claude & Gemini
- Top competitors mentioned by AI
- Sample AI responses about your business
- Generated questions used to test visibility

This link expires in 24 hours.

---
You're receiving this because you requested an AI visibility report.
If you didn't request this, you can safely ignore this email.

outrankllm.io
  `.trim();
}

function generateReportReadyEmailHtml(domain: string, reportUrl: string, score: number): string {
  const scoreColor = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your AI Visibility Report - outrankllm</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" style="max-width: 480px; background-color: #141414; border: 1px solid #262626; border-radius: 8px;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #262626;">
              <div style="font-family: 'Courier New', monospace; font-size: 24px; font-weight: 500; color: #fafafa;">
                outrank<span style="color: #22c55e;">llm</span>
              </div>
            </td>
          </tr>

          <!-- Score display -->
          <tr>
            <td style="padding: 32px; text-align: center;">
              <div style="margin-bottom: 16px;">
                <span style="font-size: 48px; font-weight: 600; color: ${scoreColor};">${score}</span>
                <span style="font-size: 24px; color: #8a8a8a;">/100</span>
              </div>
              <div style="font-family: 'Courier New', monospace; font-size: 12px; color: #8a8a8a; letter-spacing: 0.1em;">
                AI VISIBILITY SCORE
              </div>
              <p style="margin: 16px 0 0; font-size: 14px; color: #d4d4d4;">
                for <strong style="color: #fafafa;">${domain}</strong>
              </p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 0 32px 32px; text-align: center;">
              <a href="${reportUrl}"
                 style="display: inline-block; padding: 14px 32px; background-color: #22c55e; color: #0a0a0a; font-family: 'Courier New', monospace; font-size: 14px; font-weight: 500; text-decoration: none; border-radius: 4px;">
                View Full Report →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #262626; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #525252;">
                Questions? Reply to this email or visit outrankllm.io
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function generateReportReadyEmailText(domain: string, reportUrl: string, score: number): string {
  return `
outrankllm - Your AI Visibility Report

Your AI Visibility Score: ${score}/100
Domain: ${domain}

View your full report:
${reportUrl}

Your report includes:
- Breakdown by AI platform (ChatGPT, Claude, Gemini)
- Top competitors mentioned by AI
- Sample AI responses
- Recommendations for improvement

---
outrankllm.io
  `.trim();
}
