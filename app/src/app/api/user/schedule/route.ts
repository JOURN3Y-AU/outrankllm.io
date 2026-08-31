import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

// Validation schema for schedule update
const ScheduleSchema = z.object({
  scan_schedule_day: z.number().int().min(0).max(6),
  scan_schedule_hour: z.number().int().min(0).max(23),
  scan_timezone: z.string().min(1).max(100),
})

/**
 * Account-level scan schedule.
 *
 * Scans are dispatched from `domain_subscriptions`, one schedule per domain,
 * set per domain in the dashboard. This endpoint holds the account default and
 * writes through to every active subscription, so a change here cannot report
 * success while leaving the scan times untouched.
 */

// GET: Fetch current schedule
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    const { data: lead, error } = await supabase
      .from('leads')
      .select('scan_schedule_day, scan_schedule_hour, scan_timezone')
      .eq('id', session.lead_id)
      .single()

    if (error || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    return NextResponse.json({
      scan_schedule_day: lead.scan_schedule_day ?? 1,
      scan_schedule_hour: lead.scan_schedule_hour ?? 9,
      scan_timezone: lead.scan_timezone ?? 'Australia/Sydney',
    })
  } catch (error) {
    console.error('Error fetching schedule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: Update schedule
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only subscribers can set schedules
    if (session.tier === 'free') {
      return NextResponse.json(
        { error: 'Schedule settings are only available for subscribers' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const result = ScheduleSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { scan_schedule_day, scan_schedule_hour, scan_timezone } = result.data

    // Validate timezone is a valid IANA timezone
    try {
      Intl.DateTimeFormat('en-US', { timeZone: scan_timezone })
    } catch {
      return NextResponse.json(
        { error: 'Invalid timezone' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // The account-level default, applied to domains added later.
    const { error } = await supabase
      .from('leads')
      .update({
        scan_schedule_day,
        scan_schedule_hour,
        scan_timezone,
      })
      .eq('id', session.lead_id)

    if (error) {
      console.error('Error updating schedule:', error)
      return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 })
    }

    // hourly-scan-dispatcher reads domain_subscriptions and never looks at the
    // lead row, so writing only the lead row returns success and changes
    // nothing. Apply the schedule to the subscriptions that actually drive
    // scans, and report how many moved.
    const { data: updatedSubscriptions, error: subscriptionError } = await supabase
      .from('domain_subscriptions')
      .update({
        scan_schedule_day,
        scan_schedule_hour,
        scan_timezone,
      })
      .eq('lead_id', session.lead_id)
      .eq('status', 'active')
      .select('id')

    if (subscriptionError) {
      console.error('Error updating domain subscription schedules:', subscriptionError)
      return NextResponse.json(
        { error: 'Failed to update schedule' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      scan_schedule_day,
      scan_schedule_hour,
      scan_timezone,
      domains_updated: updatedSubscriptions?.length ?? 0,
    })
  } catch (error) {
    console.error('Error updating schedule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
