-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "lineId" INTEGER;

-- CreateIndex
CREATE INDEX "Payment_lineId_idx" ON "Payment"("lineId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "InvoiceLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
