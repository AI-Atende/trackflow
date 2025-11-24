-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MEMBER', 'ADMIN');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'MEMBER';
