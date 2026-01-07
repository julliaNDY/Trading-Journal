-- CreateTable
CREATE TABLE "voice_notes" (
    "id" UUID NOT NULL,
    "tradeId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "filePath" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "transcription" TEXT,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voice_notes_tradeId_idx" ON "voice_notes"("tradeId");

-- CreateIndex
CREATE INDEX "voice_notes_userId_idx" ON "voice_notes"("userId");

-- AddForeignKey
ALTER TABLE "voice_notes" ADD CONSTRAINT "voice_notes_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_notes" ADD CONSTRAINT "voice_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

