'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  LineStyle,
  CandlestickSeries,
  createSeriesMarkers,
  SeriesMarker,
} from 'lightweight-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, TrendingUp, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type Timeframe = '1m' | '5m' | '15m';

const TIMEFRAME_MS: Record<Timeframe, number> = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
};

interface TradeChartProps {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  stopLoss?: number | null;
  profitTarget?: number | null;
  openedAt: Date;
  closedAt: Date;
  partialExits?: {
    exitPrice: number;
    exitedAt: Date;
  }[];
}

// ============================================================================
// CANDLE GENERATION
// ============================================================================

/**
 * Generate simulated candle data around the trade with specific timeframe
 */
function generateSimulatedCandles(
  entryPrice: number,
  exitPrice: number,
  openedAt: Date,
  closedAt: Date,
  direction: 'LONG' | 'SHORT',
  timeframe: Timeframe
): CandlestickData<Time>[] {
  const candles: CandlestickData<Time>[] = [];
  const candleIntervalMs = TIMEFRAME_MS[timeframe];
  
  // Calculate context window based on timeframe
  const preEntryBars = timeframe === '1m' ? 20 : timeframe === '5m' ? 15 : 10;
  const postExitBars = timeframe === '1m' ? 10 : timeframe === '5m' ? 8 : 5;
  
  const startTime = new Date(openedAt);
  startTime.setTime(startTime.getTime() - (preEntryBars * candleIntervalMs));
  
  const tradeDurationMs = closedAt.getTime() - openedAt.getTime();
  const tradeCandles = Math.max(3, Math.ceil(tradeDurationMs / candleIntervalMs));
  
  // Price movement parameters
  const priceRange = Math.abs(exitPrice - entryPrice);
  const volatility = Math.max(priceRange * 0.25, entryPrice * 0.001); // Min 0.1% volatility
  
  let currentTime = startTime.getTime();
  let currentPrice = entryPrice - (direction === 'LONG' ? volatility * 0.5 : -volatility * 0.5);
  
  // Seed for consistent candles (based on trade data)
  const seedRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  let seedCounter = openedAt.getTime();
  const nextRandom = () => {
    seedCounter++;
    return seedRandom(seedCounter);
  };
  
  // Pre-entry candles (approach to entry)
  const priceStep = (direction === 'LONG' ? volatility : -volatility) / preEntryBars;
  
  for (let i = 0; i < preEntryBars; i++) {
    const open = currentPrice;
    const randomMove = (nextRandom() - 0.5) * volatility * 0.4;
    const trendMove = priceStep;
    const close = open + trendMove + randomMove;
    const high = Math.max(open, close) + nextRandom() * volatility * 0.25;
    const low = Math.min(open, close) - nextRandom() * volatility * 0.25;
    
    candles.push({
      time: Math.floor(currentTime / 1000) as Time,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
    });
    
    currentPrice = close;
    currentTime += candleIntervalMs;
  }
  
  // Trade duration candles
  const priceProgressStep = (exitPrice - entryPrice) / tradeCandles;
  currentPrice = entryPrice;
  currentTime = openedAt.getTime();
  
  for (let i = 0; i < tradeCandles; i++) {
    const open = currentPrice;
    const baseMove = priceProgressStep;
    const randomMove = (nextRandom() - 0.5) * volatility * 0.3;
    const close = open + baseMove + randomMove;
    
    const wickSize = volatility * 0.35;
    const high = Math.max(open, close) + nextRandom() * wickSize;
    const low = Math.min(open, close) - nextRandom() * wickSize;
    
    candles.push({
      time: Math.floor(currentTime / 1000) as Time,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
    });
    
    currentPrice = close;
    currentTime += candleIntervalMs;
  }
  
  // Post-exit candles
  for (let i = 0; i < postExitBars; i++) {
    const open = currentPrice;
    const randomMove = (nextRandom() - 0.5) * volatility * 0.5;
    const close = open + randomMove;
    const high = Math.max(open, close) + nextRandom() * volatility * 0.25;
    const low = Math.min(open, close) - nextRandom() * volatility * 0.25;
    
    candles.push({
      time: Math.floor(currentTime / 1000) as Time,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
    });
    
    currentPrice = close;
    currentTime += candleIntervalMs;
  }
  
  return candles;
}

