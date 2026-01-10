import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { isTranscriptionAvailable } from '@/services/transcription-service';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Allowed audio MIME types (base types without codec parameters)
const ALLOWED_BASE_TYPES = [
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/x-m4a',
  'audio/m4a',
];

// Map base MIME types to file extensions
const mimeToExt: Record<string, string> = {
  'audio/webm': '.webm',
  'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'audio/x-m4a': '.m4a',
  'audio/m4a': '.m4a',
};

/**
 * Get base MIME type without codec parameters
 * e.g. "audio/webm;codecs=opus" -> "audio/webm"
 */
function getBaseMimeType(mimeType: string): string {
  return mimeType.split(';')[0].trim();
}

/**
 * Check if MIME type is allowed (handles codecs parameter)
 */
function isAllowedMimeType(mimeType: string): boolean {
  const baseType = getBaseMimeType(mimeType);
  return ALLOWED_BASE_TYPES.includes(baseType);
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const dateStr = formData.get('date') as string | null;
    const durationStr = formData.get('duration') as string | null;
    
    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    if (!dateStr) {
      return NextResponse.json(
        { error: 'Date is required' },
        { status: 400 }
      );
    }
    
    // Validate file type (handles MIME types with codec parameters like "audio/webm;codecs=opus")
    const mimeType = file.type || 'audio/webm';
    if (!isAllowedMimeType(mimeType)) {
      return NextResponse.json(
        { error: `Invalid file type: ${mimeType}. Allowed: ${ALLOWED_BASE_TYPES.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Get base MIME type for extension lookup
    const baseMimeType = getBaseMimeType(mimeType);
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }
    
    // Parse date
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    
    // Get or create DayJournal
    let dayJournal = await prisma.dayJournal.findFirst({
      where: {
        userId: user.id,
        date,
      },
    });
    
    if (!dayJournal) {
      dayJournal = await prisma.dayJournal.create({
        data: {
          userId: user.id,
          date,
        },
      });
    }
    
    // Generate unique filename
    const fileId = uuidv4();
    const ext = mimeToExt[baseMimeType] || '.webm';
    const fileName = `${fileId}${ext}`;
    
    // Create directory structure: uploads/day-voice-notes/{dayJournalId}/
    const uploadPath = path.join('day-voice-notes', dayJournal.id);
    const fullUploadDir = path.join(process.cwd(), UPLOAD_DIR, uploadPath);
    
    await fs.mkdir(fullUploadDir, { recursive: true });
    
    // Write file to disk
    const filePath = path.join(fullUploadDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    
    // Parse duration (in seconds)
    const duration = durationStr ? parseInt(durationStr, 10) : 0;
    
    // Create database record
    const voiceNote = await prisma.dayVoiceNote.create({
      data: {
        dayJournalId: dayJournal.id,
        userId: user.id,
        filePath: path.join(uploadPath, fileName).replace(/\\/g, '/'),
        duration,
      },
    });
    
    return NextResponse.json({
      id: voiceNote.id,
      dayJournalId: voiceNote.dayJournalId,
      filePath: voiceNote.filePath,
      duration: voiceNote.duration,
      createdAt: voiceNote.createdAt,
      transcription: null,
      transcriptionAvailable: isTranscriptionAvailable(),
    });
    
  } catch (error) {
    console.error('Day voice note upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload voice note' },
      { status: 500 }
    );
  }
}

