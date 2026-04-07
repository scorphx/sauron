#!/usr/bin/env node
/**
 * seed-breach-tracker.mjs
 * Fetches the public HaveIBeenPwned breach list and aggregates breach statistics.
 * No API key required for the public /breaches endpoint.
 * Cron: daily.
 */

import { loadEnvFile, CHROME_UA, runSeed, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY  = 'breach:list:v1';
const STATS_KEY      = 'breach:stats:v1';
const CACHE_TTL      = 86400; // 24h

const HIBP_BREACHES_URL = 'https://haveibeenpwned.com/api/v3/breaches';
const HIBP_UA = 'WorldMonitor-SauronBot/1.0 (security research; contact: security@worldmonitor.app)';

function categorizeDataClasses(dataClasses) {
  const categories = { credentials: false, personal: false, financial: false, health: false, social: false };
  const dc = (dataClasses || []).map((c) => c.toLowerCase());
  if (dc.some((c) => ['passwords', 'email addresses', 'usernames'].includes(c))) categories.credentials = true;
  if (dc.some((c) => ['names', 'phone numbers', 'physical addresses', 'dates of birth'].includes(c))) categories.personal = true;
  if (dc.some((c) => ['credit cards', 'bank account numbers', 'financial data'].includes(c))) categories.financial = true;
  if (dc.some((c) => ['medical records', 'health insurance', 'health data'].includes(c))) categories.health = true;
  if (dc.some((c) => ['social media profiles', 'chat logs', 'private messages'].includes(c))) categories.social = true;
  return Object.entries(categories).filter(([, v]) => v).map(([k]) => k);
}

async function fetchBreachData() {
  const resp = await fetch(HIBP_BREACHES_URL, {
    headers: {
      'User-Agent': HIBP_UA,
      'hibp-api-key': process.env.HIBP_API_KEY || '', // optional; public endpoint works without it
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!resp.ok) throw new Error(`HIBP HTTP ${resp.status}`);

  const raw = await resp.json();
  console.log(`  Fetched ${raw.length} breaches from HIBP`);

  // Sort by breach date desc
  const breaches = raw
    .filter((b) => !b.IsRetired)
    .sort((a, b) => new Date(b.BreachDate).getTime() - new Date(a.BreachDate).getTime());

  const normalized = breaches.map((b) => ({
    name:           b.Name,
    domain:         b.Domain || '',
    title:          b.Title,
    breachDate:     b.BreachDate,
    addedDate:      b.AddedDate,
    pwnCount:       b.PwnCount,
    dataClasses:    b.DataClasses || [],
    categories:     categorizeDataClasses(b.DataClasses),
    isVerified:     b.IsVerified,
    isFabricated:   b.IsFabricated,
    isSensitive:    b.IsSensitive,
    isSpamList:     b.IsSpamList,
    isMalware:      b.IsMalware,
    isSubscription: b.IsSubscriptionBreach,
    severity:       b.PwnCount > 100_000_000 ? 'critical'
                  : b.PwnCount > 10_000_000  ? 'high'
                  : b.PwnCount > 1_000_000   ? 'medium'
                  : 'low',
  }));

  // Stats
  const totalPwned = normalized.reduce((s, b) => s + (b.pwnCount || 0), 0);
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  const byCategory = {};
  const byYear = {};

  for (const b of normalized) {
    bySeverity[b.severity] = (bySeverity[b.severity] || 0) + 1;
    for (const cat of b.categories) {
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }
    const year = b.breachDate?.slice(0, 4) || 'unknown';
    byYear[year] = (byYear[year] || 0) + 1;
  }

  // Recent (last 90 days)
  const cutoff = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
  const recentBreaches = normalized.filter((b) => b.addedDate >= cutoff).slice(0, 50);

  return {
    breaches:       normalized.slice(0, 500), // top 500 by date
    recentBreaches,
    stats: {
      totalBreaches:   normalized.length,
      totalPwnedCount: totalPwned,
      bySeverity,
      byCategory,
      byYear,
    },
    fetchedAt: new Date().toISOString(),
  };
}

await runSeed('breach', 'list', CANONICAL_KEY, fetchBreachData, {
  ttlSeconds: CACHE_TTL,
  validateFn: (d) => Array.isArray(d?.breaches) && d.breaches.length > 0,
  extraKeys: [{ key: STATS_KEY, getValue: (d) => ({ stats: d.stats, recentBreaches: d.recentBreaches, fetchedAt: d.fetchedAt }) }],
});

verifySeedKey(CANONICAL_KEY);
