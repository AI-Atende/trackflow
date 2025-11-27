-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaAdAccount" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "name" TEXT,
    "accessToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaAdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaAdInsightDaily" (
    "id" TEXT NOT NULL,
    "metaAdAccountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "adsetId" TEXT NOT NULL,
    "adsetName" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "adName" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL,
    "clicks" INTEGER NOT NULL,
    "spend" DOUBLE PRECISION NOT NULL,
    "leads" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaAdInsightDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_email_key" ON "Client"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAdAccount_clientId_key" ON "MetaAdAccount"("clientId");

-- CreateIndex
CREATE INDEX "MetaAdAccount_clientId_idx" ON "MetaAdAccount"("clientId");

-- CreateIndex
CREATE INDEX "MetaAdAccount_adAccountId_idx" ON "MetaAdAccount"("adAccountId");

-- CreateIndex
CREATE INDEX "MetaAdInsightDaily_campaignId_idx" ON "MetaAdInsightDaily"("campaignId");

-- CreateIndex
CREATE INDEX "MetaAdInsightDaily_adId_idx" ON "MetaAdInsightDaily"("adId");

-- CreateIndex
CREATE INDEX "MetaAdInsightDaily_date_idx" ON "MetaAdInsightDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAdInsightDaily_metaAdAccountId_adId_date_key" ON "MetaAdInsightDaily"("metaAdAccountId", "adId", "date");

-- AddForeignKey
ALTER TABLE "MetaAdAccount" ADD CONSTRAINT "MetaAdAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAdInsightDaily" ADD CONSTRAINT "MetaAdInsightDaily_metaAdAccountId_fkey" FOREIGN KEY ("metaAdAccountId") REFERENCES "MetaAdAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
