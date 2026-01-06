-- AlterTable: Add tradeSignature column for flexible trade matching
ALTER TABLE `trades` ADD COLUMN `tradeSignature` VARCHAR(191) NULL;

-- CreateIndex: Index on tradeSignature for fast lookups
CREATE INDEX `trades_tradeSignature_idx` ON `trades`(`tradeSignature`);

