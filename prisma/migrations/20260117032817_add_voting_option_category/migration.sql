-- CreateEnum (idempotent: only if not exists)
DO $$ BEGIN
    CREATE TYPE "VotingOptionCategory" AS ENUM ('ROADMAP', 'GENERAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable (idempotent: only if column doesn't exist)
DO $$ BEGIN
    ALTER TABLE "voting_options" ADD COLUMN "category" "VotingOptionCategory" NOT NULL DEFAULT 'GENERAL';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- CreateIndex (idempotent: only if index doesn't exist)
CREATE INDEX IF NOT EXISTS "voting_options_category_idx" ON "voting_options"("category");

-- Update existing roadmap options (idempotent: safe to run multiple times)
UPDATE "voting_options" SET "category" = 'ROADMAP' WHERE ("title" LIKE '%Epic%' OR "title" LIKE '%Phase%') AND "category" = 'GENERAL';
