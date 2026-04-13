// @ts-nocheck
export interface Satellite { noradId: string; name: string; group: string; groupLabel: string; tleLine1: string; tleLine2: string; orbit: { inclination?: number; eccentricity?: number; meanMotion?: number; altitudeKm?: number }; epoch: string; objectType: string; launchDate: string; country: string; }
export interface SatelliteStats { totalSatellites: number; byGroup: Record<string, number>; }
export interface ListSatellitesRequest { pageSize: number; cursor: string; group: string; country: string; }
export interface ListSatellitesResponse { satellites: Satellite[]; iss: Satellite | null; stats: SatelliteStats; pagination: { nextCursor: string; totalCount: number }; fetchedAt: string; }
export interface ServerContext { request: Request; }
export interface ServerOptions { onError?: (error: unknown, req: Request) => Response | Promise<Response>; }
export interface RouteDescriptor { method: string; path: string; handler: (req: Request) => Promise<Response>; }
export interface SatelliteTrackerServiceHandler { listSatellites(ctx: ServerContext, req: ListSatellitesRequest): Promise<ListSatellitesResponse>; }
function defaultError(err: unknown, _req?: Request): Response { console.error('[satellite-tracker]', err); return new Response(JSON.stringify({ error: 'internal' }), { status: 500, headers: { 'content-type': 'application/json' } }); }
export function createSatelliteTrackerServiceRoutes(handler: SatelliteTrackerServiceHandler, options?: ServerOptions): RouteDescriptor[] {
  const onError = options?.onError ?? defaultError;
  return [{ method: "GET", path: "/api/satellite-tracker/v1/list-satellites",
    handler: async (req: Request): Promise<Response> => {
      try {
        const url = new URL(req.url, 'http://localhost'); const p = url.searchParams;
        const body: ListSatellitesRequest = { pageSize: Number(p.get('page_size') ?? '50'), cursor: p.get('cursor') ?? '', group: p.get('group') ?? '', country: p.get('country') ?? '' };
        const resp = await handler.listSatellites({ request: req }, body);
        return new Response(JSON.stringify(resp), { headers: { 'content-type': 'application/json' } });
      } catch (err) { return onError(err, req); }
    },
  }];
}
