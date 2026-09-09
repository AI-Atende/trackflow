import { syncAllMetaAdCatalogs } from '@/lib/adCatalogSync';

export async function runAdCatalogSyncJob() {
  console.log('[adCatalogSyncJob] Running ad catalog sync...');
  await syncAllMetaAdCatalogs();
}
