import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import {
  getSubscriptionById,
  updateDomainSubscription,
  getReportsForSubscription,
} from '@/lib/subscriptions'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/subscriptions/[id]
 * Get a single subscription with its report history
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const subscription = await getSubscriptionById(id)

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // Verify ownership
    if (subscription.lead_id !== session.lead_id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Get report history
    const reports = await getReportsForSubscription(id)

    return NextResponse.json({
      subscription,
      reports,
    })
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Validation schema for updating a subscription
const UpdateSubscriptionSchema = z.object({
  scan_schedule_day: z.number().int().min(0).max(6).optional(),
  scan_schedule_hour: z.number().int().min(0).max(23).optional(),
  scan_timezone: z.string().min(1).max(100).optional(),
})

/**
 * PATCH /api/subscriptions/[id]
 * Update a subscription (schedule settings)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const subscription = await getSubscriptionById(id)

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // Verify ownership
    if (subscription.lead_id !== session.lead_id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Only active subscriptions can be updated
    if (subscription.status !== 'active') {
      return NextResponse.json(
        { error: 'Only active subscriptions can be updated' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const result = UpdateSubscriptionSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { scan_schedule_day, scan_schedule_hour, scan_timezone } = result.data

    // Validate timezone if provided
    if (scan_timezone) {
      try {
        Intl.DateTimeFormat('en-US', { timeZone: scan_timezone })
      } catch {
        return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 })
      }
    }

    const updated = await updateDomainSubscription(id, {
      ...(scan_schedule_day !== undefined && { scan_schedule_day }),
      ...(scan_schedule_hour !== undefined && { scan_schedule_hour }),
      ...(scan_timezone !== undefined && { scan_timezone }),
    })

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
    }

    return NextResponse.json({ subscription: updated })
  } catch (error) {
    console.error('Error updating subscription:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
