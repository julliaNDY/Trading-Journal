import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { 
  generateSummary, 
  isSummaryAvailable, 
  hashTranscription,
  type SummaryError 
} from '@/services/summary-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: voiceNoteId } = await params;
    
    // Check for force regeneration flag
    const body = await request.json().catch(() => ({}));
    const forceRegenerate = body.force === true;
    
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Check if summary service is available
    if (!isSummaryAvailable()) {
      return NextResponse.json(
        { error: 'Summary service not configured', code: 'NOT_CONFIGURED' },
        { status: 503 }
      );
    }
    
    // Find voice note and verify ownership
    const voiceNote = await prisma.voiceNote.findFirst({
      where: {
        id: voiceNoteId,
        userId: user.id,
      },
    });
    
    if (!voiceNote) {
      return NextResponse.json(
        { error: 'Voice note not found or access denied' },
        { status: 404 }
      );
    }
    
    // Check if transcription exists
    if (!voiceNote.transcription) {
      return NextResponse.json(
        { error: 'No transcription available. Please transcribe the audio first.', code: 'NO_TRANSCRIPTION' },
        { status: 400 }
      );
    }
    
    // Check if regeneration is needed
    const currentHash = hashTranscription(voiceNote.transcription);
    const needsRegen = forceRegenerate || 
      !voiceNote.summary || 
      voiceNote.transcriptionHash !== currentHash;
    
    if (!needsRegen && voiceNote.summary) {
      // Return existing summary
      try {
        const existingSummary = JSON.parse(voiceNote.summary);
        return NextResponse.json({
          id: voiceNote.id,
          summary: existingSummary,
          transcriptionHash: voiceNote.transcriptionHash,
          status: 'cached',
        });
      } catch {
        // If parsing fails, regenerate
      }
    }
    
    // Generate new summary
    const result = await generateSummary(voiceNote.transcription);
    
    // Save to database
    const updatedVoiceNote = await prisma.voiceNote.update({
      where: { id: voiceNoteId },
      data: {
        summary: JSON.stringify(result.summary),
        transcriptionHash: result.transcriptionHash,
      },
    });
    
    return NextResponse.json({
      id: updatedVoiceNote.id,
      summary: result.summary,
      transcriptionHash: result.transcriptionHash,
      status: 'generated',
    });
    
  } catch (error) {
    console.error('Summary generation error:', error);
    
    // Handle known summary errors
    const summaryError = error as SummaryError;
    if (summaryError.code) {
      const statusCode = summaryError.code === 'EMPTY_TRANSCRIPTION' ? 400 : 500;
      return NextResponse.json(
        { error: summaryError.message, code: summaryError.code },
        { status: statusCode }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to generate summary', code: 'UNKNOWN' },
      { status: 500 }
    );
  }
}

