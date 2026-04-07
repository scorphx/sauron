import type { ServerContext, ListNetworkExposureRequest, ListNetworkExposureResponse } from '../../../../src/generated/server/worldmonitor/network-exposure/v1/service_server';
import { getCachedJson } from '../../../_shared/redis';
const SEED_KEY = 'network:exposure:v1';
export async function listNetworkExposure(_ctx: ServerContext, req: ListNetworkExposureRequest): Promise<ListNetworkExposureResponse> {
  const empty: ListNetworkExposureResponse = { phishing: { entries: [], topTargets: [], totalCount: 0 }, abuseIPs: { entries: [], byCountry: {}, totalCount: 0 }, c2Servers: { entries: [], totalCount: 0 }, stats: { phishingUrls: 0, abuseIPs: 0, c2IPs: 0 }, pagination: { nextCursor: '', totalCount: 0 }, fetchedAt: '' };
  const seed = await getCachedJson(SEED_KEY, true) as ListNetworkExposureResponse | null;
  if (!seed?.stats) return empty;
  const pageSize = Math.min(Math.max(req.pageSize || 50, 1), 500);
  const offset   = req.cursor ? parseInt(req.cursor, 10) || 0 : 0;
  const phishPage = (seed.phishing?.entries || []).slice(offset, offset + pageSize);
  const next = offset + pageSize < (seed.phishing?.entries || []).length ? String(offset + pageSize) : '';
  return { ...seed, phishing: { ...seed.phishing, entries: phishPage }, pagination: { nextCursor: next, totalCount: seed.phishing?.totalCount || 0 }, fetchedAt: seed.fetchedAt || '' };
}
