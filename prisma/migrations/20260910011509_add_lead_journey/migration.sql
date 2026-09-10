-- AlterTable
ALTER TABLE "MetaAdAccount" ADD COLUMN     "capiAccessToken" TEXT,
ADD COLUMN     "pixelId" TEXT;

-- CreateTable
CREATE TABLE "JourneyStage" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "kommoPipelineId" INTEGER NOT NULL,
    "kommoStatusId" INTEGER NOT NULL,
    "metaEventName" TEXT,
    "googleConversionActionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kommoLeadId" INTEGER NOT NULL,
    "waId" TEXT,
    "fbclid" TEXT,
    "gclid" TEXT,
    "gbraid" TEXT,
    "wbraid" TEXT,
    "matchedMappedAdId" TEXT,
    "currentJourneyStageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionEventLog" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "journeyStageId" TEXT NOT NULL,
    "platform" "AdPlatform" NOT NULL,
    "eventName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversionEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JourneyStage_clientId_idx" ON "JourneyStage"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyStage_clientId_kommoPipelineId_kommoStatusId_key" ON "JourneyStage"("clientId", "kommoPipelineId", "kommoStatusId");

-- CreateIndex
CREATE INDEX "Lead_clientId_idx" ON "Lead"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_clientId_kommoLeadId_key" ON "Lead"("clientId", "kommoLeadId");

-- CreateIndex
CREATE INDEX "ConversionEventLog_clientId_idx" ON "ConversionEventLog"("clientId");

-- CreateIndex
CREATE INDEX "ConversionEventLog_status_idx" ON "ConversionEventLog"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionEventLog_leadId_journeyStageId_platform_key" ON "ConversionEventLog"("leadId", "journeyStageId", "platform");

-- AddForeignKey
ALTER TABLE "JourneyStage" ADD CONSTRAINT "JourneyStage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_matchedMappedAdId_fkey" FOREIGN KEY ("matchedMappedAdId") REFERENCES "MappedAd"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_currentJourneyStageId_fkey" FOREIGN KEY ("currentJourneyStageId") REFERENCES "JourneyStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionEventLog" ADD CONSTRAINT "ConversionEventLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionEventLog" ADD CONSTRAINT "ConversionEventLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionEventLog" ADD CONSTRAINT "ConversionEventLog_journeyStageId_fkey" FOREIGN KEY ("journeyStageId") REFERENCES "JourneyStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
