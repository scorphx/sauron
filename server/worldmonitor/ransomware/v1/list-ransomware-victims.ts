import type { ServerContext, ListRansomwareVictimsRequest, ListRansomwareVictimsResponse } from '../../../../src/generated/server/worldmonitor/ransomware/v1/service_server';
import { getCachedJson } from '../../../_shared/redis';

const SEED_KEY = 'ransomware:victims:v1';

export async function listRansomwareVictims(
  _ctx: ServerContext,
  req: ListRansomwareVictimsRequest,
): Promise<ListRansomwareVictimsResponse> {
  const empty: ListRansomwareVictimsResponse = {
    victims: [], groups: [], stats: { totalVictims: 0, activeGroups: 0, sectorBreakdown: {}, last24hCount: 0, last7dCount: 0 },
    pagination: { nextCursor: '', totalCount: 0 }, fetchedAt: '',
  };

  const seed = await getCachedJson(SEED_KEY, true) as ListRansomwareVictimsResponse | null;
  if (!seed?.victims?.length) return empty;

  let victims = seed.victims;

  if (req.groupName) victims = victims.filter((v) => v.groupName.toLowerCase().includes(req.groupName.toLowerCase()));
  if (req.sector)    victims = victims.filter((v) => v.sector === req.sector);
  if (req.country)   victims = victims.filter((v) => v.country === req.country.toUpperCase());
  if (req.sinceMs)   victims = victims.filter((v) => v.discoveredMs >= req.sinceMs);

  const pageSize = Math.min(Math.max(req.pageSize || 50, 1), 200);
  const offset   = req.cursor ? parseInt(req.cursor, 10) || 0 : 0;
  const page     = victims.slice(offset, offset + pageSize);
  const next     = offset + pageSize < victims.length ? String(offset + pageSize) : '';

  return {
    victims: page,
    groups: seed.groups || [],
    stats: seed.stats || empty.stats,
    pagination: { nextCursor: next, totalCount: victims.length },
    fetchedAt: seed.fetchedAt || '',
  };
}
