/**
 * Enhanced geographic detection combining TLD analysis, hreflang tags, and website content.
 * Signal priority: hreflang > schema address > content signals (phone/ABN/states) > TLD
 */

// Country name to ISO 3166-1 alpha-2 code mapping
const COUNTRY_TO_ISO: Record<string, string> = {
  'Australia': 'AU',
  'New Zealand': 'NZ',
  'United Kingdom': 'GB',
  'Germany': 'DE',
  'France': 'FR',
  'Spain': 'ES',
  'Italy': 'IT',
  'Netherlands': 'NL',
  'Belgium': 'BE',
  'Austria': 'AT',
  'Switzerland': 'CH',
  'Sweden': 'SE',
  'Norway': 'NO',
  'Denmark': 'DK',
  'Finland': 'FI',
  'Ireland': 'IE',
  'Poland': 'PL',
  'Portugal': 'PT',
  'Czech Republic': 'CZ',
  'Greece': 'GR',
  'Canada': 'CA',
  'Mexico': 'MX',
  'Brazil': 'BR',
  'Argentina': 'AR',
  'Colombia': 'CO',
  'Chile': 'CL',
  'Japan': 'JP',
  'China': 'CN',
  'South Korea': 'KR',
  'India': 'IN',
  'Singapore': 'SG',
  'Hong Kong': 'HK',
  'Taiwan': 'TW',
  'Malaysia': 'MY',
  'Thailand': 'TH',
  'Philippines': 'PH',
  'Indonesia': 'ID',
  'Vietnam': 'VN',
  'United Arab Emirates': 'AE',
  'Saudi Arabia': 'SA',
  'Israel': 'IL',
  'South Africa': 'ZA',
  'Egypt': 'EG',
  'Nigeria': 'NG',
  'Kenya': 'KE',
  'United States': 'US',
};

// Country code top-level domains mapped to country names
const TLD_COUNTRIES: Record<string, string> = {
  // Oceania
  '.au': 'Australia',
  '.com.au': 'Australia',
  '.net.au': 'Australia',
  '.org.au': 'Australia',
  '.nz': 'New Zealand',
  '.co.nz': 'New Zealand',

  // Europe
  '.uk': 'United Kingdom',
  '.co.uk': 'United Kingdom',
  '.org.uk': 'United Kingdom',
  '.de': 'Germany',
  '.fr': 'France',
  '.es': 'Spain',
  '.it': 'Italy',
  '.nl': 'Netherlands',
  '.be': 'Belgium',
  '.at': 'Austria',
  '.ch': 'Switzerland',
  '.se': 'Sweden',
  '.no': 'Norway',
  '.dk': 'Denmark',
  '.fi': 'Finland',
  '.ie': 'Ireland',
  '.pl': 'Poland',
  '.pt': 'Portugal',
  '.cz': 'Czech Republic',
  '.gr': 'Greece',

  // Americas
  '.ca': 'Canada',
  '.mx': 'Mexico',
  '.br': 'Brazil',
  '.ar': 'Argentina',
  '.cl': 'Chile',

  // Asia
  '.jp': 'Japan',
  '.cn': 'China',
  '.kr': 'South Korea',
  '.in': 'India',
  '.sg': 'Singapore',
  '.hk': 'Hong Kong',
  '.tw': 'Taiwan',
  '.my': 'Malaysia',
  '.th': 'Thailand',
  '.ph': 'Philippines',
  '.id': 'Indonesia',
  '.vn': 'Vietnam',

  // Middle East & Africa
  '.ae': 'United Arab Emirates',
  '.sa': 'Saudi Arabia',
  '.il': 'Israel',
  '.za': 'South Africa',
  '.eg': 'Egypt',
  '.ng': 'Nigeria',
  '.ke': 'Kenya',
};

// TLDs that are widely used as generic brand TLDs — NOT reliable geo signals
// .co is Colombia's ccTLD but used globally (like .io, .ai, .me)
const GENERIC_TLDS = new Set(['.co', '.io', '.ai', '.me', '.app', '.dev', '.ly', '.so', '.tv', '.fm', '.gg'])

