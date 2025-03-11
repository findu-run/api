/*
  Warnings:

  - You are about to drop the column `betaTester` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `trialEndsAt` on the `subscriptions` table. All the data in the column will be lost.
  - Made the column `currentPeriodEnd` on table `subscriptions` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "isTrialAvailable" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "betaTester",
DROP COLUMN "trialEndsAt",
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "currentPeriodEnd" SET NOT NULL;
