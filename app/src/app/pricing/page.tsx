import { Nav } from '@/components/nav/Nav'
import { Footer } from '@/components/landing/Footer'
import { Check } from 'lucide-react'
import Link from 'next/link'

const plans = [
  {
    name: 'Starter',
    description: 'For Business Owners',
    price: 49,
    highlight: false,
    features: [
      '1 domain + 3 competitors',
      'Weekly AI visibility report',
      'ChatGPT, Claude & Gemini tracking',
      'Visibility score & trends',
      'Email alerts on changes',
      'Basic recommendations',
    ],
    cta: 'Start Free Trial',
    ctaLink: '/',
  },
  {
    name: 'Pro',
    description: 'For Developers',
    price: 79,
    highlight: true,
    features: [
      'Everything in Starter, plus:',
      'Monthly fix PRDs for AI tools',
      'Claude Code ready implementations',
      'Competitor gap analysis',
      'Priority prompt testing',
      'API access (coming soon)',
    ],
    cta: 'Start Free Trial',
    ctaLink: '/',
  },
  {
    name: 'Agency',
    description: 'For Agencies',
    price: 199,
    highlight: false,
    features: [
      'Everything in Pro, plus:',
      'Up to 10 client domains',
      'White-label reports',
      'Per-client dashboards',
      'Bulk competitor tracking',
      'Dedicated support',
    ],
    cta: 'Contact Us',
    ctaLink: 'mailto:hello@outrankllm.io',
  },
]

export default function PricingPage() {
  return (
    <>
      <div className="grid-bg" />
      <Nav />

      <main className="relative z-10 min-h-screen" style={{ paddingTop: '140px', paddingBottom: '120px' }}>
        <div className="w-full flex flex-col items-center">
          {/* Header */}
          <div className="text-center px-6 w-full" style={{ marginBottom: '80px' }}>
            <div style={{ maxWidth: '1024px', marginLeft: 'auto', marginRight: 'auto' }}>
            {/* Decorative top element */}
            <div className="flex items-center justify-center gap-3" style={{ marginBottom: '24px' }}>
              <div className="w-8 h-px bg-[var(--border)]" />
              <span className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-widest">Pricing</span>
              <div className="w-8 h-px bg-[var(--border)]" />
            </div>

            <h1 className="text-5xl md:text-6xl font-medium" style={{ marginBottom: '20px', letterSpacing: '-0.03em' }}>
              Simple, transparent pricing
            </h1>
            <p className="text-[var(--text-mid)] text-lg" style={{ maxWidth: '512px', marginLeft: 'auto', marginRight: 'auto' }}>
              Start with a free AI visibility report. Upgrade when you&apos;re ready.
            </p>
          </div>
        </div>

          {/* Pricing Cards */}
          <div className="px-6 w-full" style={{ marginBottom: '80px' }}>
            <div style={{ maxWidth: '1024px', marginLeft: 'auto', marginRight: 'auto' }}>
            <div className="grid md:grid-cols-3 gap-6">
              {plans.map((plan, index) => (
                <div
                  key={plan.name}
                  className={`relative flex flex-col border ${
                    plan.highlight
                      ? 'border-[var(--green)] bg-[var(--surface)]'
                      : 'border-[var(--border)] bg-[var(--surface)]'
                  }`}
                  style={{
                    animationDelay: `${index * 100}ms`,
                  }}
                >
                  {plan.highlight && (
                    <div className="absolute -top-px left-0 right-0 h-px bg-[var(--green)]" />
                  )}

                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[var(--green)] text-[var(--bg)] font-mono text-xs uppercase tracking-wider">
                      Most Popular
                    </div>
                  )}

                  {/* Plan Header */}
                  <div className="border-b border-[var(--border)]" style={{ padding: '28px 28px 24px' }}>
                    <div className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider" style={{ marginBottom: '10px' }}>
                      {plan.description}
                    </div>
                    <h2 className="text-2xl font-medium" style={{ marginBottom: '16px' }}>
                      {plan.name}
                    </h2>
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-medium">${plan.price}</span>
                      <span className="text-[var(--text-dim)] font-mono text-sm">/month</span>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="flex-1" style={{ padding: '28px' }}>
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm" style={{ lineHeight: '1.5' }}>
                          <Check className="w-4 h-4 text-[var(--green)] flex-shrink-0" style={{ marginTop: '2px' }} />
                          <span className="text-[var(--text-mid)]">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA */}
                  <div style={{ padding: '0 28px 28px' }}>
                    <Link
                      href={plan.ctaLink}
                      className={`block w-full py-4 font-mono text-sm text-center transition-all ${
                        plan.highlight
                          ? 'bg-[var(--green)] text-[var(--bg)] hover:opacity-90'
                          : 'border border-[var(--border)] text-[var(--text-mid)] hover:border-[var(--green)] hover:text-[var(--text)]'
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

          {/* FAQ Teaser */}
          <div className="text-center px-6 w-full">
            <div style={{ maxWidth: '1024px', marginLeft: 'auto', marginRight: 'auto' }}>
            <div className="inline-flex items-center gap-6 p-4 border border-[var(--border)] bg-[var(--surface)]">
              <span className="text-[var(--text-dim)] font-mono text-sm">
                Questions?
              </span>
              <div className="w-px h-4 bg-[var(--border)]" />
              <Link href="/learn#faq" className="text-[var(--green)] font-mono text-sm hover:underline">
                Read FAQ →
              </Link>
              <div className="w-px h-4 bg-[var(--border)]" />
              <a href="mailto:hello@outrankllm.io" className="text-[var(--green)] font-mono text-sm hover:underline">
                Contact us →
              </a>
            </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
