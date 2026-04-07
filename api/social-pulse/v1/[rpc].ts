export const config = { runtime: 'edge' };
import { createDomainGateway, serverOptions } from '../../../server/gateway';
import { createSocialPulseServiceRoutes } from '../../../src/generated/server/worldmonitor/social-pulse/v1/service_server';
import { socialPulseHandler } from '../../../server/worldmonitor/social-pulse/v1/handler';
export default createDomainGateway(createSocialPulseServiceRoutes(socialPulseHandler, serverOptions));
