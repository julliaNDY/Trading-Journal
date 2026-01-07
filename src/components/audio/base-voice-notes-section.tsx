'use client';

/**
 * Base Voice Notes Section Component
 * 
 * Generic component shared between Trade voice notes and Journal voice notes.
 * Reduces ~1600 lines of duplicated code to a single reusable component.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Mic,
  Play,
  Pause,
  Trash2,
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp,
  Edit2,
  Sparkles,
  RefreshCw,
  Lightbulb,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  MicOff,
} from 'lucide-react';
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
import { useAudioRecorder, formatDuration } from '@/hooks/use-audio-recorder';
import { AudioPreview } from './audio-preview';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// TYPES
// ============================================================================

export interface BaseVoiceNote {
  id: string;
  filePath: string;
  duration: number;
  transcription: string | null;
  summary: string | null;
  createdAt: Date;
}

export interface VoiceNotesConfig {
  /** API base path for uploads (e.g., '/api/voice-notes' or '/api/day-voice-notes') */
  uploadEndpoint: string;
  /** API path pattern for transcription (e.g., '/api/voice-notes/{id}/transcribe') */
  transcribeEndpoint: (id: string) => string;
  /** API path pattern for summary (e.g., '/api/voice-notes/{id}/summary') */
  summaryEndpoint: (id: string) => string;
  /** Delete function to call */
  deleteFunction: (id: string) => Promise<{ success: boolean; error?: string }>;
  /** Additional form data to append when uploading */
  uploadFormData: Record<string, string>;
}

interface BaseVoiceNotesSectionProps<T extends BaseVoiceNote> {
  /** Configuration for API endpoints and functions */
  config: VoiceNotesConfig;
  /** Initial voice notes */
  initialVoiceNotes: T[];
  /** Custom title (optional) */
  title?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function BaseVoiceNotesSection<T extends BaseVoiceNote>({
  config,
  initialVoiceNotes,
  title,
}: BaseVoiceNotesSectionProps<T>) {
  const t = useTranslations('voiceNotes');
  const { toast } = useToast();

  const [voiceNotes, setVoiceNotes] = useState<T[]>(initialVoiceNotes);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    state,
    isRecording,
    isPaused,
    duration,
    audioBlob,
    error,
    isSupported,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
  } = useAudioRecorder();

  // Update voiceNotes when initialVoiceNotes changes
  useEffect(() => {
    setVoiceNotes(initialVoiceNotes);
  }, [initialVoiceNotes]);

  // Handle recording complete
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

  // Handle stop recording
  const handleStop = () => {
    stopRecording();
  };

  // Handle save (upload)
  const handleSave = async (blob: Blob) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', blob, 'voice-note.webm');
      formData.append('duration', recordedDuration.toString());

