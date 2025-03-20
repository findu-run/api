/*
  Warnings:

  - You are about to drop the column `userId` on the `query_logs` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "query_logs" DROP CONSTRAINT "query_logs_userId_fkey";

-- AlterTable
ALTER TABLE "query_logs" DROP COLUMN "userId";
