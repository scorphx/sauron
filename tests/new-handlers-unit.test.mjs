/**
 * Unit tests for all 9 new domain handlers.
 * Tests handler logic in isolation by mocking Redis getCachedJson.
 */
import assert from 'node:assert/strict';
import { describe, it, mock, beforeEach } from 'node:test';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Helper: import a TS module with replaced import paths
async function importPatchedTs(relPath, replacements = {}) {
  const sourcePath = resolve(root, relPath);
  let source = readFileSync(sourcePath, 'utf-8');
  for (const [specifier, targetPath] of Object.entries(replacements)) {
    source = source.replaceAll(`'${specifier}'`, `'${pathToFileURL(targetPath).href}'`);
    source = source.replaceAll(`"${specifier}"`, `"${pathToFileURL(targetPath).href}"`);
  }
  const tmpDir  = mkdtempSync(join(tmpdir(), 'wm-handler-'));
  const tmpPath = join(tmpDir, 'module.ts');
  writeFileSync(tmpPath, source);
  return import(`${pathToFileURL(tmpPath).href}?t=${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function makeCtx() { return { request: new Request('http://localhost/test') }; }

// ─── Ransomware Handler ────────────────────────────────────────────────────
describe('listRansomwareVictims handler', () => {
  const SEED_DATA = {
    victims: [
      { id: 'rw:acme:1', victimName: 'ACME Corp', groupName: 'LockBit', sector: 'manufacturing', country: 'US', discoveredMs: Date.now() - 3600_000, discoveredAt: '', url: '', website: '', description: '' },
      { id: 'rw:hospital:2', victimName: 'City Hospital', groupName: 'BlackCat', sector: 'healthcare', country: 'GB', discoveredMs: Date.now() - 7200_000, discoveredAt: '', url: '', website: '', description: '' },
      { id: 'rw:bank:3', victimName: 'First Bank', groupName: 'LockBit', sector: 'finance', country: 'US', discoveredMs: Date.now() - 10800_000, discoveredAt: '', url: '', website: '', description: '' },
    ],
    groups: [{ name: 'LockBit', postCount: 2, captureDate: '', locationCount: 1 }],
    stats: { totalVictims: 3, activeGroups: 2, sectorBreakdown: { manufacturing: 1, healthcare: 1, finance: 1 }, last24hCount: 3, last7dCount: 3 },
    fetchedAt: new Date().toISOString(),
  };

  it('returns all victims when no filters applied', async () => {
    // Create a temporary redis mock module
    const redisMockPath = join(mkdtempSync(join(tmpdir(), 'redis-mock-')), 'redis.ts');
    writeFileSync(redisMockPath, `export async function getCachedJson() { return ${JSON.stringify(SEED_DATA)}; }`);

    const mod = await importPatchedTs('server/worldmonitor/ransomware/v1/list-ransomware-victims.ts', {
      '../../../_shared/redis': redisMockPath,
    });

    const result = await mod.listRansomwareVictims(makeCtx(), { pageSize: 50, cursor: '', groupName: '', sector: '', country: '', sinceMs: 0 });
    assert.equal(result.victims.length, 3);
    assert.equal(result.pagination.totalCount, 3);
  });

  it('filters by sector', async () => {
    const redisMockPath = join(mkdtempSync(join(tmpdir(), 'redis-mock-')), 'redis.ts');
    writeFileSync(redisMockPath, `export async function getCachedJson() { return ${JSON.stringify(SEED_DATA)}; }`);

    const mod = await importPatchedTs('server/worldmonitor/ransomware/v1/list-ransomware-victims.ts', {
      '../../../_shared/redis': redisMockPath,
    });

    const result = await mod.listRansomwareVictims(makeCtx(), { pageSize: 50, cursor: '', groupName: '', sector: 'healthcare', country: '', sinceMs: 0 });
    assert.equal(result.victims.length, 1);
    assert.equal(result.victims[0].sector, 'healthcare');
  });

  it('filters by groupName (case-insensitive)', async () => {
    const redisMockPath = join(mkdtempSync(join(tmpdir(), 'redis-mock-')), 'redis.ts');
    writeFileSync(redisMockPath, `export async function getCachedJson() { return ${JSON.stringify(SEED_DATA)}; }`);

    const mod = await importPatchedTs('server/worldmonitor/ransomware/v1/list-ransomware-victims.ts', {
      '../../../_shared/redis': redisMockPath,
    });

    const result = await mod.listRansomwareVictims(makeCtx(), { pageSize: 50, cursor: '', groupName: 'lockbit', sector: '', country: '', sinceMs: 0 });
    assert.equal(result.victims.length, 2);
  });

  it('paginates correctly', async () => {
    const redisMockPath = join(mkdtempSync(join(tmpdir(), 'redis-mock-')), 'redis.ts');
    writeFileSync(redisMockPath, `export async function getCachedJson() { return ${JSON.stringify(SEED_DATA)}; }`);

    const mod = await importPatchedTs('server/worldmonitor/ransomware/v1/list-ransomware-victims.ts', {
      '../../../_shared/redis': redisMockPath,
    });

    const page1 = await mod.listRansomwareVictims(makeCtx(), { pageSize: 2, cursor: '', groupName: '', sector: '', country: '', sinceMs: 0 });
    assert.equal(page1.victims.length, 2);
    assert.equal(page1.pagination.nextCursor, '2');

    const page2 = await mod.listRansomwareVictims(makeCtx(), { pageSize: 2, cursor: '2', groupName: '', sector: '', country: '', sinceMs: 0 });
    assert.equal(page2.victims.length, 1);
    assert.equal(page2.pagination.nextCursor, '');
  });

  it('returns empty response when Redis is empty', async () => {
    const redisMockPath = join(mkdtempSync(join(tmpdir(), 'redis-mock-')), 'redis.ts');
    writeFileSync(redisMockPath, `export async function getCachedJson() { return null; }`);

    const mod = await importPatchedTs('server/worldmonitor/ransomware/v1/list-ransomware-victims.ts', {
      '../../../_shared/redis': redisMockPath,
    });

    const result = await mod.listRansomwareVictims(makeCtx(), { pageSize: 50, cursor: '', groupName: '', sector: '', country: '', sinceMs: 0 });
    assert.equal(result.victims.length, 0);
    assert.equal(result.pagination.totalCount, 0);
  });
});

// ─── Breach Handler ────────────────────────────────────────────────────────
describe('listBreaches handler', () => {
  const SEED_DATA = {
    breaches: [
      { name: 'Adobe', domain: 'adobe.com', title: 'Adobe', breachDate: '2013-10-04', addedDate: '2013-12-04', pwnCount: 152445165, dataClasses: ['Email addresses', 'Passwords'], categories: ['credentials'], isVerified: true, isFabricated: false, isSensitive: false, isSpamList: false, isMalware: false, isSubscription: false, severity: 'critical' },
      { name: 'LinkedInScrape', domain: 'linkedin.com', title: 'LinkedIn Scrape', breachDate: '2021-06-01', addedDate: '2021-06-22', pwnCount: 327000000, dataClasses: ['Names'], categories: ['personal'], isVerified: false, isFabricated: false, isSensitive: false, isSpamList: false, isMalware: false, isSubscription: false, severity: 'critical' },
    ],
    recentBreaches: [],
    stats: { totalBreaches: 2, totalPwnedCount: 479445165, bySeverity: { critical: 2 }, byCategory: { credentials: 1, personal: 1 }, byYear: { '2013': 1, '2021': 1 } },
    fetchedAt: new Date().toISOString(),
  };

  it('returns all breaches with no filter', async () => {
    const redisMockPath = join(mkdtempSync(join(tmpdir(), 'redis-mock-')), 'redis.ts');
    writeFileSync(redisMockPath, `export async function getCachedJson() { return ${JSON.stringify(SEED_DATA)}; }`);

    const mod = await importPatchedTs('server/worldmonitor/breach/v1/list-breaches.ts', {
      '../../../_shared/redis': redisMockPath,
    });

    const result = await mod.listBreaches(makeCtx(), { pageSize: 50, cursor: '', severity: '', category: '', sinceDate: '' });
    assert.equal(result.breaches.length, 2);
  });

  it('filters by severity', async () => {
    const redisMockPath = join(mkdtempSync(join(tmpdir(), 'redis-mock-')), 'redis.ts');
    writeFileSync(redisMockPath, `export async function getCachedJson() { return ${JSON.stringify(SEED_DATA)}; }`);

    const mod = await importPatchedTs('server/worldmonitor/breach/v1/list-breaches.ts', {
      '../../../_shared/redis': redisMockPath,
    });

    const result = await mod.listBreaches(makeCtx(), { pageSize: 50, cursor: '', severity: 'critical', category: '', sinceDate: '' });
    assert.equal(result.breaches.length, 2);

    const noneResult = await mod.listBreaches(makeCtx(), { pageSize: 50, cursor: '', severity: 'low', category: '', sinceDate: '' });
    assert.equal(noneResult.breaches.length, 0);
  });
});

// ─── Social Pulse Handler ──────────────────────────────────────────────────
describe('listSocialPosts handler', () => {
  const SEED_DATA = {
    posts: [
      { id: 'reddit:abc', source: 'reddit', sub: 'worldnews', title: 'War update', url: 'https://reddit.com/r/worldnews/1', permalink: '', author: 'user1', ups: 5000, comments: 300, score: 4500, createdMs: Date.now() - 3600_000, topics: ['geopolitics'] },
      { id: 'hn:123', source: 'hackernews', sub: 'hackernews', title: 'Zero-day exploit', url: 'https://example.com', permalink: '', author: 'dev', ups: 200, comments: 50, score: 400, createdMs: Date.now() - 1800_000, topics: ['cybersecurity'] },
    ],
    trending: [{ topic: 'geopolitics', count: 1 }, { topic: 'cybersecurity', count: 1 }],
    stats: { totalPosts: 2, sourceBreakdown: { reddit: 1, hackernews: 1 }, fetchedAt: new Date().toISOString() },
    fetchedAt: new Date().toISOString(),
  };

  it('returns all posts with no filter', async () => {
    const redisMockPath = join(mkdtempSync(join(tmpdir(), 'redis-mock-')), 'redis.ts');
    writeFileSync(redisMockPath, `export async function getCachedJson() { return ${JSON.stringify(SEED_DATA)}; }`);

    const mod = await importPatchedTs('server/worldmonitor/social-pulse/v1/list-social-posts.ts', {
      '../../../_shared/redis': redisMockPath,
    });

    const result = await mod.listSocialPosts(makeCtx(), { pageSize: 50, cursor: '', source: '', topic: '' });
    assert.equal(result.posts.length, 2);
    assert.equal(result.trending.length, 2);
  });

  it('filters by source', async () => {
    const redisMockPath = join(mkdtempSync(join(tmpdir(), 'redis-mock-')), 'redis.ts');
    writeFileSync(redisMockPath, `export async function getCachedJson() { return ${JSON.stringify(SEED_DATA)}; }`);

    const mod = await importPatchedTs('server/worldmonitor/social-pulse/v1/list-social-posts.ts', {
      '../../../_shared/redis': redisMockPath,
    });

    const result = await mod.listSocialPosts(makeCtx(), { pageSize: 50, cursor: '', source: 'hackernews', topic: '' });
    assert.equal(result.posts.length, 1);
    assert.equal(result.posts[0].source, 'hackernews');
  });

  it('filters by topic', async () => {
    const redisMockPath = join(mkdtempSync(join(tmpdir(), 'redis-mock-')), 'redis.ts');
    writeFileSync(redisMockPath, `export async function getCachedJson() { return ${JSON.stringify(SEED_DATA)}; }`);

    const mod = await importPatchedTs('server/worldmonitor/social-pulse/v1/list-social-posts.ts', {
      '../../../_shared/redis': redisMockPath,
    });

    const result = await mod.listSocialPosts(makeCtx(), { pageSize: 50, cursor: '', source: '', topic: 'geopolitics' });
    assert.equal(result.posts.length, 1);
    assert.ok(result.posts[0].topics.includes('geopolitics'));
  });
});

// ─── Space Weather Handler ─────────────────────────────────────────────────
describe('getSpaceWeather handler', () => {
  const SEED_DATA = {
    currentKp: { time: '2025-04-07T12:00:00Z', kp: 3.5, level: 'quiet' },
    kIndex: [
      { time: '2025-04-07T00:00:00Z', kp: 1.0, level: 'quiet' },
      { time: '2025-04-07T03:00:00Z', kp: 2.0, level: 'quiet' },
      { time: '2025-04-07T06:00:00Z', kp: 3.5, level: 'quiet' },
    ],
    alerts: [],
    activeAlerts: [],
    solarRegions: [],
    summary: { overallStatus: 'quiet', maxKpLast24h: 3.5, stormLevel: 'quiet', alertCount: 0 },
    fetchedAt: new Date().toISOString(),
  };

  it('returns cached space weather data', async () => {
    const redisMockPath = join(mkdtempSync(join(tmpdir(), 'redis-mock-')), 'redis.ts');
    writeFileSync(redisMockPath, `export async function getCachedJson() { return ${JSON.stringify(SEED_DATA)}; }`);

    const mod = await importPatchedTs('server/worldmonitor/space-weather/v1/get-space-weather.ts', {
      '../../../_shared/redis': redisMockPath,
    });

    const result = await mod.getSpaceWeather(makeCtx(), {});
    assert.equal(result.kIndex.length, 3);
    assert.equal(result.summary.overallStatus, 'quiet');
    assert.ok(result.currentKp);
    assert.equal(result.currentKp.kp, 3.5);
  });

  it('returns empty response when Redis is empty', async () => {
    const redisMockPath = join(mkdtempSync(join(tmpdir(), 'redis-mock-')), 'redis.ts');
    writeFileSync(redisMockPath, `export async function getCachedJson() { return null; }`);

    const mod = await importPatchedTs('server/worldmonitor/space-weather/v1/get-space-weather.ts', {
      '../../../_shared/redis': redisMockPath,
    });

    const result = await mod.getSpaceWeather(makeCtx(), {});
    assert.equal(result.kIndex.length, 0);
    assert.equal(result.summary.overallStatus, 'quiet');
  });
});

// ─── Satellite Tracker Handler ─────────────────────────────────────────────
describe('listSatellites handler', () => {
  const SEED_DATA = {
    satellites: [
      { noradId: '25544', name: 'ISS (ZARYA)', group: 'stations', groupLabel: 'Space Stations', tleLine1: '', tleLine2: '', orbit: { inclination: 51.6, altitudeKm: 408 }, epoch: '', objectType: 'PAYLOAD', launchDate: '1998-11-20', country: 'ISS' },
      { noradId: '44235', name: 'STARLINK-1234', group: 'starlink', groupLabel: 'Starlink', tleLine1: '', tleLine2: '', orbit: { inclination: 53.0, altitudeKm: 550 }, epoch: '', objectType: 'PAYLOAD', launchDate: '2019-05-24', country: 'US' },
      { noradId: '00001', name: 'LACROSSE 1', group: 'military', groupLabel: 'US Military', tleLine1: '', tleLine2: '', orbit: { inclination: 57.0, altitudeKm: 450 }, epoch: '', objectType: 'PAYLOAD', launchDate: '1988-12-02', country: 'US' },
    ],
    iss: { noradId: '25544', name: 'ISS (ZARYA)', group: 'stations', groupLabel: 'Space Stations', tleLine1: '', tleLine2: '', orbit: { inclination: 51.6, altitudeKm: 408 }, epoch: '', objectType: 'PAYLOAD', launchDate: '1998-11-20', country: 'ISS' },
    stats: { totalSatellites: 3, byGroup: { stations: 1, starlink: 1, military: 1 } },
    fetchedAt: new Date().toISOString(),
  };

  it('returns all satellites', async () => {
    const redisMockPath = join(mkdtempSync(join(tmpdir(), 'redis-mock-')), 'redis.ts');
    writeFileSync(redisMockPath, `export async function getCachedJson() { return ${JSON.stringify(SEED_DATA)}; }`);

    const mod = await importPatchedTs('server/worldmonitor/satellite-tracker/v1/list-satellites.ts', {
      '../../../_shared/redis': redisMockPath,
    });

    const result = await mod.listSatellites(makeCtx(), { pageSize: 50, cursor: '', group: '', country: '' });
    assert.equal(result.satellites.length, 3);
    assert.ok(result.iss);
    assert.equal(result.iss.noradId, '25544');
  });

  it('filters by group', async () => {
    const redisMockPath = join(mkdtempSync(join(tmpdir(), 'redis-mock-')), 'redis.ts');
    writeFileSync(redisMockPath, `export async function getCachedJson() { return ${JSON.stringify(SEED_DATA)}; }`);

    const mod = await importPatchedTs('server/worldmonitor/satellite-tracker/v1/list-satellites.ts', {
      '../../../_shared/redis': redisMockPath,
    });

    const result = await mod.listSatellites(makeCtx(), { pageSize: 50, cursor: '', group: 'military', country: '' });
    assert.equal(result.satellites.length, 1);
    assert.equal(result.satellites[0].group, 'military');
  });

  it('filters by country', async () => {
    const redisMockPath = join(mkdtempSync(join(tmpdir(), 'redis-mock-')), 'redis.ts');
    writeFileSync(redisMockPath, `export async function getCachedJson() { return ${JSON.stringify(SEED_DATA)}; }`);

    const mod = await importPatchedTs('server/worldmonitor/satellite-tracker/v1/list-satellites.ts', {
      '../../../_shared/redis': redisMockPath,
    });

    const result = await mod.listSatellites(makeCtx(), { pageSize: 50, cursor: '', group: '', country: 'US' });
    assert.equal(result.satellites.length, 2);
    assert.ok(result.satellites.every((s) => s.country === 'US'));
  });
});

// ─── Telegram Handler ─────────────────────────────────────────────────────
describe('listTelegramPosts handler', () => {
  const SEED_DATA = {
    posts: [
      { id: 'tg:intelslava:123', channel: 'intelslava', channelLabel: 'Intel Slava Z', category: 'conflict', text: 'Breaking: Update from front line', url: 'https://t.me/intelslava/123', publishedAt: '2025-04-07T10:00:00Z', publishedMs: Date.now() - 3600_000, photoCount: 1, hasVideo: false },
      { id: 'tg:CyberSecAlert:456', channel: 'CyberSecAlert', channelLabel: 'CyberSec Alert', category: 'cybersecurity', text: 'New ransomware strain detected', url: 'https://t.me/CyberSecAlert/456', publishedAt: '2025-04-07T09:00:00Z', publishedMs: Date.now() - 7200_000, photoCount: 0, hasVideo: false },
    ],
    stats: { totalPosts: 2, channels: 6, categoryBreakdown: { conflict: 1, cybersecurity: 1 }, channelBreakdown: { intelslava: 1, CyberSecAlert: 1 } },
    fetchedAt: new Date().toISOString(),
  };

  it('returns all posts', async () => {
    const redisMockPath = join(mkdtempSync(join(tmpdir(), 'redis-mock-')), 'redis.ts');
    writeFileSync(redisMockPath, `export async function getCachedJson() { return ${JSON.stringify(SEED_DATA)}; }`);

    const mod = await importPatchedTs('server/worldmonitor/telegram/v1/list-telegram-posts.ts', {
      '../../../_shared/redis': redisMockPath,
    });

    const result = await mod.listTelegramPosts(makeCtx(), { pageSize: 50, cursor: '', channel: '', category: '' });
    assert.equal(result.posts.length, 2);
  });

  it('filters by category', async () => {
    const redisMockPath = join(mkdtempSync(join(tmpdir(), 'redis-mock-')), 'redis.ts');
    writeFileSync(redisMockPath, `export async function getCachedJson() { return ${JSON.stringify(SEED_DATA)}; }`);

    const mod = await importPatchedTs('server/worldmonitor/telegram/v1/list-telegram-posts.ts', {
      '../../../_shared/redis': redisMockPath,
    });

    const result = await mod.listTelegramPosts(makeCtx(), { pageSize: 50, cursor: '', channel: '', category: 'cybersecurity' });
    assert.equal(result.posts.length, 1);
    assert.equal(result.posts[0].category, 'cybersecurity');
  });
});
