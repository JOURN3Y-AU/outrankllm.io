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

/**
 * When the weekly digest email goes out, in the client's local timezone.
 * Day numbering matches `getLocalTime` in the dispatcher: 0 = Sunday.
 */
export const DIGEST_DAY = 1
export const DIGEST_HOUR = 9

const HOURS_PER_WEEK = 168

export interface ScanSlot {
  day: number
  hour: number
  timezone: string
}

/**
 * Candidate slots in preference order, walking backwards from the digest hour.
 *
 * A scan can run in any of the week's 168 hours, because no email fires when it
 * finishes — the Monday digest reports whatever data is current. The order is
 * what makes that useful: the first candidate is the hour before the digest, so
 * early slots hold the freshest data. At thirteen domains every scan lands
 * overnight before Monday's email. At a hundred the oldest is four days, which
 * is still within a weekly refresh.
 *
 * The digest hour itself is never a candidate. A scan running then races the
 * email that reports it.
 */
export function candidateSlots(): ScanSlot[] {
  const digestOffset = DIGEST_DAY * 24 + DIGEST_HOUR
  const slots: ScanSlot[] = []

  for (let hoursBefore = 1; hoursBefore < HOURS_PER_WEEK; hoursBefore++) {
    const offset = (digestOffset - hoursBefore + HOURS_PER_WEEK) % HOURS_PER_WEEK
    slots.push({
      day: Math.floor(offset / 24),
      hour: offset % 24,
      timezone: DEFAULT_SCAN_TIMEZONE,
    })
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
    // A paused subscription does not scan, so its slot is free to reuse. Left
    // in, the internal and demo domains would reserve hours nothing runs in.
    .eq('scan_paused', false)

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

  return pickEmptiestSlot(candidates, occupancy)
}

function pickEmptiestSlot(candidates: ScanSlot[], occupancy: Map<string, number>): ScanSlot {
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
