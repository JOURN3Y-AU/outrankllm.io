import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { inngest } from '@/inngest/client'
import crypto from 'crypto'

// Validation schema
const ScanRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  domain: z.string().min(3, 'Domain must be at least 3 characters'),
  agreedToTerms: z.boolean().refine(val => val === true, {
    message: 'You must agree to the Terms & Conditions',
  }),
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

    const { email, domain, agreedToTerms } = result.data

    // Normalize email to lowercase for consistent matching
    const normalizedEmail = email.toLowerCase().trim()

    // Clean domain
    let cleanDomain = domain.toLowerCase().trim()
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '')
    cleanDomain = cleanDomain.replace(/^www\./, '')
    cleanDomain = cleanDomain.replace(/\/.*$/, '')

    // Get Supabase client
    const supabase = createServiceClient()

    // Check if this email already has a completed scan (free report limit)
    // Use ilike for case-insensitive matching
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id, tier')
      .ilike('email', normalizedEmail)
      .limit(1)
      .single()

    if (existingLead) {
      // Check if they're a paid subscriber (subscribers can run new scans based on tier)
      const isAgency = existingLead.tier === 'agency'
      const isFree = existingLead.tier === 'free'

      if (isFree) {
        // Free users: check for any in-progress scan first
        const { data: inProgressRun } = await supabase
          .from('scan_runs')
          .select('id, status, created_at')
          .eq('lead_id', existingLead.id)
          .not('status', 'in', '("complete","failed")')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (inProgressRun) {
          // User already has a scan in progress
          return NextResponse.json({
            success: false,
            scanInProgress: true,
            scanId: inProgressRun.id,
            message: 'You already have a scan in progress. Please wait for it to complete.',
          })
        }

        // Free users: check for any completed scan
        const { data: existingRun } = await supabase
          .from('scan_runs')
          .select(`
            id,
            created_at,
            reports (url_token)
          `)
          .eq('lead_id', existingLead.id)
          .eq('status', 'complete')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (existingRun?.reports) {
          // Handle both array and single object cases
          const reportData = Array.isArray(existingRun.reports)
            ? existingRun.reports[0]
            : existingRun.reports as { url_token: string }

          if (reportData?.url_token) {
            // User already has a free report - return existing report with locked flag
            return NextResponse.json({
              success: false,
              alreadyScanned: true,
              reportToken: reportData.url_token,
              scannedAt: existingRun.created_at,
              message: 'You have already used your free report. Subscribe to access your report and get weekly updates.',
            })
          }
        }
      } else if (!isAgency) {
        // Starter/Pro users: can only have one domain, show existing report
        const { data: existingRun } = await supabase
          .from('scan_runs')
          .select(`
            id,
            created_at,
            reports (url_token)
          `)
          .eq('lead_id', existingLead.id)
          .eq('status', 'complete')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (existingRun?.reports) {
          const reportData = Array.isArray(existingRun.reports)
            ? existingRun.reports[0]
            : existingRun.reports as { url_token: string }

          if (reportData?.url_token) {
            // Redirect to their existing report (not locked since they're paid)
            return NextResponse.json({
              success: false,
              alreadyScanned: true,
              reportToken: reportData.url_token,
              scannedAt: existingRun.created_at,
              isSubscriber: true,
              message: 'You already have a tracked domain. View your latest report.',
            })
          }
        }
      }
      // Agency tier: allow multiple domains, fall through to create new scan
    }

    // Upsert lead record (use normalized email for consistency)
    // Record terms acceptance timestamp when user agrees
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .upsert(
        {
          email: normalizedEmail,
          domain: cleanDomain,
          terms_accepted_at: agreedToTerms ? new Date().toISOString() : null,
        },
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

    // Check if there's an active domain subscription for this lead+domain
    // This ensures proper data isolation for multi-domain subscribers
    let domainSubscriptionId: string | null = null
    const { data: domainSub } = await supabase
      .from('domain_subscriptions')
      .select('id')
      .eq('lead_id', lead.id)
      .eq('domain', cleanDomain)
      .eq('status', 'active')
      .single()

    if (domainSub) {
      domainSubscriptionId = domainSub.id
    }

    // Create scan run
    const { data: scanRun, error: scanError } = await supabase
      .from('scan_runs')
      .insert({
        lead_id: lead.id,
        domain_subscription_id: domainSubscriptionId,
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
        email: normalizedEmail,
        expires_at: expiresAt.toISOString()
      })

    if (tokenError) {
      console.error('Error creating verification token:', tokenError)
      // Continue anyway - we can still process the scan
    }

    // Trigger background processing via Inngest
    // Inngest handles retries, monitoring, and reliable execution
    console.log('[Scan] Sending to Inngest:', {
      scanId: scanRun.id,
      domain: cleanDomain,
      leadId: lead.id,
    })

    await inngest.send({
      name: 'scan/process',
      data: {
        scanId: scanRun.id,
        domain: cleanDomain,
        email: normalizedEmail,
        verificationToken, // Pass token for email sending
        leadId: lead.id,
        domainSubscriptionId: domainSubscriptionId || undefined, // For multi-domain isolation
      },
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
