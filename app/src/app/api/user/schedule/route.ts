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

    return NextResponse.json({
      success: true,
      scan_schedule_day,
      scan_schedule_hour,
      scan_timezone,
    })
  } catch (error) {
    console.error('Error updating schedule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
