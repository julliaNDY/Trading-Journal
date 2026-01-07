import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { updateMessageFeedback, submitFeedback } from '@/app/actions/coach';
import { z } from 'zod';

const messageFeedbackSchema = z.object({
  messageId: z.string().uuid(),
  feedback: z.enum(['LIKE', 'DISLIKE']).nullable(),
});

const userFeedbackSchema = z.object({
  category: z.enum(['SUGGESTION', 'BUG_REPORT', 'COACH_FEEDBACK', 'GENERAL']),
  content: z.string().min(10).max(2000),
  title: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { type } = body as { type?: string };

    // Handle message feedback (like/dislike on coach responses)
    if (type === 'message') {
      const result = messageFeedbackSchema.safeParse(body);
      if (!result.success) {
        return NextResponse.json(
          { error: 'Invalid request', details: result.error.issues },
          { status: 400 }
        );
      }

      const success = await updateMessageFeedback(
        result.data.messageId,
        result.data.feedback
      );

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to update feedback' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true });
    }

    // Handle user feedback/suggestions
    const result = userFeedbackSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: result.error.issues },
        { status: 400 }
      );
    }

    const feedback = await submitFeedback(
      result.data.category,
      result.data.content,
      result.data.title,
      result.data.metadata
    );

    if (!feedback) {
      return NextResponse.json(
        { error: 'Failed to submit feedback' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: feedback.id });

  } catch (error) {
    console.error('Feedback submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

