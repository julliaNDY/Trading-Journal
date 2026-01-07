-- CreateEnum
CREATE TYPE "BrokerType" AS ENUM ('TRADOVATE', 'IBKR');

-- CreateEnum
CREATE TYPE "BrokerConnectionStatus" AS ENUM ('PENDING', 'CONNECTED', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "broker_connections" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "brokerType" "BrokerType" NOT NULL,
    "status" "BrokerConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "encryptedApiKey" TEXT,
    "encryptedApiSecret" TEXT,
    "accessToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "brokerAccountId" TEXT,
    "brokerAccountName" TEXT,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncIntervalMin" INTEGER NOT NULL DEFAULT 15,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "accountId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "broker_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" UUID NOT NULL,
    "brokerConnectionId" UUID NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "tradesImported" INTEGER NOT NULL DEFAULT 0,
    "tradesSkipped" INTEGER NOT NULL DEFAULT 0,
    "tradesUpdated" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "errorDetails" JSONB,
    "syncType" TEXT NOT NULL DEFAULT 'scheduled',

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "broker_connections_userId_idx" ON "broker_connections"("userId");

-- CreateIndex
CREATE INDEX "broker_connections_brokerType_idx" ON "broker_connections"("brokerType");

-- CreateIndex
CREATE INDEX "broker_connections_status_idx" ON "broker_connections"("status");

-- CreateIndex
CREATE UNIQUE INDEX "broker_connections_userId_brokerType_brokerAccountId_key" ON "broker_connections"("userId", "brokerType", "brokerAccountId");

-- CreateIndex
CREATE INDEX "sync_logs_brokerConnectionId_idx" ON "sync_logs"("brokerConnectionId");

-- CreateIndex
CREATE INDEX "sync_logs_status_idx" ON "sync_logs"("status");

-- CreateIndex
CREATE INDEX "sync_logs_startedAt_idx" ON "sync_logs"("startedAt");

-- AddForeignKey
ALTER TABLE "broker_connections" ADD CONSTRAINT "broker_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_connections" ADD CONSTRAINT "broker_connections_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_brokerConnectionId_fkey" FOREIGN KEY ("brokerConnectionId") REFERENCES "broker_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

