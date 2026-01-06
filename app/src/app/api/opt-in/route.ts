import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { email, optIn } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Update the lead's marketing opt-in status
    const { error } = await supabase
      .from('leads')
      .update({ marketing_opt_in: optIn })
      .eq('email', email)

    if (error) {
      console.error('Error updating opt-in:', error)
      return NextResponse.json(
        { error: 'Failed to update preference' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Opt-in API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
