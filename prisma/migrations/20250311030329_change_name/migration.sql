/*
  Warnings:

  - Changed the type of `type` on the `plans` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('BASIC', 'PROFESSIONAL', 'BUSINESS', 'TRIAL', 'BETA');

-- AlterTable
ALTER TABLE "plans" DROP COLUMN "type",
ADD COLUMN     "type" "PlanTier" NOT NULL;

-- DropEnum
DROP TYPE "PlanType";
