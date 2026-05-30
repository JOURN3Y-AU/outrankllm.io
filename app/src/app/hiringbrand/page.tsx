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
  Check,
  Tag,
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
          One of our team will be in touch shortly to walk you through HiringBrand.
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
            Book a Demo
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
    description: 'How positively AI describes an employer',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              }}
            >
              Sign In
            </Link>
            <Link
              href="/hiringbrand/signup"
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'white',
                textDecoration: 'none',
                padding: '8px 18px',
                borderRadius: '8px',
                background: 'var(--hb-coral)',
              }}
            >
              Get 2 months free
            </Link>
          </div>
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
              maxWidth: '680px',
              margin: '0 auto',
              textAlign: 'center',
              marginBottom: '40px',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '100px',
                background: 'var(--hb-gold)',
                color: 'var(--hb-slate)',
                fontSize: '14px',
                fontWeight: 700,
                marginBottom: '24px',
                fontFamily: "'Source Sans 3', sans-serif",
              }}
            >
              <Tag size={14} />
              Webinar offer: 2 months free with code{' '}
              <span style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px' }}>TORCPro</span>
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
              See how AI describes employers to{' '}
              <span style={{ color: 'var(--hb-teal)' }}>job seekers</span>
            </h1>
            <p
              style={{
                fontSize: '18px',
                color: 'var(--hb-slate-mid)',
                lineHeight: 1.6,
                marginBottom: '32px',
                fontFamily: "'Source Sans 3', sans-serif",
              }}
            >
              Platforms like ChatGPT, Claude, and Gemini are shaping how candidates perceive
              employer brands. Find out what they&apos;re saying.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link
                href="/hiringbrand/signup"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '15px 28px',
                  fontSize: '16px',
                  fontWeight: 600,
                  background: 'var(--hb-coral)',
                  color: 'white',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                Get 2 months free
                <ArrowRight size={18} />
              </Link>
              <a
                href="#demo"
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById('demo-form')?.scrollIntoView({ behavior: 'smooth' })
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '15px 28px',
                  fontSize: '16px',
                  fontWeight: 500,
                  background: 'white',
                  color: 'var(--hb-teal-deep)',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  border: '1.5px solid var(--hb-teal)',
                  fontFamily: "'Source Sans 3', sans-serif",
                }}
              >
                Book a Demo
              </a>
            </div>
          </div>

          {/* Lead form card */}
          <div
            id="demo-form"
            style={{
              maxWidth: '480px',
              margin: '0 auto',
              background: 'white',
              borderRadius: '20px',
              padding: '36px',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--hb-slate)', marginBottom: '20px', fontFamily: "'Outfit', sans-serif", textAlign: 'center' }}>
              Book a Demo
            </h3>
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
            <Link
              href="/hiringbrand/signup"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '16px 32px',
                fontSize: '16px',
                fontWeight: 600,
                background: 'var(--hb-coral)',
                color: 'white',
                borderRadius: '10px',
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
              Get 2 months free
              <TrendingUp size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: '80px 24px', background: 'white' }} id="pricing">
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--hb-slate)', marginBottom: '12px', fontFamily: "'Outfit', sans-serif" }}>
              Simple pricing
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--hb-slate-mid)', lineHeight: 1.6, fontFamily: "'Source Sans 3', sans-serif" }}>
              One plan, everything included, no surprises.
            </p>
          </div>

          {/* Pricing card */}
          <div style={{
            border: '2px solid var(--hb-teal)',
            borderRadius: '20px',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(74, 189, 172, 0.12)',
          }}>
            {/* Card header */}
            <div style={{ background: 'var(--hb-teal)', padding: '28px 36px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', fontFamily: "'Source Sans 3', sans-serif" }}>
                    Pro Plan
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span style={{ fontSize: '44px', fontWeight: 700, color: 'white', fontFamily: "'Outfit', sans-serif", lineHeight: 1 }}>A$89</span>
                    <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.8)', fontFamily: "'Source Sans 3', sans-serif" }}>/month</span>
                  </div>
                </div>
                <div style={{ background: 'var(--hb-gold)', color: 'var(--hb-slate)', fontSize: '12px', fontWeight: 700, padding: '6px 12px', borderRadius: '100px', fontFamily: "'Source Sans 3', sans-serif", whiteSpace: 'nowrap' }}>
                  2 months free — code TORCPro
                </div>
              </div>
            </div>

            {/* Card body */}
            <div style={{ padding: '32px 36px' }}>
              {[
                'Monitor up to 5 employer brands',
                'Scan ChatGPT, Claude, Gemini & Perplexity',
                'Weekly automated rescans',
                'Competitor benchmarking & radar chart',
                '90-day action plan with recommendations',
                'PDF & PowerPoint exports',
                'Trend tracking over time',
                'Invite team members',
              ].map((feature) => (
                <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--hb-teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Check size={12} style={{ color: 'var(--hb-teal-deep)' }} />
                  </div>
                  <span style={{ fontSize: '15px', color: 'var(--hb-slate-mid)', fontFamily: "'Source Sans 3', sans-serif" }}>{feature}</span>
                </div>
              ))}

              {/* Promo code banner */}
              <div style={{ background: 'var(--hb-gold)', borderRadius: '12px', padding: '16px 20px', margin: '24px 0', textAlign: 'center' }}>
                <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--hb-slate)', margin: '0 0 4px', fontFamily: "'Outfit', sans-serif" }}>
                  2 months free — webinar offer
                </p>
                <p style={{ fontSize: '14px', color: 'var(--hb-slate)', margin: 0, fontFamily: "'Source Sans 3', sans-serif" }}>
                  Enter code{' '}
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '15px', background: 'rgba(0,0,0,0.1)', padding: '2px 8px', borderRadius: '4px' }}>TORCPro</span>
                  {' '}at checkout
                </p>
              </div>

              <Link
                href="/hiringbrand/signup"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: 600,
                  fontFamily: "'Outfit', sans-serif",
                  background: 'var(--hb-coral)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  transition: 'transform 0.1s, box-shadow 0.2s',
                  boxSizing: 'border-box',
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
                Get Started
                <ArrowRight size={18} />
              </Link>
              <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '13px', color: 'var(--hb-slate-light)', fontFamily: "'Source Sans 3', sans-serif" }}>
                Secure payment via Stripe · Cancel anytime
              </p>
            </div>
          </div>

          {/* Enterprise callout */}
          <div style={{ textAlign: 'center', marginTop: '28px' }}>
            <p style={{ fontSize: '14px', color: 'var(--hb-slate-mid)', fontFamily: "'Source Sans 3', sans-serif" }}>
              Need 10+ brands or custom onboarding?{' '}
              <a href="mailto:hello@hiringbrand.io" style={{ color: 'var(--hb-teal-deep)', fontWeight: 500, textDecoration: 'none' }}>
                Talk to us →
              </a>
            </p>
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
