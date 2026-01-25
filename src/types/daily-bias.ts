/**
 * Daily Bias Analysis - TypeScript Types
 * Generated from JSON Schema Design (PRÉ-9.1)
 * 
 * This file contains all TypeScript type definitions for the 6-step Daily Bias analysis.
 * These types are used throughout the application for type safety and IDE autocomplete.
 */

// ============================================================================
// COMMON TYPES
// ============================================================================

export type BiasDirection = 'BEARISH' | 'NEUTRAL' | 'BULLISH';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SentimentLevel = 'VERY_BEARISH' | 'BEARISH' | 'NEUTRAL' | 'BULLISH' | 'VERY_BULLISH';
export type TrendDirection = 'UP' | 'DOWN' | 'INDETERMINATE';
export type EconomicImportance = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type VolumeLevel = 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREMELY_HIGH';
export type VolumeTrend = 'DECREASING' | 'STABLE' | 'INCREASING';
export type InstitutionalPressure = 'BULLISH' | 'NEUTRAL' | 'BEARISH';
export type SupportResistanceType = 'ROUND_NUMBER' | 'MOVING_AVERAGE' | 'PREVIOUS_LOW' | 'PREVIOUS_HIGH' | 'TRENDLINE';
export type PriceTrendDirection = 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
export type Timeframe = 'INTRADAY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type MacroEconomicCycle = 'EXPANSION' | 'PEAK' | 'CONTRACTION' | 'TROUGH';
export type IndicatorSignal = 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NEUTRAL';
export type OrderFlowConfirmation = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED';
export type OrderFlowTrend = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export type Mag7Symbol = 'AAPL' | 'MSFT' | 'GOOGL' | 'AMZN' | 'META' | 'NVDA' | 'TSLA';

export const MAG7_SYMBOLS: Mag7Symbol[] = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA'];

// ============================================================================
// STEP 1: SECURITY ANALYSIS
// ============================================================================

