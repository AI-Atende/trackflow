-- CreateEnum
CREATE TYPE "CodingStrategy" AS ENUM ('INVISIBLE', 'VISIBLE_CODE', 'TIME_WINDOW');

-- CreateEnum
CREATE TYPE "MatchStrategy" AS ENUM ('CODE_INVISIBLE', 'CODE_VISIBLE', 'TIME_WINDOW', 'UNMATCHED');

-- CreateEnum
CREATE TYPE "KommoSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "PixelSession" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sessionCode" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "fbclid" TEXT,
    "gclid" TEXT,
    "gbraid" TEXT,
    "wbraid" TEXT,
    "landingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchedAt" TIMESTAMP(3),

    CONSTRAINT "PixelSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingLink" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "waNumber" TEXT NOT NULL,
    "messageTemplate" TEXT NOT NULL,
    "codingStrategy" "CodingStrategy" NOT NULL DEFAULT 'INVISIBLE',
    "generatedCode" TEXT,
    "finalMessageText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedMessage" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "matchStrategy" "MatchStrategy" NOT NULL DEFAULT 'UNMATCHED',
    "matchedPixelSessionId" TEXT,
    "matchedTrackingLinkId" TEXT,
    "kommoLeadId" TEXT,
    "kommoSyncStatus" "KommoSyncStatus" NOT NULL DEFAULT 'PENDING',
    "kommoSyncedAt" TIMESTAMP(3),
    "kommoSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackedMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KommoFieldMapping" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "utmSourceFieldId" INTEGER,
    "utmMediumFieldId" INTEGER,
    "utmCampaignFieldId" INTEGER,
    "utmContentFieldId" INTEGER,
    "utmTermFieldId" INTEGER,
    "fbclidFieldId" INTEGER,
    "gclidFieldId" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KommoFieldMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PixelSession_sessionCode_key" ON "PixelSession"("sessionCode");

-- CreateIndex
CREATE INDEX "PixelSession_clientId_idx" ON "PixelSession"("clientId");

-- CreateIndex
CREATE INDEX "PixelSession_createdAt_idx" ON "PixelSession"("createdAt");

-- CreateIndex
CREATE INDEX "TrackingLink_clientId_idx" ON "TrackingLink"("clientId");

-- CreateIndex
CREATE INDEX "TrackingLink_generatedCode_idx" ON "TrackingLink"("generatedCode");

-- CreateIndex
CREATE INDEX "TrackedMessage_clientId_idx" ON "TrackedMessage"("clientId");

-- CreateIndex
CREATE INDEX "TrackedMessage_waId_idx" ON "TrackedMessage"("waId");

-- CreateIndex
CREATE INDEX "TrackedMessage_receivedAt_idx" ON "TrackedMessage"("receivedAt");

-- CreateIndex
CREATE INDEX "TrackedMessage_matchedPixelSessionId_idx" ON "TrackedMessage"("matchedPixelSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "KommoFieldMapping_clientId_key" ON "KommoFieldMapping"("clientId");

-- AddForeignKey
ALTER TABLE "PixelSession" ADD CONSTRAINT "PixelSession_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingLink" ADD CONSTRAINT "TrackingLink_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedMessage" ADD CONSTRAINT "TrackedMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedMessage" ADD CONSTRAINT "TrackedMessage_matchedTrackingLinkId_fkey" FOREIGN KEY ("matchedTrackingLinkId") REFERENCES "TrackingLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KommoFieldMapping" ADD CONSTRAINT "KommoFieldMapping_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
