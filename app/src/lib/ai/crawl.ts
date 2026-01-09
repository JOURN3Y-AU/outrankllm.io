/**
 * Site Crawler
 * Crawls a website to extract content for analysis
 */

// Fetch with timeout helper
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeout)
  }
}

interface SchemaData {
  type: string
  name?: string
  description?: string
  address?: {
    locality?: string
    region?: string
    country?: string
    streetAddress?: string
  }
  geo?: {
    latitude?: number
    longitude?: number
  }
  areaServed?: string | string[]
  serviceArea?: string | string[]
  services?: string[]
  products?: string[]
  offers?: { name: string; description?: string }[]
  locations?: string[]
}

interface CrawledPage {
  url: string
  path: string
  title: string | null
  description: string | null
  h1: string | null
  headings: string[]
  bodyText: string
  wordCount: number
  schemaData: SchemaData[]
  hasMetaDescription: boolean
}

export interface CrawlResult {
  pages: CrawledPage[]
  totalPages: number
  domain: string
  hasSitemap: boolean
  hasRobotsTxt: boolean
  schemaTypes: string[]
  extractedLocations: string[]
  extractedServices: string[]
  extractedProducts: string[]
}

/**
 * Parse URLs from a sitemap XML string
 */
function parseSitemapUrls(xml: string): string[] {
  const urls: string[] = []
  const locMatches = xml.matchAll(/<loc>(.*?)<\/loc>/g)
  for (const match of locMatches) {
    const loc = match[1].trim()
    urls.push(loc)
  }
  return urls
}

/**
 * Fetch a single sitemap and return its content
 */
async function fetchSingleSitemap(url: string): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'outrankllm-crawler/1.0' },
    }, 8000)
    if (!response.ok) return null
    return await response.text()
  } catch {
    return null
  }
}

/**
 * Try to fetch and parse a sitemap, handling sitemap indexes recursively
 */
async function fetchSitemap(domain: string): Promise<{ urls: string[]; found: boolean }> {
  const sitemapUrls = [
    `https://${domain}/sitemap.xml`,
    `https://${domain}/sitemap_index.xml`,
    `https://www.${domain}/sitemap.xml`,
  ]

  for (const url of sitemapUrls) {
    const xml = await fetchSingleSitemap(url)
    if (!xml) continue

    const allUrls = parseSitemapUrls(xml)
    if (allUrls.length === 0) continue

    // Check if this is a sitemap index (Yoast, etc.)
    // Sitemap indexes contain URLs ending in .xml pointing to child sitemaps
    const childSitemapUrls = allUrls.filter(u => u.endsWith('.xml') || u.includes('sitemap'))
    const pageUrls = allUrls.filter(u => !u.endsWith('.xml') && !u.includes('sitemap'))

    // If most URLs look like sitemaps, fetch them recursively
    if (childSitemapUrls.length > 0 && childSitemapUrls.length >= pageUrls.length) {
      const collectedUrls: string[] = [...pageUrls]

      // Fetch child sitemaps (limit to first 5 to avoid too many requests)
      // Prioritize page-sitemap over tag/author/category sitemaps
      const prioritizedSitemaps = childSitemapUrls.sort((a, b) => {
        const priority = (url: string) => {
          if (url.includes('page-sitemap')) return 0
          if (url.includes('post-sitemap')) return 1
          if (url.includes('product-sitemap')) return 2
          if (url.includes('service-sitemap')) return 3
          return 10 // category, tag, author sitemaps are less useful
        }
        return priority(a) - priority(b)
      })

      for (const childUrl of prioritizedSitemaps.slice(0, 5)) {
        const childXml = await fetchSingleSitemap(childUrl)
        if (childXml) {
          const childUrls = parseSitemapUrls(childXml)
          // Filter to actual page URLs
          for (const loc of childUrls) {
            if (!loc.endsWith('.xml') && !loc.match(/\.(jpg|jpeg|png|gif|pdf|css|js|ico|svg|woff|woff2)$/i)) {
              collectedUrls.push(loc)
            }
          }
        }
        if (collectedUrls.length >= 20) break
      }

      if (collectedUrls.length > 0) {
        return { urls: collectedUrls.slice(0, 20), found: true }
      }
    }

    // Not a sitemap index - filter to HTML pages
    const htmlUrls = allUrls.filter(
      loc => !loc.match(/\.(jpg|jpeg|png|gif|pdf|css|js|ico|svg|woff|woff2|xml)$/i)
    )

    if (htmlUrls.length > 0) {
      return { urls: htmlUrls.slice(0, 20), found: true }
    }
  }

  return { urls: [], found: false }
}

