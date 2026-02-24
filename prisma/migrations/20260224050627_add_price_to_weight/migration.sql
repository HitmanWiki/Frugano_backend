-- DropForeignKey
ALTER TABLE "WeightMeasurement" DROP CONSTRAINT "WeightMeasurement_productId_fkey";

-- AlterTable
ALTER TABLE "WeightMeasurement" ALTER COLUMN "productId" DROP NOT NULL,
ALTER COLUMN "price" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "WeightMeasurement" ADD CONSTRAINT "WeightMeasurement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
