-- CreateTable
CREATE TABLE "daily_bias_analyses" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "instrument" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "securityAnalysis" JSONB,
    "macroAnalysis" JSONB,
    "institutionalFlux" JSONB,
    "mag7Analysis" JSONB,
    "technicalAnalysis" JSONB,
    "synthesis" JSONB,
    "processingTimeMs" INTEGER,
    "aiProvider" TEXT NOT NULL DEFAULT 'gemini',
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_bias_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_bias_analyses_userId_idx" ON "daily_bias_analyses"("userId");

-- CreateIndex
CREATE INDEX "daily_bias_analyses_instrument_idx" ON "daily_bias_analyses"("instrument");

-- CreateIndex
CREATE INDEX "daily_bias_analyses_date_idx" ON "daily_bias_analyses"("date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_bias_analyses_userId_instrument_date_key" ON "daily_bias_analyses"("userId", "instrument", "date");

-- AddForeignKey
ALTER TABLE "daily_bias_analyses" ADD CONSTRAINT "daily_bias_analyses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
