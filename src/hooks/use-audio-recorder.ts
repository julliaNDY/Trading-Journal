'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

export interface AudioRecorderError {
  type: 'permission_denied' | 'not_supported' | 'recording_error' | 'mime_type_error' | 'unknown';
  message: string;
}

export interface UseAudioRecorderReturn {
  // State
  state: RecordingState;
  isRecording: boolean;
  isPaused: boolean;
  duration: number; // in seconds
  audioBlob: Blob | null;
  audioUrl: string | null;
  error: AudioRecorderError | null;
  isSupported: boolean;
  mimeType: string | null; // Expose the detected MIME type
  
  // Actions
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  resetRecording: () => void;
}

// Check if MediaRecorder is supported
function isMediaRecorderSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(navigator.mediaDevices?.getUserMedia) && typeof window.MediaRecorder !== 'undefined';
}

/**
 * Get the best supported MIME type for audio recording.
 * Prioritizes formats with best browser compatibility:
 * - Chrome/Edge/Firefox: audio/webm (opus codec preferred)
 * - Safari: audio/mp4 (the only format Safari supports for MediaRecorder)
 * 
 * @returns The supported MIME type or null if none are supported
 */
function getSupportedMimeType(): string | null {
  if (typeof window === 'undefined') return null;
  if (typeof MediaRecorder === 'undefined') return null;
  
  // Order matters: prefer webm/opus for quality, but Safari needs mp4
  const mimeTypes = [
    // WebM with Opus - best quality, supported by Chrome, Firefox, Edge
    'audio/webm;codecs=opus',
    'audio/webm',
    // MP4 - Safari's only supported format for MediaRecorder
    'audio/mp4',
    'audio/mp4;codecs=mp4a.40.2', // AAC
    // OGG - fallback for Firefox
    'audio/ogg;codecs=opus',
    'audio/ogg',
    // WAV - last resort, large files but widely supported
    'audio/wav',
    'audio/wave',
  ];
  
  for (const type of mimeTypes) {
    try {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log(`[AudioRecorder] Selected MIME type: ${type}`);
        return type;
      }
    } catch {
      // Some browsers throw on isTypeSupported for certain types
      continue;
    }
  }
  
  // Last resort: try without specifying MIME type
  // MediaRecorder will use the browser's default
  console.warn('[AudioRecorder] No explicit MIME type supported, will use browser default');
  return null;
}

/**
 * Get the file extension for a MIME type
 */
