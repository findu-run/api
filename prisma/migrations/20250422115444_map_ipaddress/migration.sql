/*
  Warnings:

  - You are about to drop the column `ipAddress` on the `query_logs` table. All the data in the column will be lost.
  - Added the required column `organizationId` to the `query_logs` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "query_logs" DROP CONSTRAINT "query_logs_ip_address_fkey";

-- AlterTable
ALTER TABLE "query_logs" DROP COLUMN "ipAddress",
ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "query_logs" ADD CONSTRAINT "query_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
