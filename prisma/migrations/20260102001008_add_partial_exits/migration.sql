-- AlterTable
ALTER TABLE "trades" ADD COLUMN "hasPartialExits" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "trade_exits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tradeId" UUID NOT NULL,
    "exitPrice" DECIMAL(18, 8) NOT NULL,
    "quantity" DECIMAL(18, 8) NOT NULL,
    "exitedAt" TIMESTAMP(3) NOT NULL,
    "pnl" DECIMAL(18, 2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_exits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trade_exits_tradeId_idx" ON "trade_exits"("tradeId");

-- AddForeignKey
ALTER TABLE "trade_exits" ADD CONSTRAINT "trade_exits_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
