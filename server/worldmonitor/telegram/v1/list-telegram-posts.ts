import type { ServerContext, ListTelegramPostsRequest, ListTelegramPostsResponse } from '../../../../src/generated/server/worldmonitor/telegram/v1/service_server';
import { getCachedJson } from '../../../_shared/redis';
const SEED_KEY = 'telegram:posts:v1';
export async function listTelegramPosts(_ctx: ServerContext, req: ListTelegramPostsRequest): Promise<ListTelegramPostsResponse> {
  const empty: ListTelegramPostsResponse = { posts: [], stats: { totalPosts: 0, channels: 0, categoryBreakdown: {}, channelBreakdown: {} }, pagination: { nextCursor: '', totalCount: 0 }, fetchedAt: '' };
  const seed = await getCachedJson(SEED_KEY, true) as ListTelegramPostsResponse | null;
  if (!seed?.posts?.length) return empty;
  let posts = seed.posts;
  if (req.channel)  posts = posts.filter((p) => p.channel === req.channel);
  if (req.category) posts = posts.filter((p) => p.category === req.category);
  const pageSize = Math.min(Math.max(req.pageSize || 50, 1), 200);
  const offset   = req.cursor ? parseInt(req.cursor, 10) || 0 : 0;
  const page     = posts.slice(offset, offset + pageSize);
  const next     = offset + pageSize < posts.length ? String(offset + pageSize) : '';
  return { posts: page, stats: seed.stats || empty.stats, pagination: { nextCursor: next, totalCount: posts.length }, fetchedAt: seed.fetchedAt || '' };
}
