'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import type { DayVoiceNote } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';

export interface DayVoiceNoteData {
  id: string;
  dayJournalId: string;
  filePath: string;
  duration: number;
  transcription: string | null;
  transcriptionHash: string | null;
  summary: string | null;
  createdAt: Date;
}

/**
 * Get or create a DayJournal for a given date
 */
async function getOrCreateDayJournal(userId: string, dateStr: string, timezoneOffset: number): Promise<string> {
  // Parse date string and adjust for timezone
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  
  // Find existing journal
  const existing = await prisma.dayJournal.findFirst({
    where: {
      userId,
      date,
    },
  });
  
  if (existing) {
    return existing.id;
  }
  
  // Create new journal
  const newJournal = await prisma.dayJournal.create({
    data: {
      userId,
      date,
    },
  });
  
  return newJournal.id;
}

/**
 * Get all voice notes for a specific day
 */
export async function getDayVoiceNotes(dateStr: string, timezoneOffset: number): Promise<DayVoiceNoteData[]> {
  const user = await requireAuth();
  
  // Parse date
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  
  // Find the day journal
  const dayJournal = await prisma.dayJournal.findFirst({
    where: {
      userId: user.id,
      date,
    },
    include: {
      voiceNotes: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  
  if (!dayJournal) {
    return [];
  }
  
  return dayJournal.voiceNotes.map((note: DayVoiceNote) => ({
    id: note.id,
    dayJournalId: note.dayJournalId,
    filePath: note.filePath,
    duration: note.duration,
    transcription: note.transcription,
    transcriptionHash: note.transcriptionHash,
    summary: note.summary,
    createdAt: note.createdAt,
  }));
}

/**
 * Get a single day voice note by ID
 */
export async function getDayVoiceNote(id: string): Promise<DayVoiceNoteData | null> {
  const user = await requireAuth();
  
  const voiceNote = await prisma.dayVoiceNote.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });
  
  if (!voiceNote) return null;
  
  return {
    id: voiceNote.id,
    dayJournalId: voiceNote.dayJournalId,
    filePath: voiceNote.filePath,
    duration: voiceNote.duration,
    transcription: voiceNote.transcription,
    transcriptionHash: voiceNote.transcriptionHash,
    summary: voiceNote.summary,
    createdAt: voiceNote.createdAt,
  };
}

/**
 * Delete a day voice note (file + DB record)
 */
export async function deleteDayVoiceNote(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    
    // Find the voice note and verify ownership
    const voiceNote = await prisma.dayVoiceNote.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: {
        dayJournal: true,
      },
    });
    
    if (!voiceNote) {
      return { success: false, error: 'Voice note not found or access denied' };
    }
    
    // Delete the file from disk
    try {
      const fullPath = path.join(process.cwd(), UPLOAD_DIR, voiceNote.filePath);
      await fs.unlink(fullPath);
    } catch (fileError) {
      console.warn('Could not delete voice note file:', fileError);
    }
    
    // Delete from database
    await prisma.dayVoiceNote.delete({
      where: { id },
    });
    
    // Revalidate the journal page
    revalidatePath('/journal');
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting day voice note:', error);
    return { success: false, error: 'Failed to delete voice note' };
  }
}

/**
 * Update transcription for a day voice note
 */
export async function updateDayVoiceNoteTranscription(
  id: string, 
  transcription: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    
    // Verify ownership
    const voiceNote = await prisma.dayVoiceNote.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });
    
    if (!voiceNote) {
      return { success: false, error: 'Voice note not found or access denied' };
    }
    
    await prisma.dayVoiceNote.update({
      where: { id },
      data: { transcription },
    });
    
    revalidatePath('/journal');
    
    return { success: true };
  } catch (error) {
    console.error('Error updating transcription:', error);
    return { success: false, error: 'Failed to update transcription' };
  }
}

