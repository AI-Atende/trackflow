import { syncAllAdCatalogs } from '@/lib/adCatalogSync';

export async function runAdCatalogSyncJob() {
  console.log('[adCatalogSyncJob] Running ad catalog sync...');
  await syncAllAdCatalogs();
}
