import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { transcribeAudio, isTranscriptionAvailable, type TranscriptionError } from '@/services/transcription-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: voiceNoteId } = await params;
    
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Check if transcription service is available
    if (!isTranscriptionAvailable()) {
      return NextResponse.json(
        { error: 'Transcription service not configured', code: 'NOT_CONFIGURED' },
        { status: 503 }
      );
    }
    
    // Find voice note and verify ownership
    const voiceNote = await prisma.dayVoiceNote.findFirst({
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
    
    // Check if already transcribed
    if (voiceNote.transcription) {
      return NextResponse.json({
        id: voiceNote.id,
        transcription: voiceNote.transcription,
        status: 'already_transcribed',
      });
    }
    
    // Perform transcription
    const result = await transcribeAudio(voiceNote.filePath);
    
    // Save transcription to database
    const updatedVoiceNote = await prisma.dayVoiceNote.update({
      where: { id: voiceNoteId },
      data: {
        transcription: result.textWithTimestamps || result.text,
      },
    });
    
    return NextResponse.json({
      id: updatedVoiceNote.id,
      transcription: updatedVoiceNote.transcription,
      language: result.language,
      duration: result.duration,
      status: 'completed',
    });
    
  } catch (error) {
    console.error('Transcription error:', error);
    
    const transcriptionError = error as TranscriptionError;
    if (transcriptionError.code) {
      return NextResponse.json(
        { error: transcriptionError.message, code: transcriptionError.code },
        { status: transcriptionError.code === 'FILE_TOO_LARGE' ? 413 : 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to transcribe audio', code: 'UNKNOWN' },
      { status: 500 }
    );
  }
}

