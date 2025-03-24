-- AlterTable
ALTER TABLE "IpAddress" ADD COLUMN     "author_id" TEXT;

-- AddForeignKey
ALTER TABLE "IpAddress" ADD CONSTRAINT "IpAddress_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