/**
 * Check if robots.txt exists
 */
async function checkRobotsTxt(domain: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`https://${domain}/robots.txt`, {
      headers: { 'User-Agent': 'outrankllm-crawler/1.0' },
    }, 5000)
    return response.ok
  } catch {
    return false
  }
}

/**
 * Extract JSON-LD schema markup from HTML
 */
function extractSchemaData(html: string): SchemaData[] {
  const schemas: SchemaData[] = []

  // Find all JSON-LD script tags
  const scriptMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)

  for (const match of scriptMatches) {
    try {
      const jsonText = match[1].trim()
      const parsed = JSON.parse(jsonText)

      // Handle both single objects and arrays
      const items = Array.isArray(parsed) ? parsed : [parsed]

      for (const item of items) {
        const schema = parseSchemaItem(item)
        if (schema) {
          schemas.push(schema)
        }

        // Also check @graph if present
        if (item['@graph'] && Array.isArray(item['@graph'])) {
          for (const graphItem of item['@graph']) {
            const graphSchema = parseSchemaItem(graphItem)
            if (graphSchema) {
              schemas.push(graphSchema)
            }
          }
        }
      }
    } catch {
      // Invalid JSON, skip
    }
  }

  return schemas
}

/**
 * Parse a single schema.org item
 */
function parseSchemaItem(item: Record<string, unknown>): SchemaData | null {
  if (!item || typeof item !== 'object') return null

  const type = (item['@type'] as string) || ''
  if (!type) return null

  const schema: SchemaData = { type }

  // Extract name
  if (item.name) schema.name = String(item.name)
  if (item.description) schema.description = String(item.description)

  // Extract address/location info
  if (item.address && typeof item.address === 'object') {
    const addr = item.address as Record<string, unknown>
    schema.address = {
      locality: addr.addressLocality ? String(addr.addressLocality) : undefined,
      region: addr.addressRegion ? String(addr.addressRegion) : undefined,
      country: addr.addressCountry ? String(addr.addressCountry) : undefined,
      streetAddress: addr.streetAddress ? String(addr.streetAddress) : undefined,
    }
  }

  // Extract geo
  if (item.geo && typeof item.geo === 'object') {
    const geo = item.geo as Record<string, unknown>
    schema.geo = {
      latitude: geo.latitude ? Number(geo.latitude) : undefined,
      longitude: geo.longitude ? Number(geo.longitude) : undefined,
    }
  }

  // Extract service areas
  if (item.areaServed) {
    if (Array.isArray(item.areaServed)) {
      schema.areaServed = item.areaServed.map(a => {
        if (typeof a === 'object' && a !== null) {
          const obj = a as Record<string, unknown>
          return obj.name ? String(obj.name) : String(a)
        }
        return String(a)
      }).filter((s): s is string => typeof s === 'string')
    } else if (typeof item.areaServed === 'object' && item.areaServed !== null) {
      const obj = item.areaServed as Record<string, unknown>
      schema.areaServed = obj.name ? String(obj.name) : String(item.areaServed)
    } else {
      schema.areaServed = String(item.areaServed)
    }
  }

  if (item.serviceArea) {
    if (Array.isArray(item.serviceArea)) {
      schema.serviceArea = item.serviceArea.map(a => {
        if (typeof a === 'object' && a !== null) {
          const obj = a as Record<string, unknown>
          return obj.name ? String(obj.name) : String(a)
        }
        return String(a)
      }).filter((s): s is string => typeof s === 'string')
    } else if (typeof item.serviceArea === 'object' && item.serviceArea !== null) {
      const obj = item.serviceArea as Record<string, unknown>
      schema.serviceArea = obj.name ? String(obj.name) : String(item.serviceArea)
    } else {
      schema.serviceArea = String(item.serviceArea)
    }
  }

  // Extract services (for Service, ProfessionalService schemas)
  if (item.hasOfferCatalog && typeof item.hasOfferCatalog === 'object') {
    const catalog = item.hasOfferCatalog as Record<string, unknown>
    if (catalog.itemListElement && Array.isArray(catalog.itemListElement)) {
      schema.services = catalog.itemListElement
        .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null)
        .map(i => i.name ? String(i.name) : '')
        .filter(Boolean)
    }
  }

  // Extract offers (products/services being offered)
  if (item.makesOffer && Array.isArray(item.makesOffer)) {
    schema.offers = item.makesOffer
      .filter((o): o is Record<string, unknown> => typeof o === 'object' && o !== null)
      .map(o => ({
        name: o.name ? String(o.name) : '',
        description: o.description ? String(o.description) : undefined,
      }))
      .filter(o => o.name)
  }

  // Extract product info
  if (type === 'Product' || type === 'Service') {
    if (item.name) {
      if (!schema.products) schema.products = []
      schema.products.push(String(item.name))
    }
  }

  // Extract locations from LocalBusiness, Organization, etc.
  if (type.includes('LocalBusiness') || type === 'Organization' || type === 'Store') {
    const locations: string[] = []
    if (schema.address?.locality) {
      let loc = schema.address.locality
      if (schema.address.region) loc += `, ${schema.address.region}`
      if (schema.address.country) loc += `, ${schema.address.country}`
      locations.push(loc)
    }
    if (locations.length > 0) {
      schema.locations = locations
    }
  }

  return schema
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

    // Extract JSON-LD schema markup
    const schemaData = extractSchemaData(html)

    return {
      url,
      path,
      title,
      description,
      h1,
      headings: headings.slice(0, 20),
      bodyText: bodyText.slice(0, 5000), // Limit text length
      wordCount,
      schemaData,
      hasMetaDescription: !!description && description.length > 20,
    }
  } catch {
    return null
  }
}

