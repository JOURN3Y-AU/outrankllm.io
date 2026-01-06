import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 120

interface SitemapUrl {
  loc: string
  lastmod?: string
  changefreq?: string
  priority?: string
}

// Parse sitemap XML to extract URLs
function parseSitemap(xml: string): SitemapUrl[] {
  const urls: SitemapUrl[] = []

  // Simple regex-based XML parsing for sitemap
  const urlMatches = xml.match(/<url>([\s\S]*?)<\/url>/g)
  if (!urlMatches) return urls

  for (const urlBlock of urlMatches) {
    const locMatch = urlBlock.match(/<loc>(.*?)<\/loc>/)
    if (!locMatch) continue

    const url: SitemapUrl = {
      loc: locMatch[1].trim()
    }

    const lastmodMatch = urlBlock.match(/<lastmod>(.*?)<\/lastmod>/)
    if (lastmodMatch) url.lastmod = lastmodMatch[1].trim()

    const changefreqMatch = urlBlock.match(/<changefreq>(.*?)<\/changefreq>/)
    if (changefreqMatch) url.changefreq = changefreqMatch[1].trim()

    const priorityMatch = urlBlock.match(/<priority>(.*?)<\/priority>/)
    if (priorityMatch) url.priority = priorityMatch[1].trim()

    urls.push(url)
  }

  return urls
}

// Infer page type from URL path
function inferPageType(path: string): string {
  if (path === '/' || path === '') return 'homepage'
  if (path.startsWith('/blog/')) return 'blog'
  if (path === '/blog') return 'blog-index'
  if (path.startsWith('/products/')) return 'product'
  if (path.startsWith('/small-business-ai/')) return 'industry'
  if (path === '/small-business-ai') return 'landing'
  if (path === '/contact') return 'contact'
  if (path === '/team') return 'team'
  if (path.startsWith('/admin')) return 'admin'
  return 'page'
}

// Extract path from full URL
function extractPath(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.pathname
  } catch {
    return url
  }
}

// Discover pages by crawling from a starting URL (for sites without sitemaps)
async function discoverPagesFromUrl(startUrl: string, maxPages = 50): Promise<{ loc: string }[]> {
  const discovered = new Set<string>()
  const toVisit: string[] = [startUrl]
  const baseUrl = new URL(startUrl)
  const baseDomain = baseUrl.hostname

  while (toVisit.length > 0 && discovered.size < maxPages) {
    const url = toVisit.shift()!
    if (discovered.has(url)) continue

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'JOURN3Y-Crawler/1.0' }
      })

      if (!response.ok) continue

      const html = await response.text()
      discovered.add(url)

      // Find all internal links
      const linkMatches = html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)
      for (const match of linkMatches) {
        let href = match[1]

        // Skip anchors, javascript, mailto, tel
        if (href.startsWith('#') || href.startsWith('javascript:') ||
            href.startsWith('mailto:') || href.startsWith('tel:')) continue

        // Convert relative URLs to absolute
        try {
          const absoluteUrl = new URL(href, url)

          // Only follow links on the same domain
          if (absoluteUrl.hostname !== baseDomain) continue

          // Skip common non-page extensions
          const path = absoluteUrl.pathname.toLowerCase()
          if (path.match(/\.(jpg|jpeg|png|gif|svg|pdf|css|js|ico|woff|woff2|ttf)$/)) continue

          // Skip admin, api, and other utility paths
          if (path.startsWith('/api/') || path.startsWith('/admin/') ||
              path.startsWith('/_next/') || path.startsWith('/static/')) continue

          const cleanUrl = absoluteUrl.origin + absoluteUrl.pathname
          if (!discovered.has(cleanUrl) && !toVisit.includes(cleanUrl)) {
            toVisit.push(cleanUrl)
          }
        } catch {
          // Invalid URL, skip
        }
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 200))
    } catch {
      // Failed to fetch, skip
    }
  }

  return Array.from(discovered).map(url => ({ loc: url }))
}

