/**
 * Instrument Selector Component
 * 
 * Multi-select dropdown for choosing instruments to analyze
 * Displays 21 supported instruments with search functionality
 */

'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ValidInstrument } from '@/types/daily-bias';

// ============================================================================
// CONSTANTS
// ============================================================================

export const INSTRUMENTS: { value: ValidInstrument; label: string; category: string }[] = [
  // Futures
  { value: 'NQ1', label: 'NQ1 (Nasdaq Futures)', category: 'Futures' },
  { value: 'ES1', label: 'ES1 (S&P 500 Futures)', category: 'Futures' },
  
  // Stocks
  { value: 'TSLA', label: 'TSLA (Tesla)', category: 'Stocks' },
  { value: 'NVDA', label: 'NVDA (Nvidia)', category: 'Stocks' },
  { value: 'AMD', label: 'AMD (AMD)', category: 'Stocks' },
  { value: 'AAPL', label: 'AAPL (Apple)', category: 'Stocks' },
  { value: 'PLTR', label: 'PLTR (Palantir)', category: 'Stocks' },
  { value: 'AMZN', label: 'AMZN (Amazon)', category: 'Stocks' },
  { value: 'MSFT', label: 'MSFT (Microsoft)', category: 'Stocks' },
  { value: 'META', label: 'META (Meta)', category: 'Stocks' },
  { value: 'GME', label: 'GME (GameStop)', category: 'Stocks' },
  
  // ETFs
  { value: 'SPY', label: 'SPY (S&P 500 ETF)', category: 'ETFs' },
  { value: 'TQQQ', label: 'TQQQ (3x Nasdaq ETF)', category: 'ETFs' },
  { value: 'SOXL', label: 'SOXL (3x Semiconductors)', category: 'ETFs' },
  { value: 'QQQ', label: 'QQQ (Nasdaq-100 ETF)', category: 'ETFs' },
  { value: 'SQQQ', label: 'SQQQ (3x Inverse Nasdaq)', category: 'ETFs' },
  
  // Crypto
  { value: 'BTC', label: 'BTC (Bitcoin)', category: 'Crypto' },
  { value: 'COIN', label: 'COIN (Coinbase)', category: 'Crypto' },
  { value: 'MSTR', label: 'MSTR (MicroStrategy)', category: 'Crypto' },
  { value: 'MARA', label: 'MARA (Marathon Digital)', category: 'Crypto' },
  
  // Forex
  { value: 'XAU/USD', label: 'XAU/USD (Gold)', category: 'Forex' },
  { value: 'EUR/USD', label: 'EUR/USD (Euro)', category: 'Forex' },
];

// ============================================================================
// TYPES
// ============================================================================

interface InstrumentSelectorProps {
  value: ValidInstrument | null;
  onChange: (value: ValidInstrument) => void;
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function InstrumentSelector({ 
  value, 
  onChange, 
  disabled = false,
  className = ''
}: InstrumentSelectorProps) {
  const [open, setOpen] = useState(false);
  
  const selected = value ? INSTRUMENTS.find((i) => i.value === value) : null;
  
  // Group instruments by category
  const categories = INSTRUMENTS.reduce((acc, instrument) => {
    if (!acc[instrument.category]) {
      acc[instrument.category] = [];
    }
    acc[instrument.category].push(instrument);
    return acc;
  }, {} as Record<string, typeof INSTRUMENTS>);
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {selected ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {selected.category}
              </Badge>
              <span>{selected.label}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Select instrument...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput placeholder="Search instruments..." />
          <CommandEmpty>No instrument found.</CommandEmpty>
          
          <div className="max-h-[500px] overflow-y-auto">
            {Object.entries(categories).map(([category, instruments]) => (
              <CommandGroup key={category} heading={category}>
                {instruments.map((instrument) => (
                  <CommandItem
                    key={instrument.value}
                    value={instrument.value}
                    onSelect={() => {
                      // Use instrument.value directly instead of currentValue (cmdk lowercases it)
                      onChange(instrument.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === instrument.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {instrument.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
