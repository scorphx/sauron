export const config = { runtime: 'edge' };
import { createDomainGateway, serverOptions } from '../../../server/gateway';
import { createTelegramServiceRoutes } from '../../../src/generated/server/worldmonitor/telegram/v1/service_server';
import { telegramHandler } from '../../../server/worldmonitor/telegram/v1/handler';
export default createDomainGateway(createTelegramServiceRoutes(telegramHandler, serverOptions));
