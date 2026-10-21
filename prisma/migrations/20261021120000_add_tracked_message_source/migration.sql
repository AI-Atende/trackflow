-- AlterTable
ALTER TABLE "TrackedMessage" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'portal',
ADD COLUMN     "externalMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TrackedMessage_clientId_source_externalMessageId_key" ON "TrackedMessage"("clientId", "source", "externalMessageId");
