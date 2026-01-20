/**
 * Volume Chart Component - TradingView Lightweight Charts
 * 
 * Displays volume bars with price overlay for Institutional Flux Analysis (Step 3)
 * 
 * @module components/daily-bias/charts/volume-chart
 * @created 2026-01-18
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  HistogramData,
  LineData,
  Time,
  BarData,
} from 'lightweight-charts';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { InstitutionalFlux } from '@/types/daily-bias';

interface VolumeChartProps {
  analysis: InstitutionalFlux;
  volumeData?: BarData<Time>[]; // Volume bars data
  priceData?: LineData<Time>[]; // Optional price overlay
  height?: number;
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function VolumeChart({ 
  analysis, 
  volumeData = [],
  priceData = [],
  height = 300,
  className = '' 
}: VolumeChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

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
        visible: !!priceData.length,
        borderColor: '#485563',
      },
      leftPriceScale: {
        visible: true,
        borderColor: '#485563',
      },
    });

    chartRef.current = chart;

    // Create volume histogram series
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'left',
      scaleMargins: {
        top: 0.7,
        bottom: 0,
      },
    });

    volumeSeriesRef.current = volumeSeries;

    // Set volume data
    if (volumeData.length > 0) {
      const histogramData: HistogramData<Time>[] = volumeData.map((bar) => ({
        time: bar.time,
        value: bar.value,
        color: bar.value > (analysis.volume?.average || 0) ? '#10b981' : '#6b7280',
      }));
      volumeSeries.setData(histogramData);
    }

    // Create price line series if price data available
    if (priceData.length > 0) {
      const priceSeries = chart.addLineSeries({
        color: '#3b82f6',
        lineWidth: 2,
        priceScaleId: 'right',
        scaleMargins: {
          top: 0,
          bottom: 0.7,
        },
      });

      priceSeriesRef.current = priceSeries;
      priceSeries.setData(priceData);
    }

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
      volumeSeriesRef.current = null;
      priceSeriesRef.current = null;
    };
  }, [analysis, volumeData, priceData, height]);

  // Update data when data changes
  useEffect(() => {
    if (volumeSeriesRef.current && volumeData.length > 0) {
      const histogramData: HistogramData<Time>[] = volumeData.map((bar) => ({
        time: bar.time,
        value: bar.value,
        color: bar.value > (analysis.volume?.average || 0) ? '#10b981' : '#6b7280',
      }));
      volumeSeriesRef.current.setData(histogramData);
    }
  }, [volumeData, analysis]);

  useEffect(() => {
    if (priceSeriesRef.current && priceData.length > 0) {
      priceSeriesRef.current.setData(priceData);
    }
  }, [priceData]);

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
        link.download = `volume-chart-${analysis.instrument}-${new Date().toISOString().split('T')[0]}.png`;
        link.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (error) {
      console.error('Failed to export chart:', error);
    }
  }, [analysis.instrument]);

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
      {volumeData.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded">
          <div className="text-center space-y-2">
            <p className="text-sm font-medium">No volume data available</p>
            <p className="text-xs text-muted-foreground">
              Volume data required for chart display
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
