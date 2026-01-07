'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

export interface AudioRecorderError {
  type: 'permission_denied' | 'not_supported' | 'recording_error' | 'unknown';
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

// Get the best supported mime type
function getSupportedMimeType(): string {
  if (typeof window === 'undefined') return 'audio/webm';
  
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  
  return 'audio/webm'; // fallback
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<AudioRecorderError | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  
  const isSupported = isMediaRecorderSupported();
  
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
      
      // Create MediaRecorder with best supported format
      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      
      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      // Handle recording stop
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
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
      mediaRecorder.onerror = () => {
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
    chunksRef.current = [];
    pausedDurationRef.current = 0;
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

