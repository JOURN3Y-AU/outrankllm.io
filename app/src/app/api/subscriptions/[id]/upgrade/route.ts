import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { stripe, getPriceId, type PricingRegion } from '@/lib/stripe'
import { getSubscriptionById, updateDomainSubscription } from '@/lib/subscriptions'

interface RouteParams {
  params: Promise<{ id: string }>
}

const UpgradeSchema = z.object({
  region: z.enum(['AU', 'INTL']).optional().default('INTL'),
})

/**
 * POST /api/subscriptions/[id]/upgrade
 * Upgrade a subscription from Starter to Pro
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

    // Can only upgrade active subscriptions
    if (subscription.status !== 'active') {
      return NextResponse.json(
        { error: 'Only active subscriptions can be upgraded' },
        { status: 400 }
      )
    }

    // Can only upgrade from starter to pro
    if (subscription.tier !== 'starter') {
      return NextResponse.json(
        { error: 'This subscription is already on Pro tier' },
        { status: 400 }
      )
    }

    if (!subscription.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'Subscription has no Stripe subscription ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const result = UpgradeSchema.safeParse(body)
    const region = result.success ? result.data.region : 'INTL'

    // Get the Stripe subscription to find the current item
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id)
    const subscriptionItemId = stripeSubscription.items.data[0]?.id

    if (!subscriptionItemId) {
      return NextResponse.json(
        { error: 'Could not find subscription item' },
        { status: 500 }
      )
    }

    // Get the new price ID for Pro tier
    const newPriceId = getPriceId('pro', region as PricingRegion)

    // Update the Stripe subscription (prorates automatically)
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      items: [
        {
          id: subscriptionItemId,
          price: newPriceId,
        },
      ],
      proration_behavior: 'create_prorations',
      metadata: {
        ...stripeSubscription.metadata,
        tier: 'pro',
      },
    })

    // Update local record
    const updated = await updateDomainSubscription(id, {
      tier: 'pro',
      stripe_price_id: newPriceId,
    })

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
    }

    return NextResponse.json({
      subscription: updated,
      message: 'Subscription upgraded to Pro! Your card will be charged a prorated amount.',
    })
  } catch (error) {
    console.error('Error upgrading subscription:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
