import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { generateCoachResponse, type ChatMessage, type CoachContext, type CoachError } from '@/services/coach-service';
import { calculateGlobalStats } from '@/services/stats-service';
import { getTrades } from '@/services/trade-service';
import { addMessage, createConversation, getConversation } from '@/app/actions/coach';

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { message, conversationId } = body as {
      message: string;
      conversationId?: string;
    };

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await getConversation(conversationId);
      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
    } else {
      // Create new conversation with context
      const trades = await getTrades({ userId: user.id });
      const stats = calculateGlobalStats(trades);
      
      const context: CoachContext = {
        stats: trades.length > 0 ? stats : null,
        recentTradesCount: trades.length,
        lastTradeDate: trades.length > 0 
          ? new Date(Math.max(...trades.map(t => t.closedAt.getTime()))).toISOString().split('T')[0]
          : null,
        accountAge: getAccountAge(user.createdAt),
        preferredSymbols: getPreferredSymbols(trades),
      };

      conversation = await createConversation(context);
      if (!conversation) {
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
      }
    }

    // Add user message to DB
    const userMessage = await addMessage(conversation.id, 'user', message.trim());
    if (!userMessage) {
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
    }

    // Build message history for AI
    const existingMessages = conversation.messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const allMessages: ChatMessage[] = [
      ...existingMessages,
      { role: 'user', content: message.trim() },
    ];

    // Get user's current stats for context
    const trades = await getTrades({ userId: user.id });
    const stats = calculateGlobalStats(trades);

    const context: CoachContext = {
      stats: trades.length > 0 ? stats : null,
      recentTradesCount: trades.length,
      lastTradeDate: trades.length > 0 
        ? new Date(Math.max(...trades.map(t => t.closedAt.getTime()))).toISOString().split('T')[0]
        : null,
      accountAge: getAccountAge(user.createdAt),
      preferredSymbols: getPreferredSymbols(trades),
    };

    // Generate AI response
    const response = await generateCoachResponse(allMessages, context);

    // Save assistant response to DB
    const assistantMessage = await addMessage(conversation.id, 'assistant', response.content);
    if (!assistantMessage) {
      return NextResponse.json({ error: 'Failed to save response' }, { status: 500 });
    }

    return NextResponse.json({
      conversationId: conversation.id,
      userMessage: {
        id: userMessage.id,
        content: userMessage.content,
        role: 'user',
        createdAt: userMessage.createdAt,
      },
      assistantMessage: {
        id: assistantMessage.id,
        content: response.content,
        role: 'assistant',
        createdAt: assistantMessage.createdAt,
      },
      usage: response.usage,
    });

  } catch (error) {
    console.error('Coach chat error:', error);

    const coachError = error as CoachError;
    if (coachError.code) {
      const statusMap: Record<string, number> = {
        'NOT_CONFIGURED': 503,
        'EMPTY_MESSAGE': 400,
        'RATE_LIMIT': 429,
        'API_ERROR': 500,
      };

      return NextResponse.json(
        { error: coachError.message, code: coachError.code },
        { status: statusMap[coachError.code] || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getAccountAge(createdAt: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (days < 7) return `${days} jours`;
  if (days < 30) return `${Math.floor(days / 7)} semaines`;
  if (days < 365) return `${Math.floor(days / 30)} mois`;
  return `${Math.floor(days / 365)} ans`;
}

function getPreferredSymbols(trades: Array<{ symbol: string }>): string[] {
  const symbolCounts = trades.reduce((acc, t) => {
    acc[t.symbol] = (acc[t.symbol] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(symbolCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([symbol]) => symbol);
}

