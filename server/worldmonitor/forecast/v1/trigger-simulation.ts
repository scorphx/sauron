import type {
  ForecastServiceHandler,
  ServerContext,
  TriggerSimulationRequest,
  TriggerSimulationResponse,
} from '../../../../src/generated/server/worldmonitor/forecast/v1/service_server';
import { getRawJson, runRedisPipeline } from '../../../_shared/redis';
import { markNoCacheResponse } from '../../../_shared/response-headers';
import { SIMULATION_PACKAGE_LATEST_KEY } from '../../../_shared/cache-keys';

/** Redis keys — must match the constants in scripts/seed-forecasts.mjs */
const SIMULATION_TASK_KEY_PREFIX = 'forecast:simulation-task:v1';
const SIMULATION_TASK_QUEUE_KEY = 'forecast:simulation-task-queue:v1';
/** Global rate-limit key: prevents trigger-spam regardless of caller identity */
const SIMULATION_TRIGGER_RATE_KEY = 'forecast:simulation-trigger:rate-limit';
/** 5-minute window — matches the "1 trigger per 5 minutes" spec */
const TRIGGER_RATE_TTL_SECONDS = 300;
/** Task and queue TTLs — mirror seed-forecasts.mjs constants */
const SIMULATION_TASK_TTL_SECONDS = 4 * 60 * 60; // 4 hours
const TRACE_REDIS_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

const VALID_RUN_ID_RE = /^\d{13,}-[a-z0-9-]{1,64}$/i;

type PkgPointer = { runId: string; pkgKey: string };

function isPkgPointer(v: unknown): v is PkgPointer {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o['runId'] === 'string' && typeof o['pkgKey'] === 'string';
}

const NOT_QUEUED = (reason: string): TriggerSimulationResponse => ({ queued: false, runId: '', reason });

export const triggerSimulation: ForecastServiceHandler['triggerSimulation'] = async (
  ctx: ServerContext,
  req: TriggerSimulationRequest,
): Promise<TriggerSimulationResponse> => {
  markNoCacheResponse(ctx.request);

  try {
    // 1. Resolve the runId — use the latest package pointer if caller did not supply one.
    let runId = typeof req.runId === 'string' ? req.runId.trim() : '';

    if (!runId) {
      const pkgPointer = await getRawJson(SIMULATION_PACKAGE_LATEST_KEY);
      if (!isPkgPointer(pkgPointer) || !pkgPointer.runId) {
        return NOT_QUEUED('no_package');
      }
      runId = pkgPointer.runId;
    }

    if (!VALID_RUN_ID_RE.test(runId)) {
      return NOT_QUEUED('invalid_run_id');
    }

    const taskKey = `${SIMULATION_TASK_KEY_PREFIX}:${runId}`;

    // 2. Atomic pipeline: check rate limit, check for duplicate task, enqueue if clear.
    //    raw=true: these keys are shared with the Railway seed process (no env prefix).
    const pipeline: Array<string[]> = [
      // SET NX with TTL on rate-limit key — only the first caller within the window succeeds.
      ['SET', SIMULATION_TRIGGER_RATE_KEY, String(Date.now()), 'EX', String(TRIGGER_RATE_TTL_SECONDS), 'NX'],
      // SET NX on the task key — idempotent: second call for the same runId is a no-op.
      ['SET', taskKey, JSON.stringify({ runId, createdAt: Date.now() }), 'EX', String(SIMULATION_TASK_TTL_SECONDS), 'NX'],
    ];

    const [rateLimitResult, taskResult] = await runRedisPipeline(pipeline, /* raw= */ true);

    // If rate-limit key was NOT newly set, a trigger already fired within the window.
    if (rateLimitResult?.result !== 'OK') {
      return NOT_QUEUED('rate_limited');
    }

    // If task key was NOT newly set, this runId was already queued.
    if (taskResult?.result !== 'OK') {
      return NOT_QUEUED('duplicate');
    }

    // 3. Add to sorted-set queue and refresh its TTL.
    await runRedisPipeline([
      ['ZADD', SIMULATION_TASK_QUEUE_KEY, String(Date.now()), runId],
      ['EXPIRE', SIMULATION_TASK_QUEUE_KEY, String(TRACE_REDIS_TTL_SECONDS)],
    ], /* raw= */ true);

    console.log(`[triggerSimulation] Enqueued runId=${runId}`);
    return { queued: true, runId, reason: '' };
  } catch (err) {
    console.warn('[triggerSimulation] Error:', err instanceof Error ? err.message : String(err));
    return NOT_QUEUED('redis_unavailable');
  }
};
