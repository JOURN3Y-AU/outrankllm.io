import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import Link from 'next/link'
import { Nav } from '@/components/nav/Nav'
import { Footer } from '@/components/landing/Footer'
import { getGuideBySlug, getAllGuideSlugs } from '@/lib/guides'
import { MDXContent } from '@/components/mdx/MDXContent'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const slugs = getAllGuideSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const guide = getGuideBySlug(slug)

  if (!guide) {
    return {
      title: 'Guide Not Found | outrankllm',
    }
  }

  return {
    title: `${guide.frontmatter.title} | outrankllm`,
    description: guide.frontmatter.description,
    keywords: guide.frontmatter.keywords,
    openGraph: {
      title: guide.frontmatter.title,
      description: guide.frontmatter.description,
      type: 'article',
      publishedTime: guide.frontmatter.publishedAt,
      modifiedTime: guide.frontmatter.updatedAt,
    },
  }
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params
  const guide = getGuideBySlug(slug)

  if (!guide) {
    notFound()
  }

  return (
    <>
      <div className="grid-bg" />
      <Nav />

      <main className="guide-page relative z-10 min-h-screen pb-24" style={{ paddingTop: '140px' }}>
        <div className="w-full flex flex-col items-center">
          {/* Article Header */}
          <header className="px-6 w-full" style={{ marginBottom: '64px' }}>
            <div style={{ maxWidth: '720px', marginLeft: 'auto', marginRight: 'auto' }}>
              {/* Breadcrumb */}
              <nav className="flex items-center gap-2 font-mono text-xs text-[var(--text-dim)]" style={{ marginBottom: '32px' }}>
                <Link href="/learn" className="hover:text-[var(--green)] transition-colors">
                  Learn
                </Link>
                <span>/</span>
                <span className="text-[var(--text-ghost)]">{guide.frontmatter.category}</span>
              </nav>

              {/* Category & Reading Time */}
              <div className="flex items-center gap-4" style={{ marginBottom: '20px' }}>
                <span className="font-mono text-[10px] text-[var(--green)] uppercase tracking-wider px-2 py-1 border border-[var(--green)] bg-[var(--green)]/10">
                  {guide.frontmatter.category}
                </span>
                <span className="font-mono text-xs text-[var(--text-dim)]">
                  {guide.readingTime}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-4xl md:text-5xl font-medium" style={{ marginBottom: '24px', letterSpacing: '-0.02em', lineHeight: '1.2' }}>
                {guide.frontmatter.title}
              </h1>

              {/* Description */}
              <p className="text-lg text-[var(--text-mid)]" style={{ lineHeight: '1.7' }}>
                {guide.frontmatter.description}
              </p>

              {/* Meta */}
              <div className="flex items-center gap-6 font-mono text-xs text-[var(--text-dim)]" style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
                <span>
                  Published: {new Date(guide.frontmatter.publishedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
                {guide.frontmatter.updatedAt && (
                  <span>
                    Updated: {new Date(guide.frontmatter.updatedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                )}
              </div>
            </div>
          </header>

          {/* Article Content */}
          <article className="px-6 w-full">
            <div style={{ maxWidth: '720px', marginLeft: 'auto', marginRight: 'auto' }}>
              <MDXContent content={guide.content} />
            </div>
          </article>

          {/* Back Link */}
          <div className="px-6 w-full" style={{ marginTop: '80px' }}>
            <div style={{ maxWidth: '720px', marginLeft: 'auto', marginRight: 'auto' }}>
              <Link
                href="/learn"
                className="inline-flex items-center gap-2 font-mono text-sm text-[var(--text-dim)] hover:text-[var(--green)] transition-colors"
              >
                <span>←</span>
                <span>Back to all guides</span>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
