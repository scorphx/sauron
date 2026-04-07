/**
 * Integration tests: full pipeline for all 9 new domains.
 * Simulates: seed data written to in-memory Redis mock → handler reads it → HTTP response verified.
 * 
 * Uses the same in-memory mock pattern as existing redis-caching.test.mjs.
 * No real Redis or network calls are made.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

/** Write an in-memory Redis mock that returns a fixed value for any key */
function writeRedisMock(dir, seedData) {
  const path = join(dir, 'redis.ts');
  writeFileSync(path, `
const DATA = ${JSON.stringify(seedData)};
export async function getCachedJson(key, raw) { return DATA; }
export async function setCachedJson() {}
export async function getRawJson() { return DATA; }
`);
  return path;
}

/** Import a TS handler file with remapped imports */
async function importHandler(relPath, replacements) {
  const sourcePath = resolve(root, relPath);
  let source = readFileSync(sourcePath, 'utf-8');
  for (const [from, to] of Object.entries(replacements)) {
    source = source.replaceAll(`'${from}'`, `'${pathToFileURL(to).href}'`);
    source = source.replaceAll(`"${from}"`, `"${pathToFileURL(to).href}"`);
  }
  const tmpDir  = mkdtempSync(join(tmpdir(), 'wm-int-'));
  const tmpPath = join(tmpDir, basename(sourcePath));
  writeFileSync(tmpPath, source);
  return import(`${pathToFileURL(tmpPath).href}?t=${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

/** Import a generated service_server.ts and create the route handler */
async function importServiceServer(relPath) {
  const sourcePath = resolve(root, relPath);
  let source = readFileSync(sourcePath, 'utf-8');
  const tmpDir  = mkdtempSync(join(tmpdir(), 'wm-ss-'));
  const tmpPath = join(tmpDir, 'service_server.ts');
  writeFileSync(tmpPath, source);
  return import(`${pathToFileURL(tmpPath).href}?t=${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

/** Create a mock request and check handler returns valid JSON */
async function checkRoute(handler, method, path, query = '') {
  const req = new Request(`http://localhost${path}${query}`, { method });
  const routes = handler.routes;
  const route = routes.find((r) => r.method === method && r.path === path);
  assert.ok(route, `Route ${method} ${path} not found`);
  const resp = await route.handler(req);
  assert.equal(resp.status, 200);
  const json = await resp.json();
  assert.ok(typeof json === 'object' && json !== null);
  return json;
}

// ─── Ransomware Pipeline ───────────────────────────────────────────────────
describe('ransomware pipeline integration', () => {
  const SEED = {
    victims: [
      { id: 'rw:test:1', victimName: 'Test Corp', groupName: 'TestGroup', sector: 'technology', country: 'US', discoveredMs: Date.now() - 1000, discoveredAt: '2025-04-07T00:00:00Z', url: '', website: '', description: '' },
    ],
    groups: [{ name: 'TestGroup', postCount: 1, captureDate: '', locationCount: 0 }],
    stats: { totalVictims: 1, activeGroups: 1, sectorBreakdown: { technology: 1 }, last24hCount: 1, last7dCount: 1 },
    fetchedAt: new Date().toISOString(),
  };

  it('serves victims through generated route handler', async () => {
    const mockDir    = mkdtempSync(join(tmpdir(), 'wm-rw-'));
    const redisMock  = writeRedisMock(mockDir, SEED);

    const handlerMod = await importHandler('server/worldmonitor/ransomware/v1/list-ransomware-victims.ts', {
      '../../../_shared/redis': redisMock,
    });

    const ssMod = await importServiceServer('src/generated/server/worldmonitor/ransomware/v1/service_server.ts');
    const routes = ssMod.createRansomwareServiceRoutes({ listRansomwareVictims: handlerMod.listRansomwareVictims });

    const req  = new Request('http://localhost/api/ransomware/v1/list-ransomware-victims?page_size=10');
    const route = routes.find((r) => r.path === '/api/ransomware/v1/list-ransomware-victims');
    assert.ok(route, 'ransomware route must exist');
    const resp = await route.handler(req);
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.equal(body.victims.length, 1);
    assert.equal(body.victims[0].victimName, 'Test Corp');
    assert.equal(body.pagination.totalCount, 1);
  });
});

// ─── Breach Pipeline ───────────────────────────────────────────────────────
describe('breach pipeline integration', () => {
  const SEED = {
    breaches: [
      { name: 'TestBreach', domain: 'test.com', title: 'Test Breach', breachDate: '2024-01-01', addedDate: '2024-01-15', pwnCount: 5000000, dataClasses: ['Passwords'], categories: ['credentials'], isVerified: true, isFabricated: false, isSensitive: false, isSpamList: false, isMalware: false, isSubscription: false, severity: 'medium' },
    ],
    recentBreaches: [],
    stats: { totalBreaches: 1, totalPwnedCount: 5000000, bySeverity: { medium: 1 }, byCategory: { credentials: 1 }, byYear: { '2024': 1 } },
    fetchedAt: new Date().toISOString(),
  };

  it('serves breach list through route handler', async () => {
    const mockDir   = mkdtempSync(join(tmpdir(), 'wm-br-'));
    const redisMock = writeRedisMock(mockDir, SEED);
    const handlerMod = await importHandler('server/worldmonitor/breach/v1/list-breaches.ts', { '../../../_shared/redis': redisMock });
    const ssMod      = await importServiceServer('src/generated/server/worldmonitor/breach/v1/service_server.ts');
    const routes     = ssMod.createBreachServiceRoutes({ listBreaches: handlerMod.listBreaches });

    const req   = new Request('http://localhost/api/breach/v1/list-breaches?page_size=10');
    const route = routes.find((r) => r.path === '/api/breach/v1/list-breaches');
    assert.ok(route);
    const resp = await route.handler(req);
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.equal(body.breaches.length, 1);
    assert.equal(body.breaches[0].name, 'TestBreach');
  });
});

// ─── Social Pulse Pipeline ─────────────────────────────────────────────────
describe('social pulse pipeline integration', () => {
  const SEED = {
    posts: [
      { id: 'reddit:xyz', source: 'reddit', sub: 'worldnews', title: 'Breaking: Major event', url: 'https://reddit.com/r/worldnews/1', permalink: 'https://reddit.com/r/worldnews/1', author: 'testuser', ups: 10000, comments: 500, score: 9000, createdMs: Date.now() - 600_000, topics: ['geopolitics'] },
    ],
    trending: [{ topic: 'geopolitics', count: 1 }],
    stats: { totalPosts: 1, sourceBreakdown: { reddit: 1 }, fetchedAt: new Date().toISOString() },
    fetchedAt: new Date().toISOString(),
  };

  it('serves social posts through route handler', async () => {
    const mockDir    = mkdtempSync(join(tmpdir(), 'wm-sp-'));
    const redisMock  = writeRedisMock(mockDir, SEED);
    const handlerMod = await importHandler('server/worldmonitor/social-pulse/v1/list-social-posts.ts', { '../../../_shared/redis': redisMock });
    const ssMod      = await importServiceServer('src/generated/server/worldmonitor/social-pulse/v1/service_server.ts');
    const routes     = ssMod.createSocialPulseServiceRoutes({ listSocialPosts: handlerMod.listSocialPosts });

    const req   = new Request('http://localhost/api/social-pulse/v1/list-social-posts');
    const route = routes.find((r) => r.path === '/api/social-pulse/v1/list-social-posts');
    assert.ok(route);
    const resp = await route.handler(req);
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.equal(body.posts.length, 1);
    assert.ok(body.trending.length > 0);
  });
});

// ─── Space Weather Pipeline ────────────────────────────────────────────────
describe('space weather pipeline integration', () => {
  const SEED = {
    currentKp: { time: '2025-04-07T12:00:00Z', kp: 4.0, level: 'quiet' },
    kIndex: [{ time: '2025-04-07T12:00:00Z', kp: 4.0, level: 'quiet' }],
    alerts: [{ serial: '20250407-001', product: 'ALTK04', issuedAt: '2025-04-07T10:00:00Z', message: 'Active geomagnetic conditions', severity: 'alert' }],
    activeAlerts: [{ serial: '20250407-001', product: 'ALTK04', issuedAt: '2025-04-07T10:00:00Z', message: 'Active geomagnetic conditions', severity: 'alert' }],
    solarRegions: [],
    summary: { overallStatus: 'active', maxKpLast24h: 4.0, stormLevel: 'quiet', alertCount: 1 },
    fetchedAt: new Date().toISOString(),
  };

  it('serves space weather through route handler', async () => {
    const mockDir    = mkdtempSync(join(tmpdir(), 'wm-sw-'));
    const redisMock  = writeRedisMock(mockDir, SEED);
    const handlerMod = await importHandler('server/worldmonitor/space-weather/v1/get-space-weather.ts', { '../../../_shared/redis': redisMock });
    const ssMod      = await importServiceServer('src/generated/server/worldmonitor/space-weather/v1/service_server.ts');
    const routes     = ssMod.createSpaceWeatherServiceRoutes({ getSpaceWeather: handlerMod.getSpaceWeather });

    const req   = new Request('http://localhost/api/space-weather/v1/get-space-weather');
    const route = routes.find((r) => r.path === '/api/space-weather/v1/get-space-weather');
    assert.ok(route);
    const resp = await route.handler(req);
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.equal(body.kIndex.length, 1);
    assert.equal(body.summary.overallStatus, 'active');
    assert.equal(body.activeAlerts.length, 1);
  });
});

// ─── News Aggregator Pipeline ──────────────────────────────────────────────
describe('news aggregator pipeline integration', () => {
  const SEED = {
    articles: [
      { id: 'reuters:abc', source: 'reuters', sourceLabel: 'Reuters', bias: 'center', title: 'World News Headline', url: 'https://reuters.com/news/test', summary: 'Breaking news summary', publishedMs: Date.now() - 600_000, publishedAt: '2025-04-07T11:00:00Z' },
      { id: 'bbc:def', source: 'bbc', sourceLabel: 'BBC', bias: 'center-left', title: 'Another Headline', url: 'https://bbc.com/news/test', summary: 'Another summary', publishedMs: Date.now() - 1200_000, publishedAt: '2025-04-07T10:00:00Z' },
    ],
    stats: { totalArticles: 2, sourceBreakdown: { reuters: 1, bbc: 1 } },
    fetchedAt: new Date().toISOString(),
  };

  it('serves news articles through route handler', async () => {
    const mockDir    = mkdtempSync(join(tmpdir(), 'wm-na-'));
    const redisMock  = writeRedisMock(mockDir, SEED);
    const handlerMod = await importHandler('server/worldmonitor/news-aggregator/v1/list-news-articles.ts', { '../../../_shared/redis': redisMock });
    const ssMod      = await importServiceServer('src/generated/server/worldmonitor/news-aggregator/v1/service_server.ts');
    const routes     = ssMod.createNewsAggregatorServiceRoutes({ listNewsArticles: handlerMod.listNewsArticles });

    const req   = new Request('http://localhost/api/news-aggregator/v1/list-news-articles');
    const route = routes.find((r) => r.path === '/api/news-aggregator/v1/list-news-articles');
    assert.ok(route);
    const resp = await route.handler(req);
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.equal(body.articles.length, 2);
    assert.equal(body.articles[0].source, 'reuters');
  });

  it('filters articles by source', async () => {
    const mockDir    = mkdtempSync(join(tmpdir(), 'wm-na2-'));
    const redisMock  = writeRedisMock(mockDir, SEED);
    const handlerMod = await importHandler('server/worldmonitor/news-aggregator/v1/list-news-articles.ts', { '../../../_shared/redis': redisMock });
    const ssMod      = await importServiceServer('src/generated/server/worldmonitor/news-aggregator/v1/service_server.ts');
    const routes     = ssMod.createNewsAggregatorServiceRoutes({ listNewsArticles: handlerMod.listNewsArticles });

    const req   = new Request('http://localhost/api/news-aggregator/v1/list-news-articles?source=bbc');
    const route = routes.find((r) => r.path === '/api/news-aggregator/v1/list-news-articles');
    const resp  = await route.handler(req);
    const body  = await resp.json();
    assert.equal(body.articles.length, 1);
    assert.equal(body.articles[0].source, 'bbc');
  });
});

// ─── Telegram Pipeline ────────────────────────────────────────────────────
describe('telegram pipeline integration', () => {
  const SEED = {
    posts: [
      { id: 'tg:intelslava:100', channel: 'intelslava', channelLabel: 'Intel Slava Z', category: 'conflict', text: 'Critical update from the front', url: 'https://t.me/intelslava/100', publishedAt: '2025-04-07T09:00:00Z', publishedMs: Date.now() - 3600_000, photoCount: 2, hasVideo: false },
    ],
    stats: { totalPosts: 1, channels: 6, categoryBreakdown: { conflict: 1 }, channelBreakdown: { intelslava: 1 } },
    fetchedAt: new Date().toISOString(),
  };

  it('serves telegram posts through route handler', async () => {
    const mockDir    = mkdtempSync(join(tmpdir(), 'wm-tg-'));
    const redisMock  = writeRedisMock(mockDir, SEED);
    const handlerMod = await importHandler('server/worldmonitor/telegram/v1/list-telegram-posts.ts', { '../../../_shared/redis': redisMock });
    const ssMod      = await importServiceServer('src/generated/server/worldmonitor/telegram/v1/service_server.ts');
    const routes     = ssMod.createTelegramServiceRoutes({ listTelegramPosts: handlerMod.listTelegramPosts });

    const req   = new Request('http://localhost/api/telegram/v1/list-telegram-posts');
    const route = routes.find((r) => r.path === '/api/telegram/v1/list-telegram-posts');
    assert.ok(route);
    const resp = await route.handler(req);
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.equal(body.posts.length, 1);
    assert.equal(body.posts[0].channel, 'intelslava');
    assert.ok(body.stats.categoryBreakdown.conflict === 1);
  });
});

// ─── Network Exposure Pipeline ─────────────────────────────────────────────
describe('network exposure pipeline integration', () => {
  const SEED = {
    phishing: {
      entries: [{ id: 'pt:1', url: 'https://fake-bank.com', submittedAt: '2025-04-07', verified: true, online: true, target: 'PayPal' }],
      topTargets: [{ target: 'PayPal', count: 1 }],
      totalCount: 1,
    },
    abuseIPs: { entries: [], byCountry: {}, totalCount: 0 },
    c2Servers: { entries: [], totalCount: 0 },
    stats: { phishingUrls: 1, abuseIPs: 0, c2IPs: 0 },
    fetchedAt: new Date().toISOString(),
  };

  it('serves network exposure data through route handler', async () => {
    const mockDir    = mkdtempSync(join(tmpdir(), 'wm-ne-'));
    const redisMock  = writeRedisMock(mockDir, SEED);
    const handlerMod = await importHandler('server/worldmonitor/network-exposure/v1/list-network-exposure.ts', { '../../../_shared/redis': redisMock });
    const ssMod      = await importServiceServer('src/generated/server/worldmonitor/network-exposure/v1/service_server.ts');
    const routes     = ssMod.createNetworkExposureServiceRoutes({ listNetworkExposure: handlerMod.listNetworkExposure });

    const req   = new Request('http://localhost/api/network-exposure/v1/list-network-exposure');
    const route = routes.find((r) => r.path === '/api/network-exposure/v1/list-network-exposure');
    assert.ok(route);
    const resp = await route.handler(req);
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.equal(body.stats.phishingUrls, 1);
    assert.equal(body.phishing.topTargets[0].target, 'PayPal');
  });
});

// ─── Crypto Intel Pipeline ─────────────────────────────────────────────────
describe('crypto intel pipeline integration', () => {
  const SEED = {
    chainStats: {
      bitcoin: { chain: 'bitcoin', blockHeight: 840000, transactions24h: 420000, volume24hUsd: 8000000000, avgTransactionFee: 4.2, hashrateGhs: null, marketPriceUsd: 70000, circulatingUsd: 1400000000000 },
    },
    abuseReports: [
      { id: 'ca:1', address: '1ABadAddress', chain: 'bitcoin', category: 'scam', description: 'Known scam wallet', reportedAt: '2025-04-07T00:00:00Z', url: '' },
    ],
    largeTransfers: [],
    stats: { chains: 1, abuseReports: 1, largeTransfers: 0, abuseByChain: { bitcoin: 1 }, abuseByCategory: { scam: 1 } },
    fetchedAt: new Date().toISOString(),
  };

  it('serves crypto intel through route handler', async () => {
    const mockDir    = mkdtempSync(join(tmpdir(), 'wm-ci-'));
    const redisMock  = writeRedisMock(mockDir, SEED);
    const handlerMod = await importHandler('server/worldmonitor/crypto-intel/v1/get-crypto-intel.ts', { '../../../_shared/redis': redisMock });
    const ssMod      = await importServiceServer('src/generated/server/worldmonitor/crypto-intel/v1/service_server.ts');
    const routes     = ssMod.createCryptoIntelServiceRoutes({ getCryptoIntel: handlerMod.getCryptoIntel });

    const req   = new Request('http://localhost/api/crypto-intel/v1/get-crypto-intel');
    const route = routes.find((r) => r.path === '/api/crypto-intel/v1/get-crypto-intel');
    assert.ok(route);
    const resp = await route.handler(req);
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.ok(body.chainStats.bitcoin);
    assert.equal(body.chainStats.bitcoin.chain, 'bitcoin');
    assert.equal(body.abuseReports.length, 1);
    assert.equal(body.stats.abuseByChain.bitcoin, 1);
  });
});

// ─── Satellite Tracker Pipeline ────────────────────────────────────────────
describe('satellite tracker pipeline integration', () => {
  const SEED = {
    satellites: [
      { noradId: '25544', name: 'ISS (ZARYA)', group: 'stations', groupLabel: 'Space Stations', tleLine1: '1 25544U', tleLine2: '2 25544', orbit: { inclination: 51.6, altitudeKm: 408 }, epoch: '2025-04-07', objectType: 'PAYLOAD', launchDate: '1998-11-20', country: 'ISS' },
      { noradId: '44235', name: 'STARLINK-100', group: 'starlink', groupLabel: 'Starlink', tleLine1: '1 44235U', tleLine2: '2 44235', orbit: { inclination: 53.0, altitudeKm: 550 }, epoch: '2025-04-07', objectType: 'PAYLOAD', launchDate: '2019-05-24', country: 'US' },
    ],
    iss: { noradId: '25544', name: 'ISS (ZARYA)', group: 'stations', groupLabel: 'Space Stations', tleLine1: '', tleLine2: '', orbit: { inclination: 51.6, altitudeKm: 408 }, epoch: '', objectType: 'PAYLOAD', launchDate: '1998-11-20', country: 'ISS' },
    stats: { totalSatellites: 2, byGroup: { stations: 1, starlink: 1 } },
    fetchedAt: new Date().toISOString(),
  };

  it('serves satellites through route handler', async () => {
    const mockDir    = mkdtempSync(join(tmpdir(), 'wm-st-'));
    const redisMock  = writeRedisMock(mockDir, SEED);
    const handlerMod = await importHandler('server/worldmonitor/satellite-tracker/v1/list-satellites.ts', { '../../../_shared/redis': redisMock });
    const ssMod      = await importServiceServer('src/generated/server/worldmonitor/satellite-tracker/v1/service_server.ts');
    const routes     = ssMod.createSatelliteTrackerServiceRoutes({ listSatellites: handlerMod.listSatellites });

    const req   = new Request('http://localhost/api/satellite-tracker/v1/list-satellites');
    const route = routes.find((r) => r.path === '/api/satellite-tracker/v1/list-satellites');
    assert.ok(route);
    const resp = await route.handler(req);
    assert.equal(resp.status, 200);
    const body = await resp.json();
    assert.equal(body.satellites.length, 2);
    assert.ok(body.iss);
    assert.equal(body.iss.noradId, '25544');
    assert.equal(body.stats.totalSatellites, 2);
  });

  it('paginates satellite list correctly', async () => {
    const mockDir    = mkdtempSync(join(tmpdir(), 'wm-st2-'));
    const redisMock  = writeRedisMock(mockDir, SEED);
    const handlerMod = await importHandler('server/worldmonitor/satellite-tracker/v1/list-satellites.ts', { '../../../_shared/redis': redisMock });
    const ssMod      = await importServiceServer('src/generated/server/worldmonitor/satellite-tracker/v1/service_server.ts');
    const routes     = ssMod.createSatelliteTrackerServiceRoutes({ listSatellites: handlerMod.listSatellites });

    const req   = new Request('http://localhost/api/satellite-tracker/v1/list-satellites?page_size=1');
    const route = routes.find((r) => r.path === '/api/satellite-tracker/v1/list-satellites');
    const resp  = await route.handler(req);
    const body  = await resp.json();
    assert.equal(body.satellites.length, 1);
    assert.equal(body.pagination.nextCursor, '1');

    const req2   = new Request('http://localhost/api/satellite-tracker/v1/list-satellites?page_size=1&cursor=1');
    const resp2  = await route.handler(req2);
    const body2  = await resp2.json();
    assert.equal(body2.satellites.length, 1);
    assert.equal(body2.pagination.nextCursor, '');
  });
});
