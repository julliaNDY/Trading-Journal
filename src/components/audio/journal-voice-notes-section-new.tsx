'use client';

/**
 * Voice Notes Section for Journal
 * 
 * Wrapper around BaseVoiceNotesSection for journal/day-specific voice notes.
 */

import { BaseVoiceNotesSection, BaseVoiceNote, VoiceNotesConfig } from './base-voice-notes-section';
import { deleteDayVoiceNote, type DayVoiceNoteData } from '@/app/actions/day-voice-notes';

interface JournalVoiceNotesSectionProps {
  dateStr: string;
  timezoneOffset: number;
  initialVoiceNotes: DayVoiceNoteData[];
}

// Ensure DayVoiceNoteData extends BaseVoiceNote  
type DayVoiceNote = BaseVoiceNote & {
  dayJournalId: string | null;
};

export function JournalVoiceNotesSection({ 
  dateStr, 
  timezoneOffset, 
  initialVoiceNotes 
}: JournalVoiceNotesSectionProps) {
  const config: VoiceNotesConfig = {
    uploadEndpoint: '/api/day-voice-notes',
    transcribeEndpoint: (id) => `/api/day-voice-notes/${id}/transcribe`,
    summaryEndpoint: (id) => `/api/day-voice-notes/${id}/summary`,
    deleteFunction: deleteDayVoiceNote,
    uploadFormData: { 
      date: dateStr,
      timezoneOffset: String(timezoneOffset),
    },
  };

  return (
    <BaseVoiceNotesSection<DayVoiceNote>
      config={config}
      initialVoiceNotes={initialVoiceNotes as DayVoiceNote[]}
    />
  );
}

