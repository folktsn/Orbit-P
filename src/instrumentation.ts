export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { processAdjustments, processProbationTransitions } = await import('./lib/cronService');

    console.log("Starting Next.js Background Services...");

    // Run once on startup to catch up
    processAdjustments().then(res => {
      console.log(`[Background Service] Initial Adjustments: ${res.success ? `Processed ${res.processed}/${res.totalPending}` : 'Failed'}`);
    });

    processProbationTransitions().then(res => {
      console.log(`[Background Service] Initial Probation Transitions: ${res.success ? `Passed: ${res.transitionedPass}, Failed: ${res.transitionedFail}` : 'Failed'}`);
    });

    // Run every 1 hour (1000 ms * 60 s * 60 m)
    setInterval(async () => {
      const resAdj = await processAdjustments();
      console.log(`[Background Service] Hourly Adjustments: ${resAdj.success ? `Processed ${resAdj.processed}/${resAdj.totalPending}` : 'Failed'}`);

      const resProb = await processProbationTransitions();
      console.log(`[Background Service] Hourly Probation Transitions: ${resProb.success ? `Passed: ${resProb.transitionedPass}, Failed: ${resProb.transitionedFail}` : 'Failed'}`);
    }, 1000 * 60 * 60);
  }
}