// ISO country codes from hreflang tags → country names
const HREFLANG_COUNTRY_MAP: Record<string, string> = {
  'AU': 'Australia', 'NZ': 'New Zealand', 'GB': 'United Kingdom',
  'US': 'United States', 'CA': 'Canada', 'IE': 'Ireland',
  'SG': 'Singapore', 'IN': 'India', 'ZA': 'South Africa',
  'DE': 'Germany', 'FR': 'France', 'ES': 'Spain', 'IT': 'Italy',
  'NL': 'Netherlands', 'BE': 'Belgium', 'AT': 'Austria', 'CH': 'Switzerland',
  'SE': 'Sweden', 'NO': 'Norway', 'DK': 'Denmark', 'FI': 'Finland',
  'PL': 'Poland', 'PT': 'Portugal', 'GR': 'Greece', 'JP': 'Japan',
  'CN': 'China', 'KR': 'South Korea', 'HK': 'Hong Kong', 'TW': 'Taiwan',
  'MY': 'Malaysia', 'TH': 'Thailand', 'PH': 'Philippines', 'ID': 'Indonesia',
  'AE': 'United Arab Emirates', 'SA': 'Saudi Arabia', 'IL': 'Israel',
  'BR': 'Brazil', 'MX': 'Mexico', 'AR': 'Argentina', 'CL': 'Chile',
}

/**
 * Extract target countries from hreflang link tags in HTML.
 * Returns countries in order of appearance — the first is usually the primary market.
 * e.g. <link rel="alternate" hreflang="en-AU" href="..."> → ["Australia"]
 */
export function extractHreflangCountries(html: string): string[] {
  const countries: string[] = []
  const seen = new Set<string>()

  const matches = html.matchAll(/<link[^>]*hreflang=["']([^"']+)["'][^>]*/gi)
  for (const match of matches) {
    const tag = match[1].trim()
    if (tag === 'x-default') continue
    const parts = tag.split('-')
    if (parts.length >= 2) {
      const code = parts[parts.length - 1].toUpperCase()
      const country = HREFLANG_COUNTRY_MAP[code]
      if (country && !seen.has(code)) {
        seen.add(code)
        countries.push(country)
      }
    }
  }
  return countries
}

// Major cities by country for location validation
const MAJOR_CITIES: Record<string, string[]> = {
  'Australia': ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Canberra', 'Newcastle', 'Hobart', 'Darwin'],
  'United Kingdom': ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Liverpool', 'Edinburgh', 'Bristol', 'Cardiff', 'Belfast'],
  'United States': ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'San Francisco', 'Seattle', 'Miami', 'Boston', 'Denver'],
  'Canada': ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Edmonton', 'Ottawa', 'Winnipeg', 'Halifax'],
  'New Zealand': ['Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Dunedin'],
  'Germany': ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Düsseldorf', 'Stuttgart'],
  'France': ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Bordeaux', 'Lille'],
  'Singapore': ['Singapore'],
  'India': ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Pune'],
};

// Australian states for more specific location detection
const AUSTRALIAN_STATES: Record<string, string> = {
  'NSW': 'New South Wales',
  'VIC': 'Victoria',
  'QLD': 'Queensland',
  'WA': 'Western Australia',
  'SA': 'South Australia',
  'TAS': 'Tasmania',
  'ACT': 'Australian Capital Territory',
  'NT': 'Northern Territory',
};

export interface GeoDetectionResult {
  location: string | null;
  country: string | null;
  city: string | null;
  confidence: 'high' | 'medium' | 'low';
  tldCountry: string | null;
  contentCountry: string | null;
  signals: string[];
}

/**
 * Convert country name to ISO 3166-1 alpha-2 code
 */
export function countryToIsoCode(countryName: string | null): string | null {
  if (!countryName) return null;
  return COUNTRY_TO_ISO[countryName] || null;
}

/**
 * Extract country from domain TLD
 */
export function extractTldCountry(domain: string): string | null {
  const lowerDomain = domain.toLowerCase();

  // Check for country-code TLDs (longest match first)
  const sortedTlds = Object.keys(TLD_COUNTRIES).sort((a, b) => b.length - a.length);

  for (const tld of sortedTlds) {
    if (lowerDomain.endsWith(tld)) {
      // Skip TLDs that are commonly used as generic brand TLDs
      if (GENERIC_TLDS.has(tld)) return null;
      return TLD_COUNTRIES[tld];
    }
  }

  return null;
}

/**
 * Detect location mentions in website content
 */
