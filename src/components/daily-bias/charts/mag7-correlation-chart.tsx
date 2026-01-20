/**
 * Mag 7 Correlation Chart Component - TradingView Lightweight Charts
 * 
 * Displays correlation lines for Mag 7 leaders (AAPL, MSFT, GOOGL, etc.)
 * Used for Mag 7 Leaders Analysis (Step 4)
 * 
 * @module components/daily-bias/charts/mag7-correlation-chart
 * @created 2026-01-18
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  LineData,
  Time,
} from 'lightweight-charts';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { Mag7Analysis } from '@/types/daily-bias';

interface Mag7CorrelationChartProps {
  analysis: Mag7Analysis;
  correlationData?: Record<string, LineData<Time>[]>; // { AAPL: [...], MSFT: [...], ... }
  height?: number;
  className?: string;
}

// Mag 7 symbols and colors
const MAG7_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA'];
const MAG7_COLORS = [
  '#ef4444', // AAPL - Red
  '#3b82f6', // MSFT - Blue
  '#f59e0b', // GOOGL - Orange
  '#10b981', // AMZN - Green
  '#8b5cf6', // META - Purple
  '#06b6d4', // NVDA - Cyan
  '#ec4899', // TSLA - Pink
];

// ============================================================================
// COMPONENT
// ============================================================================

export function Mag7CorrelationChart({ 
  analysis, 
  correlationData = {},
  height = 300,
  className = '' 
}: Mag7CorrelationChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#1e1e1e' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#2a2a2a' },
        horzLines: { color: '#2a2a2a' },
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#485563',
      },
    });

    chartRef.current = chart;

    // Create line series for each Mag 7 stock
    MAG7_SYMBOLS.forEach((symbol, index) => {
      const data = correlationData[symbol];
      if (!data || data.length === 0) return;

      const series = chart.addLineSeries({
        color: MAG7_COLORS[index],
        lineWidth: 2,
        title: symbol,
      });

      // Normalize data to percentage change (if needed)
      // For now, use raw values
      series.setData(data);
      seriesRefs.current.set(symbol, series);
    });

    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRefs.current.clear();
    };
  }, [analysis, correlationData, height]);

  // Update data when correlationData changes
  useEffect(() => {
    if (!chartRef.current) return;

    // Update existing series
    MAG7_SYMBOLS.forEach((symbol) => {
      const series = seriesRefs.current.get(symbol);
      const data = correlationData[symbol];
      
      if (series && data && data.length > 0) {
        series.setData(data);
      }
    });

    chartRef.current.timeScale().fitContent();
  }, [correlationData]);

  // Export chart as PNG
  const handleExport = useCallback(async () => {
    if (!chartRef.current) return;

    try {
      const chart = chartRef.current;
      const canvas = await chart.takeScreenshot();
      
      canvas.toBlob((blob) => {
        if (!blob) return;
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `mag7-correlation-chart-${analysis.instrument}-${new Date().toISOString().split('T')[0]}.png`;
        link.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (error) {
      console.error('Failed to export chart:', error);
    }
  }, [analysis.instrument]);

  // Check if we have any data
  const hasData = Object.keys(correlationData).length > 0 && 
                  Object.values(correlationData).some(data => data.length > 0);

  return (
    <div className={`relative ${className}`}>
      {/* Chart container */}
      <div 
        ref={chartContainerRef}
        className="w-full rounded-lg overflow-hidden border border-border"
        style={{ height: `${height}px` }}
      />
      
      {/* Legend */}
      {hasData && (
        <div className="absolute top-2 left-2 flex flex-wrap gap-2 z-10 bg-background/80 backdrop-blur-sm p-2 rounded border border-border">
          {MAG7_SYMBOLS.map((symbol, index) => {
            const hasDataForSymbol = correlationData[symbol] && correlationData[symbol].length > 0;
            if (!hasDataForSymbol) return null;
            
            return (
              <div key={symbol} className="flex items-center gap-1.5">
                <div 
                  className="w-3 h-0.5"
                  style={{ backgroundColor: MAG7_COLORS[index] }}
                />
                <span className="text-xs font-mono">{symbol}</span>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Toolbar */}
      <div className="absolute top-2 right-2 flex gap-2 z-10">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          className="h-8 bg-background/80 backdrop-blur-sm"
        >
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
      </div>

      {/* Info overlay */}
      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded">
          <div className="text-center space-y-2">
            <p className="text-sm font-medium">No correlation data available</p>
            <p className="text-xs text-muted-foreground">
              Mag 7 price data required for correlation chart
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
