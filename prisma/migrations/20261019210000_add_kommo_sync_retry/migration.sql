-- AlterTable
ALTER TABLE "TrackedMessage" ADD COLUMN     "kommoSyncAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "kommoLastAttemptAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "TrackedMessage_kommoSyncStatus_createdAt_idx" ON "TrackedMessage"("kommoSyncStatus", "createdAt");
