/**
 * Site Crawler
 * Crawls a website to extract content for analysis
 */

interface CrawledPage {
  url: string
  path: string
  title: string | null
  description: string | null
  h1: string | null
  headings: string[]
  bodyText: string
  wordCount: number
}

interface CrawlResult {
  pages: CrawledPage[]
  totalPages: number
  domain: string
}

/**
 * Try to fetch and parse a sitemap
 */
async function fetchSitemap(domain: string): Promise<string[]> {
  const sitemapUrls = [
    `https://${domain}/sitemap.xml`,
    `https://${domain}/sitemap_index.xml`,
    `https://www.${domain}/sitemap.xml`,
  ]

  for (const url of sitemapUrls) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'outrankllm-crawler/1.0' },
      })

      if (!response.ok) continue

      const xml = await response.text()
      const urls: string[] = []

      // Simple regex parsing for sitemap URLs
      const locMatches = xml.matchAll(/<loc>(.*?)<\/loc>/g)
      for (const match of locMatches) {
        const loc = match[1].trim()
        // Skip non-HTML resources
        if (!loc.match(/\.(jpg|jpeg|png|gif|pdf|css|js|ico|svg|woff|woff2)$/i)) {
          urls.push(loc)
        }
      }

      if (urls.length > 0) {
        return urls.slice(0, 20) // Max 20 pages
      }
    } catch {
      // Try next sitemap URL
    }
  }

  return []
}

/**
 * Discover pages by crawling from homepage
 */
async function discoverPages(domain: string, maxPages = 20): Promise<string[]> {
  const discovered = new Set<string>()
  const toVisit: string[] = [`https://${domain}`, `https://www.${domain}`]
  const baseUrls = [`https://${domain}`, `https://www.${domain}`]

  while (toVisit.length > 0 && discovered.size < maxPages) {
    const url = toVisit.shift()!

    // Normalize URL
    const normalizedUrl = url.replace(/\/$/, '')
    if (discovered.has(normalizedUrl)) continue

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'outrankllm-crawler/1.0' },
        redirect: 'follow',
      })

      if (!response.ok) continue

      const html = await response.text()
      discovered.add(normalizedUrl)

      // Extract internal links
      const linkMatches = html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)
      for (const match of linkMatches) {
        let href = match[1]

        // Skip non-page links
        if (
          href.startsWith('#') ||
          href.startsWith('javascript:') ||
          href.startsWith('mailto:') ||
          href.startsWith('tel:')
        ) {
          continue
        }

        try {
          const absoluteUrl = new URL(href, url)
          const isInternal = baseUrls.some(
            (base) =>
              absoluteUrl.hostname === new URL(base).hostname ||
              absoluteUrl.hostname === `www.${domain}` ||
              absoluteUrl.hostname === domain
          )

          if (!isInternal) continue

          // Skip resource files
          const path = absoluteUrl.pathname.toLowerCase()
          if (path.match(/\.(jpg|jpeg|png|gif|pdf|css|js|ico|svg|woff|woff2|ttf)$/)) {
            continue
          }

          // Skip admin/API paths
          if (path.startsWith('/api/') || path.startsWith('/admin/') || path.startsWith('/_')) {
            continue
          }

          const cleanUrl = (absoluteUrl.origin + absoluteUrl.pathname).replace(/\/$/, '')
          if (!discovered.has(cleanUrl) && !toVisit.includes(cleanUrl)) {
            toVisit.push(cleanUrl)
          }
        } catch {
          // Invalid URL, skip
        }
      }

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 200))
    } catch {
      // Failed to fetch, skip
    }
  }

  return Array.from(discovered)
}

/**
 * Extract content from a single page
 */
async function extractPageContent(url: string): Promise<CrawledPage | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'outrankllm-crawler/1.0' },
    })

    if (!response.ok) return null

    const html = await response.text()
    const path = new URL(url).pathname

    // Extract title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : null

    // Extract meta description
    const descMatch =
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)
    const description = descMatch ? descMatch[1].trim() : null

    // Extract H1
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : null

    // Extract H2/H3 headings
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

    // Extract body text
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    let bodyText = ''
    if (bodyMatch) {
      bodyText = bodyMatch[1]
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    const wordCount = bodyText.split(' ').filter((w) => w.length > 0).length

    return {
      url,
      path,
      title,
      description,
      h1,
      headings: headings.slice(0, 20),
      bodyText: bodyText.slice(0, 5000), // Limit text length
      wordCount,
    }
  } catch {
    return null
  }
}

/**
 * Main crawl function
 */
export async function crawlSite(domain: string): Promise<CrawlResult> {
  // Try sitemap first
  let urls = await fetchSitemap(domain)

  // Fall back to discovery if no sitemap
  if (urls.length === 0) {
    urls = await discoverPages(domain, 15)
  }

  // Ensure we have at least the homepage
  if (urls.length === 0) {
    urls = [`https://${domain}`, `https://www.${domain}`]
  }

  // Crawl each page
  const pages: CrawledPage[] = []
  for (const url of urls.slice(0, 15)) {
    const page = await extractPageContent(url)
    if (page) {
      pages.push(page)
    }
    // Small delay
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return {
    pages,
    totalPages: pages.length,
    domain,
  }
}

/**
 * Combine crawled content into a single text for analysis
 */
export function combineCrawledContent(result: CrawlResult): string {
  const sections: string[] = []

  sections.push(`Domain: ${result.domain}`)
  sections.push(`Pages crawled: ${result.totalPages}`)
  sections.push('')

  for (const page of result.pages) {
    sections.push(`--- Page: ${page.path} ---`)
    if (page.title) sections.push(`Title: ${page.title}`)
    if (page.description) sections.push(`Description: ${page.description}`)
    if (page.h1) sections.push(`H1: ${page.h1}`)
    if (page.headings.length > 0) {
      sections.push(`Headings: ${page.headings.join(' | ')}`)
    }
    sections.push(`Content: ${page.bodyText.slice(0, 1500)}`)
    sections.push('')
  }

  return sections.join('\n')
}
