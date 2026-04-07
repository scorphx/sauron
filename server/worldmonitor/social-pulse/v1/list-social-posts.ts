import type { ServerContext, ListSocialPostsRequest, ListSocialPostsResponse } from '../../../../src/generated/server/worldmonitor/social-pulse/v1/service_server';
import { getCachedJson } from '../../../_shared/redis';
const SEED_KEY = 'social:pulse:v1';
export async function listSocialPosts(_ctx: ServerContext, req: ListSocialPostsRequest): Promise<ListSocialPostsResponse> {
  const empty: ListSocialPostsResponse = { posts: [], trending: [], stats: { totalPosts: 0, sourceBreakdown: {}, fetchedAt: '' }, pagination: { nextCursor: '', totalCount: 0 }, fetchedAt: '' };
  const seed = await getCachedJson(SEED_KEY, true) as ListSocialPostsResponse | null;
  if (!seed?.posts?.length) return empty;
  let posts = seed.posts;
  if (req.source) posts = posts.filter((p) => p.source === req.source);
  if (req.topic)  posts = posts.filter((p) => p.topics.includes(req.topic));
  const pageSize = Math.min(Math.max(req.pageSize || 50, 1), 200);
  const offset   = req.cursor ? parseInt(req.cursor, 10) || 0 : 0;
  const page     = posts.slice(offset, offset + pageSize);
  const next     = offset + pageSize < posts.length ? String(offset + pageSize) : '';
  return { posts: page, trending: seed.trending || [], stats: seed.stats || empty.stats, pagination: { nextCursor: next, totalCount: posts.length }, fetchedAt: seed.fetchedAt || '' };
}