export function detectLocationFromContent(content: string): { country: string | null; city: string | null; signals: string[] } {
  const signals: string[] = [];
  let detectedCountry: string | null = null;
  let detectedCity: string | null = null;

  const contentLower = content.toLowerCase();

  // Check for Australian phone numbers (04xx, +61, 02, 03, 07, 08)
  if (/\+61|\b04\d{2}\s?\d{3}\s?\d{3}\b|\b0[2378]\s?\d{4}\s?\d{4}\b/.test(content)) {
    signals.push('Australian phone number detected');
    detectedCountry = 'Australia';
  }

  // Check for UK phone numbers (+44, 07xxx)
  if (/\+44|\b07\d{3}\s?\d{6}\b|\b0[12]\d{2,3}\s?\d{3,4}\s?\d{3,4}\b/.test(content)) {
    signals.push('UK phone number detected');
    if (!detectedCountry) detectedCountry = 'United Kingdom';
  }

  // Check for ABN (Australian Business Number)
  if (/\bABN[\s:]*\d{2}\s?\d{3}\s?\d{3}\s?\d{3}\b/i.test(content)) {
    signals.push('ABN detected');
    detectedCountry = 'Australia';
  }

  // Check for Australian states
  for (const [abbr, fullName] of Object.entries(AUSTRALIAN_STATES)) {
    const pattern = new RegExp(`\\b${abbr}\\b|\\b${fullName}\\b`, 'i');
    if (pattern.test(content)) {
      signals.push(`Australian state "${abbr}" mentioned`);
      detectedCountry = 'Australia';
      break;
    }
  }

  // Check for major city mentions
  // Common words that match city names but aren't locations
  const cityFalsePositives: Record<string, string[]> = {
    'Nice': ['nice to', 'nice work', 'nice job', 'very nice', 'a nice', 'be nice', 'how nice', 'really nice', 'so nice'],
    'Reading': ['reading the', 'reading this', 'reading our', 'reading more', 'keep reading', 'continue reading'],
    'Mobile': ['mobile app', 'mobile phone', 'mobile device', 'mobile friendly', 'mobile version', 'mobile responsive'],
    'Orange': ['orange color', 'orange button', 'orange text'],
  };

  for (const [country, cities] of Object.entries(MAJOR_CITIES)) {
    for (const city of cities) {
      // More specific matching - look for city in context
      const cityPattern = new RegExp(`\\b${city}\\b`, 'i');
      if (cityPattern.test(content)) {
        // Check for false positives (common words that aren't location references)
        const falsePositivePatterns = cityFalsePositives[city] || [];
        const isFalsePositive = falsePositivePatterns.some(fp =>
          contentLower.includes(fp.toLowerCase())
        );

        if (isFalsePositive) {
          // Skip this city, it's likely a common word usage
          continue;
        }

        // Verify it's in a location context (not just a person named Sydney, etc.)
        const contextPatterns = [
          new RegExp(`(in|at|near|around|serving|based in|located in|office in)\\s+${city}`, 'i'),
          new RegExp(`${city}\\s+(area|region|metro|cbd|city|office|branch)`, 'i'),
          new RegExp(`${city},?\\s+(NSW|VIC|QLD|WA|SA|TAS|ACT|NT|Australia|UK|USA|Canada)`, 'i'),
        ];

        const hasLocationContext = contextPatterns.some(p => p.test(content));
        if (hasLocationContext) {
          signals.push(`City "${city}" mentioned in location context`);
          detectedCity = city;
          if (!detectedCountry) detectedCountry = country;
          break;
        }
        // Without explicit location context, DON'T set the city
        // This prevents false positives like "nice" being detected as Nice, France
      }
    }
    if (detectedCity) break;
  }

  // Check for ABN / ACN (Australian Business Number / Company Number)
  if (/\bABN[\s:]*\d{2}\s?\d{3}\s?\d{3}\s?\d{3}\b/i.test(content) ||
      /\bACN[\s:]*\d{3}\s?\d{3}\s?\d{3}\b/i.test(content)) {
    signals.push('Australian business registration number (ABN/ACN) detected');
    detectedCountry = 'Australia';
  }

  // Check for Australian mobile carriers (strong signal for AU-market products)
  if (/\b(telstra|optus|vodafone australia)\b/i.test(content)) {
    signals.push('Australian mobile carrier detected');
    if (!detectedCountry) detectedCountry = 'Australia';
  }

  // Check for NZ carriers
  if (/\b(spark nz|2degrees|vodafone new zealand)\b/i.test(content)) {
    signals.push('New Zealand mobile carrier detected');
    if (!detectedCountry) detectedCountry = 'New Zealand';
  }

  // Check for UK carriers
  if (/\b(ee mobile|o2 uk|three uk|bt mobile|giffgaff)\b/i.test(content)) {
    signals.push('UK mobile carrier detected');
    if (!detectedCountry) detectedCountry = 'United Kingdom';
  }

  // Legal jurisdiction mentions in T&C / privacy policy
  const auJurisdiction = /governed by the laws of\s+(new south wales|victoria|queensland|western australia|south australia|tasmania|australia)/i
  if (auJurisdiction.test(content)) {
    signals.push('Australian legal jurisdiction detected');
    detectedCountry = 'Australia';
  }
  if (/governed by the laws of (england|scotland|wales|united kingdom)/i.test(content)) {
    signals.push('UK legal jurisdiction detected');
    if (!detectedCountry) detectedCountry = 'United Kingdom';
  }

  // Check for currency symbols and mentions
  if (/\bAUD\b|A\$\d/.test(content)) {
    signals.push('Australian dollar (AUD) detected');
    if (!detectedCountry) detectedCountry = 'Australia';
  }
  if (/\$\d|AUD|A\$/i.test(content) && contentLower.includes('australia')) {
    signals.push('Australian currency + country name detected');
    if (!detectedCountry) detectedCountry = 'Australia';
  }
  if (/£\d|GBP/i.test(content)) {
    signals.push('British currency detected');
    if (!detectedCountry) detectedCountry = 'United Kingdom';
  }
  if (/€\d|EUR/i.test(content)) {
    signals.push('Euro currency detected');
    // Can't determine specific country from Euro alone
  }

  return { country: detectedCountry, city: detectedCity, signals };
}

