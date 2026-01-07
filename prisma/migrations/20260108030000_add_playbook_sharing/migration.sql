-- CreateEnum
CREATE TYPE "PlaybookVisibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- AlterTable: Add sharing fields to playbooks
ALTER TABLE "playbooks" ADD COLUMN "visibility" "PlaybookVisibility" NOT NULL DEFAULT 'PRIVATE';
ALTER TABLE "playbooks" ADD COLUMN "shareToken" UUID;
ALTER TABLE "playbooks" ADD COLUMN "originalPlaybookId" UUID;
ALTER TABLE "playbooks" ADD COLUMN "originalAuthorId" UUID;
ALTER TABLE "playbooks" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "playbooks" ADD COLUMN "importCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "playbooks_shareToken_key" ON "playbooks"("shareToken");

-- CreateIndex
CREATE INDEX "playbooks_visibility_idx" ON "playbooks"("visibility");

-- CreateIndex
CREATE INDEX "playbooks_shareToken_idx" ON "playbooks"("shareToken");

