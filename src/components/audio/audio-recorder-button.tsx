'use client';

import { Mic, MicOff, Pause, Square, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAudioRecorder, formatDuration, type AudioRecorderError } from '@/hooks/use-audio-recorder';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface AudioRecorderButtonProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  onError?: (error: AudioRecorderError) => void;
  disabled?: boolean;
  className?: string;
}

export function AudioRecorderButton({
  onRecordingComplete,
  onError,
  disabled = false,
  className,
}: AudioRecorderButtonProps) {
  const t = useTranslations('voiceNotes');
  
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
  
  // Handle recording complete
  const handleStop = () => {
    stopRecording();
  };
  
  // When audioBlob is available after stopping, notify parent
  if (audioBlob && state === 'stopped') {
    onRecordingComplete(audioBlob, duration);
    resetRecording();
  }
  
  // Handle errors
  if (error && onError) {
    onError(error);
  }
  
  // Not supported state
  if (!isSupported) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className={cn('gap-2', className)}
        aria-label={t('error.notSupported')}
      >
        <MicOff className="h-4 w-4" />
        <span className="text-xs text-muted-foreground">{t('error.notSupported')}</span>
      </Button>
    );
  }
  
  // Idle state - show record button
  if (state === 'idle') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={startRecording}
        disabled={disabled}
        className={cn('gap-2', className)}
        aria-label={t('record')}
      >
        <Mic className="h-4 w-4" />
        <span>{t('record')}</span>
      </Button>
    );
  }
  
  // Recording or paused state - show controls
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Recording indicator with pulse animation */}
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
          aria-hidden="true"
        />
        <span
          className={cn(
            'font-mono text-sm tabular-nums',
            isRecording && 'text-red-500',
            isPaused && 'text-yellow-500'
          )}
          aria-live="polite"
          aria-label={`Duration: ${formatDuration(duration)}`}
        >
          {formatDuration(duration)}
        </span>
      </div>
      
      {/* Pause/Resume button */}
      <Button
        variant="outline"
        size="icon"
        onClick={isPaused ? resumeRecording : pauseRecording}
        className="h-8 w-8"
        aria-label={isPaused ? t('resume') : t('pause')}
      >
        {isPaused ? (
          <Play className="h-4 w-4" />
        ) : (
          <Pause className="h-4 w-4" />
        )}
      </Button>
      
      {/* Stop button */}
      <Button
        variant="destructive"
        size="icon"
        onClick={handleStop}
        className="h-8 w-8"
        aria-label={t('stop')}
      >
        <Square className="h-4 w-4" />
      </Button>
    </div>
  );
}

