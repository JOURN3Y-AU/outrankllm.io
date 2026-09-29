/**
 * Weekly scan slots.
 *
 * A slot is one (day, hour) in a subscription's local timezone. Every scan due
 * in the same slot competes for the same concurrency budget, so allocation
 * spreads subscriptions across slots instead of letting them collect in one.
 *
 * Why this file exists: `scan_schedule_day` and `scan_schedule_hour` were
 * nullable with the dispatcher defaulting to Monday 09:00, and nothing set them
 * at signup. Ten of thirteen domains ended up in one slot, and every Sunday
 * batch from 2026-08-30 lost all but the last-dispatched scan to
 * `timeouts.finish` while it queued on the gate.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * How many scans one slot may hold.
 *
 * process-scan allows 12 concurrent steps across the whole function and each
 * scan holds four long query-platform steps, so three scans saturate the gate.
 */
export const MAX_SCANS_PER_SLOT = 3

export const DEFAULT_SCAN_TIMEZONE = 'Australia/Sydney'

/** Day numbering matches `getLocalTime` in the dispatcher: 0 = Sunday. */
const MONDAY = 1
const FRIDAY = 5

/** Local hours a scan may be scheduled in. */
const FIRST_HOUR = 8
const LAST_HOUR = 17

export interface ScanSlot {
  day: number
  hour: number
  timezone: string
}

/**
 * Candidate slots in preference order: Monday first, then later weekdays.
 *
 * Business hours only, because a client is emailed when their scan finishes.
 * Once the Monday digest is split from scan completion, this can open up to all
 * 168 hours of the week.
 */
export function candidateSlots(): ScanSlot[] {
  const slots: ScanSlot[] = []
  for (let day = MONDAY; day <= FRIDAY; day++) {
    for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour++) {
      slots.push({ day, hour, timezone: DEFAULT_SCAN_TIMEZONE })
    }
  }
  return slots
}

function slotKey(day: number, hour: number): string {
  return `${day}:${hour}`
}

/**
 * Pick the emptiest slot, breaking ties by preference order.
 *
 * Every candidate slot takes one subscription before any takes a second, so
 * subscriptions spread across days and hours rather than stacking.
 *
 * Occupancy is keyed on local (day, hour) and ignores timezone. Every
 * subscription currently sits in Australia/Sydney; once they span timezones this
 * has to count in UTC instead, since 09:00 in two zones is two different slots.
 */
export async function allocateScanSlot(supabase: SupabaseClient): Promise<ScanSlot> {
  const candidates = candidateSlots()

  const { data, error } = await supabase
    .from('domain_subscriptions')
    .select('scan_schedule_day, scan_schedule_hour')
    .neq('status', 'canceled')

  if (error) {
    console.error('Error reading slot occupancy, falling back to first slot:', error)
    return candidates[0]
  }

  const occupancy = new Map<string, number>()
  for (const row of data ?? []) {
    // Skip rows with no schedule rather than counting them at the dispatcher's
    // old Monday 09:00 default. They are abandoned signups that predate slot
    // allocation, and counting them would rule out a slot nothing scans in.
    if (row.scan_schedule_day === null || row.scan_schedule_hour === null) continue
    const key = slotKey(row.scan_schedule_day, row.scan_schedule_hour)
    occupancy.set(key, (occupancy.get(key) ?? 0) + 1)
  }

  let best = candidates[0]
  let bestLoad = Number.POSITIVE_INFINITY

  for (const slot of candidates) {
    const load = occupancy.get(slotKey(slot.day, slot.hour)) ?? 0
    if (load < bestLoad) {
      best = slot
      bestLoad = load
      if (bestLoad === 0) break
    }
  }

  if (bestLoad >= MAX_SCANS_PER_SLOT) {
    console.error(
      `[scan-slots] Every slot is at capacity (${MAX_SCANS_PER_SLOT} scans). ` +
        `Allocating ${best.day}:${best.hour} anyway at load ${bestLoad}. ` +
        `Widen the slot window or raise process-scan's concurrency limit.`
    )
  }

  return best
}
