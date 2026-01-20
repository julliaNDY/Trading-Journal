/**
 * Types for Market Replay Service
 */

// ============================================================================
// TICK DATA
// ============================================================================

export interface TickData {
  time: Date | string
  symbol: string
  bidPrice: number
  askPrice: number
  lastPrice: number
  volume: number
  source?: string
  tradeId?: string
  accountId?: string
}

// ============================================================================
// CANDLE / OHLCV
// ============================================================================

export type CandleInterval = '1s' | '5s' | '15s' | '30s' | '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d'

export interface Candle {
  time: Date | string
  symbol: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  tickCount: number
}

// ============================================================================
// REPLAY CONFIG
// ============================================================================

export interface ReplayConfig {
  startTime: string
  endTime: string
  symbol?: string
  symbols?: string[]
  
  // Playback settings
  fps?: number // Frames per second (default: 60)
  speed?: number // Speed multiplier (0.5, 1, 2, 4, 10, etc.)
  
  // Data format
  format?: 'ticks' | 'candles' | 'both'
  candleInterval?: CandleInterval
  
  // Options
  includeMetrics?: boolean
  includeTradeMarkers?: boolean
  compress?: boolean
  
  // Pagination/seek
  seekTo?: string // ISO timestamp to jump to
  limit?: number // Max ticks to return (for batch mode)
  offset?: number // Offset for pagination
}

// ============================================================================
// REPLAY FRAME
// ============================================================================

export interface ReplayFrame {
  frame: number
  timestamp: string
  elapsedMs: number
  
  // Data
  ticks?: TickData[]
  candle?: Candle
  
  // Real-time metrics (optional)
  metrics?: ReplayMetrics
  
  // Trade markers (optional)
  tradeMarkers?: TradeMarker[]
  
  // Progress info
  progress: {
    percent: number
    currentTime: string
    remainingFrames: number
  }
}

export interface ReplayMetrics {
  // Price stats
  currentPrice: number
  priceChange: number
  priceChangePercent: number
  highOfDay: number
  lowOfDay: number
  
  // Volume stats
  totalVolume: number
  avgVolume: number
  volumeProfile: number[] // Volume by price level
  
  // Tick stats
  tickCount: number
  ticksPerSecond: number
  bidAskSpread: number
  avgSpread: number
}

export interface TradeMarker {
  time: string
  type: 'entry' | 'exit' | 'partial_exit' | 'stop_loss' | 'take_profit'
  side: 'long' | 'short'
  price: number
  quantity: number
  tradeId: string
  pnl?: number
}

// ============================================================================
// REPLAY METADATA
// ============================================================================

export interface ReplayMetadata {
  symbol: string
  startTime: string
  endTime: string
  tickCount: number
  tradingDays: number
  
  // Data quality
  avgTicksPerSecond: number
  gapCount: number // Number of data gaps
  coverage: number // Percentage of time covered (0-100)
  
  // Price info
  priceRange: {
    high: number
    low: number
    open: number
    close: number
  }
  
  // Size info
  estimatedSizeBytes: number
  compressedSizeBytes?: number
}

// ============================================================================
// REPLAY SESSION
// ============================================================================

export interface ReplaySession {
  id: string
  config: ReplayConfig
  status: 'created' | 'playing' | 'paused' | 'seeking' | 'completed' | 'error'
  createdAt: string
  
  // Progress
  currentFrame: number
  totalFrames: number
  currentTime: string
  
  // Playback state
  speed: number
  isPaused: boolean
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface ReplayInfoResponse {
  available: boolean
  symbols: string[]
  dateRange: {
    earliest: string
    latest: string
  }
  totalTicks: number
  isTimescaleDB: boolean
  compressionEnabled: boolean
}

export interface ReplayBatchResponse {
  config: ReplayConfig
  metadata: ReplayMetadata
  frames: ReplayFrame[]
  executionTimeMs: number
}

// ============================================================================
// CONTROL COMMANDS (for WebSocket/streaming control)
// ============================================================================

export type ReplayCommand = 
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'stop' }
  | { type: 'seek'; timestamp: string }
  | { type: 'setSpeed'; speed: number }
  | { type: 'setFps'; fps: number }
  | { type: 'jumpForward'; seconds: number }
  | { type: 'jumpBackward'; seconds: number }
