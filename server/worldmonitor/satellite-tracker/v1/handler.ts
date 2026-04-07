import type { SatelliteTrackerServiceHandler } from '../../../../src/generated/server/worldmonitor/satellite-tracker/v1/service_server';
import { listSatellites } from './list-satellites';
export const satelliteTrackerHandler: SatelliteTrackerServiceHandler = { listSatellites };
