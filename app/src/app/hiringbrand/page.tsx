'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2,
  Heart,
  Eye,
  Target,
  ArrowRight,
  CheckCircle2,
  Globe,
  BarChart3,
  Users,
  Zap,
  TrendingUp,
  MessageSquare,
} from 'lucide-react'

const hbStyles = {
  '--hb-teal': '#4ABDAC',
  '--hb-teal-deep': '#2D8A7C',
  '--hb-teal-light': '#E8F7F5',
  '--hb-coral': '#FC4A1A',
  '--hb-coral-light': '#FFF0EC',
  '--hb-gold': '#F7B733',
  '--hb-slate': '#1E293B',
  '--hb-slate-mid': '#475569',
  '--hb-slate-light': '#94A3B8',
  '--hb-surface': '#FFFFFF',
  '--hb-surface-dim': '#F1F5F9',
} as React.CSSProperties

function LeadForm() {
  const searchParams = useSearchParams()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [utmSource, setUtmSource] = useState<string | null>(null)
  const [utmMedium, setUtmMedium] = useState<string | null>(null)
  const [utmCampaign, setUtmCampaign] = useState<string | null>(null)

  useEffect(() => {
    setUtmSource(searchParams.get('utm_source'))
    setUtmMedium(searchParams.get('utm_medium'))
    setUtmCampaign(searchParams.get('utm_campaign'))
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/hiringbrand/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          company: company || undefined,
          domain: domain ? domain.replace(/^https?:\/\//, '').replace(/^www\./, '') : undefined,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--hb-teal-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <CheckCircle2 size={28} style={{ color: 'var(--hb-teal)' }} />
        </div>
        <h3
          style={{
            fontSize: '22px',
            fontWeight: 600,
            color: 'var(--hb-slate)',
            marginBottom: '8px',
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          Thanks, {name.split(' ')[0]}!
        </h3>
        <p style={{ fontSize: '15px', color: 'var(--hb-slate-mid)', lineHeight: 1.6 }}>
          We&apos;ll be in touch within 24 hours to discuss your employer brand report.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '20px',
            borderRadius: '8px',
            background: 'var(--hb-coral-light)',
            color: 'var(--hb-coral)',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <label
          htmlFor="name"
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--hb-slate-light)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '8px',
          }}
        >
          Your Name *
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Smith"
          required
          style={{
            width: '100%',
            padding: '14px 16px',
            fontSize: '15px',
            border: '1.5px solid var(--hb-surface-dim)',
            borderRadius: '10px',
            background: 'white',
            color: 'var(--hb-slate)',
            outline: 'none',
            transition: 'border-color 0.2s',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--hb-teal)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--hb-surface-dim)')}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label
          htmlFor="email"
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--hb-slate-light)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '8px',
          }}
        >
          Work Email *
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane@company.com"
          required
          style={{
            width: '100%',
            padding: '14px 16px',
            fontSize: '15px',
            border: '1.5px solid var(--hb-surface-dim)',
            borderRadius: '10px',
            background: 'white',
            color: 'var(--hb-slate)',
            outline: 'none',
            transition: 'border-color 0.2s',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--hb-teal)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--hb-surface-dim)')}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label
          htmlFor="company"
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--hb-slate-light)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '8px',
          }}
        >
          Company
        </label>
        <input
          id="company"
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Acme Corp"
          style={{
            width: '100%',
            padding: '14px 16px',
            fontSize: '15px',
            border: '1.5px solid var(--hb-surface-dim)',
            borderRadius: '10px',
            background: 'white',
            color: 'var(--hb-slate)',
            outline: 'none',
            transition: 'border-color 0.2s',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--hb-teal)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--hb-surface-dim)')}
        />
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label
          htmlFor="domain"
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--hb-slate-light)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '8px',
          }}
        >
          Company Domain
        </label>
        <div style={{ position: 'relative' }}>
          <Globe
            size={18}
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--hb-slate-light)',
            }}
          />
          <input
            id="domain"
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="acme.com"
            style={{
              width: '100%',
              padding: '14px 16px 14px 44px',
              fontSize: '15px',
              border: '1.5px solid var(--hb-surface-dim)',
              borderRadius: '10px',
              background: 'white',
              color: 'var(--hb-slate)',
              outline: 'none',
              transition: 'border-color 0.2s',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--hb-teal)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--hb-surface-dim)')}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%',
          padding: '16px',
          fontSize: '16px',
          fontWeight: 600,
          background: loading ? 'var(--hb-slate-light)' : 'var(--hb-coral)',
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'transform 0.1s, box-shadow 0.2s',
          opacity: loading ? 0.7 : 1,
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(252, 74, 26, 0.3)'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        {loading ? (
          <>
            <Loader2 size={18} style={{ animation: 'hb-spin 1s linear infinite' }} />
            Submitting...
          </>
        ) : (
          <>
            Request Your Free Report
            <ArrowRight size={18} />
          </>
        )}
      </button>
    </form>
  )
}

