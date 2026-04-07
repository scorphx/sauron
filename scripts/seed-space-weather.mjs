#!/usr/bin/env node
/**
 * seed-space-weather.mjs
 * Fetches solar activity and space weather data from NOAA Space Weather Prediction Center.
 * Free API, no key required.
 * Cron: every 15 minutes.
 */

import { loadEnvFile, CHROME_UA, runSeed, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY  = 'space:weather:v1';
const ALERTS_KEY     = 'space:alerts:v1';
const CACHE_TTL      = 900; // 15 min

// NOAA SWPC endpoints — all public, no auth
const SWPC_BASE              = 'https://services.swpc.noaa.gov';
const SOLAR_WIND_URL         = `${SWPC_BASE}/products/solar-wind/mag-7-day.json`;
const GEOMAG_STORM_URL       = `${SWPC_BASE}/products/noaa-geomagnetic-activity-observations-and-forecasts.json`;
const SOLAR_FLARES_URL       = `${SWPC_BASE}/json/goes-xray-1-day.json`;
const AURORA_FORECAST_URL    = `${SWPC_BASE}/products/27-day-outlook.json`;
const PLANETARY_K_INDEX_URL  = `${SWPC_BASE}/products/planetary-k-index.json`;
const ALERT_FEED_URL         = `${SWPC_BASE}/products/alerts.json`;
const SOLAR_REGION_URL       = `${SWPC_BASE}/products/solar-region-summary.json`;

async function safeFetch(url, label) {
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(12_000),
    });
    if (!resp.ok) { console.warn(`  [SWPC/${label}] HTTP ${resp.status}`); return null; }
    return await resp.json();
  } catch (err) {
    console.warn(`  [SWPC/${label}] failed: ${err.message}`);
    return null;
  }
}

function classifyFlare(xrayClass) {
  if (!xrayClass) return 'unknown';
  const first = xrayClass[0]?.toUpperCase();
  if (first === 'X') return 'extreme';
  if (first === 'M') return 'moderate';
  if (first === 'C') return 'minor';
  if (first === 'B') return 'subthreshold';
  return 'unknown';
}

function kpToStormLevel(kp) {
  const k = parseFloat(kp);
  if (k >= 9) return 'G5_extreme';
  if (k >= 8) return 'G4_severe';
  if (k >= 7) return 'G3_strong';
  if (k >= 6) return 'G2_moderate';
  if (k >= 5) return 'G1_minor';
  return 'quiet';
}

async function fetchSpaceWeather() {
  const [kIndexRaw, alertsRaw, solarRegionRaw] = await Promise.all([
    safeFetch(PLANETARY_K_INDEX_URL, 'k-index'),
    safeFetch(ALERT_FEED_URL, 'alerts'),
    safeFetch(SOLAR_REGION_URL, 'solar-regions'),
  ]);

  // K-Index (planetary geomagnetic activity) — last 24 values (3-hour intervals)
  const kIndex = Array.isArray(kIndexRaw)
    ? kIndexRaw.slice(-24).map((row) => ({
        time:  row[0] || '',
        kp:    parseFloat(row[1]) || 0,
        level: kpToStormLevel(row[1]),
      }))
    : [];

  const currentKp = kIndex.length > 0 ? kIndex[kIndex.length - 1] : null;

  // Active alerts
  const alerts = Array.isArray(alertsRaw)
    ? alertsRaw.slice(0, 20).map((a) => ({
        serial:      a.serial_number || '',
        product:     a.product_id || '',
        issuedAt:    a.issue_datetime || '',
        message:     (a.message || '').slice(0, 500),
        severity:    a.product_id?.startsWith('WAT') ? 'watch'
                   : a.product_id?.startsWith('WAR') ? 'warning'
                   : a.product_id?.startsWith('ALT') ? 'alert'
                   : 'info',
      }))
    : [];

  // Solar regions (active sunspot groups)
  const solarRegions = [];
  if (solarRegionRaw) {
    const lines = typeof solarRegionRaw === 'string' ? solarRegionRaw.split('\n') : [];
    for (const line of lines.slice(0, 30)) {
      if (!line.trim() || line.startsWith('#') || line.startsWith(':')) continue;
      solarRegions.push({ description: line.trim().slice(0, 200) });
    }
  }

  // Summary
  const activeAlerts  = alerts.filter((a) => ['alert','warning','watch'].includes(a.severity));
  const maxKp         = kIndex.length > 0 ? Math.max(...kIndex.map((k) => k.kp)) : 0;
  const overallStatus = maxKp >= 7 ? 'storm'
                      : maxKp >= 5 ? 'active'
                      : maxKp >= 3 ? 'unsettled'
                      : 'quiet';

  return {
    currentKp,
    kIndex,
    alerts,
    activeAlerts,
    solarRegions: solarRegions.slice(0, 20),
    summary: {
      overallStatus,
      maxKpLast24h: maxKp,
      stormLevel:   kpToStormLevel(maxKp),
      alertCount:   activeAlerts.length,
    },
    fetchedAt: new Date().toISOString(),
  };
}

await runSeed('space', 'weather', CANONICAL_KEY, fetchSpaceWeather, {
  ttlSeconds: CACHE_TTL,
  validateFn: (d) => d?.summary && Array.isArray(d?.kIndex),
  extraKeys: [{ key: ALERTS_KEY, getValue: (d) => ({ alerts: d.activeAlerts, summary: d.summary, fetchedAt: d.fetchedAt }) }],
});

verifySeedKey(CANONICAL_KEY);
