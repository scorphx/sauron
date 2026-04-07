import type { SocialPulseServiceHandler } from '../../../../src/generated/server/worldmonitor/social-pulse/v1/service_server';
import { listSocialPosts } from './list-social-posts';
export const socialPulseHandler: SocialPulseServiceHandler = { listSocialPosts };
