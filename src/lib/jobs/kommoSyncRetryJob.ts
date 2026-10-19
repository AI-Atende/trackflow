import { retryPendingKommoSyncs } from '@/lib/kommoAttribution';

// Guards against a slow run (many pending rows, slow Kommo) overlapping the next minute's tick.
let running = false;

export async function runKommoSyncRetryJob() {
  if (running) return;
  running = true;
  try {
    const { attempted, synced } = await retryPendingKommoSyncs();
    if (attempted > 0) {
      console.log(`[kommoSyncRetryJob] attempted ${attempted}, synced ${synced}`);
    }
  } finally {
    running = false;
  }
}
