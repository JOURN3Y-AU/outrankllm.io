/**
 * Enhanced geographic detection combining TLD analysis and website content
 */

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
  '.co': 'Colombia',
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
 * Extract country from domain TLD
 */
export function extractTldCountry(domain: string): string | null {
  const lowerDomain = domain.toLowerCase();

  // Check for country-code TLDs (longest match first)
  const sortedTlds = Object.keys(TLD_COUNTRIES).sort((a, b) => b.length - a.length);

  for (const tld of sortedTlds) {
    if (lowerDomain.endsWith(tld)) {
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
  for (const [country, cities] of Object.entries(MAJOR_CITIES)) {
    for (const city of cities) {
      // More specific matching - look for city in context
      const cityPattern = new RegExp(`\\b${city}\\b`, 'i');
      if (cityPattern.test(content)) {
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
        } else {
          // Still note it but with lower confidence
          signals.push(`City "${city}" mentioned (no explicit location context)`);
          if (!detectedCity) detectedCity = city;
          if (!detectedCountry) detectedCountry = country;
        }
      }
    }
    if (detectedCity) break;
  }

  // Check for currency symbols and mentions
  if (/\$\d|AUD|A\$/i.test(content) && contentLower.includes('australia')) {
    signals.push('Australian currency detected');
    if (!detectedCountry) detectedCountry = 'Australia';
  }
  if (/£\d|GBP/i.test(content)) {
    signals.push('British currency detected');
    if (!detectedCountry) detectedCountry = 'United Kingdom';
  }
  if (/€\d|EUR/i.test(content)) {
    signals.push('Euro currency detected');
    // Can't determine specific country from Euro
  }

  return { country: detectedCountry, city: detectedCity, signals };
}

/**
 * Combine multiple geo signals into a final location with confidence
 */
export function combineGeoSignals(
  tldCountry: string | null,
  contentLocation: { country: string | null; city: string | null },
  aiExtractedLocation: string | null
): GeoDetectionResult {
  const signals: string[] = [];
  let finalCountry: string | null = null;
  let finalCity: string | null = null;
  let confidence: 'high' | 'medium' | 'low' = 'low';

  // Start with TLD if available
  if (tldCountry) {
    signals.push(`TLD indicates ${tldCountry}`);
    finalCountry = tldCountry;
  }

  // Content analysis provides additional signals
  if (contentLocation.country) {
    signals.push(`Content analysis found ${contentLocation.country}`);
    if (finalCountry && finalCountry === contentLocation.country) {
      // TLD and content agree - high confidence
      confidence = 'high';
    } else if (!finalCountry) {
      finalCountry = contentLocation.country;
      confidence = 'medium';
    }
  }

  if (contentLocation.city) {
    finalCity = contentLocation.city;
    signals.push(`City detected: ${contentLocation.city}`);
  }

  // AI extracted location can provide city-level detail
  if (aiExtractedLocation) {
    signals.push(`AI analysis found: ${aiExtractedLocation}`);

    // Try to extract city from AI location
    if (!finalCity && aiExtractedLocation) {
      // Check if AI location contains a known city
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

    // If AI location mentions a country we already detected, increase confidence
    if (finalCountry && aiExtractedLocation.toLowerCase().includes(finalCountry.toLowerCase())) {
      confidence = 'high';
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

  // Adjust confidence based on signal count
  if (signals.length >= 3 && confidence === 'medium') {
    confidence = 'high';
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
 * Main function: Detect geographic location from domain and content
 */
export function detectGeography(
  domain: string,
  websiteContent: string,
  aiExtractedLocation: string | null = null
): GeoDetectionResult {
  // Step 1: Extract TLD country
  const tldCountry = extractTldCountry(domain);

  // Step 2: Analyze website content for location signals
  const contentLocation = detectLocationFromContent(websiteContent);

  // Step 3: Combine all signals
  const result = combineGeoSignals(tldCountry, contentLocation, aiExtractedLocation);

  // Add content signals to result
  result.signals = [...result.signals, ...contentLocation.signals];

  return result;
}
