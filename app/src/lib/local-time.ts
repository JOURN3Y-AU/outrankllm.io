/**
 * Local weekday and hour for a timezone.
 *
 * Both hourly crons — the scan dispatcher and the digest dispatcher — decide
 * whether something is due by comparing a stored (day, hour) against the
 * client's local time, so they share this rather than keeping two copies that
 * could disagree about day numbering.
 */

/** Day numbering: 0 = Sunday, matching `scan_schedule_day`. */
const DAY_NUMBERS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

export function getLocalTime(utcDate: Date, timezone: string): { day: number; hour: number } {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "numeric",
      hour12: false,
    })

    const parts = formatter.formatToParts(utcDate)
    const dayPart = parts.find((p) => p.type === "weekday")?.value || "Mon"
    const hourPart = parts.find((p) => p.type === "hour")?.value || "9"

    return {
      day: DAY_NUMBERS[dayPart] ?? 1,
      // Intl renders midnight as "24" in some locales with hour12: false.
      hour: parseInt(hourPart, 10) % 24,
    }
  } catch {
    // If timezone is invalid, return Monday 9am
    console.error(`Invalid timezone: ${timezone}, using defaults`)
    return { day: 1, hour: 9 }
  }
}
