import type { ServerContext, GetSpaceWeatherRequest, GetSpaceWeatherResponse } from '../../../../src/generated/server/worldmonitor/space-weather/v1/service_server';
import { getCachedJson } from '../../../_shared/redis';
const SEED_KEY = 'space:weather:v1';
export async function getSpaceWeather(_ctx: ServerContext, _req: GetSpaceWeatherRequest): Promise<GetSpaceWeatherResponse> {
  const empty: GetSpaceWeatherResponse = { currentKp: null, kIndex: [], alerts: [], activeAlerts: [], solarRegions: [], summary: { overallStatus: 'quiet', maxKpLast24h: 0, stormLevel: 'quiet', alertCount: 0 }, fetchedAt: '' };
  const seed = await getCachedJson(SEED_KEY, true) as GetSpaceWeatherResponse | null;
  if (!seed) return empty;
  return seed;
}
