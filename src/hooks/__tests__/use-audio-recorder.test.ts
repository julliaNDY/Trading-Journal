/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAudioRecorder, formatDuration } from '../use-audio-recorder';

// Mock MediaRecorder
class MockMediaRecorder {
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  
  start() {
    this.state = 'recording';
  }
  
  pause() {
    this.state = 'paused';
  }
  
  resume() {
    this.state = 'recording';
  }
  
  stop() {
    // Simulate data available
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob(['test audio'], { type: 'audio/webm' }) });
    }
    this.state = 'inactive';
    if (this.onstop) {
      this.onstop();
    }
  }
  
  static isTypeSupported() {
    return true;
  }
}

// Mock MediaStream
class MockMediaStream {
  getTracks() {
    return [{ stop: vi.fn() }];
  }
}

describe('useAudioRecorder', () => {
  let originalMediaRecorder: typeof MediaRecorder | undefined;
  let originalGetUserMedia: typeof navigator.mediaDevices.getUserMedia | undefined;
  
  beforeEach(() => {
    // Store originals
    originalMediaRecorder = (window as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
    originalGetUserMedia = navigator.mediaDevices?.getUserMedia;
    
    // Setup mocks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).MediaRecorder = MockMediaRecorder;
    
    // Mock navigator.mediaDevices
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(new MockMediaStream()),
      },
      writable: true,
      configurable: true,
    });
  });
  
  afterEach(() => {
    // Restore originals
    if (originalMediaRecorder) {
      (window as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder = originalMediaRecorder;
    }
    if (originalGetUserMedia && navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = originalGetUserMedia;
    }
    vi.clearAllMocks();
  });
  
  describe('initial state', () => {
    it('should start with idle state', () => {
      const { result } = renderHook(() => useAudioRecorder());
      
      expect(result.current.state).toBe('idle');
      expect(result.current.isRecording).toBe(false);
      expect(result.current.isPaused).toBe(false);
      expect(result.current.duration).toBe(0);
      expect(result.current.audioBlob).toBeNull();
      expect(result.current.audioUrl).toBeNull();
      expect(result.current.error).toBeNull();
    });
    
    it('should report isSupported correctly when MediaRecorder exists', () => {
      const { result } = renderHook(() => useAudioRecorder());
      expect(result.current.isSupported).toBe(true);
    });
  });
  
  describe('startRecording', () => {
    it('should request microphone permission and start recording', async () => {
      const { result } = renderHook(() => useAudioRecorder());
      
      await act(async () => {
        await result.current.startRecording();
      });
      
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      
      expect(result.current.state).toBe('recording');
      expect(result.current.isRecording).toBe(true);
    });
    
    it('should set permission_denied error when getUserMedia fails', async () => {
      const mockError = new DOMException('Permission denied', 'NotAllowedError');
      (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(mockError);
      
      const { result } = renderHook(() => useAudioRecorder());
      
      await act(async () => {
        await result.current.startRecording();
      });
      
      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.type).toBe('permission_denied');
      expect(result.current.state).toBe('idle');
    });
  });
  
  describe('pauseRecording', () => {
    it('should pause recording when in recording state', async () => {
      const { result } = renderHook(() => useAudioRecorder());
      
      await act(async () => {
        await result.current.startRecording();
      });
      
      act(() => {
        result.current.pauseRecording();
      });
      
      expect(result.current.state).toBe('paused');
      expect(result.current.isPaused).toBe(true);
      expect(result.current.isRecording).toBe(false);
    });
  });
  
  describe('resumeRecording', () => {
    it('should resume recording when paused', async () => {
      const { result } = renderHook(() => useAudioRecorder());
      
      await act(async () => {
        await result.current.startRecording();
      });
      
      act(() => {
        result.current.pauseRecording();
      });
      
      act(() => {
        result.current.resumeRecording();
      });
      
      expect(result.current.state).toBe('recording');
      expect(result.current.isRecording).toBe(true);
      expect(result.current.isPaused).toBe(false);
    });
  });
  
  describe('stopRecording', () => {
    it('should stop recording and generate audio blob', async () => {
      const { result } = renderHook(() => useAudioRecorder());
      
      await act(async () => {
        await result.current.startRecording();
      });
      
      act(() => {
        result.current.stopRecording();
      });
      
      await waitFor(() => {
        expect(result.current.state).toBe('stopped');
      });
      
      expect(result.current.audioBlob).not.toBeNull();
      expect(result.current.audioUrl).not.toBeNull();
    });
  });
  
  describe('resetRecording', () => {
    it('should reset all state to initial values', async () => {
      const { result } = renderHook(() => useAudioRecorder());
      
      await act(async () => {
        await result.current.startRecording();
      });
      
      act(() => {
        result.current.stopRecording();
      });
      
      await waitFor(() => {
        expect(result.current.audioBlob).not.toBeNull();
      });
      
      act(() => {
        result.current.resetRecording();
      });
      
      expect(result.current.state).toBe('idle');
      expect(result.current.duration).toBe(0);
      expect(result.current.audioBlob).toBeNull();
      expect(result.current.audioUrl).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });
});

describe('formatDuration', () => {
  it('should format 0 seconds as 00:00', () => {
    expect(formatDuration(0)).toBe('00:00');
  });
  
  it('should format seconds only', () => {
    expect(formatDuration(45)).toBe('00:45');
  });
  
  it('should format minutes and seconds', () => {
    expect(formatDuration(125)).toBe('02:05');
  });
  
  it('should format 10+ minutes', () => {
    expect(formatDuration(600)).toBe('10:00');
  });
  
  it('should pad single digit seconds', () => {
    expect(formatDuration(61)).toBe('01:01');
  });
});

