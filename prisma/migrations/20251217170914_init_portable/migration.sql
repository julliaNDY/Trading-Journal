-- AlterTable
ALTER TABLE `trades` ADD COLUMN `accountId` VARCHAR(191) NULL,
    ADD COLUMN `fees` DECIMAL(18, 2) NULL,
    ADD COLUMN `grossPnlUsd` DECIMAL(18, 2) NULL,
    ADD COLUMN `note` TEXT NULL,
    ADD COLUMN `plannedRMultiple` DECIMAL(10, 4) NULL,
    ADD COLUMN `points` DECIMAL(18, 4) NULL,
    ADD COLUMN `profitTarget` DECIMAL(18, 8) NULL,
    ADD COLUMN `rating` INTEGER NULL,
    ADD COLUMN `realizedRMultiple` DECIMAL(10, 4) NULL,
    ADD COLUMN `ticksPerContract` DECIMAL(18, 4) NULL,
    ADD COLUMN `youtubeUrl` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `playbooks` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `playbooks_userId_idx`(`userId`),
    UNIQUE INDEX `playbooks_userId_name_key`(`userId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `playbook_groups` (
    `id` VARCHAR(191) NOT NULL,
    `playbookId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `playbook_groups_playbookId_idx`(`playbookId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `playbook_prerequisites` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `text` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `playbook_prerequisites_groupId_idx`(`groupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trade_playbooks` (
    `id` VARCHAR(191) NOT NULL,
    `tradeId` VARCHAR(191) NOT NULL,
    `playbookId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `trade_playbooks_tradeId_idx`(`tradeId`),
    INDEX `trade_playbooks_playbookId_idx`(`playbookId`),
    UNIQUE INDEX `trade_playbooks_tradeId_playbookId_key`(`tradeId`, `playbookId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trade_playbook_prerequisites` (
    `tradePlaybookId` VARCHAR(191) NOT NULL,
    `prerequisiteId` VARCHAR(191) NOT NULL,
    `checked` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`tradePlaybookId`, `prerequisiteId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accounts` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `broker` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT '#6366f1',
    `initialBalance` DECIMAL(18, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `accounts_userId_idx`(`userId`),
    UNIQUE INDEX `accounts_userId_name_key`(`userId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `trades_accountId_idx` ON `trades`(`accountId`);

-- AddForeignKey
ALTER TABLE `trades` ADD CONSTRAINT `trades_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `playbooks` ADD CONSTRAINT `playbooks_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `playbook_groups` ADD CONSTRAINT `playbook_groups_playbookId_fkey` FOREIGN KEY (`playbookId`) REFERENCES `playbooks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `playbook_prerequisites` ADD CONSTRAINT `playbook_prerequisites_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `playbook_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trade_playbooks` ADD CONSTRAINT `trade_playbooks_tradeId_fkey` FOREIGN KEY (`tradeId`) REFERENCES `trades`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trade_playbooks` ADD CONSTRAINT `trade_playbooks_playbookId_fkey` FOREIGN KEY (`playbookId`) REFERENCES `playbooks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trade_playbook_prerequisites` ADD CONSTRAINT `trade_playbook_prerequisites_tradePlaybookId_fkey` FOREIGN KEY (`tradePlaybookId`) REFERENCES `trade_playbooks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trade_playbook_prerequisites` ADD CONSTRAINT `trade_playbook_prerequisites_prerequisiteId_fkey` FOREIGN KEY (`prerequisiteId`) REFERENCES `playbook_prerequisites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
