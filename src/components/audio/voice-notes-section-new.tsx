'use client';

/**
 * Voice Notes Section for Trades
 * 
 * Wrapper around BaseVoiceNotesSection for trade-specific voice notes.
 */

import { BaseVoiceNotesSection, BaseVoiceNote, VoiceNotesConfig } from './base-voice-notes-section';
import { deleteVoiceNote, type VoiceNoteData } from '@/app/actions/voice-notes';

interface VoiceNotesSectionProps {
  tradeId: string;
  initialVoiceNotes: VoiceNoteData[];
}

// Ensure VoiceNoteData extends BaseVoiceNote
type VoiceNote = BaseVoiceNote & {
  tradeId: string;
};

export function VoiceNotesSection({ tradeId, initialVoiceNotes }: VoiceNotesSectionProps) {
  const config: VoiceNotesConfig = {
    uploadEndpoint: '/api/voice-notes',
    transcribeEndpoint: (id) => `/api/voice-notes/${id}/transcribe`,
    summaryEndpoint: (id) => `/api/voice-notes/${id}/summary`,
    deleteFunction: deleteVoiceNote,
    uploadFormData: { tradeId },
  };

  return (
    <BaseVoiceNotesSection<VoiceNote>
      config={config}
      initialVoiceNotes={initialVoiceNotes as VoiceNote[]}
    />
  );
}

