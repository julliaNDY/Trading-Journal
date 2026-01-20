-- CreateEnum
CREATE TYPE "BrokerAssetType" AS ENUM ('FOREX', 'FUTURES', 'STOCKS', 'CRYPTO', 'MULTI_ASSET', 'PROP_FIRM', 'OPTIONS');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('API', 'FILE_UPLOAD', 'COMING_SOON');

-- CreateTable
CREATE TABLE "brokers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "country" TEXT,
    "region" TEXT,
    "integrationStatus" "IntegrationStatus" NOT NULL DEFAULT 'COMING_SOON',
    "supportedAssets" "BrokerAssetType"[],
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "apiDocumentationUrl" TEXT,
    "csvTemplateUrl" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brokers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brokers_name_key" ON "brokers"("name");

-- CreateIndex
CREATE INDEX "brokers_integrationStatus_idx" ON "brokers"("integrationStatus");

-- CreateIndex
CREATE INDEX "brokers_country_idx" ON "brokers"("country");

-- CreateIndex
CREATE INDEX "brokers_priority_idx" ON "brokers"("priority");

-- CreateIndex
CREATE INDEX "brokers_isActive_idx" ON "brokers"("isActive");
