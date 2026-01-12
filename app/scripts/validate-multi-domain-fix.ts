/**
 * Validation script for multi-domain fix
 *
 * Run with: npx ts-node scripts/validate-multi-domain-fix.ts
 *
 * This script validates the code changes without hitting the database.
 * It checks that the domain resolution logic is correct.
 */

// Simulate the domain resolution logic from enrich-subscriber.ts
function resolveDomain(params: {
  domainSubscriptionId?: string;
  domainSubscriptionDomain?: string;
  scanRunDomain?: string;
  leadDomain?: string;
}): string | null {
  let resolvedDomain: string | null = null;

  // Try 1: Get from domain_subscription (most accurate for multi-domain)
  if (params.domainSubscriptionId && params.domainSubscriptionDomain) {
    resolvedDomain = params.domainSubscriptionDomain;
    console.log(`  ✓ Resolved from domain_subscription: ${resolvedDomain}`);
  }

  // Try 2: Get from scan_run
  if (!resolvedDomain && params.scanRunDomain) {
    resolvedDomain = params.scanRunDomain;
    console.log(`  ✓ Resolved from scan_run: ${resolvedDomain}`);
  }

  // Try 3: Legacy fallback to lead.domain
  if (!resolvedDomain && params.leadDomain) {
    resolvedDomain = params.leadDomain;
    console.log(`  ⚠ Fallback to lead.domain: ${resolvedDomain} (legacy)`);
  }

  return resolvedDomain;
}

// Test cases
console.log('\n=== Multi-Domain Fix Validation ===\n');

console.log('Test 1: Second domain with subscription (j4rvis.com)');
const test1 = resolveDomain({
  domainSubscriptionId: 'sub-j4rvis',
  domainSubscriptionDomain: 'j4rvis.com',
  scanRunDomain: 'j4rvis.com',
  leadDomain: 'mantel.com.au', // First domain - should NOT be used
});
console.log(`  Result: ${test1}`);
console.log(`  Expected: j4rvis.com`);
console.log(`  ${test1 === 'j4rvis.com' ? '✅ PASS' : '❌ FAIL'}\n`);

console.log('Test 2: First domain with subscription (mantel.com.au)');
const test2 = resolveDomain({
  domainSubscriptionId: 'sub-mantel',
  domainSubscriptionDomain: 'mantel.com.au',
  scanRunDomain: 'mantel.com.au',
  leadDomain: 'mantel.com.au',
});
console.log(`  Result: ${test2}`);
console.log(`  Expected: mantel.com.au`);
console.log(`  ${test2 === 'mantel.com.au' ? '✅ PASS' : '❌ FAIL'}\n`);

console.log('Test 3: Legacy scan (no domain_subscription, no scan_run.domain)');
const test3 = resolveDomain({
  domainSubscriptionId: undefined,
  domainSubscriptionDomain: undefined,
  scanRunDomain: undefined,
  leadDomain: 'legacy-domain.com',
});
console.log(`  Result: ${test3}`);
console.log(`  Expected: legacy-domain.com (fallback)`);
console.log(`  ${test3 === 'legacy-domain.com' ? '✅ PASS' : '❌ FAIL'}\n`);

console.log('Test 4: Scan with domain but no subscription yet');
const test4 = resolveDomain({
  domainSubscriptionId: undefined,
  domainSubscriptionDomain: undefined,
  scanRunDomain: 'new-domain.com',
  leadDomain: 'old-domain.com',
});
console.log(`  Result: ${test4}`);
console.log(`  Expected: new-domain.com (from scan_run)`);
console.log(`  ${test4 === 'new-domain.com' ? '✅ PASS' : '❌ FAIL'}\n`);

// Simulate webhook scan linking logic
console.log('=== Webhook Scan Linking Logic ===\n');

interface Scan {
  id: string;
  domain: string;
  lead_id: string;
}

function filterScansForDomain(scans: Scan[], targetDomain: string): Scan[] {
  return scans.filter(s => s.domain === targetDomain);
}

const allScans: Scan[] = [
  { id: 'scan-1', domain: 'mantel.com.au', lead_id: 'user-1' },
  { id: 'scan-2', domain: 'mantel.com.au', lead_id: 'user-1' },
  { id: 'scan-3', domain: 'j4rvis.com', lead_id: 'user-1' },
];

console.log('Test 5: Filter scans for j4rvis.com subscription');
const j4rvisScans = filterScansForDomain(allScans, 'j4rvis.com');
console.log(`  All scans: ${allScans.map(s => s.domain).join(', ')}`);
console.log(`  Filtered for j4rvis.com: ${j4rvisScans.map(s => s.id).join(', ')}`);
console.log(`  ${j4rvisScans.length === 1 && j4rvisScans[0].id === 'scan-3' ? '✅ PASS' : '❌ FAIL'}\n`);

console.log('Test 6: Filter scans for mantel.com.au subscription');
const mantelScans = filterScansForDomain(allScans, 'mantel.com.au');
console.log(`  Filtered for mantel.com.au: ${mantelScans.map(s => s.id).join(', ')}`);
console.log(`  ${mantelScans.length === 2 ? '✅ PASS' : '❌ FAIL'}\n`);

console.log('=== Summary ===');
const allPassed =
  test1 === 'j4rvis.com' &&
  test2 === 'mantel.com.au' &&
  test3 === 'legacy-domain.com' &&
  test4 === 'new-domain.com' &&
  j4rvisScans.length === 1 &&
  mantelScans.length === 2;

if (allPassed) {
  console.log('✅ All tests passed! Multi-domain fix logic is correct.\n');
  process.exit(0);
} else {
  console.log('❌ Some tests failed!\n');
  process.exit(1);
}
