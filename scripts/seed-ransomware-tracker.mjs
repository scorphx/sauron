#!/usr/bin/env node
/**
 * seed-ransomware-tracker.mjs
 * Fetches live ransomware victim claims from RansomWatch (https://ransomwatch.telemetry.ltd/)
 * and publishes them to Redis under 'ransomware:victims:v1'.
 *
 * RansomWatch exposes a public JSON API — no API key required.
 * Cron: every 30 minutes.
 */

import { loadEnvFile, CHROME_UA, runSeed, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'ransomware:victims:v1';
const GROUPS_KEY    = 'ransomware:groups:v1';
const CACHE_TTL     = 1800; // 30 min

const RANSOMWATCH_POSTS_URL  = 'https://raw.githubusercontent.com/joshhighet/ransomwatch/main/posts.json';
const RANSOMWATCH_GROUPS_URL = 'https://raw.githubusercontent.com/joshhighet/ransomwatch/main/groups.json';

const MAX_VICTIMS = 2000;
const LOOKBACK_DAYS = 90;

const SECTOR_KEYWORDS = {
  healthcare: ['hospital','clinic','health','medical','pharma','dental','patient'],
  finance: ['bank','financial','insurance','invest','capital','credit','asset'],
  government: ['government','gov','municipal','police','court','ministry','federal','state'],
  education: ['university','college','school','education','academy','student'],
  energy: ['energy','power','utility','grid','oil','gas','pipeline'],
  manufacturing: ['manufacturing','factory','industrial','production','steel','auto'],
  technology: ['tech','software','cyber','digital','it','data','cloud','telecom'],
  retail: ['retail','store','supermarket','grocery','fashion','consumer'],
  legal: ['law','legal','attorney','counsel','firm'],
  transport: ['transport','logistics','shipping','airline','freight','cargo'],
};

function detectSector(name, description = '') {
  const text = `${name} ${description}`.toLowerCase();
  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) return sector;
  }
  return 'other';
}

function isoToMs(isoString) {
  if (!isoString) return 0;
  try { return new Date(isoString).getTime(); } catch { return 0; }
}

async function fetchRansomwatchData() {
  const cutoffMs = Date.now() - LOOKBACK_DAYS * 86400_000;

  // Fetch posts + groups in parallel
  const [postsResp, groupsResp] = await Promise.all([
    fetch(RANSOMWATCH_POSTS_URL, {
      headers: { 'User-Agent': CHROME_UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    }),
    fetch(RANSOMWATCH_GROUPS_URL, {
      headers: { 'User-Agent': CHROME_UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    }),
  ]);

  if (!postsResp.ok) throw new Error(`RansomWatch posts HTTP ${postsResp.status}`);
  if (!groupsResp.ok) throw new Error(`RansomWatch groups HTTP ${groupsResp.status}`);

  const posts  = await postsResp.json();
  const groups = await groupsResp.json();

  console.log(`  Fetched ${posts.length} posts, ${groups.length} groups`);

  // Build group metadata map
  const groupMeta = new Map();
  for (const g of groups) {
    groupMeta.set(g.name, {
      name: g.name,
      captureDate: g.capturedate || '',
      locations: g.locations || [],
      postCount: 0,
    });
  }

  // Process posts
  const victims = [];
  for (const post of posts) {
    const postedMs = isoToMs(post.discovered);
    if (postedMs < cutoffMs) continue;

    const group = post.group_name || 'unknown';
    if (groupMeta.has(group)) groupMeta.get(group).postCount++;

    victims.push({
      id:          `rw:${post.post_title?.slice(0,40).replace(/\W+/g,'_') || Math.random().toString(36).slice(2)}:${postedMs}`,
      victimName:  (post.post_title || '').trim().slice(0, 120),
      groupName:   group,
      url:         (post.post_url || '').slice(0, 300),
      discoveredAt: post.discovered || '',
      discoveredMs: postedMs,
      sector:      detectSector(post.post_title || '', post.website || ''),
      website:     (post.website || '').slice(0, 200),
      country:     (post.country || '').toUpperCase().slice(0, 2),
      description: (post.description || '').slice(0, 500),
    });
  }

  // Sort newest first, cap
  victims.sort((a, b) => b.discoveredMs - a.discoveredMs);
  const cappedVictims = victims.slice(0, MAX_VICTIMS);

  // Group summary
  const groupSummary = [...groupMeta.values()]
    .filter((g) => g.postCount > 0)
    .sort((a, b) => b.postCount - a.postCount)
    .slice(0, 100)
    .map((g) => ({
      name:        g.name,
      postCount:   g.postCount,
      captureDate: g.captureDate,
      locationCount: (g.locations || []).length,
    }));

  const stats = {
    totalVictims:  cappedVictims.length,
    activeGroups:  groupSummary.length,
    sectorBreakdown: {},
    last24hCount:  0,
    last7dCount:   0,
  };

  const now = Date.now();
  for (const v of cappedVictims) {
    stats.sectorBreakdown[v.sector] = (stats.sectorBreakdown[v.sector] || 0) + 1;
    if (v.discoveredMs > now - 86400_000) stats.last24hCount++;
    if (v.discoveredMs > now - 7 * 86400_000) stats.last7dCount++;
  }

  return {
    victims: cappedVictims,
    groups:  groupSummary,
    stats,
    fetchedAt: new Date().toISOString(),
  };
}

await runSeed('ransomware', 'victims', CANONICAL_KEY, fetchRansomwatchData, {
  ttlSeconds: CACHE_TTL,
  validateFn: (d) => Array.isArray(d?.victims),
  extraKeys: [{ key: GROUPS_KEY, getValue: (d) => ({ groups: d.groups, fetchedAt: d.fetchedAt }) }],
});

verifySeedKey(CANONICAL_KEY);
