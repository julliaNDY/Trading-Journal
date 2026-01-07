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
import { Loader2, TrendingUp, AlertTriangle, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h';

const TIMEFRAME_MS: Record<Timeframe, number> = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
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
  // Future: real data from broker
  hasBrokerConnection?: boolean;
  brokerType?: string;
}

// ============================================================================
// CANDLE GENERATION
// ============================================================================

/**
 * Determines the best automatic timeframe based on trade duration
 */
function getAutoTimeframe(tradeDurationMs: number): Timeframe {
  if (tradeDurationMs < 10 * 60 * 1000) return '1m';      // < 10 min → 1m
  if (tradeDurationMs < 30 * 60 * 1000) return '5m';      // < 30 min → 5m
  if (tradeDurationMs < 2 * 60 * 60 * 1000) return '15m'; // < 2h → 15m
  if (tradeDurationMs < 8 * 60 * 60 * 1000) return '30m'; // < 8h → 30m
  if (tradeDurationMs < 24 * 60 * 60 * 1000) return '1h'; // < 24h → 1h
  return '4h';                                             // >= 24h → 4h
}

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
  hasBrokerConnection = false,
  brokerType,
}: TradeChartProps) {
  const t = useTranslations('tradeChart');
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  
  // Calculate auto timeframe based on trade duration
  const tradeDurationMs = closedAt.getTime() - openedAt.getTime();
  const autoTimeframe = getAutoTimeframe(tradeDurationMs);
  const [timeframe, setTimeframe] = useState<Timeframe>(autoTimeframe);
  
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

    // Add entry price line
    candlestickSeries.createPriceLine({
      price: entryPrice,
      color: '#3b82f6',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: t('entry'),
    });

    // Add exit price line
    candlestickSeries.createPriceLine({
      price: exitPrice,
      color: direction === 'LONG' 
        ? (exitPrice > entryPrice ? '#22c55e' : '#ef4444')
        : (exitPrice < entryPrice ? '#22c55e' : '#ef4444'),
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: t('exit'),
    });

    // Add stop loss line if exists
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

    // Add markers for entry and exit (v5 API uses attachPrimitive or we skip markers)
    // Note: v5 changed the markers API - using price lines instead for now

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
                <SelectItem value="30m">30m</SelectItem>
                <SelectItem value="1h">1h</SelectItem>
                <SelectItem value="4h">4h</SelectItem>
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
        {isLoading && (
          <div className="h-[350px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        
        <div 
          ref={chartContainerRef} 
          className={`h-[350px] ${isLoading ? 'hidden' : ''}`}
        />

        {!isLoading && (
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-blue-500" />
              <span>{t('entry')}: {entryPrice.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className={`w-3 h-0.5 ${
                (direction === 'LONG' && exitPrice > entryPrice) || 
                (direction === 'SHORT' && exitPrice < entryPrice) 
                  ? 'bg-green-500' 
                  : 'bg-red-500'
              }`} />
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

        <div className={`mt-3 p-2 rounded border ${
          hasBrokerConnection 
            ? 'bg-blue-500/10 border-blue-500/20' 
            : 'bg-yellow-500/10 border-yellow-500/20'
        }`}>
          <div className={`flex items-start gap-2 text-xs ${
            hasBrokerConnection ? 'text-blue-500' : 'text-yellow-500'
          }`}>
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              {hasBrokerConnection 
                ? t('brokerConnectedNote', { broker: brokerType || 'Broker' })
                : t('simulatedDataNote')
              }
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