const PILLARS = [
  {
    icon: Heart,
    title: 'Desirability',
    description: 'How positively AI describes your company as an employer',
    color: '#FC4A1A',
    bg: '#FFF0EC',
  },
  {
    icon: Eye,
    title: 'AI Awareness',
    description: 'How much AI platforms actually know about your employer brand',
    color: '#4ABDAC',
    bg: '#E8F7F5',
  },
  {
    icon: Target,
    title: 'Differentiation',
    description: 'How uniquely AI positions you compared to competitors',
    color: '#F7B733',
    bg: '#FEF9EC',
  },
]

const STEPS = [
  {
    icon: MessageSquare,
    title: 'We scan AI platforms',
    description: 'ChatGPT, Claude, Gemini, and Perplexity are asked about your employer brand',
  },
  {
    icon: BarChart3,
    title: 'Analyse sentiment & awareness',
    description: 'We measure how positively, accurately, and extensively AI describes you',
  },
  {
    icon: Users,
    title: 'Benchmark against competitors',
    description: 'See how your employer brand stacks up against the companies you compete with for talent',
  },
  {
    icon: Zap,
    title: 'Deliver actionable insights',
    description: 'Get a clear action plan to improve your AI employer brand visibility',
  },
]

const STATS = [
  { value: '67%', label: 'of job seekers now use AI for career research' },
  { value: '300M+', label: 'weekly active ChatGPT users worldwide' },
  { value: '4 in 5', label: 'candidates research employers before applying' },
]

