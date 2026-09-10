export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const cron = (await import('node-cron')).default;
  const { runAdCatalogSyncJob } = await import('./lib/jobs/adCatalogSyncJob');
  const { runConversionEventRetryJob } = await import('./lib/jobs/conversionEventRetryJob');

  // No webhook exists on Meta or Google for "campaign/adset/ad structure changed" — this is
  // poll-based by design. Every 6h balances freshness against API rate limits; the manual
  // "Sincronizar agora" button (api/ad-catalog/sync) runs the same function on demand.
  cron.schedule('0 */6 * * *', () => {
    runAdCatalogSyncJob().catch(console.error);
  });

  // Lead-journey conversion events are sent inline first (see leadJourney.ts); this just sweeps
  // up anything left PENDING/FAILED from a transient failure. Every 15 min — these are time
  // -sensitive (ad platforms attribute conversions better closer to the real event time).
  cron.schedule('*/15 * * * *', () => {
    runConversionEventRetryJob().catch(console.error);
  });

  console.log(
    '[instrumentation] Cron jobs registered (ad catalog sync: every 6h, conversion event retry: every 15min)',
  );
}
