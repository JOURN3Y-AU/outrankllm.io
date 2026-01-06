import { Ghost } from '@/components/ghost/Ghost'
import { FloatingPixels } from '@/components/landing/FloatingPixels'
import { Platforms, WorksWith } from '@/components/landing/Platforms'
import { EmailForm } from '@/components/landing/EmailForm'
import { Footer } from '@/components/landing/Footer'
import { Nav } from '@/components/nav/Nav'

export default function Home() {
  return (
    <>
      {/* Background layers */}
      <div className="grid-bg" />
      <FloatingPixels />
      <Nav />

      {/* Main content */}
      <main className="page relative z-10 min-h-screen flex flex-col items-center" style={{ paddingTop: '8vh' }}>
        <div className="stagger-children flex flex-col items-center">
          {/* Logo section */}
          <div className="flex flex-col items-center gap-3" style={{ marginBottom: '20px' }}>
            <Ghost size="md" />
            <div className="logo-text">
              outrank<span className="mark">llm</span>
            </div>
          </div>

          {/* Divider */}
          <div className="divider" style={{ marginBottom: '20px' }} />

          {/* Headline */}
          <h1 className="text-center" style={{ marginBottom: '12px' }}>
            Your site is invisible to <span className="em">AI</span>
          </h1>

          {/* Subhead */}
          <p className="text-[var(--text-mid)] text-[1.1rem] text-center" style={{ marginBottom: '20px' }}>
            We fix that.
          </p>

          {/* Tagline */}
          <p className="tagline max-w-[420px] text-center" style={{ marginBottom: '28px' }}>
            Turn AI blindspots into <strong className="text-[var(--text-mid)]">ready-to-ship PRDs</strong> for
            Cursor, Claude Code, and Windsurf.
          </p>

          {/* Email form */}
          <div className="w-full" style={{ maxWidth: '420px', marginBottom: '32px' }}>
            <EmailForm />
          </div>

          {/* Platform indicators */}
          <Platforms />

          {/* Works with */}
          <WorksWith />
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </>
  )
}
