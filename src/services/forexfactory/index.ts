/**
 * ForexFactory Service Index
 * 
 * @module services/forexfactory
 */

export {
  fetchForexFactoryEvents,
  filterEventsByDateRange,
  filterEventsByImportance,
  filterEventsByInstrument,
} from './forexfactory-service';

// Re-export EconomicEvent type from prompts
export type { EconomicEvent } from '@/lib/prompts/macro-analysis-prompt';
