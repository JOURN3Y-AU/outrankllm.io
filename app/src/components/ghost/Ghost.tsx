'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

interface GhostProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: { width: 40, height: 50 },
  md: { width: 64, height: 80 },
  lg: { width: 96, height: 120 },
}

export function Ghost({ className, size = 'md' }: GhostProps) {
  const dimensions = sizes[size]

  return (
    <div
      className={cn('ghost relative', className)}
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      <Image
        src="/images/ghost-eyes-open.png"
        alt="Ghost"
        fill
        className="eyes-open object-contain"
        priority
      />
      <Image
        src="/images/ghost-eyes-closed.png"
        alt="Ghost blinking"
        fill
        className="eyes-closed object-contain"
        priority
      />
    </div>
  )
}
