/*
  Warnings:

  - You are about to drop the column `organizationId` on the `query_logs` table. All the data in the column will be lost.
  - Added the required column `ip_address` to the `query_logs` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "query_logs" DROP CONSTRAINT "query_logs_organizationId_fkey";

-- AlterTable
ALTER TABLE "query_logs" DROP COLUMN "organizationId",
ADD COLUMN     "ip_address" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "query_logs" ADD CONSTRAINT "query_logs_ip_address_fkey" FOREIGN KEY ("ip_address") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
