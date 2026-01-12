import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { stripe } from '@/lib/stripe'
import {
  getSubscriptionById,
  updateDomainSubscription,
} from '@/lib/subscriptions'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/subscriptions/[id]/cancel
 * Cancel a domain subscription (sets cancel_at_period_end)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // Can only cancel active subscriptions
    if (subscription.status !== 'active') {
      return NextResponse.json(
        { error: 'Only active subscriptions can be canceled' },
        { status: 400 }
      )
    }

    // Already scheduled for cancellation
    if (subscription.cancel_at_period_end) {
      return NextResponse.json(
        { error: 'Subscription is already scheduled for cancellation' },
        { status: 400 }
      )
    }

    // Cancel on Stripe (at period end, not immediately)
    if (subscription.stripe_subscription_id) {
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: true,
      })
    }

    // Update local record
    const updated = await updateDomainSubscription(id, {
      cancel_at_period_end: true,
    })

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
    }

    return NextResponse.json({
      subscription: updated,
      message: `Subscription will be canceled at the end of the billing period (${updated.current_period_end})`,
    })
  } catch (error) {
    console.error('Error canceling subscription:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
