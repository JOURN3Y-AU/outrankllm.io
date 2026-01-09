'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession, logout } from '@/lib/auth-client'
import { User, LogOut, LayoutDashboard } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const { session, loading } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const isActive = (path: string) => pathname === path

  const handleLogout = async () => {
    await logout()
    router.push('/')
    router.refresh()
  }

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

          {/* Auth section */}
          {loading ? (
            <div className="w-20 h-9" /> // Placeholder to prevent layout shift
          ) : session ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 font-mono text-sm px-4 py-2 border border-[var(--border)] hover:border-[var(--green)] text-[var(--text-mid)] hover:text-[var(--text)] transition-colors"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Account</span>
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] shadow-lg"
                  style={{ zIndex: 100, minWidth: '220px' }}
                >
                  <div className="border-b border-[var(--border)]" style={{ padding: '14px 16px' }}>
                    <div className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider" style={{ marginBottom: '6px' }}>
                      Signed in as
                    </div>
                    <div className="text-sm text-[var(--text)] truncate">
                      {session.email}
                    </div>
                  </div>

                  <div style={{ padding: '8px 0' }}>
                    <Link
                      href="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 text-sm text-[var(--text-mid)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
                      style={{ padding: '10px 16px' }}
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Dashboard
                    </Link>

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 text-sm text-[var(--text-mid)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
                      style={{ padding: '10px 16px' }}
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="font-mono text-sm px-4 py-2 border border-[var(--border)] hover:border-[var(--green)] text-[var(--text-mid)] hover:text-[var(--text)] transition-colors"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