      // Add custom form data
      Object.entries(config.uploadFormData).forEach(([key, value]) => {
        formData.append(key, value);
      });

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 100);

      const response = await fetch(`${config.uploadEndpoint}/upload`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const newVoiceNote = await response.json();
      setUploadProgress(100);

      // Add to list
      setVoiceNotes((prev) => [newVoiceNote as T, ...prev]);

      // Reset recording state
      setRecordedBlob(null);
      setRecordedDuration(0);
      resetRecording();

      toast({
        title: t('uploaded'),
        variant: 'default',
      });
    } catch (err) {
      toast({
        title: t('error.uploadFailed'),
        description: err instanceof Error ? err.message : t('error.unknown'),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle discard recording
  const handleDiscard = () => {
    setRecordedBlob(null);
    setRecordedDuration(0);
    resetRecording();
  };

  // Handle delete voice note
  const handleDelete = async () => {
    if (!deleteNoteId) return;

    setIsDeleting(true);
    try {
      const result = await config.deleteFunction(deleteNoteId);

      if (result.success) {
        setVoiceNotes((prev) => prev.filter((n) => n.id !== deleteNoteId));
        toast({
          title: t('deleted'),
          variant: 'default',
        });
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
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

  // Handle error
  useEffect(() => {
    if (error) {
      let message = t('error.uploadFailed');
      if (error.type === 'permission_denied') {
        message = t('error.microphoneDenied');
      } else if (error.type === 'not_supported') {
        message = t('error.notSupported');
      }

      toast({
        title: t('error.title'),
        description: message,
        variant: 'destructive',
      });
    }
  }, [error, t, toast]);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Mic className="h-5 w-5" />
            {title || t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Recording Controls */}
          {!recordedBlob && (
            <div className="flex items-center gap-3">
              {state === 'idle' && (
                <Button
                  variant="outline"
                  onClick={startRecording}
                  disabled={!isSupported}
                  className="gap-2"
                  aria-label={t('record')}
                >
                  <Mic className="h-4 w-4" />
                  {t('record')}
                </Button>
              )}

              {(isRecording || isPaused) && (
                <>
                  {/* Recording indicator */}
                  <div
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-md',
                      isRecording && 'bg-red-500/10',
                      isPaused && 'bg-yellow-500/10'
                    )}
                  >
                    <div
                      className={cn(
                        'h-3 w-3 rounded-full',
                        isRecording && 'bg-red-500 animate-pulse',
                        isPaused && 'bg-yellow-500'
                      )}
                    />
                    <span
                      className={cn(
                        'font-mono text-sm tabular-nums',
                        isRecording && 'text-red-500',
                        isPaused && 'text-yellow-500'
                      )}
                    >
                      {formatDuration(duration)}
                    </span>
                  </div>

                  {/* Pause/Resume */}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={isPaused ? resumeRecording : pauseRecording}
                    className="h-8 w-8"
                    aria-label={isPaused ? t('resume') : t('pause')}
                  >
                    {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  </Button>

                  {/* Stop */}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleStop}
                    className="gap-2"
                    aria-label={t('stop')}
                  >
                    {t('stop')}
                  </Button>
                </>
              )}

              {!isSupported && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MicOff className="h-4 w-4" />
                  {t('error.notSupported')}
                </div>
              )}
            </div>
          )}

          {/* Preview recorded audio */}
          {recordedBlob && (
            <AudioPreview
              audioBlob={recordedBlob}
              duration={recordedDuration}
              onSave={handleSave}
              onDiscard={handleDiscard}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
            />
          )}

          {/* Voice Notes List */}
          {voiceNotes.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              {voiceNotes.map((note) => (
                <VoiceNoteItem
                  key={note.id}
                  voiceNote={note}
                  config={config}
                  onDelete={() => setDeleteNoteId(note.id)}
                  onTranscriptionUpdate={(id, transcription) => {
                    setVoiceNotes((prev) =>
                      prev.map((n) => (n.id === id ? { ...n, transcription } : n))
                    );
                  }}
                  onSummaryUpdate={(id, summary) => {
                    setVoiceNotes((prev) =>
                      prev.map((n) => (n.id === id ? { ...n, summary } : n))
                    );
                  }}
                />
              ))}
            </div>
          )}

          {voiceNotes.length === 0 && state === 'idle' && !recordedBlob && (
            <p className="text-sm text-muted-foreground">
              {t('title')} - {t('record')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteNoteId} onOpenChange={() => setDeleteNoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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

// ============================================================================
// VOICE NOTE ITEM COMPONENT
// ============================================================================

interface ParsedSummary {
  keyPoints: string[];
  mistakes: string[];
  lessons: string[];
  actions: string[];
  rawSummary: string;
}

interface VoiceNoteItemProps<T extends BaseVoiceNote> {
  voiceNote: T;
  config: VoiceNotesConfig;
  onDelete: () => void;
  onTranscriptionUpdate: (id: string, transcription: string) => void;
  onSummaryUpdate: (id: string, summary: string) => void;
}

function VoiceNoteItem<T extends BaseVoiceNote>({
  voiceNote,
  config,
  onDelete,
  onTranscriptionUpdate,
  onSummaryUpdate,
}: VoiceNoteItemProps<T>) {
  const t = useTranslations('voiceNotes');
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

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

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Handle transcription request
  const handleTranscribe = async () => {
    setIsTranscribing(true);
    try {
      const response = await fetch(config.transcribeEndpoint(voiceNote.id), {
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
      toast({
        title: t('error.title'),
        description: err instanceof Error ? err.message : t('error.transcriptionFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  // Handle summary generation
  const handleGenerateSummary = async () => {
    if (!voiceNote.transcription) {
      toast({
        title: t('error.title'),
        description: t('summary.needsTranscription'),
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingSummary(true);
    try {
      const response = await fetch(config.summaryEndpoint(voiceNote.id), {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Summary generation failed');
      }

      onSummaryUpdate(voiceNote.id, data.summary);
      setShowSummary(true);

      toast({
        title: t('summary.generated'),
        variant: 'default',
      });
    } catch (err) {
      toast({
        title: t('error.title'),
        description: err instanceof Error ? err.message : t('error.summaryFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Handle save edited transcription
  const handleSaveTranscription = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(config.transcribeEndpoint(voiceNote.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcription: editedTranscription }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Save failed');
      }

      onTranscriptionUpdate(voiceNote.id, editedTranscription);
      setIsEditing(false);

      toast({
        title: t('transcription.saved'),
        variant: 'default',
      });
    } catch (err) {
      toast({
        title: t('error.title'),
        description: err instanceof Error ? err.message : t('error.saveFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const progress = voiceNote.duration > 0 ? (currentTime / voiceNote.duration) * 100 : 0;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Audio Player */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={togglePlay}
          aria-label={isPlaying ? t('pause') : t('play')}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        <div className="flex-1 space-y-1">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatDuration(currentTime)}</span>
            <span>{formatDuration(voiceNote.duration)}</span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onDelete}
          aria-label={t('delete')}
        >
          <Trash2 className="h-4 w-4" />
        </Button>

        <audio ref={audioRef} src={audioUrl} preload="metadata" />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {/* Transcription button */}
        {!voiceNote.transcription ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleTranscribe}
            disabled={isTranscribing}
            className="gap-2"
          >
            {isTranscribing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            {isTranscribing ? t('transcription.processing') : t('transcription.button')}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTranscription(!showTranscription)}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            {t('transcription.show')}
            {showTranscription ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        )}

        {/* Summary button */}
        {voiceNote.transcription && (
          <>
            {!voiceNote.summary ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateSummary}
                disabled={isGeneratingSummary}
                className="gap-2"
              >
                {isGeneratingSummary ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isGeneratingSummary ? t('summary.generating') : t('summary.button')}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSummary(!showSummary)}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {t('summary.show')}
                {showSummary ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </>
        )}
      </div>

      {/* Transcription display */}
      {showTranscription && voiceNote.transcription && (
        <div className="rounded-md bg-muted/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t('transcription.title')}</span>
            <div className="flex gap-1">
              {isEditing ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      setEditedTranscription(voiceNote.transcription || '');
                    }}
                    disabled={isSaving}
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSaveTranscription}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      t('save')
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setIsEditing(true)}
                    aria-label={t('edit')}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleTranscribe}
                    disabled={isTranscribing}
                    aria-label={t('transcription.regenerate')}
                  >
                    {isTranscribing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
          {isEditing ? (
            <textarea
              value={editedTranscription}
              onChange={(e) => setEditedTranscription(e.target.value)}
              className="w-full min-h-[100px] p-2 text-sm bg-background border rounded-md resize-y"
            />
          ) : (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {voiceNote.transcription}
            </p>
          )}
        </div>
      )}

      {/* Summary display */}
      {showSummary && parsedSummary && (
        <div className="rounded-md bg-gradient-to-br from-violet-500/5 to-purple-500/5 border border-violet-500/20 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              {t('summary.title')}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleGenerateSummary}
              disabled={isGeneratingSummary}
              aria-label={t('summary.regenerate')}
            >
              {isGeneratingSummary ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>

          {/* Key Points */}
          {parsedSummary.keyPoints.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                {t('summary.keyPoints')}
              </h4>
              <ul className="space-y-1">
                {parsedSummary.keyPoints.map((point, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Mistakes */}
          {parsedSummary.mistakes.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                {t('summary.mistakes')}
              </h4>
              <ul className="space-y-1">
                {parsedSummary.mistakes.map((mistake, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-red-500">•</span>
                    <span>{mistake}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Lessons */}
          {parsedSummary.lessons.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-blue-500" />
                {t('summary.lessons')}
              </h4>
              <ul className="space-y-1">
                {parsedSummary.lessons.map((lesson, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-blue-500">•</span>
                    <span>{lesson}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          {parsedSummary.actions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                {t('summary.actions')}
              </h4>
              <ul className="space-y-1">
                {parsedSummary.actions.map((action, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-green-500">•</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Date info */}
      <div className="text-xs text-muted-foreground">
        {new Date(voiceNote.createdAt).toLocaleString()}
      </div>
    </div>
  );
}

