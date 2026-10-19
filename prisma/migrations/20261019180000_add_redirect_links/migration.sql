-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "shortKey" TEXT;

-- AlterTable
ALTER TABLE "TrackingLink" ADD COLUMN     "slug" TEXT,
ADD COLUMN     "utmSource" TEXT,
ADD COLUMN     "utmMedium" TEXT,
ADD COLUMN     "utmCampaign" TEXT,
ADD COLUMN     "utmContent" TEXT,
ADD COLUMN     "utmTerm" TEXT,
ADD COLUMN     "timeWindowFallback" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Client_shortKey_key" ON "Client"("shortKey");

-- CreateIndex
CREATE INDEX "PixelSession_lastTrackingLinkId_idx" ON "PixelSession"("lastTrackingLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingLink_clientId_slug_key" ON "TrackingLink"("clientId", "slug");
