/*
  Warnings:

  - You are about to drop the column `ipAddress` on the `query_logs` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "query_logs_created_at_idx";

-- AlterTable
-- ALTER TABLE "query_logs" DROP COLUMN "ipAddress",
ADD COLUMN     "ip_address" TEXT;

-- CreateIndex
CREATE INDEX "query_logs_organizationId_created_at_idx" ON "query_logs"("organizationId", "created_at");

-- CreateIndex
CREATE INDEX "query_logs_organizationId_idx" ON "query_logs"("organizationId");
