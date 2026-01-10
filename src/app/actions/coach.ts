'use server';

import prisma from '@/lib/prisma';
import { getUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { isAdmin } from './admin';

// Types for coach actions
export interface ConversationWithMessages {
  id: string;
  title: string | null;
  context: unknown;
  createdAt: Date;
  updatedAt: Date;
  messages: {
    id: string;
    role: string;
    content: string;
    feedback: string | null;
    createdAt: Date;
  }[];
}

/**
 * Create a new coach conversation
 */
export async function createConversation(context?: unknown): Promise<ConversationWithMessages | null> {
  const user = await getUser();
  if (!user) return null;

  const conversation = await prisma.coachConversation.create({
    data: {
      userId: user.id,
      context: context ? JSON.parse(JSON.stringify(context)) : undefined,
    },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return conversation;
}

/**
 * Get a conversation by ID
 */
export async function getConversation(id: string): Promise<ConversationWithMessages | null> {
  const user = await getUser();
  if (!user) return null;

  const conversation = await prisma.coachConversation.findFirst({
    where: {
      id,
      userId: user.id,
    },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return conversation;
}

/**
 * Get recent conversations for a user
 */
export async function getRecentConversations(limit = 10): Promise<ConversationWithMessages[]> {
  const user = await getUser();
  if (!user) return [];

  const conversations = await prisma.coachConversation.findMany({
    where: { userId: user.id },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 1, // Just get first message for preview
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

  return conversations;
}

/**
 * Add a message to a conversation
 */
export async function addMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<{ id: string; role: string; content: string; createdAt: Date } | null> {
  const user = await getUser();
  if (!user) return null;

  // Verify conversation belongs to user
  const conversation = await prisma.coachConversation.findFirst({
    where: {
      id: conversationId,
      userId: user.id,
    },
  });

  if (!conversation) return null;

  const message = await prisma.coachMessage.create({
    data: {
      conversationId,
      role,
      content,
    },
  });

  // Update conversation's updatedAt
  await prisma.coachConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  // Auto-generate title from first user message if not set
  if (!conversation.title && role === 'user') {
    const title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
    await prisma.coachConversation.update({
      where: { id: conversationId },
      data: { title },
    });
  }

  return message;
}

/**
 * Update feedback on a message
 */
export async function updateMessageFeedback(
  messageId: string,
  feedback: 'LIKE' | 'DISLIKE' | null
): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;

  // Verify message belongs to user's conversation
  const message = await prisma.coachMessage.findFirst({
    where: { id: messageId },
    include: { conversation: true },
  });

  if (!message || message.conversation.userId !== user.id) return false;

  await prisma.coachMessage.update({
    where: { id: messageId },
    data: { feedback },
  });

  return true;
}

/**
 * Delete a conversation
 */
export async function deleteConversation(id: string): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;

  const conversation = await prisma.coachConversation.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!conversation) return false;

  await prisma.coachConversation.delete({
    where: { id },
  });

  return true;
}

/**
 * Submit user feedback/suggestion
 */
export async function submitFeedback(
  category: 'SUGGESTION' | 'BUG_REPORT' | 'COACH_FEEDBACK' | 'GENERAL',
  content: string,
  title?: string,
  metadata?: Record<string, unknown>
): Promise<{ id: string } | null> {
  const user = await getUser();
  if (!user) return null;

  const feedback = await prisma.userFeedback.create({
    data: {
      userId: user.id,
      category,
      content,
      title,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
    },
  });

  revalidatePath('/admin');

  return { id: feedback.id };
}

/**
 * Get all feedbacks (admin only)
 */
export async function getAllFeedbacks(
  filter?: { category?: string; resolved?: boolean }
): Promise<Array<{
  id: string;
  userId: string;
  category: string;
  title: string | null;
  content: string;
  resolved: boolean;
  createdAt: Date;
}>> {
  // Admin check
  const adminCheck = await isAdmin();
  if (!adminCheck) {
    throw new Error('Forbidden: Admin access required');
  }

  const feedbacks = await prisma.userFeedback.findMany({
    where: {
      ...(filter?.category && { category: filter.category as 'SUGGESTION' | 'BUG_REPORT' | 'COACH_FEEDBACK' | 'GENERAL' }),
      ...(filter?.resolved !== undefined && { resolved: filter.resolved }),
    },
    orderBy: { createdAt: 'desc' },
  });

  return feedbacks;
}

/**
 * Mark feedback as resolved (admin only)
 */
export async function resolveFeedback(id: string): Promise<boolean> {
  // Admin check
  const adminCheck = await isAdmin();
  if (!adminCheck) {
    throw new Error('Forbidden: Admin access required');
  }

  await prisma.userFeedback.update({
    where: { id },
    data: { resolved: true },
  });

  return true;
}

