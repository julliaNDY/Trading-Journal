/**
 * Daily Bias Analysis - Zod Validation Schemas
 * Generated from JSON Schema Design (PRÉ-9.1)
 * 
 * These Zod schemas provide runtime validation for all Daily Bias Analysis API requests and responses.
 * Used for input validation, response transformation, and type coercion.
 */

import { z } from 'zod';
import type * as DailyBias from '@/types/daily-bias';

// ============================================================================
// COMMON VALIDATORS
// ============================================================================

export const BiasDirectionSchema = z.enum(['BEARISH', 'NEUTRAL', 'BULLISH'] as const);
export const RiskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const);
export const SentimentLevelSchema = z.enum(['VERY_BEARISH', 'BEARISH', 'NEUTRAL', 'BULLISH', 'VERY_BULLISH'] as const);
export const TrendDirectionSchema = z.enum(['UP', 'DOWN', 'INDETERMINATE'] as const);
export const EconomicImportanceSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const);
export const VolumeLevelSchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'EXTREMELY_HIGH'] as const);
export const VolumeTrendSchema = z.enum(['DECREASING', 'STABLE', 'INCREASING'] as const);
export const InstitutionalPressureSchema = z.enum(['BULLISH', 'NEUTRAL', 'BEARISH'] as const);
export const SupportResistanceTypeSchema = z.enum(['ROUND_NUMBER', 'MOVING_AVERAGE', 'PREVIOUS_LOW', 'PREVIOUS_HIGH', 'TRENDLINE'] as const);
export const PriceTrendDirectionSchema = z.enum(['UPTREND', 'DOWNTREND', 'SIDEWAYS'] as const);
export const TimeframeSchema = z.enum(['INTRADAY', 'DAILY', 'WEEKLY', 'MONTHLY'] as const);
export const MacroEconomicCycleSchema = z.enum(['EXPANSION', 'PEAK', 'CONTRACTION', 'TROUGH'] as const);
export const IndicatorSignalSchema = z.enum(['BULLISH_CROSS', 'BEARISH_CROSS', 'NEUTRAL'] as const);
export const OrderFlowConfirmationSchema = z.enum(['BULLISH', 'BEARISH'] as const);

