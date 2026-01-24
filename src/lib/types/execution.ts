export interface ExecutionMarker {
  id: string;
  symbol: string;
  time: number;
  price: number;
  side: 'buy' | 'sell';
  qty?: number;
  entryPrice?: number;
  exitPrice?: number;
  pnlUsd?: number;
  riskRewardRatio?: number;
  text?: string;
  tooltip?: string;
  arrowColor?: string;
  textColor?: string;
}

export interface ChartState {
  symbol: string;
  timeframe: string;
  executionsById: Map<string, any>;
}
