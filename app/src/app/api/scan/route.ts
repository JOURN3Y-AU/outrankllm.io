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
  homepageVariant: z.string().nullable().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Capture geo location from Vercel headers (best-guess customer location)
    const ipCountry = request.headers.get('x-vercel-ip-country')
    const ipCity = request.headers.get('x-vercel-ip-city')
    const ipRegion = request.headers.get('x-vercel-ip-country-region')
    const ipTimezone = request.headers.get('x-vercel-ip-timezone')

    // Capture referral URL from cookie (set by middleware on first visit)
    const referralUrl = request.cookies.get('referral_url')?.value || null

    // Parse and validate request body
    const body = await request.json()
    const result = ScanRequestSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { email, domain, agreedToTerms, homepageVariant } = result.data

    // Normalize email to lowercase for consistent matching
    const normalizedEmail = email.toLowerCase().trim()

    // Clean domain
    let cleanDomain = domain.toLowerCase().trim()
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '')
    cleanDomain = cleanDomain.replace(/^www\./, '')
    cleanDomain = cleanDomain.replace(/\/.*$/, '')

    // Get Supabase client
    const supabase = createServiceClient()

    // Check if this email already has a completed scan (free report limit - ONE per email)
    // Use ilike for case-insensitive matching
    // Get ALL leads for this email to check across all domains
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('id, tier, domain')
      .ilike('email', normalizedEmail)

    // Find if any lead is a paid subscriber
    const paidLead = existingLeads?.find((l: { tier: string | null }) => l.tier && l.tier !== 'free')
    const existingLead = paidLead || existingLeads?.[0]

    if (existingLead) {
      // Check if they're a paid subscriber (subscribers can run new scans based on tier)
      const isAgency = existingLead.tier === 'agency'
      const isFree = !paidLead // No paid lead found = free user

      if (isFree) {
        // Get all lead IDs for this email to check across all their domains
        const leadIds = existingLeads?.map((l: { id: string }) => l.id) || []

        // Free users: check for any in-progress scan FOR THIS DOMAIN first
        const { data: inProgressRun } = await supabase
          .from('scan_runs')
          .select('id, status, created_at')
          .in('lead_id', leadIds)
          .eq('domain', cleanDomain)
          .not('status', 'in', '("complete","failed")')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (inProgressRun) {
          // User already has a scan in progress for this domain
          return NextResponse.json({
            success: false,
            scanInProgress: true,
            scanId: inProgressRun.id,
            message: 'You already have a scan in progress for this domain. Please wait for it to complete.',
          })
        }

        // Free users: check for ANY completed scan across ALL domains for this email
        // This enforces "one free report per email address"
        // Note: Multiple different emails CAN scan the same domain - this only restricts per-email
        const { data: existingRun } = await supabase
          .from('scan_runs')
          .select(`
            id,
            domain,
            created_at,
            reports (url_token)
          `)
          .in('lead_id', leadIds)
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
            // Check if the free report has expired (7 days)
            const createdAt = new Date(existingRun.created_at)
            const expiresAt = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000)
            const isExpired = new Date() > expiresAt

            // Check if this is the same domain or a different domain
            const isSameDomain = existingRun.domain === cleanDomain

            if (isSameDomain) {
              // User already has a free report for this exact domain - return existing report
              return NextResponse.json({
                success: false,
                alreadyScanned: true,
                reportToken: reportData.url_token,
                scannedAt: existingRun.created_at,
                isExpired,
                message: isExpired
                  ? 'Your free report has expired. Subscribe to unlock it and get weekly updates.'
                  : 'You have already used your free report for this domain. Subscribe to access your report and get weekly updates.',
              })
            } else {
              // User trying to scan a DIFFERENT domain - they've already used their one free report
              return NextResponse.json({
                success: false,
                freeReportUsed: true,
                existingDomain: existingRun.domain,
                reportToken: reportData.url_token,
                scannedAt: existingRun.created_at,
                isExpired,
                message: isExpired
                  ? `Your free report for ${existingRun.domain} has expired. Subscribe to unlock it and add more domains.`
                  : `You've already used your free report for ${existingRun.domain}. Subscribe to monitor multiple domains.`,
              })
            }
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
    // Only include geo fields if we have values (won't overwrite existing with null)
    const upsertData: Record<string, unknown> = {
      email: normalizedEmail,
      domain: cleanDomain,
      terms_accepted_at: agreedToTerms ? new Date().toISOString() : null,
    }
    if (ipCountry) upsertData.ip_country = ipCountry
    if (ipCity) upsertData.ip_city = ipCity
    if (ipRegion) upsertData.ip_region = ipRegion
    if (ipTimezone) upsertData.ip_timezone = ipTimezone
    if (homepageVariant) upsertData.homepage_variant = homepageVariant
    if (referralUrl) upsertData.referral_url = referralUrl

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .upsert(upsertData, { onConflict: 'email,domain', ignoreDuplicates: false })
      .select('id, email_verified')
      .single()

    if (leadError) {
      console.error('Error creating lead:', leadError)
      return NextResponse.json(
        { error: 'Failed to create lead record' },
        { status: 500 }
      )
    }

    // Check if there's a domain subscription for this lead+domain
    // Include 'incomplete' status to handle scans started during checkout flow
    // This ensures proper data isolation for multi-domain subscribers
    let domainSubscriptionId: string | null = null
    const { data: domainSub } = await supabase
      .from('domain_subscriptions')
      .select('id')
      .eq('lead_id', lead.id)
      .eq('domain', cleanDomain)
      .in('status', ['active', 'incomplete', 'past_due', 'trialing'])  // CRITICAL: Include incomplete
      .single()

    if (domainSub) {
      domainSubscriptionId = domainSub.id
    }

    // Create scan run with domain for multi-domain isolation
    const { data: scanRun, error: scanError } = await supabase
      .from('scan_runs')
      .insert({
        lead_id: lead.id,
        domain: cleanDomain,  // CRITICAL: Store domain for multi-domain isolation
        domain_subscription_id: domainSubscriptionId,
        status: 'pending',
        progress: 0,
        trigger_type: 'initial',
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
    expiresAt.setDate(expiresAt.getDate() + 10) // 10 day expiry

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