/**
 * Main crawl function
 */
export async function crawlSite(domain: string): Promise<CrawlResult> {
  // Check for sitemap and robots.txt in parallel
  const [sitemapResult, hasRobotsTxt] = await Promise.all([
    fetchSitemap(domain),
    checkRobotsTxt(domain),
  ])

  // Use sitemap URLs or fall back to discovery
  let urls = sitemapResult.urls
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

  // Aggregate schema data from all pages
  const allSchemas = pages.flatMap(p => p.schemaData)
  const schemaTypes = [...new Set(allSchemas.map(s => s.type))]

  // Extract locations from schema
  const extractedLocations: string[] = []
  for (const schema of allSchemas) {
    if (schema.locations) {
      extractedLocations.push(...schema.locations)
    }
    if (schema.areaServed) {
      const areas = Array.isArray(schema.areaServed) ? schema.areaServed : [schema.areaServed]
      extractedLocations.push(...areas.map(a => String(a)))
    }
    if (schema.serviceArea) {
      const areas = Array.isArray(schema.serviceArea) ? schema.serviceArea : [schema.serviceArea]
      extractedLocations.push(...areas.map(a => String(a)))
    }
    if (schema.address?.locality) {
      let loc = schema.address.locality
      if (schema.address.country) loc += `, ${schema.address.country}`
      extractedLocations.push(loc)
    }
  }

  // Extract services from schema
  const extractedServices: string[] = []
  for (const schema of allSchemas) {
    if (schema.services) {
      extractedServices.push(...schema.services)
    }
    if (schema.offers) {
      extractedServices.push(...schema.offers.map(o => o.name))
    }
    if (schema.type === 'Service' && schema.name) {
      extractedServices.push(schema.name)
    }
  }

  // Extract products from schema
  const extractedProducts: string[] = []
  for (const schema of allSchemas) {
    if (schema.products) {
      extractedProducts.push(...schema.products)
    }
    if (schema.type === 'Product' && schema.name) {
      extractedProducts.push(schema.name)
    }
  }

  return {
    pages,
    totalPages: pages.length,
    domain,
    hasSitemap: sitemapResult.found,
    hasRobotsTxt,
    schemaTypes,
    extractedLocations: [...new Set(extractedLocations)],
    extractedServices: [...new Set(extractedServices)],
    extractedProducts: [...new Set(extractedProducts)],
  }
}

/**
 * Combine crawled content into a single text for analysis
 */
export function combineCrawledContent(result: CrawlResult): string {
  const sections: string[] = []

  sections.push(`Domain: ${result.domain}`)
  sections.push(`Pages crawled: ${result.totalPages}`)
  sections.push(`Has sitemap: ${result.hasSitemap ? 'Yes' : 'No'}`)
  sections.push(`Has robots.txt: ${result.hasRobotsTxt ? 'Yes' : 'No'}`)

  // Include schema-extracted data upfront for the AI
  if (result.extractedLocations.length > 0) {
    sections.push(`\nLOCATIONS FROM SCHEMA MARKUP: ${result.extractedLocations.join(', ')}`)
  }
  if (result.extractedServices.length > 0) {
    sections.push(`SERVICES FROM SCHEMA MARKUP: ${result.extractedServices.join(', ')}`)
  }
  if (result.extractedProducts.length > 0) {
    sections.push(`PRODUCTS FROM SCHEMA MARKUP: ${result.extractedProducts.join(', ')}`)
  }
  if (result.schemaTypes.length > 0) {
    sections.push(`SCHEMA TYPES FOUND: ${result.schemaTypes.join(', ')}`)
  }

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
