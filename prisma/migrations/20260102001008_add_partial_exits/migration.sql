-- AlterTable
ALTER TABLE `trades` ADD COLUMN `hasPartialExits` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `trade_exits` (
    `id` VARCHAR(191) NOT NULL,
    `tradeId` VARCHAR(191) NOT NULL,
    `exitPrice` DECIMAL(18, 8) NOT NULL,
    `quantity` DECIMAL(18, 8) NOT NULL,
    `exitedAt` DATETIME(3) NOT NULL,
    `pnl` DECIMAL(18, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `trade_exits_tradeId_idx`(`tradeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `trade_exits` ADD CONSTRAINT `trade_exits_tradeId_fkey` FOREIGN KEY (`tradeId`) REFERENCES `trades`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
