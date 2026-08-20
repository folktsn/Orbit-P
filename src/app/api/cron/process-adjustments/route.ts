import { NextResponse } from 'next/server';
import { processAdjustments, processProbationTransitions } from '@/lib/cronService';

export async function GET() {
  try {
    const resAdj = await processAdjustments();
    const resProb = await processProbationTransitions();

    return NextResponse.json({ 
      success: true, 
      adjustments: resAdj,
      probation: resProb
    });
  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: 'Failed to run cron background services', details: error.message }, { status: 500 });
  }
}