// Detect content sections from headings and page structure
function detectSections(headings: string[], html: string): string[] {
  const sections: string[] = []
  const headingsLower = headings.map(h => h.toLowerCase())
  const htmlLower = html.toLowerCase()

  // Location/geo patterns
  if (headingsLower.some(h => h.includes('location') || h.includes('serving') || h.includes('area')) ||
      htmlLower.includes('northern beaches') || htmlLower.includes('north shore') ||
      htmlLower.includes('western sydney') || htmlLower.includes('gold coast')) {
    sections.push('location-coverage')
  }

  // FAQ patterns
  if (headingsLower.some(h => h.includes('faq') || h.includes('question')) ||
      htmlLower.includes('accordion') || html.includes('FAQPage')) {
    sections.push('faq')
  }

  // Partner/certification patterns
  if (headingsLower.some(h => h.includes('partner') || h.includes('certified') || h.includes('authorized')) ||
      htmlLower.includes('certified partner') || htmlLower.includes('authorized partner')) {
    sections.push('partner-credentials')
  }

  // Pricing patterns
  if (headingsLower.some(h => h.includes('pricing') || h.includes('cost') || h.includes('package'))) {
    sections.push('pricing')
  }

  // Testimonials/reviews
  if (headingsLower.some(h => h.includes('testimonial') || h.includes('review') || h.includes('client') || h.includes('customer'))) {
    sections.push('testimonials')
  }

  // Case studies
  if (headingsLower.some(h => h.includes('case stud') || h.includes('success stor'))) {
    sections.push('case-studies')
  }

  // How it works / process
  if (headingsLower.some(h => h.includes('how it works') || h.includes('process') || h.includes('step'))) {
    sections.push('how-it-works')
  }

  // Benefits/features
  if (headingsLower.some(h => h.includes('benefit') || h.includes('feature') || h.includes('why choose'))) {
    sections.push('benefits')
  }

  // Contact/CTA
  if (headingsLower.some(h => h.includes('contact') || h.includes('get started') || h.includes('book') || h.includes('schedule'))) {
    sections.push('cta')
  }

  // Team/about
  if (headingsLower.some(h => h.includes('team') || h.includes('about') || h.includes('who we are'))) {
    sections.push('team-about')
  }

  // Industries/use cases
  if (headingsLower.some(h => h.includes('industr') || h.includes('use case') || h.includes('solution'))) {
    sections.push('industries')
  }

  return sections
}

// Extract key phrases from page content
function extractKeyPhrases(html: string): string[] {
  const phrases: string[] = []

  // Extract from body, removing scripts/styles
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (!bodyMatch) return phrases

  const text = bodyMatch[1]
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Look for specific valuable phrases
  const patterns = [
    /australia'?s?\s+leading/gi,
    /certified\s+\w+\s+partner/gi,
    /authorized\s+\w+\s+partner/gi,
    /\d+\s+weeks?\s+implementation/gi,
    /enterprise\s+ai/gi,
    /small\s+business\s+ai/gi,
    /\d+\+?\s+hours?\s+(saved|per\s+week)/gi,
    /free\s+consultation/gi,
    /roi\s+calculator/gi,
    /serving\s+[\w\s,]+australia/gi,
  ]

  for (const pattern of patterns) {
    const matches = text.match(pattern)
    if (matches) {
      phrases.push(...matches.map(m => m.trim()))
    }
  }

  return [...new Set(phrases)] // dedupe
}

