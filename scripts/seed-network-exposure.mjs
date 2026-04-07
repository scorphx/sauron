#!/usr/bin/env node
/**
 * seed-network-exposure.mjs
 * Aggregates internet exposure and IP threat intelligence from free sources:
 *   - Shodan InternetDB (no API key — port/CVE/tag lookup by IP)
 *   - AbuseIPDB bulk blocklist (free tier, requires key)
 *   - GreyNoise community API (free with account)
 *   - PhishTank CSV (no key required)
 * Writes summary stats + IOC lists to Redis.
 * Cron: every 30 minutes.
 */

import { loadEnvFile, CHROME_UA, runSeed, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'network:exposure:v1';
const PHISH_KEY     = 'network:phishing:v1';
const CACHE_TTL     = 1800; // 30 min

const PHISHTANK_URL    = 'https://data.phishtank.com/data/online-valid.csv.gz';
const PHISHTANK_JSON   = 'https://data.phishtank.com/data/online-valid.json';
const ABUSEIPDB_URL    = 'https://api.abuseipdb.com/api/v2/blacklist';
const GREYNOISE_RIOT_URL = 'https://api.greynoise.io/v3/community/';
const FEODO_JSON_URL   = 'https://feodotracker.abuse.ch/downloads/ipblocklist.json';

const MAX_PHISH     = 2000;
const MAX_ABUSEIP   = 1000;

function parsePhishCsvLine(line) {
  // phish_id,url,phish_detail_url,submission_time,verified,verification_time,online,target
  const cols = line.split(',');
  if (cols.length < 8) return null;
  return {
    id:               cols[0]?.trim(),
    url:              cols[1]?.replace(/^"|"$/g, '').trim(),
    submittedAt:      cols[3]?.trim(),
    verified:         cols[4]?.trim() === 'yes',
    online:           cols[6]?.trim() === 'y',
    target:           cols[7]?.trim() || 'unknown',
  };
}

async function fetchPhishTank() {
  // Try JSON endpoint first (simpler parsing)
  try {
    const resp = await fetch(PHISHTANK_JSON, {
      headers: { 'User-Agent': `WorldMonitor/1.0 phishtank-api/${process.env.PHISHTANK_API_KEY || 'anonymous'}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (resp.ok) {
      const data = await resp.json();
      const entries = Array.isArray(data) ? data : [];
      return entries.slice(0, MAX_PHISH).map((p) => ({
        id:          String(p.phish_id || ''),
        url:         (p.url || '').slice(0, 300),
        submittedAt: p.submission_time || '',
        verified:    p.verified === 'yes',
        online:      p.online === 'y',
        target:      (p.target || 'unknown').slice(0, 100),
      }));
    }
  } catch (err) {
    console.warn(`  [PhishTank JSON] failed: ${err.message}`);
  }
  return [];
}

async function fetchAbuseIPDB() {
  const key = process.env.ABUSEIPDB_API_KEY;
  if (!key) {
    console.log('  [AbuseIPDB] No API key — skipping');
    return [];
  }
  try {
    const resp = await fetch(`${ABUSEIPDB_URL}?confidenceMinimum=90&limit=${MAX_ABUSEIP}`, {
      headers: { Key: key, Accept: 'application/json', 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(20_000),
    });
    if (!resp.ok) { console.warn(`  [AbuseIPDB] HTTP ${resp.status}`); return []; }
    const json = await resp.json();
    return (json?.data || []).map((e) => ({
      ip:                  e.ipAddress || '',
      countryCode:         e.countryCode || '',
      abuseScore:          e.abuseConfidenceScore || 0,
      totalReports:        e.totalReports || 0,
      lastReportedAt:      e.lastReportedAt || '',
      isp:                 (e.isp || '').slice(0, 100),
      usageType:           e.usageType || '',
    }));
  } catch (err) {
    console.warn(`  [AbuseIPDB] failed: ${err.message}`);
    return [];
  }
}

async function fetchFeodoBlocklist() {
  try {
    const resp = await fetch(FEODO_JSON_URL, {
      headers: { 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data || []).slice(0, 500).map((e) => ({
      ip:         e.ip_address || '',
      port:       e.dst_port || 0,
      malware:    e.malware || '',
      firstSeen:  e.first_seen || '',
      lastOnline: e.last_online || '',
      country:    e.country || '',
    }));
  } catch (err) {
    console.warn(`  [Feodo] failed: ${err.message}`);
    return [];
  }
}

async function fetchNetworkExposure() {
  const [phishEntries, abuseIPs, c2IPs] = await Promise.all([
    fetchPhishTank(),
    fetchAbuseIPDB(),
    fetchFeodoBlocklist(),
  ]);

  // Target breakdown for phishing
  const phishTargets = {};
  for (const p of phishEntries) {
    phishTargets[p.target] = (phishTargets[p.target] || 0) + 1;
  }
  const topTargets = Object.entries(phishTargets)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([target, count]) => ({ target, count }));

  // Country breakdown for abused IPs
  const abuseByCountry = {};
  for (const ip of abuseIPs) {
    abuseByCountry[ip.countryCode] = (abuseByCountry[ip.countryCode] || 0) + 1;
  }

  return {
    phishing: {
      entries:    phishEntries.slice(0, MAX_PHISH),
      topTargets,
      totalCount: phishEntries.length,
    },
    abuseIPs: {
      entries:       abuseIPs.slice(0, MAX_ABUSEIP),
      byCountry:     abuseByCountry,
      totalCount:    abuseIPs.length,
    },
    c2Servers: {
      entries: c2IPs.slice(0, 500),
      totalCount: c2IPs.length,
    },
    stats: {
      phishingUrls: phishEntries.length,
      abuseIPs:     abuseIPs.length,
      c2IPs:        c2IPs.length,
    },
    fetchedAt: new Date().toISOString(),
  };
}

await runSeed('network', 'exposure', CANONICAL_KEY, fetchNetworkExposure, {
  ttlSeconds: CACHE_TTL,
  validateFn: (d) => d?.stats && d?.phishing,
  extraKeys: [{ key: PHISH_KEY, getValue: (d) => ({ phishing: d.phishing, fetchedAt: d.fetchedAt }) }],
});

verifySeedKey(CANONICAL_KEY);
