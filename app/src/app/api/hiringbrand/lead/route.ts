/**
 * HiringBrand.io Lead Capture API
 * POST — public endpoint (no auth required)
 * Saves lead to hb_leads table and sends notification email
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const SALES_EMAIL = process.env.HB_SALES_EMAIL || 'kevin@outrankllm.io'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, company, domain, phone, message, utm_source, utm_medium, utm_campaign } = body

    // Validate required fields
    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      )
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Insert lead
    const { error: insertError } = await supabase.from('hb_leads').insert({
      name,
      email,
      company: company || null,
      domain: domain || null,
      phone: phone || null,
      message: message || null,
      source: 'landing_page',
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
    })

    if (insertError) {
      console.error('[HB Lead] Insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to save lead' },
        { status: 500 }
      )
    }

    // Send notification email to sales team
    try {
      await resend.emails.send({
        from: 'HiringBrand <noreply@hiringbrand.io>',
        to: SALES_EMAIL,
        subject: `New HiringBrand lead: ${company || name}`,
        html: `
          <div style="font-family: 'Outfit', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #fff; border-radius: 12px;">
            <h2 style="color: #1E293B; margin: 0 0 16px;">New Lead from HiringBrand.io</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #94A3B8; width: 100px;">Name</td><td style="padding: 8px 0; color: #1E293B; font-weight: 500;">${name}</td></tr>
              <tr><td style="padding: 8px 0; color: #94A3B8;">Email</td><td style="padding: 8px 0; color: #1E293B; font-weight: 500;">${email}</td></tr>
              ${company ? `<tr><td style="padding: 8px 0; color: #94A3B8;">Company</td><td style="padding: 8px 0; color: #1E293B; font-weight: 500;">${company}</td></tr>` : ''}
              ${domain ? `<tr><td style="padding: 8px 0; color: #94A3B8;">Domain</td><td style="padding: 8px 0; color: #1E293B; font-weight: 500;">${domain}</td></tr>` : ''}
              ${phone ? `<tr><td style="padding: 8px 0; color: #94A3B8;">Phone</td><td style="padding: 8px 0; color: #1E293B; font-weight: 500;">${phone}</td></tr>` : ''}
              ${message ? `<tr><td style="padding: 8px 0; color: #94A3B8;">Message</td><td style="padding: 8px 0; color: #1E293B; font-weight: 500;">${message}</td></tr>` : ''}
            </table>
            ${utm_source ? `<p style="margin-top: 16px; font-size: 12px; color: #94A3B8;">Source: ${utm_source}${utm_medium ? ` / ${utm_medium}` : ''}${utm_campaign ? ` / ${utm_campaign}` : ''}</p>` : ''}
          </div>
        `,
        text: `New HiringBrand lead:\n\nName: ${name}\nEmail: ${email}${company ? `\nCompany: ${company}` : ''}${domain ? `\nDomain: ${domain}` : ''}${phone ? `\nPhone: ${phone}` : ''}${message ? `\nMessage: ${message}` : ''}`,
      })
    } catch (emailErr) {
      // Don't fail the request if email fails — lead is already saved
      console.error('[HB Lead] Email notification failed:', emailErr)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[HB Lead] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
