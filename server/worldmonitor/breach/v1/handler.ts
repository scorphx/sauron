import type { BreachServiceHandler } from '../../../../src/generated/server/worldmonitor/breach/v1/service_server';
import { listBreaches } from './list-breaches';
export const breachHandler: BreachServiceHandler = { listBreaches };
