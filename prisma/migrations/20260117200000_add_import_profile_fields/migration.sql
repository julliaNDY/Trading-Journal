-- AlterTable
ALTER TABLE "import_profiles" ADD COLUMN "brokerName" TEXT,
ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "import_profiles_brokerName_idx" ON "import_profiles"("brokerName");

-- Add comment
COMMENT ON COLUMN "import_profiles"."brokerName" IS 'Broker identifier (e.g., tradovate, ibkr, mt4)';
COMMENT ON COLUMN "import_profiles"."isSystem" IS 'System profiles cannot be deleted/modified by users';
COMMENT ON COLUMN "import_profiles"."mapping" IS 'JSON stringified CsvMapping';
