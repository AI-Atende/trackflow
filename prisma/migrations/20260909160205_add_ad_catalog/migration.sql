-- CreateEnum
CREATE TYPE "AdPlatform" AS ENUM ('META', 'GOOGLE');

-- AlterTable
ALTER TABLE "KommoFieldMapping" ADD COLUMN     "adIdFieldId" INTEGER,
ADD COLUMN     "adsetIdFieldId" INTEGER,
ADD COLUMN     "campaignIdFieldId" INTEGER;

-- AlterTable
ALTER TABLE "TrackedMessage" ADD COLUMN     "resolvedAdMatchConfidence" TEXT;

-- CreateTable
CREATE TABLE "MappedAd" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "platform" "AdPlatform" NOT NULL,
    "adExternalId" TEXT NOT NULL,
    "adName" TEXT NOT NULL,
    "adStatus" TEXT NOT NULL,
    "campaignExternalId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "adsetExternalId" TEXT NOT NULL,
    "adsetName" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MappedAd_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MappedAd_clientId_platform_idx" ON "MappedAd"("clientId", "platform");

-- CreateIndex
CREATE INDEX "MappedAd_clientId_platform_campaignExternalId_idx" ON "MappedAd"("clientId", "platform", "campaignExternalId");

-- CreateIndex
CREATE UNIQUE INDEX "MappedAd_clientId_platform_adExternalId_key" ON "MappedAd"("clientId", "platform", "adExternalId");

-- AddForeignKey
ALTER TABLE "MappedAd" ADD CONSTRAINT "MappedAd_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
