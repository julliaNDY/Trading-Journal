'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Trash2, Check, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatDuration } from '@/hooks/use-audio-recorder';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface AudioPreviewProps {
  audioBlob: Blob;
  duration: number;
  onSave: (blob: Blob) => Promise<void>;
  onDiscard: () => void;
  isUploading?: boolean;
  uploadProgress?: number;
  className?: string;
}

export function AudioPreview({
  audioBlob,
  duration,
  onSave,
  onDiscard,
  isUploading = false,
  uploadProgress = 0,
  className,
}: AudioPreviewProps) {
  const t = useTranslations('voiceNotes');
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isAudioReady, setIsAudioReady] = useState(false);
  
  // Generate waveform visualization data
  const generateWaveform = useCallback(async (blob: Blob) => {
    // Validate blob before processing
    if (!blob || blob.size === 0) {
      console.warn('[AudioPreview] Empty blob, skipping waveform generation');
      setWaveformData(Array(50).fill(0.5));
      return;
    }
    
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('[AudioPreview] AudioContext not available');
        setWaveformData(Array(50).fill(0.5));
        return;
      }
      
      const audioContext = new AudioContextClass();
      const arrayBuffer = await blob.arrayBuffer();
      
      try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const rawData = audioBuffer.getChannelData(0);
        const samples = 50; // Number of bars in the waveform
        const blockSize = Math.floor(rawData.length / samples);
        
        if (blockSize === 0) {
          setWaveformData(Array(50).fill(0.5));
          audioContext.close();
          return;
        }
        
        const filteredData: number[] = [];
        
        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            const index = i * blockSize + j;
            if (index < rawData.length) {
              sum += Math.abs(rawData[index]);
            }
          }
          filteredData.push(sum / blockSize);
        }
        
        // Normalize the data
        const maxVal = Math.max(...filteredData);
        const normalizedData = maxVal > 0 
          ? filteredData.map(val => val / maxVal)
          : Array(50).fill(0.5);
        
        setWaveformData(normalizedData);
        audioContext.close();
      } catch (decodeError) {
        console.warn('[AudioPreview] Failed to decode audio data:', decodeError);
        setWaveformData(Array(50).fill(0.5));
        audioContext.close();
      }
    } catch (error) {
      console.warn('[AudioPreview] Waveform generation error:', error);
      // If waveform generation fails, show a simple bar
      setWaveformData(Array(50).fill(0.5));
    }
  }, []);
  
  // Create audio URL from blob
  useEffect(() => {
    // Validate blob
    if (!audioBlob || audioBlob.size === 0) {
      console.error('[AudioPreview] Invalid or empty audio blob');
      setAudioError('No audio data available');
      return;
    }
    
    console.log(`[AudioPreview] Creating URL for blob: ${audioBlob.size} bytes, type: ${audioBlob.type || 'unknown'}`);
    
    // Reset state
    setAudioError(null);
    setIsAudioReady(false);
    setIsPlaying(false);
    setCurrentTime(0);
    
    const url = URL.createObjectURL(audioBlob);
    setAudioUrl(url);
    
    // Generate waveform data
    generateWaveform(audioBlob);
    
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [audioBlob, generateWaveform]);
  
  // Handle play/pause
  const togglePlayPause = async () => {
    if (!audioRef.current || audioError) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('[AudioPreview] Playback error:', error);
        setAudioError('Unable to play audio in this browser');
      }
    }
  };
  
  // Update current time during playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    
    const handleCanPlay = () => {
      console.log('[AudioPreview] Audio is ready to play');
      setIsAudioReady(true);
      setAudioError(null);
    };
    
    const handleError = (e: Event) => {
      const audioEl = e.target as HTMLAudioElement;
      const error = audioEl.error;
      
      console.error('[AudioPreview] Audio element error:', {
        code: error?.code,
        message: error?.message,
        src: audioEl.src?.substring(0, 50),
      });
      
      let errorMessage = 'Audio format not supported';
      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Audio playback was aborted';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error while loading audio';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Audio format not supported by this browser';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Audio source not supported by this browser';
            break;
        }
      }
      
      setAudioError(errorMessage);
      setIsAudioReady(false);
    };
    
    const handleLoadStart = () => {
      console.log('[AudioPreview] Audio loading started');
    };
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);
    audio.addEventListener('loadstart', handleLoadStart);
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadstart', handleLoadStart);
    };
  }, [audioUrl]);
  
  // Handle click on waveform to seek
  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };
  
  // Handle save
  const handleSave = async () => {
    await onSave(audioBlob);
  };
  
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  
  return (
    <div className={cn('space-y-3 p-4 bg-muted/50 rounded-lg border', className)}>
      {/* Hidden audio element - only render if URL is valid */}
      {audioUrl && (
        <audio 
          ref={audioRef} 
          src={audioUrl} 
          preload="metadata"
          // Provide alternative sources for better browser compatibility
        />
      )}
      
      {/* Error display */}
      {audioError && (
        <div className="flex items-center gap-2 p-2 bg-destructive/10 text-destructive rounded-md text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{audioError}</span>
        </div>
      )}
      
      {/* Waveform visualization */}
      <div
        className="relative h-12 cursor-pointer flex items-center gap-[2px]"
        onClick={handleWaveformClick}
        role="slider"
        aria-label="Audio timeline"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={Math.floor(currentTime)}
        tabIndex={0}
      >
        {waveformData.map((value, index) => {
          const barPercentage = (index / waveformData.length) * 100;
          const isPlayed = barPercentage <= progressPercentage;
          
          return (
            <div
              key={index}
              className={cn(
                'flex-1 rounded-full min-w-[2px] transition-colors',
                isPlayed ? 'bg-primary' : 'bg-muted-foreground/30'
              )}
              style={{
                height: `${Math.max(value * 100, 10)}%`,
              }}
            />
          );
        })}
        
        {/* Playhead indicator */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-primary"
          style={{ left: `${progressPercentage}%` }}
        />
      </div>
      
      {/* Time display */}
      <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
        <span>{formatDuration(Math.floor(currentTime))}</span>
        <span>{formatDuration(duration)}</span>
      </div>
      
      {/* Upload progress */}
      {isUploading && (
        <div className="space-y-1">
          <Progress value={uploadProgress} className="h-1" />
          <p className="text-xs text-muted-foreground text-center">
            {t('uploading')} {uploadProgress}%
          </p>
        </div>
      )}
      
      {/* Controls */}
      <div className="flex items-center justify-between">
        {/* Play/Pause */}
        <Button
          variant="outline"
          size="icon"
          onClick={togglePlayPause}
          disabled={isUploading || !!audioError || !isAudioReady}
          className="h-10 w-10"
          aria-label={isPlaying ? t('pause') : t('play')}
          title={audioError || undefined}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </Button>
        
        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Discard */}
          <Button
            variant="outline"
            size="sm"
            onClick={onDiscard}
            disabled={isUploading}
            className="gap-2 text-destructive hover:text-destructive"
            aria-label={t('discard')}
          >
            <Trash2 className="h-4 w-4" />
            <span>{t('discard')}</span>
          </Button>
          
          {/* Save */}
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={isUploading}
            className="gap-2"
            aria-label={t('save')}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            <span>{t('save')}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

