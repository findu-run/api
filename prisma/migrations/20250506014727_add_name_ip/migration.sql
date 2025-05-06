/*
  Warnings:

  - You are about to drop the column `ipAddress` on the `query_logs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "IpAddress" ADD COLUMN     "name" TEXT;

-- AlterTable
ALTER TABLE "query_logs" DROP COLUMN "ipAddress",
ADD COLUMN     "ip_address" TEXT;
