import { useState, useCallback, useEffect, useRef } from 'react';
import { ExecutionMarker } from '@/lib/types/execution';
import { buildExecutionLabel, buildExecutionTooltip, EXECUTION_STYLES } from '../utils/execution-markers';

export function useTradingViewExecutions(
  widget: any | null,
  symbol: string,
  timeframe: string,
  tradeIds?: string[]
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const executionsById = useRef(new Map());

  const clearExecutions = useCallback(() => {
    for (const exec of executionsById.current.values()) {
      exec.remove();
    }
    executionsById.current.clear();
  }, []);

  const updateExecutions = useCallback(async (markers: ExecutionMarker[]) => {
    if (!widget) return;

    const chart = widget.activeChart();
    if (!chart) return;

    clearExecutions();

    for (const m of markers) {
      try {
        const exec = await chart.createExecutionShape();
        if (!exec) continue;

        exec
          .setTime(m.time)
          .setPrice(m.price)
          .setDirection(m.side)
          .setText(buildExecutionLabel(m))
          .setTooltip(m.tooltip ?? buildExecutionTooltip(m));

        if (m.arrowColor) {
          exec.setArrowColor(m.arrowColor);
        } else {
          exec.setArrowColor(EXECUTION_STYLES[m.side].arrowColor);
        }

        if (m.textColor) {
          exec.setTextColor(m.textColor);
        } else {
          exec.setTextColor(EXECUTION_STYLES[m.side].textColor);
        }

        executionsById.current.set(m.id, exec);
      } catch (e) {
        console.warn(`Failed to create execution marker ${m.id}:`, e);
      }
    }
  }, [widget, clearExecutions]);

  const fetchExecutions = useCallback(async () => {
    if (!widget) return;

    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('symbol', symbol);
      params.append('from', Math.floor(Date.now() / 1000 - 86400 * 30).toString());
      params.append('to', Math.floor(Date.now() / 1000).toString());
      if (tradeIds?.length) params.append('tradeIds', tradeIds.join(','));

      const res = await fetch(`/api/trades/executions?${params}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const { data } = await res.json();
      await updateExecutions(data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [widget, symbol, tradeIds, updateExecutions]);

  useEffect(() => {
    fetchExecutions();
  }, [symbol, timeframe, fetchExecutions]);

  useEffect(() => {
    return () => clearExecutions();
  }, [clearExecutions]);

  return { loading, error, clearExecutions, updateExecutions, fetchExecutions };
}
