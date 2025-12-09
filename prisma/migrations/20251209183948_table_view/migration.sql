-- CreateTable
CREATE TABLE "TableView" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dataSource" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TableView_clientId_dataSource_idx" ON "TableView"("clientId", "dataSource");

-- AddForeignKey
ALTER TABLE "TableView" ADD CONSTRAINT "TableView_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
