export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { processAdjustments, processProbationTransitions } = await import('./lib/cronService');

    console.log("Starting Next.js Background Services...");

    let activeRun: Promise<void> | null = null;
    const runBackgroundServices = (label: 'Initial' | 'Hourly') => {
      if (activeRun) return activeRun;

      activeRun = (async () => {
        const resAdj = await processAdjustments();
        console.log(`[Background Service] ${label} Adjustments: ${resAdj.success ? `Processed ${resAdj.processed}/${resAdj.totalPending}` : 'Failed'}`);

        const resProb = await processProbationTransitions();
        console.log(`[Background Service] ${label} Probation Transitions: ${resProb.success ? `Passed: ${resProb.transitionedPass}, Failed: ${resProb.transitionedFail}` : 'Failed'}`);
      })().finally(() => {
        activeRun = null;
      });

      return activeRun;
    };

    // Run once on startup to catch up without overlapping both DynamoDB scans.
    void runBackgroundServices('Initial');

    // Run every 1 hour (1000 ms * 60 s * 60 m)
    setInterval(() => {
      void runBackgroundServices('Hourly');
    }, 1000 * 60 * 60);
  }
}
