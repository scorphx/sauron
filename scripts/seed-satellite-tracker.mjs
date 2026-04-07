#!/usr/bin/env node
/**
 * seed-satellite-tracker.mjs
 * Fetches TLE (Two-Line Element) data for notable satellite categories:
 *   - Military satellites (US, Russian, Chinese)
 *   - ISS + crewed spacecraft
 *   - Active spy/reconnaissance satellites
 * Source: CelesTrak (public domain, no key required)
 * Cron: every hour.
 */

import { loadEnvFile, CHROME_UA, runSeed, verifySeedKey } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'satellite:tracker:v1';
const ISS_KEY       = 'satellite:iss:v1';
const CACHE_TTL     = 3600; // 1h

const CELESTRAK_BASE = 'https://celestrak.org/SOCRATES/query.php';
const CELESTRAK_TLE  = 'https://celestrak.org/SOCRATES/';

// CelesTrak group TLE endpoints
const TLE_GROUPS = [
  { id: 'stations',    label: 'Space Stations',     url: 'https://celestrak.org/SOCRATES/query.php?GROUP=stations&FORMAT=tle' },
  { id: 'military',    label: 'US Military',         url: 'https://celestrak.org/SOCRATES/query.php?GROUP=military&FORMAT=tle' },
  { id: 'science',     label: 'Science',             url: 'https://celestrak.org/SOCRATES/query.php?GROUP=science&FORMAT=tle' },
  { id: 'weather',     label: 'Weather Satellites',  url: 'https://celestrak.org/SOCRATES/query.php?GROUP=weather&FORMAT=tle' },
  { id: 'gps',         label: 'GPS Constellation',   url: 'https://celestrak.org/SOCRATES/query.php?GROUP=gps-ops&FORMAT=tle' },
  { id: 'starlink',    label: 'Starlink',            url: 'https://celestrak.org/SOCRATES/query.php?GROUP=starlink&FORMAT=tle' },
];

// Fallback: CelesTrak catalog via Celestrak API v2
const CATALOG_URLS = {
  stations: 'https://celestrak.org/SOCRATES/query.php?GROUP=stations&FORMAT=json',
  military: 'https://celestrak.org/SOCRATES/query.php?GROUP=military&FORMAT=json',
};

// Use the simple catalog-as-JSON endpoint
const TLE_JSON_URLS = [
  { id: 'stations', label: 'Space Stations',    url: 'https://celestrak.org/SOCRATES/query.php?GROUP=stations&FORMAT=json' },
  { id: 'military', label: 'US Military Sats',  url: 'https://celestrak.org/SOCRATES/query.php?GROUP=military&FORMAT=json' },
  { id: 'weather',  label: 'Weather Sats',      url: 'https://celestrak.org/SOCRATES/query.php?GROUP=weather&FORMAT=json' },
  { id: 'starlink', label: 'Starlink',           url: 'https://celestrak.org/SOCRATES/query.php?GROUP=starlink&FORMAT=json' },
];

// Alternative: CelesTrak API v2 (satcat + TLEs)
const SATCAT_BASE = 'https://celestrak.org/pub/TLE/catalog.txt';
const N2YO_BASE   = 'https://www.n2yo.com/api/';

// Much simpler: use the celestrak satcat JSON
const CELESTRAK_SATCAT = 'https://celestrak.org/pub/satcat.csv';
const CELESTRAK_TLE_ACTIVE = 'https://celestrak.org/SOCRATES/query.php?GROUP=active&FORMAT=json';

function parseTle(tleText) {
  const lines = tleText.split('\n').map((l) => l.trim()).filter(Boolean);
  const sats = [];
  for (let i = 0; i < lines.length - 2; i++) {
    if (lines[i + 1]?.startsWith('1 ') && lines[i + 2]?.startsWith('2 ')) {
      sats.push({
        name: lines[i].replace(/^0 /, '').trim(),
        tle1: lines[i + 1],
        tle2: lines[i + 2],
      });
      i += 2;
    }
  }
  return sats;
}

function extractOrbit(tle2) {
  // Parse TLE line 2 for basic orbital elements
  if (!tle2 || tle2.length < 60) return {};
  try {
    const inc      = parseFloat(tle2.slice(8, 16));   // inclination deg
    const raan     = parseFloat(tle2.slice(17, 25));  // right ascension
    const ecc      = parseFloat('0.' + tle2.slice(26, 33)); // eccentricity
    const mm       = parseFloat(tle2.slice(52, 63));  // mean motion (rev/day)
    const altitude = mm > 0 ? Math.round(((8681663.653 / mm) ** (2/3)) - 6371) : 0;
    return { inclination: inc, eccentricity: ecc, meanMotion: mm, altitudeKm: altitude };
  } catch { return {}; }
}

async function fetchGroupJson(group) {
  try {
    const resp = await fetch(group.url, {
      headers: { 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (Array.isArray(data) ? data : []).map((s) => ({
      noradId:    s.NORAD_CAT_ID || s.OBJECT_ID || '',
      name:       (s.OBJECT_NAME || s.SATNAME || '').trim(),
      group:      group.id,
      groupLabel: group.label,
      tleLine1:   s.TLE_LINE1 || '',
      tleLine2:   s.TLE_LINE2 || '',
      orbit:      extractOrbit(s.TLE_LINE2 || ''),
      epoch:      s.EPOCH || '',
      objectType: s.OBJECT_TYPE || 'PAYLOAD',
      launchDate: s.LAUNCH_DATE || '',
      country:    s.COUNTRY_CODE || '',
    }));
  } catch (err) {
    console.warn(`  [CelesTrak/${group.id}] failed: ${err.message}`);
    return [];
  }
}

async function fetchSatelliteTracker() {
  const groupResults = await Promise.all(TLE_JSON_URLS.map(fetchGroupJson));
  const allSats = groupResults.flat();

  console.log(`  Fetched ${allSats.length} satellites total`);

  // De-duplicate by NORAD ID
  const seen = new Set();
  const unique = allSats.filter((s) => {
    const key = s.noradId || s.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Group stats
  const groupStats = {};
  for (const s of unique) {
    groupStats[s.group] = (groupStats[s.group] || 0) + 1;
  }

  // ISS specifically
  const iss = unique.find((s) => s.name.includes('ISS') || s.name.includes('ZARYA'));

  return {
    satellites: unique.slice(0, 2000),
    iss:        iss || null,
    stats: {
      totalSatellites: unique.length,
      byGroup: groupStats,
    },
    fetchedAt: new Date().toISOString(),
  };
}

await runSeed('satellite', 'tracker', CANONICAL_KEY, fetchSatelliteTracker, {
  ttlSeconds: CACHE_TTL,
  validateFn: (d) => Array.isArray(d?.satellites),
  extraKeys: [{ key: ISS_KEY, getValue: (d) => ({ iss: d.iss, fetchedAt: d.fetchedAt }) }],
});

verifySeedKey(CANONICAL_KEY);
