// @ts-nocheck
export interface TelegramPost { id: string; channel: string; channelLabel: string; category: string; text: string; url: string; publishedAt: string; publishedMs: number; photoCount: number; hasVideo: boolean; }
export interface TelegramStats { totalPosts: number; channels: number; categoryBreakdown: Record<string, number>; channelBreakdown: Record<string, number>; }
export interface ListTelegramPostsRequest { pageSize: number; cursor: string; channel: string; category: string; }
export interface ListTelegramPostsResponse { posts: TelegramPost[]; stats: TelegramStats; pagination: { nextCursor: string; totalCount: number }; fetchedAt: string; }
export interface ServerContext { request: Request; }
export interface ServerOptions { onError?: (error: unknown, req: Request) => Response | Promise<Response>; }
export interface RouteDescriptor { method: string; path: string; handler: (req: Request) => Promise<Response>; }
export interface TelegramServiceHandler { listTelegramPosts(ctx: ServerContext, req: ListTelegramPostsRequest): Promise<ListTelegramPostsResponse>; }
function defaultError(err: unknown, _req?: Request): Response { console.error('[telegram]', err); return new Response(JSON.stringify({ error: 'internal' }), { status: 500, headers: { 'content-type': 'application/json' } }); }
export function createTelegramServiceRoutes(handler: TelegramServiceHandler, options?: ServerOptions): RouteDescriptor[] {
  const onError = options?.onError ?? defaultError;
  return [{ method: "GET", path: "/api/telegram/v1/list-telegram-posts",
    handler: async (req: Request): Promise<Response> => {
      try {
        const url = new URL(req.url, 'http://localhost'); const p = url.searchParams;
        const body: ListTelegramPostsRequest = { pageSize: Number(p.get('page_size') ?? '50'), cursor: p.get('cursor') ?? '', channel: p.get('channel') ?? '', category: p.get('category') ?? '' };
        const resp = await handler.listTelegramPosts({ request: req }, body);
        return new Response(JSON.stringify(resp), { headers: { 'content-type': 'application/json' } });
      } catch (err) { return onError(err, req); }
    },
  }];
}
