'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, logout } from '@/lib/auth-client'
import { User, LogOut, LayoutDashboard, Menu, X, HelpCircle, Bug, MessageSquare, Lock } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { FeedbackModal } from '@/components/feedback/FeedbackModal'
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal'

type FeedbackType = 'bug' | 'feature' | 'feedback' | 'other'

export function Nav() {
  const pathname = usePathname()
  const { session, loading } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('feedback')
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  const isActive = (path: string) => pathname === path

  const handleLogout = async () => {
    setMenuOpen(false)
    setMobileMenuOpen(false)
    await logout()
    // Force a full page reload to clear all client-side state
    window.location.href = '/'
  }

  const openFeedbackModal = (type: FeedbackType) => {
    setFeedbackType(type)
    setFeedbackModalOpen(true)
    setMobileMenuOpen(false)
  }

  const openChangePassword = () => {
    setChangePasswordOpen(true)
    setMenuOpen(false)
    setMobileMenuOpen(false)
  }

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 py-4 bg-[var(--bg)]/80 backdrop-blur-sm border-b border-[var(--border-subtle)]" style={{ paddingLeft: '32px', paddingRight: '32px' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="logo-text hover:opacity-80 transition-opacity" style={{ fontSize: '1.25rem' }}>
            outrank<span className="mark">llm</span>.io
          </Link>

          {/* Desktop Nav Links - hidden on mobile */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/learn"
              className={`font-mono text-sm transition-colors ${
                isActive('/learn')
                  ? 'text-[var(--text)]'
                  : 'text-[var(--text-mid)] hover:text-[var(--text)]'
              }`}
            >
              Learn
            </Link>
            <Link
              href="/pricing"
              className={`font-mono text-sm transition-colors ${
                isActive('/pricing')
                  ? 'text-[var(--text)]'
                  : 'text-[var(--text-mid)] hover:text-[var(--text)]'
              }`}
            >
              Pricing
            </Link>

            {/* Desktop Help Menu - inline dropdown */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(prev => menuRef.current ? !prev : prev)}
                className="flex items-center gap-1 text-[var(--text-mid)] hover:text-[var(--text)] transition-colors"
                style={{ padding: '8px' }}
                aria-label="Help menu"
              >
                <HelpCircle size={18} />
              </button>
            </div>

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
                        onClick={openChangePassword}
                        className="w-full flex items-center gap-3 text-sm text-[var(--text-mid)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
                        style={{ padding: '10px 16px' }}
                      >
                        <Lock className="w-4 h-4" />
                        Change Password
                      </button>

                      {/* Help options in account dropdown */}
                      <button
                        onClick={() => openFeedbackModal('bug')}
                        className="w-full flex items-center gap-3 text-sm text-[var(--text-mid)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
                        style={{ padding: '10px 16px' }}
                      >
                        <Bug className="w-4 h-4" />
                        Report an Issue
                      </button>

                      <button
                        onClick={() => openFeedbackModal('feedback')}
                        className="w-full flex items-center gap-3 text-sm text-[var(--text-mid)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
                        style={{ padding: '10px 16px' }}
                      >
                        <MessageSquare className="w-4 h-4" />
                        Give Feedback
                      </button>

                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 text-sm text-[var(--text-mid)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors border-t border-[var(--border)]"
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

          {/* Mobile Hamburger Button - visible on mobile only */}
          <div className="md:hidden" ref={mobileMenuRef}>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-[var(--text-mid)] hover:text-[var(--text)] transition-colors"
              style={{ padding: '8px' }}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Mobile Dropdown Menu */}
            {mobileMenuOpen && (
              <div
                className="absolute right-0 bg-[var(--surface)] border border-[var(--border)] shadow-lg"
                style={{ top: '100%', marginTop: '8px', marginRight: '16px', minWidth: '240px' }}
              >
                {/* Navigation Links */}
                <div className="border-b border-[var(--border)]" style={{ padding: '8px 0' }}>
                  <Link
                    href="/learn"
                    className={`block font-mono text-sm transition-colors ${
                      isActive('/learn')
                        ? 'text-[var(--text)] bg-[var(--surface-hover)]'
                        : 'text-[var(--text-mid)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]'
                    }`}
                    style={{ padding: '12px 16px' }}
                  >
                    Learn
                  </Link>
                  <Link
                    href="/pricing"
                    className={`block font-mono text-sm transition-colors ${
                      isActive('/pricing')
                        ? 'text-[var(--text)] bg-[var(--surface-hover)]'
                        : 'text-[var(--text-mid)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]'
                    }`}
                    style={{ padding: '12px 16px' }}
                  >
                    Pricing
                  </Link>
                </div>

                {/* Help Section */}
                <div className="border-b border-[var(--border)]" style={{ padding: '8px 0' }}>
                  <div className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider" style={{ padding: '8px 16px 4px' }}>
                    Help
                  </div>
                  <button
                    onClick={() => openFeedbackModal('bug')}
                    className="w-full flex items-center gap-3 text-sm text-[var(--text-mid)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
                    style={{ padding: '12px 16px' }}
                  >
                    <Bug size={16} className="text-[var(--red)]" />
                    Report an Issue
                  </button>
                  <button
                    onClick={() => openFeedbackModal('feedback')}
                    className="w-full flex items-center gap-3 text-sm text-[var(--text-mid)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
                    style={{ padding: '12px 16px' }}
                  >
                    <MessageSquare size={16} className="text-[var(--green)]" />
                    Give Feedback
                  </button>
                </div>

                {/* Auth Section */}
                <div style={{ padding: '8px 0' }}>
                  {loading ? null : session ? (
                    <>
                      <div style={{ padding: '8px 16px 12px' }}>
                        <div className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider" style={{ marginBottom: '4px' }}>
                          Signed in as
                        </div>
                        <div className="text-sm text-[var(--text)] truncate">
                          {session.email}
                        </div>
                      </div>
                      <Link
                        href="/dashboard"
                        className="flex items-center gap-3 text-sm text-[var(--text-mid)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
                        style={{ padding: '12px 16px' }}
                      >
                        <LayoutDashboard size={16} />
                        Dashboard
                      </Link>
                      <button
                        onClick={openChangePassword}
                        className="w-full flex items-center gap-3 text-sm text-[var(--text-mid)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
                        style={{ padding: '12px 16px' }}
                      >
                        <Lock size={16} />
                        Change Password
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 text-sm text-[var(--text-mid)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
                        style={{ padding: '12px 16px' }}
                      >
                        <LogOut size={16} />
                        Sign out
                      </button>
                    </>
                  ) : (
                    <Link
                      href="/login"
                      className="flex items-center gap-3 font-mono text-sm text-[var(--text-mid)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
                      style={{ padding: '12px 16px' }}
                    >
                      <User size={16} />
                      Login
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        initialType={feedbackType}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </>
  )
}
