-- AlterTable: Add tradeSignature column for flexible trade matching
ALTER TABLE "trades" ADD COLUMN "tradeSignature" TEXT;

-- CreateIndex: Index on tradeSignature for fast lookups
CREATE INDEX "trades_tradeSignature_idx" ON "trades"("tradeSignature");
