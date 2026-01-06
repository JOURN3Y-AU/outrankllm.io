import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// Validation schema
const ScanRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  domain: z.string().min(3, 'Domain must be at least 3 characters'),
})

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const result = ScanRequestSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { email, domain } = result.data

    // Clean domain
    let cleanDomain = domain.toLowerCase().trim()
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '')
    cleanDomain = cleanDomain.replace(/^www\./, '')
    cleanDomain = cleanDomain.replace(/\/.*$/, '')

    // Get Supabase client
    const supabase = createServiceClient()

    // Upsert lead record
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .upsert(
        { email, domain: cleanDomain },
        { onConflict: 'email,domain', ignoreDuplicates: false }
      )
      .select('id, email_verified')
      .single()

    if (leadError) {
      console.error('Error creating lead:', leadError)
      return NextResponse.json(
        { error: 'Failed to create lead record' },
        { status: 500 }
      )
    }

    // Create scan run
    const { data: scanRun, error: scanError } = await supabase
      .from('scan_runs')
      .insert({
        lead_id: lead.id,
        status: 'pending',
        progress: 0,
      })
      .select('id')
      .single()

    if (scanError) {
      console.error('Error creating scan run:', scanError)
      return NextResponse.json(
        { error: 'Failed to create scan record' },
        { status: 500 }
      )
    }

    // Generate verification token for magic link
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // 24 hour expiry

    // Store verification token
    const { error: tokenError } = await supabase
      .from('email_verification_tokens')
      .insert({
        lead_id: lead.id,
        run_id: scanRun.id,
        token: verificationToken,
        email: email,
        expires_at: expiresAt.toISOString()
      })

    if (tokenError) {
      console.error('Error creating verification token:', tokenError)
      // Continue anyway - we can still process the scan
    }

    // Trigger background processing (fire and forget)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    fetch(`${appUrl}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scanId: scanRun.id,
        domain: cleanDomain,
        email,
        verificationToken, // Pass token for email sending
        leadId: lead.id,
      }),
    }).catch((err) => {
      console.error('Failed to trigger background processing:', err)
    })

    return NextResponse.json({
      success: true,
      scanId: scanRun.id,
      message: 'Scan initiated. Check your email for a verification link to view your report.',
    })
  } catch (error) {
    console.error('Scan API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
