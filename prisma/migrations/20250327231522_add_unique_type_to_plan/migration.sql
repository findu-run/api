-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "paymentId" TEXT,
ALTER COLUMN "subscriptionId" DROP NOT NULL;