export const Mag7SymbolSchema = z.enum(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA'] as const);

// Common value validators
const scoreSchema = z.number().min(0).max(10);
const normalizedSchema = z.number().min(0).max(1);
const percentageSchema = z.number().min(-100).max(100);
const correlationSchema = z.number().min(-1).max(1);
const rsiSchema = z.number().min(0).max(100);
const volatilityIndexSchema = z.number().min(0).max(100);
const isoDateTimeSchema = z.string().datetime();
const instrumentSchema = z.string().min(1).max(20);

// ============================================================================
// STEP 1: SECURITY ANALYSIS
// ============================================================================

export const VolatilityFactorSchema = z.object({
  factor: z.string(),
  impact: z.enum(['LOW', 'MEDIUM', 'HIGH'] as const),
});

export const RiskItemSchema = z.object({
  risk: z.string(),
  probability: normalizedSchema,
  impact: normalizedSchema,
});

export const SecurityAnalysisDetailsSchema = z.object({
  summary: z.string().max(500),
  volatilityFactors: z.array(VolatilityFactorSchema).optional(),
  risks: z.array(RiskItemSchema),
  recommendations: z.array(z.string()),
});

export const SecurityAnalysisSchema = z.object({
  volatilityIndex: volatilityIndexSchema,
  riskLevel: RiskLevelSchema,
  securityScore: scoreSchema,
  analysis: SecurityAnalysisDetailsSchema,
  timestamp: isoDateTimeSchema,
  instrument: instrumentSchema,
});

export type SecurityAnalysisRequest = z.infer<typeof SecurityAnalysisSchema>;

// ============================================================================
// STEP 2: MACRO ANALYSIS
// ============================================================================

export const EconomicEventSchema = z.object({
  event: z.string(),
  time: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM format
  importance: EconomicImportanceSchema,
  country: z.string(),
  forecast: z.number().nullable().optional(),
  previous: z.number().nullable().optional(),
  actual: z.number().nullable().optional(),
  impactOnInstrument: z.string().optional(),
});

export const MacroAnalysisDetailsSchema = z.object({
  summary: z.string().max(500),
  centralBankPolicy: z.string().optional(),
  economicCycle: MacroEconomicCycleSchema.optional(),
  keyThemes: z.array(z.string()).optional(),
});

export const MacroAnalysisSchema = z.object({
  economicEvents: z.array(EconomicEventSchema),
  macroScore: scoreSchema,
  sentiment: SentimentLevelSchema,
  analysis: MacroAnalysisDetailsSchema.optional(),
  timestamp: isoDateTimeSchema,
  instrument: instrumentSchema,
});

export type MacroAnalysisRequest = z.infer<typeof MacroAnalysisSchema>;

// ============================================================================
// STEP 3: INSTITUTIONAL FLUX
// ============================================================================

export const VolumeHeatMapSchema = z.object({
  priceLevel: z.string(),
  volume: z.number().positive(),
  intensity: normalizedSchema,
});

export const VolumeProfileSchema = z.object({
  volumeLevel: VolumeLevelSchema,
  trend: VolumeTrendSchema,
  concentration: normalizedSchema,
  heatMap: z.array(VolumeHeatMapSchema).optional(),
});

export const LargeOrdersSchema = z.object({
  buyOrders: z.number().int().nonnegative(),
  sellOrders: z.number().int().nonnegative(),
  ratio: z.number().positive(),
});

export const OrderFlowSchema = z.object({
  buyerDominance: normalizedSchema,
  largeOrders: LargeOrdersSchema.optional(),
  institutionalPressure: InstitutionalPressureSchema.optional(),
});

export const KeyLevelSchema = z.object({
  level: z.number(),
  type: SupportResistanceTypeSchema,
  strength: normalizedSchema,
});

export const InstitutionalFluxDetailsSchema = z.object({
  summary: z.string().max(500).optional(),
  keyLevels: z.array(KeyLevelSchema).optional(),
});

export const InstitutionalFluxSchema = z.object({
  volumeProfile: VolumeProfileSchema,
  orderFlow: OrderFlowSchema,
  fluxScore: scoreSchema,
  analysis: InstitutionalFluxDetailsSchema.optional(),
  timestamp: isoDateTimeSchema,
  instrument: instrumentSchema,
});

export type InstitutionalFluxRequest = z.infer<typeof InstitutionalFluxSchema>;

// ============================================================================
// STEP 4: MAG 7 LEADERS
// ============================================================================

export const Mag7CorrelationSchema = z.object({
  symbol: Mag7SymbolSchema,
  correlation: correlationSchema,
  trend: TrendDirectionSchema,
  performancePercent: percentageSchema.optional(),
  strength: normalizedSchema,
});

export const GroupSentimentSchema = z.object({
  category: z.string(),
  sentiment: SentimentLevelSchema,
});

export const Mag7AnalysisDetailsSchema = z.object({
  summary: z.string().max(500).optional(),
  leaderDynamics: z.string().optional(),
  groupSentiment: z.array(GroupSentimentSchema).optional(),
});

export const Mag7AnalysisSchema = z.object({
  correlations: z.array(Mag7CorrelationSchema),
  leaderScore: scoreSchema,
  sentiment: SentimentLevelSchema,
  analysis: Mag7AnalysisDetailsSchema.optional(),
  timestamp: isoDateTimeSchema,
  instrument: instrumentSchema,
});

export type Mag7AnalysisRequest = z.infer<typeof Mag7AnalysisSchema>;

// ============================================================================
// STEP 5: TECHNICAL STRUCTURE
// ============================================================================

export const SupportLevelSchema = z.object({
  price: z.number(),
  strength: normalizedSchema,
  type: SupportResistanceTypeSchema,
  testedCount: z.number().int().nonnegative().optional(),
});

export const ResistanceLevelSchema = z.object({
  price: z.number(),
  strength: normalizedSchema,
  type: SupportResistanceTypeSchema,
  testedCount: z.number().int().nonnegative().optional(),
});

export const MovingAveragePricesSchema = z.object({
  ma20: z.number().optional(),
  ma50: z.number().optional(),
  ma200: z.number().optional(),
});

export const TrendSchema = z.object({
  direction: PriceTrendDirectionSchema,
  strength: normalizedSchema,
  timeframe: TimeframeSchema,
  maPrices: MovingAveragePricesSchema.optional(),
});

export const TechnicalPatternSchema = z.object({
  pattern: z.string(),
  bullish: z.boolean(),
});

export const MACDSchema = z.object({
  signal: IndicatorSignalSchema.optional(),
  histogram: z.number().optional(),
});

export const TechnicalAnalysisDetailsSchema = z.object({
  summary: z.string().max(500).optional(),
  patterns: z.array(TechnicalPatternSchema).optional(),
  rsi: rsiSchema.optional(),
  macd: MACDSchema.optional(),
});

export const TechnicalStructureSchema = z.object({
  supportLevels: z.array(SupportLevelSchema),
  resistanceLevels: z.array(ResistanceLevelSchema),
  trend: TrendSchema,
  technicalScore: scoreSchema,
  analysis: TechnicalAnalysisDetailsSchema.optional(),
  timestamp: isoDateTimeSchema,
  instrument: instrumentSchema,
});

export type TechnicalStructureRequest = z.infer<typeof TechnicalStructureSchema>;

// ============================================================================
// STEP 6: SYNTHESIS & FINAL BIAS
// ============================================================================

export const OpeningConfirmationSchema = z.object({
  expectedDirection: TrendDirectionSchema,
  confirmationScore: normalizedSchema,
  timeToConfirm: z.string().optional(),
});

export const StepWeightsSchema = z.object({
  security: normalizedSchema.optional(),
  macro: normalizedSchema.optional(),
  flux: normalizedSchema.optional(),
  mag7: normalizedSchema.optional(),
  technical: normalizedSchema.optional(),
});

export const TradingRecommendationsSchema = z.object({
  primary: z.string().optional(),
  targetUpside: z.number().optional(),
  targetDownside: z.number().optional(),
  stopLoss: z.number().optional(),
  riskRewardRatio: z.number().positive().optional(),
});

export const SynthesisAnalysisDetailsSchema = z.object({
  summary: z.string().max(800).optional(),
  stepWeights: StepWeightsSchema.optional(),
  agreementLevel: normalizedSchema.optional(),
  keyThesisPoints: z.array(z.string()).optional(),
  counterArguments: z.array(z.string()).optional(),
  tradingRecommendations: TradingRecommendationsSchema.optional(),
});

export const SynthesisSchema = z.object({
  finalBias: BiasDirectionSchema,
  confidence: normalizedSchema,
  openingConfirmation: OpeningConfirmationSchema,
  analysis: SynthesisAnalysisDetailsSchema.optional(),
  timestamp: isoDateTimeSchema,
  instrument: instrumentSchema,
});

export type SynthesisRequest = z.infer<typeof SynthesisSchema>;

// ============================================================================
// AGGREGATE RESPONSE
// ============================================================================

export const AllAnalysisStepsSchema = z.object({
  security: SecurityAnalysisSchema,
  macro: MacroAnalysisSchema,
  flux: InstitutionalFluxSchema,
  mag7: Mag7AnalysisSchema,
  technical: TechnicalStructureSchema,
  synthesis: SynthesisSchema,
});

export const AnalysisMetadataSchema = z.object({
  processingTime: z.number().nonnegative().optional(),
  cached: z.boolean().optional(),
  fallbackUsed: z.boolean().optional(),
  version: z.string().optional(),
});

export const DailyBiasAnalysisResponseSchema = z.object({
  instrument: instrumentSchema,
  timestamp: isoDateTimeSchema,
  steps: AllAnalysisStepsSchema,
  finalBias: BiasDirectionSchema,
  metadata: AnalysisMetadataSchema.optional(),
});

export type DailyBiasAnalysisResponse = z.infer<typeof DailyBiasAnalysisResponseSchema>;

// ============================================================================
// ERROR RESPONSE
// ============================================================================

export const ErrorCodeSchema = z.enum(['INVALID_INPUT', 'RATE_LIMIT', 'SERVICE_UNAVAILABLE', 'INTERNAL_ERROR'] as const);

export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: ErrorCodeSchema,
  details: z.record(z.unknown()).optional(),
  timestamp: isoDateTimeSchema,
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ============================================================================
// REQUEST TYPES
// ============================================================================

export const AnalysisRequestSchema = z.object({
  instrument: instrumentSchema,
  useCache: z.boolean().optional().default(true),
  forceRefresh: z.boolean().optional().default(false),
});

export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;

export const BatchAnalysisRequestSchema = z.object({
  instruments: z.array(instrumentSchema).min(1).max(100),
  useCache: z.boolean().optional().default(true),
});

export type BatchAnalysisRequest = z.infer<typeof BatchAnalysisRequestSchema>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validates and parses an incoming Analysis Request
 */
export function validateAnalysisRequest(data: unknown): AnalysisRequest {
  return AnalysisRequestSchema.parse(data);
}

/**
 * Validates and parses a Daily Bias Analysis Response
 */
export function validateAnalysisResponse(data: unknown): DailyBiasAnalysisResponse {
  return DailyBiasAnalysisResponseSchema.parse(data);
}

/**
 * Validates and parses error responses
 */
export function validateErrorResponse(data: unknown): ErrorResponse {
  return ErrorResponseSchema.parse(data);
}

/**
 * Safe validation with error handling
 */
export function safeValidateAnalysisResponse(data: unknown) {
  const result = DailyBiasAnalysisResponseSchema.safeParse(data);
  if (!result.success) {
    console.error('Validation error:', result.error);
    return null;
  }
  return result.data;
}

// ============================================================================
// PARTIAL VALIDATORS
// ============================================================================

/**
 * Validators for individual steps (useful for incremental updates)
 */
export const StepValidators = {
  security: SecurityAnalysisSchema,
  macro: MacroAnalysisSchema,
  flux: InstitutionalFluxSchema,
  mag7: Mag7AnalysisSchema,
  technical: TechnicalStructureSchema,
  synthesis: SynthesisSchema,
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  // Common types already exported from the Zod infer above
  SecurityAnalysisRequest,
  MacroAnalysisRequest,
  InstitutionalFluxRequest,
  Mag7AnalysisRequest,
  TechnicalStructureRequest,
  SynthesisRequest,
  AnalysisRequest,
  BatchAnalysisRequest,
  DailyBiasAnalysisResponse,
  ErrorResponse,
};