export default function HiringBrandLandingPage() {
  return (
    <div style={{ ...hbStyles, minHeight: '100vh', background: 'white' }}>
      <style>{`
        @keyframes hb-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Nav */}
      <nav
        style={{
          background: 'white',
          padding: '16px 24px',
          borderBottom: '1px solid var(--hb-surface-dim)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--hb-teal)',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            hiring<span style={{ fontWeight: 800 }}>brand</span>
            <span style={{ color: 'var(--hb-gold)' }}>.io</span>
          </span>
          <Link
            href="/hiringbrand/login"
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--hb-slate-mid)',
              textDecoration: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1.5px solid var(--hb-surface-dim)',
              transition: 'border-color 0.2s',
            }}
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{
          background: 'var(--hb-teal-light)',
          padding: '72px 24px 80px',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div
            style={{
              maxWidth: '640px',
              margin: '0 auto',
              textAlign: 'center',
              marginBottom: '48px',
            }}
          >
            <div
              style={{
                display: 'inline-block',
                padding: '6px 14px',
                borderRadius: '100px',
                background: 'rgba(74, 189, 172, 0.15)',
                color: 'var(--hb-teal-deep)',
                fontSize: '13px',
                fontWeight: 600,
                marginBottom: '24px',
                fontFamily: "'Source Sans 3', sans-serif",
              }}
            >
              AI Employer Reputation Intelligence
            </div>
            <h1
              style={{
                fontSize: '42px',
                fontWeight: 700,
                color: 'var(--hb-slate)',
                lineHeight: 1.15,
                marginBottom: '20px',
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: '-0.5px',
              }}
            >
              See how AI describes your company to{' '}
              <span style={{ color: 'var(--hb-teal)' }}>job seekers</span>
            </h1>
            <p
              style={{
                fontSize: '18px',
                color: 'var(--hb-slate-mid)',
                lineHeight: 1.6,
                fontFamily: "'Source Sans 3', sans-serif",
              }}
            >
              Platforms like ChatGPT, Claude, and Gemini are shaping how candidates perceive your
              employer brand. Find out what they&apos;re saying.
            </p>
          </div>

          {/* Lead form card */}
          <div
            style={{
              maxWidth: '480px',
              margin: '0 auto',
              background: 'white',
              borderRadius: '20px',
              padding: '36px',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
            }}
          >
            <Suspense
              fallback={
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Loader2
                    size={32}
                    style={{ color: 'var(--hb-teal)', animation: 'hb-spin 1s linear infinite' }}
                  />
                </div>
              }
            >
              <LeadForm />
            </Suspense>
          </div>
        </div>
      </section>

      {/* Three Pillar Scores */}
      <section style={{ padding: '80px 24px', background: 'white' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2
              style={{
                fontSize: '32px',
                fontWeight: 700,
                color: 'var(--hb-slate)',
                marginBottom: '12px',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Three scores that matter
            </h2>
            <p
              style={{
                fontSize: '16px',
                color: 'var(--hb-slate-mid)',
                maxWidth: '520px',
                margin: '0 auto',
                lineHeight: 1.6,
                fontFamily: "'Source Sans 3', sans-serif",
              }}
            >
              We measure your employer brand across the dimensions that influence candidate
              decisions
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '24px',
              justifyContent: 'center',
            }}
          >
            {PILLARS.map((pillar) => (
              <div
                key={pillar.title}
                style={{
                  flex: '1 1 280px',
                  maxWidth: '340px',
                  padding: '32px',
                  borderRadius: '16px',
                  border: '1px solid var(--hb-surface-dim)',
                  background: 'white',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.06)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: pillar.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '20px',
                  }}
                >
                  <pillar.icon size={24} style={{ color: pillar.color }} />
                </div>
                <h3
                  style={{
                    fontSize: '20px',
                    fontWeight: 600,
                    color: 'var(--hb-slate)',
                    marginBottom: '8px',
                    fontFamily: "'Outfit', sans-serif",
                  }}
                >
                  {pillar.title}
                </h3>
                <p
                  style={{
                    fontSize: '15px',
                    color: 'var(--hb-slate-mid)',
                    lineHeight: 1.5,
                    fontFamily: "'Source Sans 3', sans-serif",
                  }}
                >
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof stats */}
      <section style={{ padding: '72px 24px', background: 'var(--hb-slate)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: 'white',
              textAlign: 'center',
              marginBottom: '48px',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            What AI says about you <span style={{ color: 'var(--hb-teal)' }}>matters</span>
          </h2>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '32px',
              justifyContent: 'center',
            }}
          >
            {STATS.map((stat) => (
              <div
                key={stat.value}
                style={{
                  flex: '1 1 240px',
                  maxWidth: '320px',
                  textAlign: 'center',
                  padding: '24px',
                }}
              >
                <div
                  style={{
                    fontSize: '44px',
                    fontWeight: 700,
                    color: 'var(--hb-teal)',
                    marginBottom: '8px',
                    fontFamily: "'Outfit', sans-serif",
                    lineHeight: 1,
                  }}
                >
                  {stat.value}
                </div>
                <p
                  style={{
                    fontSize: '16px',
                    color: 'rgba(255, 255, 255, 0.7)',
                    lineHeight: 1.5,
                    fontFamily: "'Source Sans 3', sans-serif",
                  }}
                >
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '80px 24px', background: 'var(--hb-surface-dim)' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: '32px',
              fontWeight: 700,
              color: 'var(--hb-slate)',
              textAlign: 'center',
              marginBottom: '48px',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            How it works
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                style={{
                  display: 'flex',
                  gap: '20px',
                  alignItems: 'flex-start',
                  padding: '24px',
                  background: 'white',
                  borderRadius: '16px',
                  border: '1px solid rgba(0,0,0,0.04)',
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: 'var(--hb-teal-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    position: 'relative',
                  }}
                >
                  <span
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: 'var(--hb-teal-deep)',
                      fontFamily: "'Outfit', sans-serif",
                    }}
                  >
                    {i + 1}
                  </span>
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: '17px',
                      fontWeight: 600,
                      color: 'var(--hb-slate)',
                      marginBottom: '4px',
                      fontFamily: "'Outfit', sans-serif",
                    }}
                  >
                    {step.title}
                  </h3>
                  <p
                    style={{
                      fontSize: '15px',
                      color: 'var(--hb-slate-mid)',
                      lineHeight: 1.5,
                      fontFamily: "'Source Sans 3', sans-serif",
                    }}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div style={{ textAlign: 'center', marginTop: '48px' }}>
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault()
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '16px 32px',
                fontSize: '16px',
                fontWeight: 600,
                background: 'var(--hb-coral)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'transform 0.1s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(252, 74, 26, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              Request Your Free Report
              <TrendingUp size={18} />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: '24px',
          borderTop: '1px solid var(--hb-surface-dim)',
        }}
      >
        <div
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <span
            style={{
              fontSize: '13px',
              color: 'var(--hb-slate-light)',
              fontFamily: "'Source Sans 3', sans-serif",
            }}
          >
            &copy; {new Date().getFullYear()} HiringBrand.io
          </span>
          <Link
            href="/hiringbrand/login"
            style={{
              fontSize: '13px',
              color: 'var(--hb-slate-light)',
              textDecoration: 'none',
            }}
          >
            Sign In
          </Link>
        </div>
      </footer>
    </div>
  )
}
