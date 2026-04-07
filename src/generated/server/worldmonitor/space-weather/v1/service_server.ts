// @ts-nocheck
export interface KIndexEntry { time: string; kp: number; level: string; }
export interface SpaceWeatherAlert { serial: string; product: string; issuedAt: string; message: string; severity: string; }
export interface SpaceWeatherSummary { overallStatus: string; maxKpLast24h: number; stormLevel: string; alertCount: number; }
export interface GetSpaceWeatherRequest { placeholder?: boolean; }
export interface GetSpaceWeatherResponse { currentKp: KIndexEntry | null; kIndex: KIndexEntry[]; alerts: SpaceWeatherAlert[]; activeAlerts: SpaceWeatherAlert[]; solarRegions: { description: string }[]; summary: SpaceWeatherSummary; fetchedAt: string; }
export interface ServerContext { request: Request; }
export interface ServerOptions { onError?: (err: unknown) => Response; }
export interface RouteDescriptor { method: string; path: string; handler: (req: Request) => Promise<Response>; }
export interface SpaceWeatherServiceHandler { getSpaceWeather(ctx: ServerContext, req: GetSpaceWeatherRequest): Promise<GetSpaceWeatherResponse>; }
function defaultError(err: unknown): Response { console.error('[space-weather]', err); return new Response(JSON.stringify({ error: 'internal' }), { status: 500, headers: { 'content-type': 'application/json' } }); }
export function createSpaceWeatherServiceRoutes(handler: SpaceWeatherServiceHandler, options?: ServerOptions): RouteDescriptor[] {
  const onError = options?.onError ?? defaultError;
  return [{ method: "GET", path: "/api/space-weather/v1/get-space-weather",
    handler: async (req: Request): Promise<Response> => {
      try {
        const resp = await handler.getSpaceWeather({ request: req }, {});
        return new Response(JSON.stringify(resp), { headers: { 'content-type': 'application/json' } });
      } catch (err) { return onError(err); }
    },
  }];
}