export function TradeChart({
  symbol,
  direction,
  entryPrice,
  exitPrice,
  stopLoss,
  profitTarget,
  openedAt,
  closedAt,
  partialExits,
}: TradeChartProps) {
  const t = useTranslations('tradeChart');
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  
  // Default to 5m timeframe - always show chart immediately on load
  // The user can change the timeframe if needed
  const [timeframe, setTimeframe] = useState<Timeframe>('5m');
  
  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    if (chartRef.current) {
      const timeScale = chartRef.current.timeScale();
      const visibleRange = timeScale.getVisibleLogicalRange();
      if (visibleRange) {
        const center = (visibleRange.from + visibleRange.to) / 2;
        const newRange = (visibleRange.to - visibleRange.from) * 0.7;
        timeScale.setVisibleLogicalRange({
          from: center - newRange / 2,
          to: center + newRange / 2,
        });
      }
    }
  }, []);
  
  const handleZoomOut = useCallback(() => {
    if (chartRef.current) {
      const timeScale = chartRef.current.timeScale();
      const visibleRange = timeScale.getVisibleLogicalRange();
      if (visibleRange) {
        const center = (visibleRange.from + visibleRange.to) / 2;
        const newRange = (visibleRange.to - visibleRange.from) * 1.4;
        timeScale.setVisibleLogicalRange({
          from: center - newRange / 2,
          to: center + newRange / 2,
        });
      }
    }
  }, []);
  
  const handleFitContent = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(75, 85, 99, 0.3)' },
        horzLines: { color: 'rgba(75, 85, 99, 0.3)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: 'rgba(156, 163, 175, 0.5)',
          labelBackgroundColor: '#374151',
        },
        horzLine: {
          color: 'rgba(156, 163, 175, 0.5)',
          labelBackgroundColor: '#374151',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(75, 85, 99, 0.5)',
      },
      timeScale: {
        borderColor: 'rgba(75, 85, 99, 0.5)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    chartRef.current = chart;

    // Add candlestick series (v5 API)
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    });

    seriesRef.current = candlestickSeries;

    // Generate and set data with selected timeframe
    const candles = generateSimulatedCandles(
      entryPrice,
      exitPrice,
      openedAt,
      closedAt,
      direction,
      timeframe
    );
    
    candlestickSeries.setData(candles);
    setHasData(candles.length > 0);

    // Create markers array for entry/exit points
    const markers: SeriesMarker<Time>[] = [];
    
    // Entry marker - only if we have entry data
    if (openedAt && entryPrice) {
      const entryTime = Math.floor(openedAt.getTime() / 1000) as Time;
      markers.push({
        time: entryTime,
        position: 'belowBar',
        color: '#3b82f6', // blue for entry
        shape: 'arrowUp',
        text: t('entry'),
        size: 2,
      });
    }
    
    // Exit marker - only if we have exit data
    if (closedAt && exitPrice) {
      const exitTime = Math.floor(closedAt.getTime() / 1000) as Time;
      
      // Calculate profit to determine color
      const profit = direction === 'LONG' 
        ? exitPrice - entryPrice 
        : entryPrice - exitPrice;
      const exitColor = profit > 0 ? '#22c55e' : '#ef4444'; // green for profit, red for loss
      
      markers.push({
        time: exitTime,
        position: 'aboveBar',
        color: exitColor,
        shape: 'arrowDown',
        text: t('exit'),
        size: 2,
      });
    }
    
    // Add partial exit markers if they exist
    if (partialExits && partialExits.length > 0) {
      partialExits.forEach((exit, index) => {
        const partialTime = Math.floor(exit.exitedAt.getTime() / 1000) as Time;
        markers.push({
          time: partialTime,
          position: 'aboveBar',
          color: '#a855f7', // purple for partial exits
          shape: 'arrowDown',
          text: `P${index + 1}`,
          size: 1,
        });
      });
    }
    
    // Sort markers by time and apply using the v5 API
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    const seriesMarkers = createSeriesMarkers(candlestickSeries, markers);

    // Add stop loss line if exists (keep this as a reference line)
    if (stopLoss) {
      candlestickSeries.createPriceLine({
        price: stopLoss,
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'SL',
      });
    }

    // Add profit target line if exists
    if (profitTarget) {
      candlestickSeries.createPriceLine({
        price: profitTarget,
        color: '#22c55e',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'TP',
      });
    }

    // Add partial exit lines
    if (partialExits && partialExits.length > 0) {
      partialExits.forEach((exit, index) => {
        candlestickSeries.createPriceLine({
          price: exit.exitPrice,
          color: '#a855f7',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `P${index + 1}`,
        });
      });
    }

    // Fit content
    chart.timeScale().fitContent();

    setIsLoading(false);

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      // Clean up markers primitive
      seriesMarkers.detach();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [entryPrice, exitPrice, openedAt, closedAt, direction, stopLoss, profitTarget, partialExits, timeframe, t]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('title')} - {symbol}
          </CardTitle>
          
          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Timeframe Selector */}
            <Select value={timeframe} onValueChange={(v) => setTimeframe(v as Timeframe)}>
              <SelectTrigger className="w-[80px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1m">1m</SelectItem>
                <SelectItem value="5m">5m</SelectItem>
                <SelectItem value="15m">15m</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Zoom Controls */}
            <div className="flex items-center border rounded-md">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-none"
                onClick={handleZoomIn}
                title={t('zoomIn')}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-none border-x"
                onClick={handleFitContent}
                title={t('fitContent')}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-none"
                onClick={handleZoomOut}
                title={t('zoomOut')}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative h-[350px]">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          <div 
            ref={chartContainerRef} 
            className="h-full w-full"
          />
        </div>

        {!isLoading && (
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <svg className="w-3 h-3 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4l-8 8h5v8h6v-8h5z"/>
              </svg>
              <span>{t('entry')}: {entryPrice.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className={`w-3 h-3 ${
                (direction === 'LONG' && exitPrice > entryPrice) || 
                (direction === 'SHORT' && exitPrice < entryPrice) 
                  ? 'text-green-500' 
                  : 'text-red-500'
              }`} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 20l8-8h-5V4H9v8H4z"/>
              </svg>
              <span>{t('exit')}: {exitPrice.toFixed(2)}</span>
            </div>
            {stopLoss && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-red-500 border-dashed" style={{ borderTopWidth: 1 }} />
                <span>SL: {stopLoss.toFixed(2)}</span>
              </div>
            )}
            {profitTarget && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-green-500 border-dashed" style={{ borderTopWidth: 1 }} />
                <span>TP: {profitTarget.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

      </CardContent>
    </Card>
  );
}

