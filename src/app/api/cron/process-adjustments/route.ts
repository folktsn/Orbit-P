import { NextResponse } from 'next/server';
import { processAdjustments, processProbationTransitions } from '@/lib/cronService';
import { authorizeRequest } from '@/lib/auth-session';

const MIN_RUN_INTERVAL_MS = 30 * 60 * 1000;
const CRON_STATE_KEY = '__orbit_background_service_state__';

type BackgroundServiceResult = {
  adjustments: Awaited<ReturnType<typeof processAdjustments>>;
  probation: Awaited<ReturnType<typeof processProbationTransitions>>;
};

type BackgroundServiceState = {
  active: Promise<BackgroundServiceResult> | null;
  lastCompletedAt: number;
  lastResult: BackgroundServiceResult | null;
};

const globalWithBackgroundService = globalThis as typeof globalThis & {
  [CRON_STATE_KEY]?: BackgroundServiceState;
};

function getBackgroundServiceState() {
  if (!globalWithBackgroundService[CRON_STATE_KEY]) {
    globalWithBackgroundService[CRON_STATE_KEY] = {
      active: null,
      lastCompletedAt: 0,
      lastResult: null,
    };
  }
  return globalWithBackgroundService[CRON_STATE_KEY];
}

export async function GET(request: Request) {
  const authorization = await authorizeRequest(request, 'admin');
  if (!authorization.ok) return authorization.response;

  const state = getBackgroundServiceState();
  const now = Date.now();

  if (state.active) {
    return NextResponse.json({ success: true, skipped: true, reason: 'already-running' });
  }

  if (state.lastResult && now - state.lastCompletedAt < MIN_RUN_INTERVAL_MS) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: 'recently-completed',
      lastCompletedAt: new Date(state.lastCompletedAt).toISOString(),
      ...state.lastResult,
    });
  }

  try {
    state.active = (async () => {
      const adjustments = await processAdjustments();
      const probation = await processProbationTransitions();
      return { adjustments, probation };
    })();
    const result = await state.active;
    state.lastResult = result;
    state.lastCompletedAt = Date.now();

    return NextResponse.json({
      success: true,
      skipped: false,
      ...result,
    });
  } catch (error: unknown) {
    console.error('Cron job error:', error);
    return NextResponse.json({
      error: 'Failed to run cron background services',
      details: error instanceof Error ? error.message : 'Unknown background service error',
    }, { status: 500 });
  } finally {
    state.active = null;
  }
}