/**
 * Combine multiple geo signals into a final location with confidence.
 * Priority: hreflang > content signals (phone/ABN/carriers/legal) > TLD
 */
export function combineGeoSignals(
  tldCountry: string | null,
  contentLocation: { country: string | null; city: string | null },
  aiExtractedLocation: string | null,
  hreflangCountries: string[] = []
): GeoDetectionResult {
  const signals: string[] = [];
  let finalCountry: string | null = null;
  let finalCity: string | null = null;
  let confidence: 'high' | 'medium' | 'low' = 'low';

  // Priority 1: Hreflang — set deliberately by the business for SEO geo-targeting
  if (hreflangCountries.length > 0) {
    signals.push(`Hreflang tags target: ${hreflangCountries.join(', ')}`);
    if (hreflangCountries.length === 1) {
      // Single market — definitive
      finalCountry = hreflangCountries[0];
      confidence = 'high';
    } else {
      // Multi-market — use content/TLD to pick the primary; fall back to first hreflang
      const contentConfirmed = hreflangCountries.find(c => contentLocation.country === c);
      const tldConfirmed = hreflangCountries.find(c => tldCountry === c);
      finalCountry = contentConfirmed || tldConfirmed || hreflangCountries[0];
      confidence = (contentConfirmed || tldConfirmed) ? 'high' : 'medium';
    }
  }

  // Priority 2: Content signals (phone numbers, ABN, carriers, legal text)
  if (contentLocation.country) {
    signals.push(`Content signals found: ${contentLocation.country}`);
    if (!finalCountry) {
      finalCountry = contentLocation.country;
      confidence = 'medium';
    } else if (finalCountry === contentLocation.country && confidence !== 'high') {
      confidence = 'high';
    }
  }

  if (contentLocation.city) {
    finalCity = contentLocation.city;
    signals.push(`City detected: ${contentLocation.city}`);
  }

  // Priority 3: TLD — weakest signal, only use as fallback
  if (tldCountry && !finalCountry) {
    signals.push(`TLD indicates ${tldCountry}`);
    finalCountry = tldCountry;
    // Keep confidence low — TLD alone is weak
  }

  // AI extracted location: use for city detail and confidence confirmation
  if (aiExtractedLocation) {
    signals.push(`AI analysis found: ${aiExtractedLocation}`);

    if (!finalCity) {
      for (const cities of Object.values(MAJOR_CITIES)) {
        for (const city of cities) {
          if (aiExtractedLocation.toLowerCase().includes(city.toLowerCase())) {
            finalCity = city;
            break;
          }
        }
        if (finalCity) break;
      }
    }

    if (finalCountry && aiExtractedLocation.toLowerCase().includes(finalCountry.toLowerCase())) {
      if (confidence === 'medium') confidence = 'high';
    }
  }

  // Build final location string
  let location: string | null = null;
  if (finalCity && finalCountry) {
    location = `${finalCity}, ${finalCountry}`;
    if (confidence === 'low') confidence = 'medium';
  } else if (finalCity) {
    location = finalCity;
  } else if (finalCountry) {
    location = finalCountry;
  }

  return {
    location,
    country: finalCountry,
    city: finalCity,
    confidence,
    tldCountry,
    contentCountry: contentLocation.country,
    signals
  };
}

/**
 * Main function: Detect geographic location from domain, hreflang tags, and content.
 * Pass hreflangCountries from the crawl result for best accuracy.
 */
export function detectGeography(
  domain: string,
  websiteContent: string,
  aiExtractedLocation: string | null = null,
  hreflangCountries: string[] = []
): GeoDetectionResult {
  const tldCountry = extractTldCountry(domain);
  const contentLocation = detectLocationFromContent(websiteContent);
  const result = combineGeoSignals(tldCountry, contentLocation, aiExtractedLocation, hreflangCountries);
  result.signals = [...result.signals, ...contentLocation.signals];
  return result;
}
