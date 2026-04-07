import type { ServerContext, ListBreachesRequest, ListBreachesResponse } from '../../../../src/generated/server/worldmonitor/breach/v1/service_server';
import { getCachedJson } from '../../../_shared/redis';

const SEED_KEY = 'breach:list:v1';

export async function listBreaches(_ctx: ServerContext, req: ListBreachesRequest): Promise<ListBreachesResponse> {
  const empty: ListBreachesResponse = { breaches: [], recentBreaches: [], stats: { totalBreaches: 0, totalPwnedCount: 0, bySeverity: {}, byCategory: {}, byYear: {} }, pagination: { nextCursor: '', totalCount: 0 }, fetchedAt: '' };
  const seed = await getCachedJson(SEED_KEY, true) as ListBreachesResponse | null;
  if (!seed?.breaches?.length) return empty;

  let breaches = seed.breaches;
  if (req.severity)  breaches = breaches.filter((b) => b.severity === req.severity);
  if (req.category)  breaches = breaches.filter((b) => b.categories.includes(req.category));
  if (req.sinceDate) breaches = breaches.filter((b) => b.addedDate >= req.sinceDate);

  const pageSize = Math.min(Math.max(req.pageSize || 50, 1), 200);
  const offset   = req.cursor ? parseInt(req.cursor, 10) || 0 : 0;
  const page     = breaches.slice(offset, offset + pageSize);
  const next     = offset + pageSize < breaches.length ? String(offset + pageSize) : '';

  return { breaches: page, recentBreaches: seed.recentBreaches || [], stats: seed.stats || empty.stats, pagination: { nextCursor: next, totalCount: breaches.length }, fetchedAt: seed.fetchedAt || '' };
}
