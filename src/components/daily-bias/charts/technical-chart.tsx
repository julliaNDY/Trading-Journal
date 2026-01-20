/**
 * Technical Chart Component - TradingView Lightweight Charts
 * 
 * Displays OHLCV candlestick chart with support/resistance levels and trend lines
 * Used for Technical Structure Analysis (Step 5)
 * 
 * @module components/daily-bias/charts/technical-chart
 * @created 2026-01-18
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  LineData,
  createPriceLine,
  PriceLineOptions,
} from 'lightweight-charts';
import { Button } from '@/components/ui/button';
import { Download, Maximize2 } from 'lucide-react';
import type { TechnicalAnalysis } from '@/types/daily-bias';

interface TechnicalChartProps {
  analysis: TechnicalAnalysis;
  priceData?: CandlestickData<Time>[]; // Historical OHLCV data
  height?: number;
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TechnicalChart({ 
  analysis, 
  priceData = [],
  height = 400,
  className = '' 
}: TechnicalChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

    // Create candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    candlestickSeriesRef.current = candlestickSeries;

    // Set data if available
    if (priceData.length > 0) {
      candlestickSeries.setData(priceData);
      chart.timeScale().fitContent();
    }

    // Add support/resistance levels as price lines
    if (analysis.supportLevels && analysis.supportLevels.length > 0) {
      analysis.supportLevels.slice(0, 4).forEach((level) => {
        const color = level.strength > 0.7 ? '#22c55e' : 
                     level.strength > 0.4 ? '#84cc16' : '#a3e635';
        
        candlestickSeries.createPriceLine({
          price: level.price,
          color: color,
          lineWidth: level.strength > 0.7 ? 2 : 1,
          lineStyle: level.strength > 0.7 ? 0 : 1, // 0 = solid, 1 = dashed
          axisLabelVisible: true,
          title: `Support ${level.price.toFixed(2)} (${(level.strength * 100).toFixed(0)}%)`,
        } as PriceLineOptions);
      });
    }

    if (analysis.resistanceLevels && analysis.resistanceLevels.length > 0) {
      analysis.resistanceLevels.slice(0, 4).forEach((level) => {
        const color = level.strength > 0.7 ? '#ef4444' : 
                     level.strength > 0.4 ? '#f97316' : '#fb923c';
        
        candlestickSeries.createPriceLine({
          price: level.price,
          color: color,
          lineWidth: level.strength > 0.7 ? 2 : 1,
          lineStyle: level.strength > 0.7 ? 0 : 1,
          axisLabelVisible: true,
          title: `Resistance ${level.price.toFixed(2)} (${(level.strength * 100).toFixed(0)}%)`,
        } as PriceLineOptions);
      });
    }

    // Add trend line if available
    if (analysis.trend && analysis.trend.direction !== 'SIDEWAYS') {
      // Simple trend line approximation (from trend data)
      // Note: Real trend line would need actual price points
      const trendColor = analysis.trend.direction === 'UPTREND' ? '#10b981' : '#ef4444';
      
      // This is a placeholder - real implementation would need trend.startPrice and trend.endPrice
      // For now, we'll just indicate the trend direction visually
    }

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
      candlestickSeriesRef.current = null;
    };
  }, [analysis, priceData, height]);

  // Update data when priceData changes
  useEffect(() => {
    if (candlestickSeriesRef.current && priceData.length > 0) {
      candlestickSeriesRef.current.setData(priceData);
      chartRef.current?.timeScale().fitContent();
    }
  }, [priceData]);

  // Export chart as PNG
  const handleExport = useCallback(async () => {
    if (!chartRef.current) return;

    try {
      const chart = chartRef.current;
      const canvas = await chart.takeScreenshot();
      
      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) return;
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `technical-chart-${analysis.instrument}-${new Date().toISOString().split('T')[0]}.png`;
        link.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (error) {
      console.error('Failed to export chart:', error);
    }
  }, [analysis.instrument]);

  if (!analysis) {
    return (
      <div className={`flex items-center justify-center h-[${height}px] bg-muted/50 rounded`}>
        <p className="text-muted-foreground">No technical analysis data available</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Chart container */}
      <div 
        ref={chartContainerRef}
        className="w-full rounded-lg overflow-hidden border border-border"
        style={{ height: `${height}px` }}
      />
      
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
      {priceData.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded">
          <div className="text-center space-y-2">
            <p className="text-sm font-medium">No price data available</p>
            <p className="text-xs text-muted-foreground">
              Historical price data required for chart display
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
