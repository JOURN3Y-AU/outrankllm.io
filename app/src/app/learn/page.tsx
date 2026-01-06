import { Nav } from '@/components/nav/Nav'
import { Footer } from '@/components/landing/Footer'
import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Learn About GEO & AI Visibility | outrankllm',
  description: 'Learn how Generative Engine Optimization (GEO) helps your website get recommended by AI assistants like ChatGPT, Claude, and Gemini.',
  keywords: ['GEO', 'generative engine optimization', 'AI visibility', 'ChatGPT SEO', 'Claude optimization', 'AI search'],
}

const faqs = [
  {
    question: 'What is GEO (Generative Engine Optimization)?',
    answer: 'GEO is the practice of optimizing your website and content to be recommended by AI assistants like ChatGPT, Claude, and Gemini. Unlike traditional SEO which focuses on search engine rankings, GEO focuses on how AI models understand, reference, and recommend your business.',
  },
  {
    question: 'How is GEO different from SEO?',
    answer: 'SEO optimizes for search engine crawlers and ranking algorithms. GEO optimizes for large language models that power AI assistants. While there is overlap (clear content, good structure), GEO also considers factors like how AI training data represents your brand, entity recognition, and conversational query patterns.',
  },
  {
    question: 'Why does AI visibility matter?',
    answer: 'Millions of people now ask AI assistants for recommendations instead of searching Google. If ChatGPT recommends your competitor but not you, you are losing customers. AI visibility is becoming as important as search visibility.',
  },
  {
    question: 'How does outrankllm test AI visibility?',
    answer: 'We query ChatGPT, Claude, and Gemini with prompts your potential customers might ask. We analyze whether you are mentioned, how you are described, and how you compare to competitors. This gives you a clear picture of your AI visibility.',
  },
  {
    question: 'What are AI-ready PRDs?',
    answer: 'PRDs (Product Requirement Documents) are detailed specifications. Our AI-ready PRDs are formatted specifically for AI coding tools like Cursor, Claude Code, and Windsurf. You can paste them directly into these tools to implement fixes without manual translation.',
  },
  {
    question: 'How often should I check my AI visibility?',
    answer: 'AI models are updated regularly, and your visibility can change. We recommend weekly monitoring to catch changes early. Our Starter plan includes weekly reports, while Pro and Agency plans include more frequent monitoring options.',
  },
  {
    question: 'Can I track my competitors?',
    answer: 'Yes. All plans include competitor tracking. Starter tracks 3 competitors, while Agency plans can track unlimited competitors across multiple client domains.',
  },
  {
    question: 'Do you offer a free trial?',
    answer: 'Yes. Start with a free AI visibility report for your domain. No credit card required. This shows you exactly where you stand before committing to a plan.',
  },
]

const concepts = [
  {
    id: '01',
    title: 'AI Visibility Score',
    description: 'A measure of how often and how positively AI assistants mention your business in response to relevant queries.',
    icon: '◈',
  },
  {
    id: '02',
    title: 'Entity Recognition',
    description: 'Whether AI models correctly identify and understand what your business does, who you serve, and what makes you unique.',
    icon: '◇',
  },
  {
    id: '03',
    title: 'Prompt Coverage',
    description: 'The range of user queries and prompts where your business could relevantly be recommended by AI assistants.',
    icon: '▣',
  },
  {
    id: '04',
    title: 'Competitive Position',
    description: 'How your AI visibility compares to competitors, and which queries they dominate that you should target.',
    icon: '◎',
  },
]

const guides = [
  {
    title: 'Getting Started with GEO',
    description: 'A complete introduction to Generative Engine Optimization and why it matters for your business.',
    slug: 'getting-started-with-geo',
    comingSoon: false,
    category: 'Fundamentals',
  },
  {
    title: 'How AI Assistants Choose Recommendations',
    description: 'Understanding the factors that influence whether ChatGPT, Claude, or Gemini recommend your business.',
    slug: 'how-ai-chooses-recommendations',
    comingSoon: false,
    category: 'Deep Dive',
  },
  {
    title: 'GEO for E-commerce',
    description: 'Specific strategies for getting your products recommended by AI shopping assistants.',
    slug: 'geo-for-ecommerce',
    comingSoon: false,
    category: 'Industry',
  },
  {
    title: 'GEO for SaaS Companies',
    description: 'How software companies can improve their visibility in AI-powered tool recommendations.',
    slug: 'geo-for-saas',
    comingSoon: false,
    category: 'Industry',
  },
  {
    title: 'Local Business GEO',
    description: 'Getting recommended when users ask AI for local service providers and businesses.',
    slug: 'local-business-geo',
    comingSoon: false,
    category: 'Industry',
  },
  {
    title: 'Measuring AI Visibility ROI',
    description: 'How to track the business impact of improved AI visibility and recommendations.',
    slug: 'measuring-ai-visibility-roi',
    comingSoon: false,
    category: 'Analytics',
  },
]