// Crawl a single page to extract metadata
async function crawlPage(url: string): Promise<{
  title: string | null
  description: string | null
  h1: string | null
  keywords: string[]
  schemaTypes: string[]
  wordCount: number
  headings: string[]
  detectedSections: string[]
  keyPhrases: string[]
}> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'JOURN3Y-Sitemap-Crawler/1.0'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()

    // Extract title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : null

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)
    const description = descMatch ? descMatch[1].trim() : null

    // Extract H1 (using [\s\S]*? instead of .* with s flag for compatibility)
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : null

    // Extract meta keywords
    const keywordsMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i)
    const keywords = keywordsMatch
      ? keywordsMatch[1].split(',').map(k => k.trim()).filter(k => k.length > 0)
      : []

    // Extract JSON-LD schema types
    const schemaTypes: string[] = []
    const schemaMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
    if (schemaMatches) {
      for (const schemaBlock of schemaMatches) {
        const jsonMatch = schemaBlock.match(/<script[^>]*>([\s\S]*?)<\/script>/i)
        if (jsonMatch) {
          try {
            const json = JSON.parse(jsonMatch[1])
            if (json['@type']) {
              if (Array.isArray(json['@type'])) {
                schemaTypes.push(...json['@type'])
              } else {
                schemaTypes.push(json['@type'])
              }
            }
          } catch {
            // Invalid JSON, skip
          }
        }
      }
    }

    // Extract H2 and H3 headings
    const headings: string[] = []
    const h2Matches = html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)
    for (const match of h2Matches) {
      const text = match[1].replace(/<[^>]+>/g, '').trim()
      if (text) headings.push(text)
    }
    const h3Matches = html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)
    for (const match of h3Matches) {
      const text = match[1].replace(/<[^>]+>/g, '').trim()
      if (text) headings.push(text)
    }

    // Detect content sections based on headings and content patterns
    const detectedSections = detectSections(headings, html)

    // Extract key phrases from content
    const keyPhrases = extractKeyPhrases(html)

    // Estimate word count from body text
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    let wordCount = 0
    if (bodyMatch) {
      const text = bodyMatch[1]
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      wordCount = text.split(' ').filter(w => w.length > 0).length
    }

    return { title, description, h1, keywords, schemaTypes, wordCount, headings, detectedSections, keyPhrases }
  } catch (error) {
    console.error(`Error crawling ${url}:`, error)
    throw error
  }
}

