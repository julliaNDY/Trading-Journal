'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import type { VoiceNote } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'public/uploads';

export interface VoiceNoteData {
  id: string;
  tradeId: string;
  filePath: string;
  duration: number;
  transcription: string | null;
  summary: string | null;
  createdAt: Date;
}

/**
 * Get all voice notes for a specific trade
 */
export async function getVoiceNotes(tradeId: string): Promise<VoiceNoteData[]> {
  const user = await requireAuth();
  
  const voiceNotes = await prisma.voiceNote.findMany({
    where: {
      tradeId,
      userId: user.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  
  return voiceNotes.map((note: VoiceNote) => ({
    id: note.id,
    tradeId: note.tradeId,
    filePath: note.filePath,
    duration: note.duration,
    transcription: note.transcription,
    summary: note.summary,
    createdAt: note.createdAt,
  }));
}

/**
 * Get a single voice note by ID
 */
export async function getVoiceNote(id: string): Promise<VoiceNoteData | null> {
  const user = await requireAuth();
  
  const voiceNote = await prisma.voiceNote.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });
  
  if (!voiceNote) return null;
  
  return {
    id: voiceNote.id,
    tradeId: voiceNote.tradeId,
    filePath: voiceNote.filePath,
    duration: voiceNote.duration,
    transcription: voiceNote.transcription,
    summary: voiceNote.summary,
    createdAt: voiceNote.createdAt,
  };
}

/**
 * Delete a voice note (file + DB record)
 * Includes ownership verification for security
 */
export async function deleteVoiceNote(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    
    // Find the voice note and verify ownership
    const voiceNote = await prisma.voiceNote.findFirst({
      where: {
        id,
        userId: user.id, // Security: verify ownership
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
      // File might already be deleted, continue with DB cleanup
      console.warn('Could not delete voice note file:', fileError);
    }
    
    // Delete from database
    await prisma.voiceNote.delete({
      where: { id },
    });
    
    // Revalidate the trade detail page
    revalidatePath(`/trades/${voiceNote.tradeId}`);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting voice note:', error);
    return { success: false, error: 'Failed to delete voice note' };
  }
}

/**
 * Update transcription for a voice note (used by story 5.2)
 */
export async function updateVoiceNoteTranscription(
  id: string, 
  transcription: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    
    // Verify ownership
    const voiceNote = await prisma.voiceNote.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });
    
    if (!voiceNote) {
      return { success: false, error: 'Voice note not found or access denied' };
    }
    
    await prisma.voiceNote.update({
      where: { id },
      data: { transcription },
    });
    
    revalidatePath(`/trades/${voiceNote.tradeId}`);
    
    return { success: true };
  } catch (error) {
    console.error('Error updating transcription:', error);
    return { success: false, error: 'Failed to update transcription' };
  }
}

/**
 * Update summary for a voice note (used by story 5.3)
 */
export async function updateVoiceNoteSummary(
  id: string, 
  summary: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    
    // Verify ownership
    const voiceNote = await prisma.voiceNote.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });
    
    if (!voiceNote) {
      return { success: false, error: 'Voice note not found or access denied' };
    }
    
    await prisma.voiceNote.update({
      where: { id },
      data: { summary },
    });
    
    revalidatePath(`/trades/${voiceNote.tradeId}`);
    
    return { success: true };
  } catch (error) {
    console.error('Error updating summary:', error);
    return { success: false, error: 'Failed to update summary' };
  }
}