function SectionLabel({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-4" style={{ marginBottom: '32px' }}>
      <span className="font-mono text-[var(--green)] text-sm">{number}</span>
      <div className="h-px flex-1 bg-[var(--border)]" />
      <span className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-widest">{title}</span>
    </div>
  )
}

export default function LearnPage() {
  return (
    <>
      <div className="grid-bg" />
      <Nav />

      <main className="learn-page relative z-10 min-h-screen" style={{ paddingTop: '140px', paddingBottom: '120px' }}>
        <div className="w-full flex flex-col items-center">
          {/* Hero Section */}
          <header className="text-center px-6 w-full" style={{ marginBottom: '100px' }}>
            <div style={{ maxWidth: '896px', marginLeft: 'auto', marginRight: 'auto' }}>
            {/* Decorative top element */}
            <div className="flex items-center justify-center gap-3" style={{ marginBottom: '24px' }}>
              <div className="w-8 h-px bg-[var(--border)]" />
              <span className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-widest">Documentation</span>
              <div className="w-8 h-px bg-[var(--border)]" />
            </div>

            <h1 className="text-5xl md:text-6xl font-medium" style={{ marginBottom: '24px', letterSpacing: '-0.03em' }}>
              Learn About{' '}
              <span className="relative">
                <span className="text-[var(--green)]">GEO</span>
                <span className="absolute -bottom-2 left-0 right-0 h-px bg-[var(--green)] opacity-50" />
              </span>
            </h1>

            <p className="text-[var(--text-mid)] text-lg leading-relaxed" style={{ maxWidth: '576px', marginLeft: 'auto', marginRight: 'auto' }}>
              Generative Engine Optimization is the new frontier of digital visibility.
              Learn how to get your business recommended by AI assistants.
            </p>
          </div>
        </header>

          {/* What is GEO Section */}
          <section className="px-6 w-full" style={{ marginBottom: '120px' }}>
            <div style={{ maxWidth: '896px', marginLeft: 'auto', marginRight: 'auto' }}>
            <SectionLabel number="01" title="Overview" />

            <div className="grid md:grid-cols-12 gap-8">
              <div className="md:col-span-4">
                <h2 className="text-3xl font-medium sticky top-32">
                  What is Generative Engine Optimization?
                </h2>
              </div>

              <div className="md:col-span-8" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <p className="text-[var(--text-mid)] text-lg" style={{ lineHeight: '1.8' }}>
                  <strong className="text-[var(--text)]">Generative Engine Optimization (GEO)</strong> is
                  the practice of optimizing your digital presence to be recommended by AI assistants
                  like ChatGPT, Claude, and Google Gemini.
                </p>

                <div style={{ padding: '24px', borderLeft: '2px solid var(--green)', background: 'var(--surface)' }}>
                  <p className="text-[var(--text-mid)] font-mono text-sm" style={{ lineHeight: '1.8' }}>
                    &quot;What&apos;s the best project management tool for small teams?&quot;
                    <br />
                    &quot;Who should I hire for web development in Austin?&quot;
                  </p>
                  <p className="text-[var(--text-dim)] text-xs font-mono" style={{ marginTop: '16px' }}>
                    — Example prompts users ask AI assistants
                  </p>
                </div>

                <p className="text-[var(--text-mid)]" style={{ lineHeight: '1.8' }}>
                  When someone asks an AI assistant questions like these, the AI draws on its training
                  data and real-time information to make recommendations. If your business isn&apos;t visible
                  to these AI systems, you&apos;re missing out on a rapidly growing channel of customer discovery.
                </p>

                <p className="text-[var(--text-mid)]" style={{ lineHeight: '1.8' }}>
                  GEO helps you understand and improve how AI perceives and recommends your business.
                </p>
              </div>
            </div>
          </div>
        </section>

          {/* Key Concepts */}
          <section className="px-6 w-full" style={{ marginBottom: '120px' }}>
            <div style={{ maxWidth: '896px', marginLeft: 'auto', marginRight: 'auto' }}>
            <SectionLabel number="02" title="Key Concepts" />

            <div className="grid md:grid-cols-2 gap-px bg-[var(--border)]">
              {concepts.map((concept, i) => (
                <div
                  key={concept.id}
                  className="bg-[var(--bg)] p-8 group hover:bg-[var(--surface)] transition-colors"
                  style={{
                    animationDelay: `${i * 100}ms`,
                  }}
                >
                  <div className="flex items-start justify-between" style={{ marginBottom: '16px' }}>
                    <span className="text-2xl text-[var(--text-dim)] group-hover:text-[var(--green)] transition-colors">
                      {concept.icon}
                    </span>
                    <span className="font-mono text-xs text-[var(--text-ghost)]">{concept.id}</span>
                  </div>
                  <h3 className="text-lg font-medium" style={{ marginBottom: '8px' }}>
                    {concept.title}
                  </h3>
                  <p className="text-sm text-[var(--text-dim)] leading-relaxed">
                    {concept.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

          {/* Guides Section */}
          <section className="px-6 w-full" style={{ marginBottom: '120px' }}>
            <div style={{ maxWidth: '896px', marginLeft: 'auto', marginRight: 'auto' }}>
            <SectionLabel number="03" title="Guides & Resources" />

            <div className="space-y-3">
              {guides.map((guide, i) => (
                <div
                  key={guide.slug}
                  className="group border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--text-dim)] transition-colors"
                >
                  <div className="flex items-stretch">
                    {/* Line number column */}
                    <div className="w-16 flex-shrink-0 flex items-center justify-center border-r border-[var(--border)] bg-[var(--bg)]">
                      <span className="font-mono text-xs text-[var(--text-ghost)]">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex items-start justify-between gap-4" style={{ padding: '20px 24px' }}>
                      <div>
                        <div className="flex items-center gap-3" style={{ marginBottom: '10px' }}>
                          <h3 className="font-medium group-hover:text-[var(--green)] transition-colors">
                            {guide.title}
                          </h3>
                          <span className="font-mono text-[10px] text-[var(--text-ghost)] uppercase tracking-wider px-2 py-0.5 border border-[var(--border)]">
                            {guide.category}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--text-dim)]" style={{ lineHeight: '1.7' }}>{guide.description}</p>
                      </div>

                      {guide.comingSoon ? (
                        <span className="flex-shrink-0 px-3 py-1.5 font-mono text-xs text-[var(--text-dim)] border border-[var(--border)] bg-[var(--bg)]">
                          Coming Soon
                        </span>
                      ) : (
                        <Link
                          href={`/learn/${guide.slug}`}
                          className="flex-shrink-0 px-4 py-1.5 font-mono text-xs text-[var(--green)] border border-[var(--green)] hover:bg-[var(--green)] hover:text-[var(--bg)] transition-colors"
                        >
                          Read →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

          {/* FAQ Section */}
          <section id="faq" className="px-6 w-full" style={{ marginBottom: '120px' }}>
            <div style={{ maxWidth: '896px', marginLeft: 'auto', marginRight: 'auto' }}>
            <SectionLabel number="04" title="FAQ" />

            <div className="space-y-0">
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  className="border-b border-[var(--border)] group"
                >
                  <div className="grid md:grid-cols-12" style={{ padding: '28px 0', gap: '16px' }}>
                    <div className="md:col-span-1">
                      <span className="font-mono text-xs text-[var(--text-ghost)]">
                        Q{String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="md:col-span-5">
                      <h3 className="font-medium text-[var(--text)] group-hover:text-[var(--green)] transition-colors" style={{ lineHeight: '1.5' }}>
                        {faq.question}
                      </h3>
                    </div>
                    <div className="md:col-span-6">
                      <p className="text-[var(--text-mid)] text-sm" style={{ lineHeight: '1.8' }}>
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

          {/* CTA Section */}
          <section className="px-6 w-full">
            <div style={{ maxWidth: '896px', marginLeft: 'auto', marginRight: 'auto' }}>
            <div className="relative border border-[var(--border)] bg-[var(--surface)] p-12 text-center overflow-hidden">
              {/* Decorative corner elements */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-[var(--green)]" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-[var(--green)]" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-[var(--green)]" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-[var(--green)]" />

              <div className="font-mono text-xs text-[var(--text-dim)] uppercase tracking-widest" style={{ marginBottom: '16px' }}>
                Get Started
              </div>

              <h2 className="text-3xl font-medium" style={{ marginBottom: '12px' }}>
                Ready to check your AI visibility?
              </h2>

              <p className="text-[var(--text-mid)] max-w-md mx-auto" style={{ marginBottom: '32px' }}>
                Get a free report showing how AI assistants see your business.
              </p>

              <Link
                href="/"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[var(--green)] text-[var(--bg)] font-mono text-sm hover:opacity-90 transition-opacity"
              >
                <span>Get Free Report</span>
                <span>→</span>
              </Link>
            </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </>
  )
}