export interface VolatilityFactor {
  factor: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface RiskItem {
  risk: string;
  probability: number; // 0-1
  impact: number; // 0-1
}

export interface SecurityAnalysisDetails {
  summary: string;
  volatilityFactors?: VolatilityFactor[];
  risks: RiskItem[];
  recommendations: string[];
}

export interface SecurityAnalysis {
  volatilityIndex: number; // 0-100
  riskLevel: RiskLevel;
  securityScore: number; // 0-10
  analysis: SecurityAnalysisDetails;
  timestamp: string; // ISO 8601
  instrument: string;
  dataSources?: string[]; // Data sources used for analysis
}

// ============================================================================
// STEP 2: MACRO ANALYSIS
// ============================================================================

export interface EconomicEvent {
  event: string;
  time: string; // HH:MM format
  importance: EconomicImportance;
  country: string;
  forecast?: number | null;
  previous?: number | null;
  actual?: number | null;
  impactOnInstrument?: string;
}

export interface MacroAnalysisDetails {
  summary: string;
  centralBankPolicy?: string;
  economicCycle?: MacroEconomicCycle;
  keyThemes?: string[];
}

export interface MacroAnalysis {
  economicEvents: EconomicEvent[];
  macroScore: number; // 0-10
  sentiment: SentimentLevel;
  analysis?: MacroAnalysisDetails;
  timestamp: string; // ISO 8601
  instrument: string;
}

// ============================================================================
// STEP 3: INSTITUTIONAL FLUX
// ============================================================================

export interface VolumeHeatMap {
  priceLevel: string;
  volume: number;
  intensity: number; // 0-1
}

export interface VolumeSpike {
  timestamp: string; // ISO 8601
  volume: number;
  priceChange: number; // % change
}

export interface VolumeByPriceLevel {
  priceLevel: number;
  volume: number;
  percentage: number; // % of total volume
}

export interface VolumeProfile {
  volumeLevel: VolumeLevel;
  trend?: VolumeTrend;
  volumeTrend: VolumeTrend;
  concentration: number; // 0-1
  volumeRatio: number;
  totalVolume?: number;
  averageVolume?: number;
  volumeSpikes?: VolumeSpike[];
  volumeByPriceLevel?: VolumeByPriceLevel[];
  heatMap?: VolumeHeatMap[];
}

export interface LargeOrder {
  timestamp: string; // ISO 8601
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface LargeOrders {
  buyOrders: number;
  sellOrders: number;
  ratio: number;
}

export interface OrderFlow {
  buyVolume: number;
  sellVolume: number;
  buyVsSellRatio: number;
  netOrderFlow: number;
  orderFlowTrend: OrderFlowTrend;
  buyerDominance?: number; // 0-1
  largeOrders?: LargeOrders | LargeOrder[];
  aggressiveness?: number; // 0-10
  institutionalPressure?: InstitutionalPressure;
}

export interface KeyLevel {
  level: number;
  type: SupportResistanceType;
  strength: number; // 0-1
}

export interface InstitutionalFluxDetails {
  summary?: string;
  keyLevels?: KeyLevel[];
}

export interface InstitutionalFlux {
  volumeProfile: VolumeProfile & {
    totalVolume?: number; // Total volume traded
  };
  orderFlow: OrderFlow & {
    netFlow?: number; // Net order flow
    buyPressure?: number; // Buy pressure percentage
    sellPressure?: number; // Sell pressure percentage
    confirmation?: OrderFlowConfirmation;
  };
  fluxScore: number; // 0-10
  analysis?: InstitutionalFluxDetails;
  timestamp: string; // ISO 8601
  instrument: string;
  dataSources?: string[]; // Data sources used for analysis
}

// ============================================================================
// STEP 4: MAG 7 LEADERS
// ============================================================================

export interface Mag7Correlation {
  symbol: Mag7Symbol;
  correlation: number; // -1 to 1
  trend: TrendDirection;
  performancePercent?: number;
  strength: number; // 0-1
}

export interface GroupSentiment {
  category: string;
  sentiment: SentimentLevel;
}

export interface Mag7AnalysisDetails {
  summary?: string;
  leaderDynamics?: string;
  groupSentiment?: GroupSentiment[];
}

export interface Mag7Analysis {
  correlations: Mag7Correlation[];
  leaderScore: number; // 0-10
  sentiment: SentimentLevel;
  analysis?: Mag7AnalysisDetails;
  timestamp: string; // ISO 8601
  instrument: string;
  dataSources?: string[]; // Data sources used for analysis
}

// ============================================================================
// STEP 5: TECHNICAL STRUCTURE
// ============================================================================

export interface SupportLevel {
  price: number;
  strength: number; // 0-1
  type: SupportResistanceType;
  testedCount?: number;
}

export interface ResistanceLevel {
  price: number;
  strength: number; // 0-1
  type: SupportResistanceType;
  testedCount?: number;
}

export interface MovingAveragePrices {
  ma20?: number;
  ma50?: number;
  ma200?: number;
}

export interface Trend {
  direction: PriceTrendDirection;
  strength: number; // 0-1
  timeframe: Timeframe;
  maPrices?: MovingAveragePrices;
}

export interface TechnicalPattern {
  pattern: string;
  bullish: boolean;
}

export interface MACD {
  signal?: IndicatorSignal;
  histogram?: number;
}

export interface TechnicalAnalysisDetails {
  summary?: string;
  patterns?: TechnicalPattern[];
  rsi?: number; // 0-100
  macd?: MACD;
}

export interface KeyDriver {
  indicator: string;
  value: string;
  signal: 'bullish' | 'bearish' | 'neutral';
  weight: 'high' | 'medium' | 'low';
}

export interface TechnicalStructure {
  supportLevels: SupportLevel[];
  resistanceLevels: ResistanceLevel[];
  trend: Trend;
  technicalScore: number; // 0-10
  analysis?: TechnicalAnalysisDetails;
  indicators?: Array<{ name: string; value: number; signal?: IndicatorSignal }>;
  keyDrivers?: KeyDriver[]; // Key indicators driving the bias determination
  timestamp: string; // ISO 8601
  instrument: string;
  dataSources?: string[]; // Data sources used for analysis
}

// Alias for consistency
export type TechnicalAnalysis = TechnicalStructure;

// ============================================================================
// STEP 6: SYNTHESIS & FINAL BIAS
// ============================================================================

export interface OpeningConfirmation {
  expectedDirection: TrendDirection;
  confirmationScore: number; // 0-1
  timeToConfirm?: string; // e.g., "30min"
}

export interface StepWeights {
  security?: number; // 0-1
  macro?: number; // 0-1
  flux?: number; // 0-1
  mag7?: number; // 0-1
  technical?: number; // 0-1
}

export interface TradingRecommendations {
  primary?: string;
  targetUpside?: number;
  targetDownside?: number;
  stopLoss?: number;
  riskRewardRatio?: number;
}

export interface SynthesisAnalysisDetails {
  summary?: string;
  stepWeights?: StepWeights;
  agreementLevel?: number; // 0-1
  keyThesisPoints?: string[];
  counterArguments?: string[];
  tradingRecommendations?: TradingRecommendations;
}

export interface Synthesis {
  finalBias: BiasDirection;
  confidence: number; // 0-1
  openingConfirmation: OpeningConfirmation;
  analysis?: SynthesisAnalysisDetails;
  timestamp: string; // ISO 8601
  instrument: string;
}

// ============================================================================
// AGGREGATE RESPONSE
// ============================================================================

export interface AllAnalysisSteps {
  security: SecurityAnalysis;
  macro: MacroAnalysis;
  flux: InstitutionalFlux;
  mag7: Mag7Analysis;
  technical: TechnicalStructure;
  synthesis: Synthesis;
}

export interface AnalysisMetadata {
  processingTime?: number; // milliseconds
  cached?: boolean;
  fallbackUsed?: boolean;
  version?: string;
}

export interface DailyBiasAnalysisResponse {
  instrument: string;
  timestamp: string; // ISO 8601
  steps: AllAnalysisSteps;
  finalBias: BiasDirection;
  metadata?: AnalysisMetadata;
}

// ============================================================================
// ERROR RESPONSE
// ============================================================================

export type ErrorCode = 'INVALID_INPUT' | 'RATE_LIMIT' | 'SERVICE_UNAVAILABLE' | 'INTERNAL_ERROR';

export interface ErrorResponse {
  error: string;
  code: ErrorCode;
  details?: Record<string, unknown>;
  timestamp: string; // ISO 8601
}

// ============================================================================
// REQUEST TYPES
// ============================================================================

export interface AnalysisRequest {
  instrument: string;
  useCache?: boolean; // default: true
  forceRefresh?: boolean; // default: false
}

export interface BatchAnalysisRequest {
  instruments: string[];
  useCache?: boolean;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isBiasDirection(value: unknown): value is BiasDirection {
  return value === 'BEARISH' || value === 'NEUTRAL' || value === 'BULLISH';
}

export function isRiskLevel(value: unknown): value is RiskLevel {
  return ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(value));
}

export function isSentimentLevel(value: unknown): value is SentimentLevel {
  return ['VERY_BEARISH', 'BEARISH', 'NEUTRAL', 'BULLISH', 'VERY_BULLISH'].includes(String(value));
}

export function isMag7Symbol(value: unknown): value is Mag7Symbol {
  return MAG7_SYMBOLS.includes(value as Mag7Symbol);
}

export function isDailyBiasAnalysisResponse(value: unknown): value is DailyBiasAnalysisResponse {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.instrument === 'string' &&
    typeof obj.timestamp === 'string' &&
    typeof obj.steps === 'object' &&
    isBiasDirection(obj.finalBias)
  );
}

export function isErrorResponse(value: unknown): value is ErrorResponse {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.error === 'string' && typeof obj.code === 'string';
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const VALID_INSTRUMENTS = [
  'NQ1',
  'ES1',
  'TSLA',
  'NVDA',
  'SPY',
  'TQQQ',
  'AMD',
  'AAPL',
  'XAU/USD',
  'PLTR',
  'SOXL',
  'AMZN',
  'MSTR',
  'EUR/USD',
  'QQQ',
  'MSFT',
  'COIN',
  'BTC',
  'META',
  'GME',
  'SQQQ',
  'MARA',
] as const;

export type ValidInstrument = typeof VALID_INSTRUMENTS[number];

export const STEP_NAMES = {
  security: 'Security Analysis',
  macro: 'Macro Analysis',
  flux: 'Institutional Flux',
  mag7: 'Mag 7 Leaders',
  technical: 'Technical Structure',
  synthesis: 'Synthesis & Final Bias',
} as const;

export type StepName = keyof typeof STEP_NAMES;

export const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
export const DEFAULT_ANALYSIS_TIMEOUT = 10 * 1000; // 10 seconds per step

// ============================================================================
// UTILITY TYPES (PRÉ-9.2)
// ============================================================================

/**
 * Extract the type of a specific analysis step
 * @example StepType<'security'> => SecurityAnalysis
 */
export type StepType<T extends StepName> = T extends 'security'
  ? SecurityAnalysis
  : T extends 'macro'
  ? MacroAnalysis
  : T extends 'flux'
  ? InstitutionalFlux
  : T extends 'mag7'
  ? Mag7Analysis
  : T extends 'technical'
  ? TechnicalStructure
  : T extends 'synthesis'
  ? Synthesis
  : never;

/**
 * Partial analysis response with only specific steps completed
 */
export type PartialAnalysisSteps = Partial<AllAnalysisSteps>;

/**
 * Analysis step with loading state
 */
export type StepWithStatus<T extends StepName> = {
  step: T;
  status: 'idle' | 'loading' | 'success' | 'error';
  data?: StepType<T>;
  error?: ErrorResponse;
};

/**
 * All steps with their loading states
 */
export type AllStepsWithStatus = {
  [K in StepName]: StepWithStatus<K>;
};

/**
 * Discriminated union for analysis results
 */
export type AnalysisResult<T = DailyBiasAnalysisResponse> =
  | { success: true; data: T; cached?: boolean }
  | { success: false; error: ErrorResponse };

/**
 * Async state for analysis operations
 */
export interface AsyncAnalysisState<T = DailyBiasAnalysisResponse> {
  data: T | null;
  loading: boolean;
  error: ErrorResponse | null;
  timestamp: string | null;
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  remaining: number;
  resetAt: string; // ISO 8601
  limit: number;
}

/**
 * Extended metadata with rate limiting
 */
export interface ExtendedAnalysisMetadata extends AnalysisMetadata {
  rateLimit?: RateLimitInfo;
  userId?: string;
  requestId?: string;
}

/**
 * Analysis response with extended metadata
 */
export interface ExtendedDailyBiasAnalysisResponse extends Omit<DailyBiasAnalysisResponse, 'metadata'> {
  metadata?: ExtendedAnalysisMetadata;
}

/**
 * Webhook payload for analysis completion
 */
export interface AnalysisWebhookPayload {
  event: 'analysis.completed' | 'analysis.failed';
  instrument: string;
  timestamp: string;
  data?: DailyBiasAnalysisResponse;
  error?: ErrorResponse;
}

/**
 * Historical analysis record
 */
export interface HistoricalAnalysis {
  id: string;
  instrument: string;
  date: string; // YYYY-MM-DD
  analysis: DailyBiasAnalysisResponse;
  createdAt: string;
  updatedAt: string;
}

/**
 * Analysis comparison between two dates
 */
export interface AnalysisComparison {
  instrument: string;
  date1: string;
  date2: string;
  analysis1: DailyBiasAnalysisResponse;
  analysis2: DailyBiasAnalysisResponse;
  changes: {
    finalBias: { changed: boolean; from: BiasDirection; to: BiasDirection };
    confidence: { changed: boolean; from: number; to: number };
    scores: {
      security: { changed: boolean; from: number; to: number };
      macro: { changed: boolean; from: number; to: number };
      flux: { changed: boolean; from: number; to: number };
      mag7: { changed: boolean; from: number; to: number };
      technical: { changed: boolean; from: number; to: number };
    };
  };
}

// ============================================================================
// HELPER FUNCTIONS (PRÉ-9.2)
// ============================================================================

/**
 * Check if a string is a valid instrument
 */
export function isValidInstrument(value: string): value is ValidInstrument {
  return VALID_INSTRUMENTS.includes(value as ValidInstrument);
}

/**
 * Get the display name for a step
 */
export function getStepDisplayName(step: StepName): string {
  return STEP_NAMES[step];
}

/**
 * Extract scores from all analysis steps
 */
export function extractScores(steps: AllAnalysisSteps): Record<StepName, number> {
  return {
    security: steps.security.securityScore,
    macro: steps.macro.macroScore,
    flux: steps.flux.fluxScore,
    mag7: steps.mag7.leaderScore,
    technical: steps.technical.technicalScore,
    synthesis: steps.synthesis.confidence * 10, // Convert 0-1 to 0-10 scale
  };
}

/**
 * Calculate average score across all steps
 */
export function calculateAverageScore(steps: AllAnalysisSteps): number {
  const scores = extractScores(steps);
  const values = Object.values(scores);
  return values.reduce((sum, score) => sum + score, 0) / values.length;
}

/**
 * Determine if analysis is bullish, bearish, or neutral
 */
export function getAnalysisSentiment(analysis: DailyBiasAnalysisResponse): BiasDirection {
  return analysis.finalBias;
}

/**
 * Get confidence level as a percentage
 */
export function getConfidencePercentage(synthesis: Synthesis): number {
  return Math.round(synthesis.confidence * 100);
}

/**
 * Check if analysis is cached
 */
export function isCachedAnalysis(response: DailyBiasAnalysisResponse): boolean {
  return response.metadata?.cached === true;
}

/**
 * Check if fallback was used
 */
export function wasFallbackUsed(response: DailyBiasAnalysisResponse): boolean {
  return response.metadata?.fallbackUsed === true;
}

/**
 * Format timestamp for display
 */
export function formatAnalysisTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Get time since analysis
 */
export function getTimeSinceAnalysis(timestamp: string): number {
  return Date.now() - new Date(timestamp).getTime();
}

/**
 * Check if analysis is stale (older than cache TTL)
 */
export function isAnalysisStale(timestamp: string, ttl: number = DEFAULT_CACHE_TTL): boolean {
  return getTimeSinceAnalysis(timestamp) > ttl;
}

/**
 * Create an empty async state
 */
export function createEmptyAsyncState<T = DailyBiasAnalysisResponse>(): AsyncAnalysisState<T> {
  return {
    data: null,
    loading: false,
    error: null,
    timestamp: null,
  };
}

/**
 * Create a loading async state
 */
export function createLoadingState<T = DailyBiasAnalysisResponse>(): AsyncAnalysisState<T> {
  return {
    data: null,
    loading: true,
    error: null,
    timestamp: null,
  };
}

/**
 * Create a success async state
 */
export function createSuccessState<T = DailyBiasAnalysisResponse>(data: T): AsyncAnalysisState<T> {
  return {
    data,
    loading: false,
    error: null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create an error async state
 */
export function createErrorState<T = DailyBiasAnalysisResponse>(error: ErrorResponse): AsyncAnalysisState<T> {
  return {
    data: null,
    loading: false,
    error,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Merge partial analysis steps with existing steps
 */
export function mergeAnalysisSteps(
  existing: PartialAnalysisSteps,
  updates: PartialAnalysisSteps
): PartialAnalysisSteps {
  return {
    ...existing,
    ...updates,
  };
}

/**
 * Check if all steps are completed
 */
export function areAllStepsCompleted(steps: PartialAnalysisSteps): steps is AllAnalysisSteps {
  return !!(
    steps.security &&
    steps.macro &&
    steps.flux &&
    steps.mag7 &&
    steps.technical &&
    steps.synthesis
  );
}

/**
 * Get completed step names
 */
export function getCompletedSteps(steps: PartialAnalysisSteps): StepName[] {
  return (Object.keys(steps) as StepName[]).filter((key) => steps[key] !== undefined);
}

/**
 * Get pending step names
 */
export function getPendingSteps(steps: PartialAnalysisSteps): StepName[] {
  const allSteps: StepName[] = ['security', 'macro', 'flux', 'mag7', 'technical', 'synthesis'];
  return allSteps.filter((step) => steps[step] === undefined);
}

/**
 * Calculate completion percentage
 */
export function calculateCompletionPercentage(steps: PartialAnalysisSteps): number {
  const completed = getCompletedSteps(steps).length;
  const total = 6; // Total number of steps
  return Math.round((completed / total) * 100);
}

/**
 * Create a mock analysis response for testing
 */
export function createMockAnalysisResponse(
  instrument: string,
  overrides?: Partial<DailyBiasAnalysisResponse>
): DailyBiasAnalysisResponse {
  const timestamp = new Date().toISOString();
  
  return {
    instrument,
    timestamp,
    finalBias: 'NEUTRAL',
    steps: {
      security: {
        volatilityIndex: 50,
        riskLevel: 'MEDIUM',
        securityScore: 5,
        analysis: {
          summary: 'Mock security analysis',
          risks: [],
          recommendations: [],
        },
        timestamp,
        instrument,
      },
      macro: {
        economicEvents: [],
        macroScore: 5,
        sentiment: 'NEUTRAL',
        timestamp,
        instrument,
      },
      flux: {
        volumeProfile: {
          volumeLevel: 'NORMAL',
          trend: 'STABLE',
          volumeTrend: 'STABLE',
          concentration: 0.5,
          volumeRatio: 1,
        },
        orderFlow: {
          buyVolume: 1_000_000,
          sellVolume: 1_000_000,
          buyVsSellRatio: 1,
          netOrderFlow: 0,
          orderFlowTrend: 'NEUTRAL',
          buyerDominance: 0.5,
        },
        fluxScore: 5,
        timestamp,
        instrument,
      },
      mag7: {
        correlations: MAG7_SYMBOLS.map((symbol) => ({
          symbol,
          correlation: 0,
          trend: 'INDETERMINATE',
          strength: 0.5,
        })),
        leaderScore: 5,
        sentiment: 'NEUTRAL',
        timestamp,
        instrument,
      },
      technical: {
        supportLevels: [],
        resistanceLevels: [],
        trend: {
          direction: 'SIDEWAYS',
          strength: 0.5,
          timeframe: 'DAILY',
        },
        technicalScore: 5,
        timestamp,
        instrument,
      },
      synthesis: {
        finalBias: 'NEUTRAL',
        confidence: 0.5,
        openingConfirmation: {
          expectedDirection: 'INDETERMINATE',
          confirmationScore: 0.5,
        },
        timestamp,
        instrument,
      },
    },
    metadata: {
      processingTime: 1000,
      cached: false,
      fallbackUsed: false,
      version: '1.0.0',
    },
    ...overrides,
  };
}

/**
 * Create a mock error response for testing
 */
export function createMockErrorResponse(
  code: ErrorCode = 'INTERNAL_ERROR',
  message: string = 'Mock error'
): ErrorResponse {
  return {
    error: message,
    code,
    timestamp: new Date().toISOString(),
  };
}
