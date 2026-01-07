/**
 * Test script to show query research results for a domain
 * Run with: npx tsx test-queries.ts [domain]
 */

// Set env vars BEFORE any imports
import { readFileSync } from 'fs'
const envContent = readFileSync('.env.local', 'utf-8')
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && !key.startsWith('#') && key.trim()) {
    process.env[key.trim()] = valueParts.join('=').trim()
  }
})

// Set both env var names the AI SDK might look for
if (process.env.VERCEL_AI_GATEWAY_KEY) {
  process.env.AI_GATEWAY_API_KEY = process.env.VERCEL_AI_GATEWAY_KEY
}

const domain = process.argv[2] || 'journ3y.com.au'

async function testQueries() {
  console.log(`\n🔍 Testing query research for: ${domain}\n`)
  console.log('='.repeat(60))

  // Dynamic imports AFTER env vars are set
  const { crawlSite, combineCrawledContent } = await import('./src/lib/ai/crawl')
  const { analyzeWebsite } = await import('./src/lib/ai/analyze')
  const { researchQueries, dedupeAndRankQueries } = await import('./src/lib/ai/query-research')
  const { detectGeography, extractTldCountry } = await import('./src/lib/geo/detect')

  // Step 1: Crawl
  console.log('\n📥 Step 1: Crawling site...')
  const crawlResult = await crawlSite(domain)
  console.log(`   Crawled ${crawlResult.totalPages} pages`)

  // Step 2: Analyze
  console.log('\n🔬 Step 2: Analyzing content...')
  const tldCountry = extractTldCountry(domain)
  const combinedContent = combineCrawledContent(crawlResult)
  const analysis = await analyzeWebsite(combinedContent, tldCountry, 'test-run')

  console.log(`   Business Type: ${analysis.businessType}`)
  console.log(`   Business Name: ${analysis.businessName}`)
  console.log(`   Location: ${analysis.location}`)
  console.log(`   Industry: ${analysis.industry}`)
  console.log(`   Services: ${analysis.services?.slice(0, 5).join(', ') || 'None'}`)
  console.log(`   Products: ${analysis.products?.slice(0, 5).join(', ') || 'None'}`)

  // Step 3: Geo detection
  const geoResult = detectGeography(domain, combinedContent, analysis.location)
  console.log(`\n🌍 Geo Detection: ${geoResult.location} (${geoResult.confidence})`)

  // Step 4: Research queries
  console.log('\n🔎 Step 3: Researching queries from each LLM...')
  console.log('   (ChatGPT uses web search, others validate)\n')

  const analysisWithGeo = {
    ...analysis,
    location: geoResult.location || analysis.location,
    geoConfidence: geoResult.confidence,
    city: geoResult.city,
    country: geoResult.country,
  }

  const rawQueries = await researchQueries(
    analysisWithGeo,
    'test-run',
    (platform) => console.log(`   ⏳ Querying ${platform}...`)
  )

  // Show raw queries by platform
  console.log('\n' + '='.repeat(60))
  console.log('📋 RAW QUERIES BY PLATFORM:')
  console.log('='.repeat(60))

  const byPlatform = rawQueries.reduce((acc, q) => {
    if (!acc[q.platform]) acc[q.platform] = []
    acc[q.platform].push(q)
    return acc
  }, {} as Record<string, typeof rawQueries>)

  for (const [platform, queries] of Object.entries(byPlatform)) {
    console.log(`\n🤖 ${platform.toUpperCase()} (${queries.length} queries):`)
    queries.forEach((q, i) => {
      console.log(`   ${i + 1}. [${q.category}] "${q.query}"`)
    })
  }

  // Step 5: Dedupe and rank
  console.log('\n' + '='.repeat(60))
  console.log('⭐ TOP 7 QUERIES (after deduplication):')
  console.log('='.repeat(60))

  const topQueries = dedupeAndRankQueries(rawQueries, 7)

  topQueries.forEach((q, i) => {
    const sources = q.suggestedBy.join(', ') || 'fallback'
    console.log(`\n${i + 1}. "${q.query}"`)
    console.log(`   Category: ${q.category}`)
    console.log(`   Suggested by: ${sources}`)
    console.log(`   Relevance score: ${q.relevanceScore}`)
  })

  console.log('\n' + '='.repeat(60))
  console.log('✅ Done!')
  console.log('='.repeat(60))
}

testQueries().catch(err => {
  console.error('\n❌ Error:', err.message)
  if (err.stack) {
    console.error(err.stack)
  }
  process.exit(1)
})
