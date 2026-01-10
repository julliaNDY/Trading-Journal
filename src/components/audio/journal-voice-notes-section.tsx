'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Mic, Play, Pause, Trash2, Loader2, FileText, ChevronDown, ChevronUp, Edit2, Sparkles, RefreshCw, Lightbulb, AlertTriangle, BookOpen, CheckCircle2, MicOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAudioRecorder, formatDuration, getExtensionForMimeType } from '@/hooks/use-audio-recorder';
import { AudioPreview } from './audio-preview';
import { deleteDayVoiceNote, type DayVoiceNoteData } from '@/app/actions/day-voice-notes';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface JournalVoiceNotesSectionProps {
  dateStr: string;
  timezoneOffset: number;
  initialVoiceNotes: DayVoiceNoteData[];
}

export function JournalVoiceNotesSection({ dateStr, timezoneOffset, initialVoiceNotes }: JournalVoiceNotesSectionProps) {
  const t = useTranslations('voiceNotes');
  const { toast } = useToast();
  
  const [voiceNotes, setVoiceNotes] = useState<DayVoiceNoteData[]>(initialVoiceNotes);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Audio recorder hook
  const {
    state,
    duration,
    audioBlob,
    error,
    mimeType,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    isSupported,
  } = useAudioRecorder();
  
  // Update voiceNotes when initialVoiceNotes changes (date change)
  useEffect(() => {
    setVoiceNotes(initialVoiceNotes);
  }, [initialVoiceNotes]);
  
  // Handle recording completion
  const handleRecordingComplete = useCallback((blob: Blob, dur: number) => {
    setRecordedBlob(blob);
    setRecordedDuration(dur);
  }, []);
  
  // Effect to handle recording state changes
  useEffect(() => {
    if (state === 'stopped' && audioBlob) {
      handleRecordingComplete(audioBlob, duration);
    }
  }, [state, audioBlob, duration, handleRecordingComplete]);
  
  // Handle save recording
  const handleSave = async () => {
    if (!recordedBlob) return;
    
    setIsUploading(true);
    try {
      // Use the correct file extension based on the MIME type used for recording
      const extension = getExtensionForMimeType(mimeType || recordedBlob.type);
      const fileName = `recording.${extension}`;
      
      console.log(`[JournalVoiceNotes] Uploading: ${fileName}, MIME: ${recordedBlob.type}, size: ${recordedBlob.size}`);
      
      const formData = new FormData();
      formData.append('file', recordedBlob, fileName);
      formData.append('date', dateStr);
      formData.append('duration', String(recordedDuration));
      
      const response = await fetch('/api/day-voice-notes/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }
      
      const newVoiceNote = await response.json();
      
      // Add to list
      setVoiceNotes(prev => [newVoiceNote, ...prev]);
      
      // Reset recording
      setRecordedBlob(null);
      setRecordedDuration(0);
      resetRecording();
      
      toast({
        title: t('uploaded'),
        variant: 'default',
      });
    } catch (err) {
      console.error('Upload error:', err);
      toast({
        title: t('error.title'),
        description: err instanceof Error ? err.message : t('error.uploadFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  // Handle discard recording
  const handleDiscard = () => {
    setRecordedBlob(null);
    setRecordedDuration(0);
    resetRecording();
  };
  
  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteNoteId) return;
    
    setIsDeleting(true);
    try {
      const result = await deleteDayVoiceNote(deleteNoteId);
      
      if (result.success) {
        setVoiceNotes(prev => prev.filter(n => n.id !== deleteNoteId));
        toast({
          title: t('deleted'),
          variant: 'default',
        });
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast({
        title: t('error.title'),
        description: err instanceof Error ? err.message : t('error.deleteFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setDeleteNoteId(null);
    }
  };
  
  // Show error toast for recording errors
  useEffect(() => {
    if (error) {
      let message = error.message;
      if (error.type === 'permission_denied') {
        message = t('error.microphoneDenied');
      } else if (error.type === 'not_supported') {
        message = t('error.notSupported');
      } else if (error.type === 'mime_type_error') {
        message = t('error.formatNotSupported');
      } else if (error.type === 'recording_error') {
        message = t('error.recordingFailed');
      }
      
      toast({
        title: t('error.title'),
        description: message,
        variant: 'destructive',
      });
    }
  }, [error, toast, t]);
  
  const isRecording = state === 'recording' || state === 'paused';
  const showPreview = recordedBlob && !isRecording;
  
  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Mic className="h-5 w-5" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Recording UI */}
          {!showPreview && (
            <div className="space-y-3">
              {!isSupported ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MicOff className="h-4 w-4" />
                  {t('error.notSupported')}
                </div>
              ) : isRecording ? (
                // Recording in progress
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                    </span>
                    <span className="text-sm font-medium">{t('recording')}</span>
                    <span className="font-mono text-sm">{formatDuration(duration)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={state === 'paused' ? resumeRecording : pauseRecording}
                    >
                      {state === 'paused' ? t('resume') : t('pause')}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={stopRecording}
                    >
                      {t('stop')}
                    </Button>
                  </div>
                </div>
              ) : (
                // Ready to record
                <Button
                  variant="outline"
                  onClick={startRecording}
                  className="gap-2"
                >
                  <Mic className="h-4 w-4" />
                  {t('record')}
                </Button>
              )}
            </div>
          )}
          
          {/* Preview after recording */}
          {showPreview && (
            <AudioPreview
              audioBlob={recordedBlob}
              duration={recordedDuration}
              onSave={handleSave}
              onDiscard={handleDiscard}
              isUploading={isUploading}
            />
          )}
          
          {/* Voice Notes List */}
          {voiceNotes.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              {voiceNotes.map((note) => (
                <JournalVoiceNoteItem
                  key={note.id}
                  voiceNote={note}
                  onDelete={() => setDeleteNoteId(note.id)}
                  onTranscriptionUpdate={(id, transcription) => {
                    setVoiceNotes(prev => prev.map(n => 
                      n.id === id ? { ...n, transcription } : n
                    ));
                  }}
                  onSummaryUpdate={(id, summary) => {
                    setVoiceNotes(prev => prev.map(n => 
                      n.id === id ? { ...n, summary } : n
                    ));
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteNoteId} onOpenChange={() => setDeleteNoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Summary structure from LLM
interface ParsedSummary {
  keyPoints: string[];
  mistakes: string[];
  lessons: string[];
  actions: string[];
  rawSummary: string;
}

// Individual voice note item component with transcription and summary support
function JournalVoiceNoteItem({
  voiceNote,
  onDelete,
  onTranscriptionUpdate,
  onSummaryUpdate,
}: {
  voiceNote: DayVoiceNoteData;
  onDelete: () => void;
  onTranscriptionUpdate: (id: string, transcription: string) => void;
  onSummaryUpdate: (id: string, summary: string) => void;
}) {
  const t = useTranslations('voiceNotes');
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isAudioReady, setIsAudioReady] = useState(false);
  
  // Transcription states
  const [showTranscription, setShowTranscription] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTranscription, setEditedTranscription] = useState(voiceNote.transcription || '');
  const [isSaving, setIsSaving] = useState(false);
  
  // Summary states
  const [showSummary, setShowSummary] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  
  // Parse summary from JSON string
  const parsedSummary: ParsedSummary | null = useMemo(() => {
    if (!voiceNote.summary) return null;
    try {
      return JSON.parse(voiceNote.summary) as ParsedSummary;
    } catch {
      return null;
    }
  }, [voiceNote.summary]);
  
  const audioUrl = `/api/uploads/${voiceNote.filePath}`;
  
  const togglePlay = useCallback(async () => {
    if (!audioRef.current || audioError) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.error('[JournalVoiceNoteItem] Playback error:', err);
        setAudioError('Unable to play audio');
        toast({
          title: t('error.title'),
          description: t('error.playbackFailed'),
          variant: 'destructive',
        });
      }
    }
  }, [isPlaying, audioError, toast, t]);
  
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handleCanPlay = () => {
      setIsAudioReady(true);
      setAudioError(null);
    };
    const handleError = () => {
      console.error('[JournalVoiceNoteItem] Audio error for:', audioUrl);
      setAudioError('Audio format not supported');
      setIsAudioReady(false);
    };
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
    };
  }, [audioUrl]);
  
  // Handle transcription request
  const handleTranscribe = async () => {
    setIsTranscribing(true);
    try {
      const response = await fetch(`/api/day-voice-notes/${voiceNote.id}/transcribe`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Transcription failed');
      }
      
      onTranscriptionUpdate(voiceNote.id, data.transcription);
      setEditedTranscription(data.transcription);
      setShowTranscription(true);
      
      toast({
        title: t('transcription.completed'),
        variant: 'default',
      });
    } catch (err) {
      console.error('Transcription error:', err);
      toast({
        title: t('error.title'),
        description: err instanceof Error ? err.message : t('error.transcriptionFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsTranscribing(false);
    }
  };
  
  // Handle save edited transcription
  const handleSaveTranscription = async () => {
    setIsSaving(true);
    try {
      const { updateDayVoiceNoteTranscription } = await import('@/app/actions/day-voice-notes');
      const result = await updateDayVoiceNoteTranscription(voiceNote.id, editedTranscription);
      
      if (result.success) {
        onTranscriptionUpdate(voiceNote.id, editedTranscription);
        setIsEditing(false);
        toast({
          title: t('transcription.edited'),
          variant: 'default',
        });
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Save transcription error:', err);
      toast({
        title: t('error.title'),
        description: err instanceof Error ? err.message : t('error.unknown'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle summary generation
  const handleGenerateSummary = async (force: boolean = false) => {
    setIsGeneratingSummary(true);
    try {
      const response = await fetch(`/api/day-voice-notes/${voiceNote.id}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Summary generation failed');
      }
      
      onSummaryUpdate(voiceNote.id, JSON.stringify(data.summary));
      setShowSummary(true);
      
      toast({
        title: t('summary.generated'),
        variant: 'default',
      });
    } catch (err) {
      console.error('Summary generation error:', err);
      toast({
        title: t('error.title'),
        description: err instanceof Error ? err.message : t('summary.failed'),
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingSummary(false);
    }
  };
  
  const progress = voiceNote.duration > 0 ? (currentTime / voiceNote.duration) * 100 : 0;
  const hasTranscription = !!voiceNote.transcription;
  const hasSummary = !!parsedSummary;
  
  return (
    <div className="space-y-2 p-3 rounded-lg bg-muted/50">
      {/* Audio player row */}
      <div className="flex items-center gap-3">
        <audio ref={audioRef} src={audioUrl} preload="metadata" />
        
        {/* Play button */}
        <Button
          variant="outline"
          size="icon"
          onClick={togglePlay}
          disabled={!!audioError || !isAudioReady}
          className="h-9 w-9 shrink-0"
          aria-label={isPlaying ? t('pause') : t('play')}
          title={audioError || undefined}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </Button>
        
        {/* Progress and time */}
        <div className="flex-1 min-w-0 space-y-1">
          <Progress value={progress} className="h-1.5" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-mono">{formatDuration(Math.floor(currentTime))}</span>
            <span className="font-mono">{formatDuration(voiceNote.duration)}</span>
          </div>
        </div>
        
        {/* Delete button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={t('delete')}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Transcription controls row */}
      <div className="flex items-center gap-2 pt-1">
        {!hasTranscription ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleTranscribe}
            disabled={isTranscribing}
            className="gap-2 text-xs"
          >
            {isTranscribing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('transcription.inProgress')}
              </>
            ) : (
              <>
                <FileText className="h-3 w-3" />
                {t('transcription.transcribe')}
              </>
            )}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTranscription(!showTranscription)}
            className="gap-2 text-xs"
          >
            {showTranscription ? (
              <>
                <ChevronUp className="h-3 w-3" />
                {t('transcription.hide')}
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                {t('transcription.show')}
              </>
            )}
          </Button>
        )}
      </div>
      
      {/* Transcription content */}
      {hasTranscription && showTranscription && (
        <div className="pt-2 border-t">
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editedTranscription}
                onChange={(e) => setEditedTranscription(e.target.value)}
                className="w-full min-h-[100px] p-2 text-sm rounded-md border bg-background resize-y"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveTranscription}
                  disabled={isSaving}
                  className="gap-2"
                >
                  {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                  {t('transcription.save')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setEditedTranscription(voiceNote.transcription || '');
                  }}
                >
                  {t('transcription.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {voiceNote.transcription}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="gap-2 text-xs"
              >
                <Edit2 className="h-3 w-3" />
                {t('transcription.edit')}
              </Button>
            </div>
          )}
        </div>
      )}
      
      {/* Summary controls - only show if transcription exists */}
      {hasTranscription && (
        <div className="flex items-center gap-2 pt-1">
          {!hasSummary ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGenerateSummary(false)}
              disabled={isGeneratingSummary}
              className="gap-2 text-xs"
            >
              {isGeneratingSummary ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('summary.generating')}
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" />
                  {t('summary.generate')}
                </>
              )}
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSummary(!showSummary)}
                className="gap-2 text-xs"
              >
                {showSummary ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    {t('summary.hide')}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    {t('summary.show')}
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleGenerateSummary(true)}
                disabled={isGeneratingSummary}
                className="gap-2 text-xs"
                title={t('summary.regenerate')}
              >
                {isGeneratingSummary ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
              </Button>
            </>
          )}
        </div>
      )}
      
      {/* Summary content */}
      {hasSummary && showSummary && parsedSummary && (
        <div className="pt-2 border-t space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            {t('summary.title')}
          </div>
          
          {/* Raw Summary */}
          {parsedSummary.rawSummary && (
            <p className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3">
              {parsedSummary.rawSummary}
            </p>
          )}
          
          {/* Key Points */}
          {parsedSummary.keyPoints.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                <Lightbulb className="h-3 w-3" />
                {t('summary.keyPoints')}
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 ml-5 list-disc">
                {parsedSummary.keyPoints.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Mistakes */}
          {parsedSummary.mistakes.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-orange-600 dark:text-orange-400">
                <AlertTriangle className="h-3 w-3" />
                {t('summary.mistakes')}
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 ml-5 list-disc">
                {parsedSummary.mistakes.map((mistake, i) => (
                  <li key={i}>{mistake}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Lessons */}
          {parsedSummary.lessons.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-purple-600 dark:text-purple-400">
                <BookOpen className="h-3 w-3" />
                {t('summary.lessons')}
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 ml-5 list-disc">
                {parsedSummary.lessons.map((lesson, i) => (
                  <li key={i}>{lesson}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Actions */}
          {parsedSummary.actions.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3" />
                {t('summary.actions')}
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 ml-5 list-disc">
                {parsedSummary.actions.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

