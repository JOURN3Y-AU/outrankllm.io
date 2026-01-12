'use client'

import { useState, useEffect, useRef } from 'react'
import { Calendar, Clock, Globe, Check, Loader2, ChevronDown } from 'lucide-react'

const DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: formatHour(i),
}))

function formatHour(hour: number): string {
  if (hour === 0) return '12:00 AM'
  if (hour === 12) return '12:00 PM'
  if (hour < 12) return `${hour}:00 AM`
  return `${hour - 12}:00 PM`
}

// Common timezones grouped by region
const TIMEZONES = [
  { group: 'Australia/Pacific', zones: [
    { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' },
    { value: 'Australia/Melbourne', label: 'Melbourne (AEDT/AEST)' },
    { value: 'Australia/Brisbane', label: 'Brisbane (AEST)' },
    { value: 'Australia/Perth', label: 'Perth (AWST)' },
    { value: 'Australia/Adelaide', label: 'Adelaide (ACDT/ACST)' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZDT/NZST)' },
  ]},
  { group: 'Americas', zones: [
    { value: 'America/New_York', label: 'New York (EST/EDT)' },
    { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
    { value: 'America/Denver', label: 'Denver (MST/MDT)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
    { value: 'America/Toronto', label: 'Toronto (EST/EDT)' },
    { value: 'America/Vancouver', label: 'Vancouver (PST/PDT)' },
  ]},
  { group: 'Europe', zones: [
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
    { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
  ]},
  { group: 'Asia', zones: [
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Kolkata', label: 'Mumbai (IST)' },
  ]},
]

// Flatten timezones for easier lookup
const ALL_TIMEZONES = TIMEZONES.flatMap(g => g.zones)

interface DropdownProps {
  value: number | string
  onChange: (value: number | string) => void
  options: Array<{ value: number | string; label: string }>
  icon: React.ReactNode
  label: string
  grouped?: boolean
  groups?: Array<{ group: string; zones: Array<{ value: string; label: string }> }>
  compact?: boolean
}

function Dropdown({ value, onChange, options, icon, label, grouped, groups, compact }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const selectedLabel = grouped
    ? ALL_TIMEZONES.find(z => z.value === value)?.label || String(value)
    : options.find(o => o.value === value)?.label || String(value)

  return (
    <div className="relative" ref={dropdownRef}>
      {!compact && (
        <label className="flex items-center gap-2 text-sm text-[var(--text-dim)]" style={{ marginBottom: '8px' }}>
          {icon}
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] font-mono text-sm hover:border-[var(--green)] focus:border-[var(--green)] focus:outline-none transition-colors"
        style={{ padding: compact ? '8px 10px' : '10px 12px' }}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`w-4 h-4 text-[var(--text-dim)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="absolute z-50 w-full mt-1 bg-[var(--bg)] border border-[var(--border)] shadow-lg overflow-hidden"
          style={{ maxHeight: '280px', overflowY: 'auto' }}
        >
          {grouped && groups ? (
            // Grouped options (for timezones)
            groups.map((group) => (
              <div key={group.group}>
                <div
                  className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider bg-[var(--surface)]"
                  style={{ padding: '8px 12px' }}
                >
                  {group.group}
                </div>
                {group.zones.map((zone) => (
                  <button
                    key={zone.value}
                    type="button"
                    onClick={() => {
                      onChange(zone.value)
                      setIsOpen(false)
                    }}
                    className={`w-full text-left font-mono text-sm transition-colors ${
                      value === zone.value
                        ? 'bg-[var(--green)]/10 text-[var(--green)]'
                        : 'text-[var(--text)] hover:bg-[var(--surface-hover)]'
                    }`}
                    style={{ padding: '10px 12px', paddingLeft: '20px' }}
                  >
                    <span className="flex items-center justify-between">
                      {zone.label}
                      {value === zone.value && <Check className="w-4 h-4" />}
                    </span>
                  </button>
                ))}
              </div>
            ))
          ) : (
            // Simple options
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={`w-full text-left font-mono text-sm transition-colors ${
                  value === option.value
                    ? 'bg-[var(--green)]/10 text-[var(--green)]'
                    : 'text-[var(--text)] hover:bg-[var(--surface-hover)]'
                }`}
                style={{ padding: '10px 12px' }}
              >
                <span className="flex items-center justify-between">
                  {option.label}
                  {value === option.value && <Check className="w-4 h-4" />}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

interface ScheduleSettingsProps {
  subscriptionId: string
  initialDay?: number
  initialHour?: number
  initialTimezone?: string
  compact?: boolean
}

export function ScheduleSettings({
  subscriptionId,
  initialDay = 1,
  initialHour = 9,
  initialTimezone = 'Australia/Sydney',
  compact = false,
}: ScheduleSettingsProps) {
  const [day, setDay] = useState(initialDay)
  const [hour, setHour] = useState(initialHour)
  const [timezone, setTimezone] = useState(initialTimezone)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Detect browser timezone on mount
  useEffect(() => {
    if (!initialTimezone || initialTimezone === 'Australia/Sydney') {
      try {
        const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone
        // Only auto-set if it's in our list
        const isSupported = TIMEZONES.some(group =>
          group.zones.some(z => z.value === browserTz)
        )
        if (isSupported) {
          setTimezone(browserTz)
        }
      } catch {
        // Ignore - use default
      }
    }
  }, [initialTimezone])

  // Track changes
  useEffect(() => {
    setHasChanges(
      day !== initialDay ||
      hour !== initialHour ||
      timezone !== initialTimezone
    )
  }, [day, hour, timezone, initialDay, initialHour, initialTimezone])

  // Calculate next scan date
  const getNextScanDate = (): string => {
    const now = new Date()
    const nextScan = new Date()

    // Set to the target day and hour in the selected timezone
    const currentDay = now.getDay()
    let daysUntilTarget = day - currentDay
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 7
    }

    nextScan.setDate(now.getDate() + daysUntilTarget)

    try {
      return nextScan.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        timeZone: timezone,
      }) + ` at ${formatHour(hour)}`
    } catch {
      return `${DAYS[day].label} at ${formatHour(hour)}`
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const response = await fetch(`/api/subscriptions/${subscriptionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scan_schedule_day: day,
          scan_schedule_hour: hour,
          scan_timezone: timezone,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save')
      }

      setSaved(true)
      setHasChanges(false)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className={`grid gap-4 ${compact ? 'md:grid-cols-3' : 'md:grid-cols-3'}`} style={{ marginBottom: '16px' }}>
        {/* Day selector */}
        <Dropdown
          value={day}
          onChange={(v) => setDay(v as number)}
          options={DAYS}
          icon={<Calendar className="w-4 h-4" />}
          label="Day"
          compact={compact}
        />

        {/* Hour selector */}
        <Dropdown
          value={hour}
          onChange={(v) => setHour(v as number)}
          options={HOURS}
          icon={<Clock className="w-4 h-4" />}
          label="Time"
          compact={compact}
        />

        {/* Timezone selector */}
        <Dropdown
          value={timezone}
          onChange={(v) => setTimezone(v as string)}
          options={[]}
          grouped={true}
          groups={TIMEZONES}
          icon={<Globe className="w-4 h-4" />}
          label="Timezone"
          compact={compact}
        />
      </div>

      {/* Next scan preview */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-[var(--text-dim)]">
          <span className="font-medium text-[var(--text)]">Next scan:</span>{' '}
          {getNextScanDate()}
        </div>

        <div className="flex items-center gap-3">
          {error && (
            <span className="text-sm text-red-500">{error}</span>
          )}
          {saved && (
            <span className="flex items-center gap-1 text-sm text-[var(--green)]">
              <Check className="w-4 h-4" />
              Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 font-mono text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              padding: '8px 16px',
              background: hasChanges ? 'var(--green)' : 'var(--surface-hover)',
              color: hasChanges ? 'var(--bg)' : 'var(--text-dim)',
              border: '1px solid var(--border)',
            }}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
