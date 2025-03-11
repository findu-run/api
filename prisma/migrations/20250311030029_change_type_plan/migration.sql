/*
  Warnings:

  - You are about to drop the column `type` on the `subscriptions` table. All the data in the column will be lost.
  - Added the required column `type` to the `plans` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('BASIC', 'PROFESSIONAL', 'BUSINESS', 'TRIAL', 'BETA');

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "type" "PlanType" NOT NULL;

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "type";

-- DropEnum
DROP TYPE "SubscriptionType";
