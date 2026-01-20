/**
 * useDailyBiasRealtime Hook
 * 
 * React hook for real-time Daily Bias analysis updates
 * Uses Server-Sent Events (SSE) with polling fallback
 * 
 * @module hooks/use-daily-bias-realtime
 * @created 2026-01-18
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '@/lib/logger';
import type { DailyBiasAnalysisResult } from '@/services/ai/daily-bias-service';

// ============================================================================
// Types
// ============================================================================

export interface RealtimeUpdate {
  type: 'connected' | 'analysis-updated' | 'heartbeat' | 'error';
  data: any;
  timestamp: string;
}

export interface UseDailyBiasRealtimeOptions {
  instrument: string | null;
  date?: string;
  enabled?: boolean;
  onUpdate?: (analysis: DailyBiasAnalysisResult) => void;
  onError?: (error: Error) => void;
  pollingInterval?: number; // Fallback polling interval (ms)
  usePolling?: boolean; // Force polling mode (disable SSE)
}

export interface UseDailyBiasRealtimeResult {
  isConnected: boolean;
  isPolling: boolean;
  lastUpdate: Date | null;
  error: Error | null;
  reconnect: () => void;
  disconnect: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for real-time Daily Bias analysis updates
 * 
 * Uses SSE (Server-Sent Events) with automatic fallback to polling if SSE fails
 */
export function useDailyBiasRealtime(
  options: UseDailyBiasRealtimeOptions
): UseDailyBiasRealtimeResult {
  const {
    instrument,
    date = new Date().toISOString().split('T')[0],
    enabled = true,
    onUpdate,
    onError,
    pollingInterval = 5000,
    usePolling = false
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(true);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnalysisTimestampRef = useRef<string | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
    setIsPolling(false);
  }, []);

  // Polling fallback function
  const startPolling = useCallback(async () => {
    if (!instrument || !enabled) return;

    setIsPolling(true);
    setIsConnected(false);

    const poll = async () => {
      try {
        // Use GET endpoint to check for updates (lightweight)
        const response = await fetch(`/api/daily-bias/analyze?instrument=${instrument}&date=${date}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            // Check if analysis is new (compare timestamps)
            const currentTimestamp = result.data.createdAt || result.data.id;
            
            // CRITICAL FIX: Only trigger onUpdate if timestamp actually changed
            if (currentTimestamp && currentTimestamp !== lastAnalysisTimestampRef.current) {
              lastAnalysisTimestampRef.current = currentTimestamp;
              setLastUpdate(new Date());
              
              if (onUpdate) {
                onUpdate(result.data);
              }
            }
          }
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Polling error');
        setError(error);
        if (onError) {
          onError(error);
        }
      }
    };

    // DON'T poll immediately - analysis already loaded
    // Only start interval polling for future updates
    pollingIntervalRef.current = setInterval(poll, pollingInterval);
    
    logger.debug('Polling fallback started', {
      instrument,
      date,
      interval: pollingInterval
    });
  }, [instrument, date, enabled, onUpdate, onError, pollingInterval]);

  // SSE connection function
  const connectSSE = useCallback(() => {
    if (!instrument || !enabled || usePolling) {
      startPolling();
      return;
    }

    try {
      // Build SSE URL
      const url = `/api/daily-bias/stream?instrument=${instrument}&date=${date}`;
      
      // Create EventSource
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      // Handle connection open
      eventSource.onopen = () => {
        setIsConnected(true);
        setIsPolling(false);
        setError(null);
        logger.debug('SSE connection opened', { instrument, date });
      };

      // Handle messages
      eventSource.onmessage = (event) => {
        try {
          const update: RealtimeUpdate = JSON.parse(event.data);
          setLastUpdate(new Date());

          if (update.type === 'analysis-updated' && update.data?.analysis) {
            if (onUpdate) {
              onUpdate(update.data.analysis);
            }
          }
        } catch (err) {
          logger.warn('Failed to parse SSE message', {
            instrument,
            error: err instanceof Error ? err.message : 'Unknown error'
          });
        }
      };

      // Handle custom events
      eventSource.addEventListener('connected', (event: any) => {
        setIsConnected(true);
        setIsPolling(false);
        setError(null);
      });

      eventSource.addEventListener('analysis-updated', (event: any) => {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          setLastUpdate(new Date());

          if (data.analysis && onUpdate) {
            onUpdate(data.analysis);
          }
        } catch (err) {
          logger.warn('Failed to parse analysis-updated event', {
            instrument,
            error: err instanceof Error ? err.message : 'Unknown error'
          });
        }
      });

      eventSource.addEventListener('heartbeat', () => {
        // Just update timestamp, no data
        setLastUpdate(new Date());
      });

      // Handle errors
      eventSource.onerror = (err) => {
        logger.warn('SSE connection error, falling back to polling', {
          instrument,
          date
        });

        // Close SSE
        eventSource.close();
        eventSourceRef.current = null;
        setIsConnected(false);

        // Fallback to polling
        if (shouldReconnectRef.current && enabled) {
          startPolling();
        }

        const error = new Error('SSE connection failed, using polling fallback');
        setError(error);
        if (onError) {
          onError(error);
        }
      };

    } catch (err) {
      logger.error('Failed to create SSE connection', {
        instrument,
        error: err instanceof Error ? err.message : 'Unknown error'
      });

      // Fallback to polling
      startPolling();

      const error = err instanceof Error ? err : new Error('Failed to create SSE connection');
      setError(error);
      if (onError) {
        onError(error);
      }
    }
  }, [instrument, date, enabled, usePolling, onUpdate, onError, startPolling]);

  // Reconnect function
  const reconnect = useCallback(() => {
    cleanup();
    shouldReconnectRef.current = true;
    
    // Small delay before reconnecting
    reconnectTimeoutRef.current = setTimeout(() => {
      connectSSE();
    }, 1000);
  }, [cleanup, connectSSE]);

  // Disconnect function
  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    cleanup();
  }, [cleanup]);

  // Main effect: Connect when instrument changes
  useEffect(() => {
    if (!instrument || !enabled) {
      cleanup();
      return;
    }

    connectSSE();

    // Cleanup on unmount or when dependencies change
    return () => {
      cleanup();
    };
  }, [instrument, date, enabled, connectSSE, cleanup]);

  // Auto-reconnect on error (with exponential backoff)
  useEffect(() => {
    if (error && shouldReconnectRef.current && enabled && !isPolling) {
      const backoffDelay = Math.min(5000 * Math.pow(2, 0), 30000); // Max 30s
      
      reconnectTimeoutRef.current = setTimeout(() => {
        if (shouldReconnectRef.current) {
          reconnect();
        }
      }, backoffDelay);
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [error, enabled, isPolling, reconnect]);

  return {
    isConnected,
    isPolling,
    lastUpdate,
    error,
    reconnect,
    disconnect
  };
}
