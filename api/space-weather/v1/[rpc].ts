export const config = { runtime: 'edge' };
import { createDomainGateway, serverOptions } from '../../../server/gateway';
import { createSpaceWeatherServiceRoutes } from '../../../src/generated/server/worldmonitor/space-weather/v1/service_server';
import { spaceWeatherHandler } from '../../../server/worldmonitor/space-weather/v1/handler';
export default createDomainGateway(createSpaceWeatherServiceRoutes(spaceWeatherHandler, serverOptions));
