-- AlterTable
ALTER TABLE "KommoFieldMapping" ADD COLUMN     "defaultCurrency" TEXT NOT NULL DEFAULT 'BRL';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "email" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "saleValue" DOUBLE PRECISION;