export function getExtensionForMimeType(mimeType: string | null): string {
  if (!mimeType) return 'webm';
  
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav') || mimeType.includes('wave')) return 'wav';
  
  return 'webm'; // default
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<AudioRecorderError | null>(null);
  const [detectedMimeType, setDetectedMimeType] = useState<string | null>(null);
  // Initialize as false to match SSR, then update on client mount
  const [isSupported, setIsSupported] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  const mimeTypeRef = useRef<string | null>(null);
  
  // Check support only on client side to prevent hydration mismatch
  useEffect(() => {
    setIsSupported(isMediaRecorderSupported());
  }, []);
  
  // Cleanup function
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    mediaRecorderRef.current = null;
  }, [audioUrl]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);
  
  // Start timer for duration tracking
  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    startTimeRef.current = Date.now() - (pausedDurationRef.current * 1000);
    
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setDuration(elapsed);
      
      // Auto-stop at 10 minutes (600 seconds) to prevent huge files
      if (elapsed >= 600) {
        stopRecording();
      }
    }, 100);
  }, []);
  
  // Stop timer
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  
  // Request microphone permission and start recording
  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError({
        type: 'not_supported',
        message: 'Audio recording is not supported in this browser',
      });
      return;
    }
    
    setError(null);
    chunksRef.current = [];
    
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      streamRef.current = stream;
      
      // Detect the best supported MIME type
      const mimeType = getSupportedMimeType();
      mimeTypeRef.current = mimeType;
      setDetectedMimeType(mimeType);
      
      console.log(`[AudioRecorder] Initializing with MIME type: ${mimeType || 'browser default'}`);
      
      // Create MediaRecorder - with or without explicit MIME type
      let mediaRecorder: MediaRecorder;
      try {
        if (mimeType) {
          mediaRecorder = new MediaRecorder(stream, { mimeType });
        } else {
          // Let the browser choose the default format
          mediaRecorder = new MediaRecorder(stream);
        }
      } catch (mimeError) {
        console.warn(`[AudioRecorder] Failed with MIME type ${mimeType}, trying without:`, mimeError);
        // If the specified MIME type fails, try without it
        try {
          mediaRecorder = new MediaRecorder(stream);
          mimeTypeRef.current = mediaRecorder.mimeType || null;
          setDetectedMimeType(mediaRecorder.mimeType || null);
          console.log(`[AudioRecorder] Fallback to browser default: ${mediaRecorder.mimeType}`);
        } catch (fallbackError) {
          // MediaRecorder completely failed
          console.error('[AudioRecorder] MediaRecorder creation failed:', fallbackError);
          setError({
            type: 'mime_type_error',
            message: 'Your browser does not support any audio recording format',
          });
          stream.getTracks().forEach(track => track.stop());
          return;
        }
      }
      
      mediaRecorderRef.current = mediaRecorder;
      
      // Get the actual MIME type being used
      const actualMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
      console.log(`[AudioRecorder] Actual MIME type in use: ${actualMimeType}`);
      
      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      // Handle recording stop
      mediaRecorder.onstop = () => {
        // Validate we have recorded data
        if (chunksRef.current.length === 0) {
          console.warn('[AudioRecorder] No data chunks recorded');
          setError({
            type: 'recording_error',
            message: 'No audio data was recorded',
          });
          setState('idle');
          stopTimer();
          return;
        }
        
        // Use the actual MIME type that was used for recording
        const blobMimeType = actualMimeType;
        const blob = new Blob(chunksRef.current, { type: blobMimeType });
        
        // Validate blob has content
        if (blob.size === 0) {
          console.warn('[AudioRecorder] Recorded blob is empty');
          setError({
            type: 'recording_error',
            message: 'No audio data was recorded',
          });
          setState('idle');
          stopTimer();
          return;
        }
        
        console.log(`[AudioRecorder] Recording complete: ${blob.size} bytes, type: ${blob.type}`);
        
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setState('stopped');
        stopTimer();
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };
      
      // Handle errors
      mediaRecorder.onerror = (event) => {
        console.error('[AudioRecorder] Recording error:', event);
        setError({
          type: 'recording_error',
          message: 'An error occurred during recording',
        });
        setState('idle');
        stopTimer();
      };
      
      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      setState('recording');
      pausedDurationRef.current = 0;
      startTimer();
      
    } catch (err) {
      console.error('[AudioRecorder] Start recording error:', err);
      
      // Handle permission denied
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError({
            type: 'permission_denied',
            message: 'Microphone permission was denied',
          });
        } else if (err.name === 'NotFoundError') {
          setError({
            type: 'not_supported',
            message: 'No microphone found',
          });
        } else if (err.name === 'NotSupportedError') {
          setError({
            type: 'mime_type_error',
            message: 'Audio format not supported in this browser',
          });
        } else {
          setError({
            type: 'unknown',
            message: err.message,
          });
        }
      } else {
        setError({
          type: 'unknown',
          message: 'Failed to start recording',
        });
      }
    }
  }, [isSupported, startTimer, stopTimer]);
  
  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      // Note: Some browsers (Firefox) don't support pause/resume
      // In that case, we just stop the timer and mark as paused
      if (mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.pause();
        } catch {
          // Firefox doesn't support pause, we'll handle this gracefully
        }
      }
      pausedDurationRef.current = duration;
      stopTimer();
      setState('paused');
    }
  }, [state, duration, stopTimer]);
  
  // Resume recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === 'paused') {
      try {
        if (mediaRecorderRef.current.state === 'paused') {
          mediaRecorderRef.current.resume();
        }
      } catch {
        // Firefox fallback - restart recording
      }
      startTimer();
      setState('recording');
    }
  }, [state, startTimer]);
  
  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && (state === 'recording' || state === 'paused')) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    }
  }, [state]);
  
  // Reset recording state
  const resetRecording = useCallback(() => {
    cleanup();
    setState('idle');
    setDuration(0);
    setAudioBlob(null);
    setAudioUrl(null);
    setError(null);
    setDetectedMimeType(null);
    chunksRef.current = [];
    pausedDurationRef.current = 0;
    mimeTypeRef.current = null;
  }, [cleanup]);
  
  return {
    state,
    isRecording: state === 'recording',
    isPaused: state === 'paused',
    duration,
    audioBlob,
    audioUrl,
    error,
    isSupported,
    mimeType: detectedMimeType,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
  };
}

// Utility function to format duration as MM:SS
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

