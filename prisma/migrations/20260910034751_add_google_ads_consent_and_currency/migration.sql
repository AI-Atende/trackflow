-- AlterTable
ALTER TABLE "GoogleAdAccount" ADD COLUMN     "currencyCode" TEXT,
ADD COLUMN     "googleAdsConsentGranted" BOOLEAN NOT NULL DEFAULT true;
