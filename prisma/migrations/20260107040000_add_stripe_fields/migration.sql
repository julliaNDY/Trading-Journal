-- Add Stripe integration fields to subscription system

-- Add stripeCustomerId to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_stripeCustomerId_key" ON "users"("stripeCustomerId");

-- Add Stripe fields to plans
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "stripePriceId" TEXT;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "savings" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "plans_stripePriceId_key" ON "plans"("stripePriceId");

-- Update default trialDays from 0 to 7
ALTER TABLE "plans" ALTER COLUMN "trialDays" SET DEFAULT 7;

-- Add stripeSubscriptionId to subscriptions
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_stripeSubscriptionId_key" ON "subscriptions"("stripeSubscriptionId");
CREATE INDEX IF NOT EXISTS "subscriptions_stripeSubscriptionId_idx" ON "subscriptions"("stripeSubscriptionId");

-- Add Stripe fields to invoices
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "stripeInvoiceId" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "invoicePdfUrl" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_stripeInvoiceId_key" ON "invoices"("stripeInvoiceId");
CREATE INDEX IF NOT EXISTS "invoices_stripeInvoiceId_idx" ON "invoices"("stripeInvoiceId");

