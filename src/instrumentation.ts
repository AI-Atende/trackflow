export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const cron = (await import('node-cron')).default;
  const { runAdCatalogSyncJob } = await import('./lib/jobs/adCatalogSyncJob');

  // No webhook exists on Meta or Google for "campaign/adset/ad structure changed" — this is
  // poll-based by design. Every 6h balances freshness against API rate limits; the manual
  // "Sincronizar agora" button (api/ad-catalog/sync) runs the same function on demand.
  cron.schedule('0 */6 * * *', () => {
    runAdCatalogSyncJob().catch(console.error);
  });

  console.log('[instrumentation] Cron jobs registered (ad catalog sync: every 6h)');
}
