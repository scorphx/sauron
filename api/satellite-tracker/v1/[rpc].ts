export const config = { runtime: 'edge' };
import { createDomainGateway, serverOptions } from '../../../server/gateway';
import { createSatelliteTrackerServiceRoutes } from '../../../src/generated/server/worldmonitor/satellite-tracker/v1/service_server';
import { satelliteTrackerHandler } from '../../../server/worldmonitor/satellite-tracker/v1/handler';
export default createDomainGateway(createSatelliteTrackerServiceRoutes(satelliteTrackerHandler, serverOptions));
