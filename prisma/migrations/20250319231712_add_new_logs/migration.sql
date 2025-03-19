/*
  Warnings:

  - The values [BETA] on the enum `PlanTier` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `cpf` on the `query_logs` table. All the data in the column will be lost.
  - You are about to drop the column `response` on the `query_logs` table. All the data in the column will be lost.
  - Added the required column `queryType` to the `query_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `query_logs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PlanTier_new" AS ENUM ('BASIC', 'PROFESSIONAL', 'BUSINESS', 'TRIAL');
ALTER TABLE "plans" ALTER COLUMN "type" TYPE "PlanTier_new" USING ("type"::text::"PlanTier_new");
ALTER TYPE "PlanTier" RENAME TO "PlanTier_old";
ALTER TYPE "PlanTier_new" RENAME TO "PlanTier";
DROP TYPE "PlanTier_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "query_logs" DROP CONSTRAINT "query_logs_userId_fkey";

-- AlterTable
ALTER TABLE "query_logs" DROP COLUMN "cpf",
DROP COLUMN "response",
ADD COLUMN     "queryType" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL,
ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "query_logs" ADD CONSTRAINT "query_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