// GET /api/ai-monitor/sitemap - Get sitemap sync status and pages
export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createClient() as any

    // Verify authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all pages
    const { data: pages, error } = await supabase
      .from('site_pages')
      .select('*')
      .order('path', { ascending: true })

    if (error) {
      console.error('Error fetching pages:', error)
      return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 })
    }

    // Calculate status
    const totalPages = pages?.length || 0
    const crawledPages = pages?.filter((p: { crawl_status: string }) => p.crawl_status === 'success').length || 0
    const pendingPages = pages?.filter((p: { crawl_status: string }) => p.crawl_status === 'pending').length || 0
    const errorPages = pages?.filter((p: { crawl_status: string }) => p.crawl_status === 'error').length || 0

    // Get last crawl time
    const lastCrawled = pages
      ?.filter((p: { last_crawled_at: string | null }) => p.last_crawled_at)
      .sort((a: { last_crawled_at: string }, b: { last_crawled_at: string }) =>
        new Date(b.last_crawled_at).getTime() - new Date(a.last_crawled_at).getTime()
      )[0]

    return NextResponse.json({
      status: {
        totalPages,
        crawledPages,
        pendingPages,
        errorPages,
        lastSyncAt: lastCrawled?.last_crawled_at || null
      },
      pages: pages || []
    })
  } catch (error) {
    console.error('Sitemap API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/ai-monitor/sitemap - Sync sitemap and optionally crawl pages
export async function POST(request: Request) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createClient() as any

    // Verify authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { crawl = false, sitemapUrl, homepageUrl, discoveryMode = 'sitemap' } = body

    // Validate that we have a URL to work with
    const targetUrl = discoveryMode === 'homepage' ? homepageUrl : sitemapUrl
    if (!targetUrl) {
      return NextResponse.json({
        error: discoveryMode === 'homepage'
          ? 'Homepage URL is required'
          : 'Sitemap URL is required'
      }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(targetUrl)
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    let urls: { loc: string; lastmod?: string; changefreq?: string; priority?: string }[] = []

    if (discoveryMode === 'homepage') {
      // Discover pages by crawling from homepage
      console.log('Discovering pages from homepage:', targetUrl)
      const discoveredUrls = await discoverPagesFromUrl(targetUrl, 50)
      urls = discoveredUrls
      console.log(`Discovered ${urls.length} pages from homepage crawl`)
    } else {
      // Fetch and parse sitemap
      const sitemapResponse = await fetch(targetUrl)

      if (!sitemapResponse.ok) {
        return NextResponse.json({ error: 'Failed to fetch sitemap' }, { status: 500 })
      }

      const sitemapXml = await sitemapResponse.text()
      urls = parseSitemap(sitemapXml)

      if (urls.length === 0) {
        return NextResponse.json({ error: 'No URLs found in sitemap' }, { status: 400 })
      }
    }

    // Prepare pages for upsert
    const pages = urls.map(url => ({
      url: url.loc,
      path: extractPath(url.loc),
      last_modified: url.lastmod ? new Date(url.lastmod).toISOString() : null,
      change_frequency: url.changefreq || null,
      priority: url.priority ? parseFloat(url.priority) : null,
      page_type: inferPageType(extractPath(url.loc)),
      crawl_status: 'pending'
    }))

    // Upsert pages (insert or update based on URL)
    const { error: upsertError } = await supabase
      .from('site_pages')
      .upsert(pages, {
        onConflict: 'url',
        ignoreDuplicates: false
      })

    if (upsertError) {
      console.error('Error upserting pages:', upsertError)
      return NextResponse.json({ error: 'Failed to save pages' }, { status: 500 })
    }

    // If crawl is requested, crawl each page for metadata
    if (crawl) {
      // Get all pending pages
      const { data: pagesToCrawl } = await supabase
        .from('site_pages')
        .select('id, url')
        .eq('crawl_status', 'pending')

      if (pagesToCrawl && pagesToCrawl.length > 0) {
        // Crawl pages in batches to avoid overwhelming the server
        const batchSize = 5
        for (let i = 0; i < pagesToCrawl.length; i += batchSize) {
          const batch = pagesToCrawl.slice(i, i + batchSize)

          await Promise.all(batch.map(async (page: { id: string; url: string }) => {
            try {
              const metadata = await crawlPage(page.url)

              await supabase
                .from('site_pages')
                .update({
                  title: metadata.title,
                  description: metadata.description,
                  h1: metadata.h1,
                  keywords: metadata.keywords,
                  schema_types: metadata.schemaTypes,
                  word_count: metadata.wordCount,
                  headings: metadata.headings,
                  detected_sections: metadata.detectedSections,
                  key_phrases: metadata.keyPhrases,
                  last_crawled_at: new Date().toISOString(),
                  crawl_status: 'success',
                  crawl_error: null
                })
                .eq('id', page.id)
            } catch (error) {
              await supabase
                .from('site_pages')
                .update({
                  last_crawled_at: new Date().toISOString(),
                  crawl_status: 'error',
                  crawl_error: error instanceof Error ? error.message : 'Unknown error'
                })
                .eq('id', page.id)
            }
          }))

          // Small delay between batches
          if (i + batchSize < pagesToCrawl.length) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        }
      }
    }

    // Fetch updated pages
    const { data: updatedPages } = await supabase
      .from('site_pages')
      .select('*')
      .order('path', { ascending: true })

    const totalPages = updatedPages?.length || 0
    const crawledPages = updatedPages?.filter((p: { crawl_status: string }) => p.crawl_status === 'success').length || 0
    const pendingPages = updatedPages?.filter((p: { crawl_status: string }) => p.crawl_status === 'pending').length || 0
    const errorPages = updatedPages?.filter((p: { crawl_status: string }) => p.crawl_status === 'error').length || 0

    return NextResponse.json({
      message: crawl ? 'Sitemap synced and pages crawled' : 'Sitemap synced',
      status: {
        totalPages,
        crawledPages,
        pendingPages,
        errorPages,
        lastSyncAt: new Date().toISOString()
      },
      pages: updatedPages || []
    })
  } catch (error) {
    console.error('Sitemap sync error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
