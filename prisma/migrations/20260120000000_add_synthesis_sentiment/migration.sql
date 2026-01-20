-- CreateEnum
CREATE TYPE "SynthesisSentiment" AS ENUM ('BULLISH', 'BEARISH', 'NEUTRAL');

-- AlterTable
ALTER TABLE "daily_bias_analyses" ADD COLUMN "synthesisText" TEXT,
ADD COLUMN "synthesisSentiment" "SynthesisSentiment";

-- CreateIndex
CREATE INDEX "daily_bias_analyses_synthesisSentiment_idx" ON "daily_bias_analyses"("synthesisSentiment");
