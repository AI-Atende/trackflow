-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "attributionType" TEXT;

-- AlterTable
ALTER TABLE "MetaAdAccount" ADD COLUMN     "sendUnattributedConversions" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Lead_clientId_currentJourneyStageId_idx" ON "Lead"("clientId", "currentJourneyStageId");
