import { retryPendingConversionEvents } from '@/lib/leadJourney';

export async function runConversionEventRetryJob() {
  console.log('[conversionEventRetryJob] Retrying pending/failed conversion events...');
  await retryPendingConversionEvents();
}
