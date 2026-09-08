-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "portalClientId" TEXT,
ADD COLUMN     "ssoProvisioned" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Client_portalClientId_key" ON "Client"("portalClientId");
