-- AlterEnum
ALTER TYPE "MatchStrategy" ADD VALUE 'AD_CODE';

-- AlterTable
ALTER TABLE "MappedAd" ADD COLUMN     "adAccountId" TEXT;

-- AlterTable
ALTER TABLE "TrackedMessage" ADD COLUMN     "matchedMappedAdId" TEXT;

-- CreateTable
CREATE TABLE "AdMessageLink" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "mappedAdId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "waNumber" TEXT NOT NULL,
    "messageTemplate" TEXT NOT NULL,
    "codingStrategy" "CodingStrategy" NOT NULL,
    "finalMessage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdMessageLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdMessageLink_mappedAdId_key" ON "AdMessageLink"("mappedAdId");

-- CreateIndex
CREATE UNIQUE INDEX "AdMessageLink_code_key" ON "AdMessageLink"("code");

-- CreateIndex
CREATE INDEX "AdMessageLink_clientId_idx" ON "AdMessageLink"("clientId");

-- AddForeignKey
ALTER TABLE "TrackedMessage" ADD CONSTRAINT "TrackedMessage_matchedMappedAdId_fkey" FOREIGN KEY ("matchedMappedAdId") REFERENCES "MappedAd"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdMessageLink" ADD CONSTRAINT "AdMessageLink_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdMessageLink" ADD CONSTRAINT "AdMessageLink_mappedAdId_fkey" FOREIGN KEY ("mappedAdId") REFERENCES "MappedAd"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
