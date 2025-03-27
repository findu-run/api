/*
  Warnings:

  - A unique constraint covering the columns `[type]` on the table `plans` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "plans_type_key" ON "plans"("type");
