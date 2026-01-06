'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Nav() {
  const pathname = usePathname()

  const isActive = (path: string) => pathname === path

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 py-4 bg-[var(--bg)]/80 backdrop-blur-sm border-b border-[var(--border-subtle)]" style={{ paddingLeft: '32px', paddingRight: '32px' }}>
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="font-mono text-lg font-medium hover:opacity-80 transition-opacity">
          outrank<span className="text-[var(--green)]">llm</span>
        </Link>

        {/* Nav Links */}
        <div className="flex items-center gap-8">
          <Link
            href="/learn"
            className={`font-mono text-sm transition-colors ${
              isActive('/learn')
                ? 'text-[var(--text)]'
                : 'text-[var(--text-dim)] hover:text-[var(--text-mid)]'
            }`}
          >
            Learn
          </Link>
          <Link
            href="/pricing"
            className={`font-mono text-sm transition-colors ${
              isActive('/pricing')
                ? 'text-[var(--text)]'
                : 'text-[var(--text-dim)] hover:text-[var(--text-mid)]'
            }`}
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="font-mono text-sm px-4 py-2 border border-[var(--border)] hover:border-[var(--green)] text-[var(--text-mid)] hover:text-[var(--text)] transition-colors"
          >
            Login
          </Link>
        </div>
      </div>
    </nav>
  )
}
