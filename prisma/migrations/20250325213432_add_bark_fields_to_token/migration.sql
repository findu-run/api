/*
  Warnings:

  - You are about to drop the `bark_sessions` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "TokenType" ADD VALUE 'BARK_CONNECT';

-- DropForeignKey
ALTER TABLE "bark_sessions" DROP CONSTRAINT "bark_sessions_user_id_fkey";

-- AlterTable
ALTER TABLE "tokens" ADD COLUMN     "bark_key" TEXT,
ADD COLUMN     "device_key" TEXT,
ADD COLUMN     "device_token" TEXT;

-- DropTable
DROP TABLE "bark_sessions";
