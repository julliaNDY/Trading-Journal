-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('LIKE', 'DISLIKE');

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('SUGGESTION', 'BUG_REPORT', 'COACH_FEEDBACK', 'GENERAL');

-- CreateTable
CREATE TABLE "coach_conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "title" TEXT,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversationId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "feedback" "FeedbackType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_feedbacks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "category" "FeedbackCategory" NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coach_conversations_userId_idx" ON "coach_conversations"("userId");

-- CreateIndex
CREATE INDEX "coach_conversations_createdAt_idx" ON "coach_conversations"("createdAt");

-- CreateIndex
CREATE INDEX "coach_messages_conversationId_idx" ON "coach_messages"("conversationId");

-- CreateIndex
CREATE INDEX "user_feedbacks_userId_idx" ON "user_feedbacks"("userId");

-- CreateIndex
CREATE INDEX "user_feedbacks_category_idx" ON "user_feedbacks"("category");

-- CreateIndex
CREATE INDEX "user_feedbacks_resolved_idx" ON "user_feedbacks"("resolved");

-- AddForeignKey
ALTER TABLE "coach_conversations" ADD CONSTRAINT "coach_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "coach_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_feedbacks" ADD CONSTRAINT "user_feedbacks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

