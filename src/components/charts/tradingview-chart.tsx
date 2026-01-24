'use client';

import { useEffect, useRef } from 'react';
import { useTradingViewExecutions } from './hooks/useTradingViewExecutions';

interface TradingViewChartProps {
  symbol: string;
  timeframe: string;
  tradeIds?: string[];
  showExecutions?: boolean;
}

export function TradingViewChart({
  symbol,
  timeframe,
  tradeIds,
  showExecutions = true,
}: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);

  const { loading: execLoading, error: execError, fetchExecutions } =
    useTradingViewExecutions(widgetRef.current, symbol, timeframe, tradeIds);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const script = document.createElement('script');
    script.src = '/charting_library/charting_library.js';
    script.async = true;
    script.onload = () => {
      if (!chartContainerRef.current) return;

      const widget = new (window as any).TradingView.widget({
        container: chartContainerRef.current,
        library_path: '/charting_library/',
        symbol,
        interval: timeframe,
        timezone: 'Etc/UTC',
        theme: 'dark',
        autosize: true,
        
        enabled_features: [
          'left_toolbar',
          'drawing_templates',
          'header_widget',
          'header_indicators',
          'header_symbol_search',
          'header_resolutions',
          'header_chart_type',
          'header_settings',
          'header_screenshot',
          'header_fullscreen_button',
          'header_compare',
          'study_templates',
          'show_interval_dialog_on_key_press',
          'use_localstorage_for_settings',
          'save_chart_properties_to_local_storage',
        ],
        
        disabled_features: [
          'header_undo_redo',
        ],
        
        drawings_access: {
          type: 'black',
          tools: [],
        },
        
        studies_overrides: {
          'volume.volume.color.0': '#F23645',
          'volume.volume.color.1': '#26A69A',
        },
        
        overrides: {
          'mainSeriesProperties.candleStyle.upColor': '#26A69A',
          'mainSeriesProperties.candleStyle.downColor': '#F23645',
          'mainSeriesProperties.candleStyle.borderUpColor': '#26A69A',
          'mainSeriesProperties.candleStyle.borderDownColor': '#F23645',
          'mainSeriesProperties.candleStyle.wickUpColor': '#26A69A',
          'mainSeriesProperties.candleStyle.wickDownColor': '#F23645',
        },
      });

      widgetRef.current = widget;

      widget.onChartReady(() => {
        if (showExecutions) {
          fetchExecutions();
        }
      });
    };

    document.head.appendChild(script);

    return () => {
      if (widgetRef.current) {
        widgetRef.current.remove();
        widgetRef.current = null;
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [symbol, timeframe, showExecutions, fetchExecutions]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={chartContainerRef}
        id="tradingview-chart"
        className="w-full h-full"
      />
      {execLoading && (
        <div className="absolute top-2 right-2 text-sm text-muted-foreground">
          Loading executions...
        </div>
      )}
      {execError && (
        <div className="absolute top-2 right-2 text-red-500 text-sm">
          Error: {execError.message}
        </div>
      )}
    </div>
  );
}
