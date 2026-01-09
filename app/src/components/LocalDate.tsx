'use client'

interface LocalDateProps {
  date: string
  showTime?: boolean
  className?: string
}

/**
 * Displays a date in the user's local timezone
 * Must be a client component to use browser timezone
 */
export function LocalDate({ date, showTime = true, className }: LocalDateProps) {
  const dateObj = new Date(date)

  const formattedDate = dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const formattedTime = dateObj.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return (
    <span className={className}>
      {formattedDate}
      {showTime && ` at ${formattedTime}`}
    </span>
  )
}
