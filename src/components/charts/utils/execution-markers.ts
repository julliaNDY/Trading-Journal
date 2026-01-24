import { ExecutionMarker } from '@/lib/types/execution';

export const EXECUTION_STYLES = {
  buy: {
    arrowColor: '#2962FF',
    textColor: '#FFFFFF',
    label: 'Entry',
  },
  sell: {
    arrowColor: '#F23645',
    textColor: '#FFFFFF',
    label: 'Exit',
  },
};

export function buildExecutionLabel(marker: ExecutionMarker): string {
  const price = marker.price.toFixed(2);
  if (marker.pnlUsd !== undefined) {
    const pnlStr = marker.pnlUsd >= 0 ? `+${marker.pnlUsd}` : `${marker.pnlUsd}`;
    return `${marker.text ?? EXECUTION_STYLES[marker.side].label} @ ${price} (${pnlStr})`;
  }
  return `${marker.text ?? EXECUTION_STYLES[marker.side].label} @ ${price}`;
}

export function buildExecutionTooltip(marker: ExecutionMarker): string {
  const lines = [];
  lines.push(`${marker.side.toUpperCase()}: ${marker.qty ?? '?'} @ ${marker.price.toFixed(2)}`);
  lines.push(`Time: ${new Date(marker.time * 1000).toLocaleTimeString()}`);
  if (marker.pnlUsd !== undefined) {
    lines.push(`P&L: ${marker.pnlUsd >= 0 ? '+' : ''}${marker.pnlUsd.toFixed(2)} USD`);
  }
  if (marker.riskRewardRatio !== undefined) {
    lines.push(`R:R: ${marker.riskRewardRatio.toFixed(2)}`);
  }
  return lines.join('\n');
}
