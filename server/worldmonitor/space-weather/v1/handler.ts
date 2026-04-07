import type { SpaceWeatherServiceHandler } from '../../../../src/generated/server/worldmonitor/space-weather/v1/service_server';
import { getSpaceWeather } from './get-space-weather';
export const spaceWeatherHandler: SpaceWeatherServiceHandler = { getSpaceWeather };
