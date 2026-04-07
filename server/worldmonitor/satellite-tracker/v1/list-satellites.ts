import type { ServerContext, ListSatellitesRequest, ListSatellitesResponse } from '../../../../src/generated/server/worldmonitor/satellite-tracker/v1/service_server';
import { getCachedJson } from '../../../_shared/redis';
const SEED_KEY = 'satellite:tracker:v1';
export async function listSatellites(_ctx: ServerContext, req: ListSatellitesRequest): Promise<ListSatellitesResponse> {
  const empty: ListSatellitesResponse = { satellites: [], iss: null, stats: { totalSatellites: 0, byGroup: {} }, pagination: { nextCursor: '', totalCount: 0 }, fetchedAt: '' };
  const seed = await getCachedJson(SEED_KEY, true) as ListSatellitesResponse | null;
  if (!seed?.satellites?.length) return empty;
  let sats = seed.satellites;
  if (req.group)   sats = sats.filter((s) => s.group === req.group);
  if (req.country) sats = sats.filter((s) => s.country === req.country.toUpperCase());
  const pageSize = Math.min(Math.max(req.pageSize || 50, 1), 500);
  const offset   = req.cursor ? parseInt(req.cursor, 10) || 0 : 0;
  const page     = sats.slice(offset, offset + pageSize);
  const next     = offset + pageSize < sats.length ? String(offset + pageSize) : '';
  return { satellites: page, iss: seed.iss || null, stats: seed.stats || empty.stats, pagination: { nextCursor: next, totalCount: sats.length }, fetchedAt: seed.fetchedAt || '' };
}
