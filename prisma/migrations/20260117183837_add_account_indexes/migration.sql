-- Story 3.1: Unlimited Accounts - Data Model & Optimizations
-- Add optimized indexes for multi-account queries

-- Add index on broker field for filtering by broker
CREATE INDEX IF NOT EXISTS "accounts_broker_idx" ON "accounts"("broker");

-- Add index on createdAt for sorting by creation date
CREATE INDEX IF NOT EXISTS "accounts_createdAt_idx" ON "accounts"("createdAt");

-- Add composite index on userId + broker for efficient filtering
CREATE INDEX IF NOT EXISTS "accounts_userId_broker_idx" ON "accounts"("userId", "broker");
