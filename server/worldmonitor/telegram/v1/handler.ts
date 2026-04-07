import type { TelegramServiceHandler } from '../../../../src/generated/server/worldmonitor/telegram/v1/service_server';
import { listTelegramPosts } from './list-telegram-posts';
export const telegramHandler: TelegramServiceHandler = { listTelegramPosts };
