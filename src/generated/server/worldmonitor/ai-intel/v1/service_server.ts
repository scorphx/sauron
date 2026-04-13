export interface ServerContext { request: Request; }

export interface IntelAction {
  type: 'zoom' | 'layer_on' | 'layer_off' | 'highlight';
  payload: Record<string, unknown>;
}

export interface AskIntelRequest {
  query: string;
  region?: string;
}

export interface AskIntelResponse {
  summary: string;
  actions: IntelAction[];
  fetchedAt: string;
}

export interface ServerOptions {
  onError?: (error: unknown, req: Request) => Response | Promise<Response>;
}

export interface RouteDescriptor {
  method: string;
  path: string;
  handler: (req: Request) => Promise<Response>;
}

export interface AiIntelServiceHandler {
  askIntel(ctx: ServerContext, req: AskIntelRequest): Promise<AskIntelResponse>;
}

function defaultError(err: unknown, _req?: Request): Response {
  console.error('[ai-intel]', err);
  return new Response(JSON.stringify({ error: 'internal' }), {
    status: 500,
    headers: { 'content-type': 'application/json' },
  });
}

export function createAiIntelServiceRoutes(
  handler: AiIntelServiceHandler,
  options?: ServerOptions,
): RouteDescriptor[] {
  const onError = options?.onError ?? defaultError;
  return [
    {
      method: "GET",
      path: "/api/ai-intel/v1/ask-intel",
      handler: async (req: Request): Promise<Response> => {
        try {
          const url = new URL(req.url, 'http://localhost');
          const p = url.searchParams;
          const query = p.get('query') ?? '';
          if (!query.trim()) {
            return new Response(JSON.stringify({ error: 'query is required' }), {
              status: 400,
              headers: { 'content-type': 'application/json' },
            });
          }
          const body: AskIntelRequest = {
            query,
            region: p.get('region') ?? undefined,
          };
          const resp = await handler.askIntel({ request: req }, body);
          return new Response(JSON.stringify(resp), {
            headers: { 'content-type': 'application/json' },
          });
        } catch (err) {
          return onError(err, req);
        }
      },
    },
  ];
}
