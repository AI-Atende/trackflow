/*
  Warnings:

  - You are about to drop the column `finalMessageText` on the `TrackingLink` table. All the data in the column will be lost.
  - You are about to drop the column `generatedCode` on the `TrackingLink` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "TrackingLink_generatedCode_idx";

-- AlterTable
ALTER TABLE "PixelSession" ADD COLUMN     "lastTrackingLinkId" TEXT;

-- AlterTable
ALTER TABLE "TrackingLink" DROP COLUMN "finalMessageText",
DROP COLUMN "generatedCode";

-- AddForeignKey
ALTER TABLE "PixelSession" ADD CONSTRAINT "PixelSession_lastTrackingLinkId_fkey" FOREIGN KEY ("lastTrackingLinkId") REFERENCES "TrackingLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
