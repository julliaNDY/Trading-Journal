'use client';

import { useRef, useState, useEffect } from 'react';
import { Play, Pause, Trash2, Check, Loader2 } from 'lucide-react';
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
  
  // Create audio URL from blob
  useEffect(() => {
    const url = URL.createObjectURL(audioBlob);
    setAudioUrl(url);
    
    // Generate waveform data
    generateWaveform(audioBlob);
    
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [audioBlob]);
  
  // Generate waveform visualization data
  async function generateWaveform(blob: Blob) {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const rawData = audioBuffer.getChannelData(0);
      const samples = 50; // Number of bars in the waveform
      const blockSize = Math.floor(rawData.length / samples);
      const filteredData: number[] = [];
      
      for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[i * blockSize + j]);
        }
        filteredData.push(sum / blockSize);
      }
      
      // Normalize the data
      const maxVal = Math.max(...filteredData);
      const normalizedData = filteredData.map(val => val / maxVal);
      
      setWaveformData(normalizedData);
      audioContext.close();
    } catch {
      // If waveform generation fails, show a simple bar
      setWaveformData(Array(50).fill(0.5));
    }
  }
  
  // Handle play/pause
  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
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
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
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
      {/* Hidden audio element */}
      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} preload="metadata" />
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
          disabled={isUploading}
          className="h-10 w-10"
          aria-label={isPlaying ? t('pause') : t('play')}
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

