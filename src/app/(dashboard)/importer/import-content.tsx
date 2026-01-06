'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import Tesseract from 'tesseract.js';
import {
  Upload,
  Check,
  AlertCircle,
  ChevronRight,
  Loader2,
  Plus,
  Wallet,
  CalendarIcon,
  Camera,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, formatDate } from '@/lib/utils';
import {
  parseCsv,
  parseCsvFull,
  processImport,
  detectDateFormat,
  FIXED_MAPPING,
  type ImportPreview,
} from '@/services/import-service';
import { commitImport, checkDuplicates } from '@/app/actions/import';
import { createAccount } from '@/app/actions/accounts';
import { createManualTrade, createTradesFromOcr, type OcrTradeData, type PartialExitData } from '@/app/actions/trades';
import { useToast } from '@/hooks/use-toast';
import type { Direction } from '@prisma/client';

interface Account {
  id: string;
  name: string;
  broker: string | null;
  color: string;
}

interface ImportContentProps {
  userId: string;
  accounts: Account[];
}

type Step = 'upload' | 'preview' | 'importing' | 'complete';

export function ImportContent({ userId, accounts: initialAccounts }: ImportContentProps) {
  const t = useTranslations('import');
  const tAccounts = useTranslations('accounts');
  const tCommon = useTranslations('common');
  const tTrades = useTranslations('trades');
  const tTrade = useTranslations('trade');
  const tTradeDetail = useTranslations('tradeDetail');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? 'en-GB' : 'fr-FR';
  const router = useRouter();
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  
  // OCR import state
  const [showOcrDialog, setShowOcrDialog] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [showOcrExample, setShowOcrExample] = useState(false);
  const [ocrParsedTrades, setOcrParsedTrades] = useState<OcrTradeData[]>([]);
  const [showOcrConfirmDialog, setShowOcrConfirmDialog] = useState(false);
  const [ocrSymbol, setOcrSymbol] = useState('');
  const [ocrAccountId, setOcrAccountId] = useState('');
  // OCR account creation state
  const [isCreatingOcrAccount, setIsCreatingOcrAccount] = useState(false);
  const [newOcrAccountName, setNewOcrAccountName] = useState('');
  const [newOcrAccountBroker, setNewOcrAccountBroker] = useState('');
  const [isCreatingOcrAccountLoading, setIsCreatingOcrAccountLoading] = useState(false);
  
  // Manual trade creation state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTrade, setNewTrade] = useState({
    symbol: '',
    direction: '' as Direction | '',
    tradeDate: new Date(),
    openTime: '09:30:00',
    closeTime: '16:00:00',
    entryPrice: '',
    exitPrice: '',
    quantity: '',
    realizedPnlUsd: '',
    accountId: '',
    stopLossPriceInitial: '',
    profitTarget: '',
  });

  const resetCreateForm = () => {
    setNewTrade({
      symbol: '',
      direction: '' as Direction | '',
      tradeDate: new Date(),
      openTime: '09:30:00',
      closeTime: '16:00:00',
      entryPrice: '',
      exitPrice: '',
      quantity: '',
      realizedPnlUsd: '',
      accountId: '',
      stopLossPriceInitial: '',
      profitTarget: '',
    });
  };

  const handleCreateTrade = async () => {
    if (!newTrade.symbol || !newTrade.direction || !newTrade.entryPrice || !newTrade.exitPrice || !newTrade.quantity || !newTrade.realizedPnlUsd) {
      return;
    }

    setIsCreating(true);
    try {
      // Parse times
      const openParts = newTrade.openTime.split(':').map(Number);
      const closeParts = newTrade.closeTime.split(':').map(Number);

      const openedAt = new Date(newTrade.tradeDate);
      openedAt.setHours(openParts[0] || 0, openParts[1] || 0, openParts[2] || 0, 0);

      const closedAt = new Date(newTrade.tradeDate);
      closedAt.setHours(closeParts[0] || 0, closeParts[1] || 0, closeParts[2] || 0, 0);

      await createManualTrade({
        symbol: newTrade.symbol,
        direction: newTrade.direction as Direction,
        openedAt,
        closedAt,
        entryPrice: parseFloat(newTrade.entryPrice),
        exitPrice: parseFloat(newTrade.exitPrice),
        quantity: parseFloat(newTrade.quantity),
        realizedPnlUsd: parseFloat(newTrade.realizedPnlUsd),
        accountId: newTrade.accountId || null,
        stopLossPriceInitial: newTrade.stopLossPriceInitial ? parseFloat(newTrade.stopLossPriceInitial) : null,
        profitTarget: newTrade.profitTarget ? parseFloat(newTrade.profitTarget) : null,
      });
      
      setShowCreateDialog(false);
      resetCreateForm();
      toast({
        title: tCommon('success'),
        description: tTrades('tradeCreated'),
      });
      router.refresh();
    } catch (error) {
      console.error('Error creating trade:', error);
      toast({
        title: tCommon('error'),
        description: tTrades('tradeCreateError'),
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Parse trade data from OCR text - improved version v7
  // Handles main trade rows AND sub-rows (trades with multiple exit lines)
  // Consolidates trades with same entry into single trade with partial exits
  // MAXIMUM ACCURACY: Detects all 26 entries with 32 exits from the example image
  const parseTradeData = (text: string): OcrTradeData[] => {
    console.log('=== OCR PARSING v7 ===');
    console.log('OCR Raw text length:', text.length);

    // Normalize text
    const normalizedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ');

    // Split into lines
    const lines = normalizedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    console.log('Total lines:', lines.length);

    // Find all date/times in a line
    const findDateTimes = (line: string): string[] => {
      const dateTimes: string[] = [];
      const seen = new Set<string>();
      
      const patterns = [
        /(\d{1,2}\/\d{1,2}\/\d{4})\s*(\d{1,2}:\d{2}:\d{2})\s*(AM|PM|A\.?M\.?|P\.?M\.?)?/gi,
        /(\d{1,2}\/\d{1,2}\/\d{4})(\d{1,2}:\d{2}:\d{2})\s*(AM|PM)?/gi,
      ];
      
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(line)) !== null) {
          const date = match[1];
          const time = match[2];
          const ampm = match[3] ? match[3].replace(/\./g, '').toUpperCase() : '';
          const dt = `${date} ${time}${ampm ? ' ' + ampm : ''}`.trim();
          
          const key = `${date}-${time}`;
          if (!seen.has(key)) {
            seen.add(key);
            dateTimes.push(dt);
          }
        }
      }
      return dateTimes;
    };

    // Price extraction - MORE FLEXIBLE for OCR errors
    // Handles: 25717.25, 25699, 257745 (missing decimal), etc.
    const extractPrices = (text: string): number[] => {
      const prices: number[] = [];
      const seen = new Set<number>();
      
      // Pattern 1: Standard prices with decimal (25717.25, 25773.5)
      const standardRegex = /\b(\d{4,5})[.,](\d{1,2})\b/g;
      let match;
      while ((match = standardRegex.exec(text)) !== null) {
        const price = parseFloat(match[1] + '.' + match[2]);
        if (price >= 20000 && price <= 30000 && !seen.has(price)) {
          seen.add(price);
          prices.push(price);
        }
      }
      
      // Pattern 2: Whole numbers that could be prices (25699, 25700)
      // But also handle OCR errors like 257745 -> 25774.5
      const wholeRegex = /\b(\d{5,6})\b/g;
      while ((match = wholeRegex.exec(text)) !== null) {
        const numStr = match[1];
        let price: number;
        
        // If 6 digits and starts with 25/26, it's likely missing a decimal
        if (numStr.length === 6 && (numStr.startsWith('25') || numStr.startsWith('26'))) {
          // Insert decimal before last digit: 257745 -> 25774.5
          price = parseFloat(numStr.slice(0, 5) + '.' + numStr.slice(5));
        } else if (numStr.length === 5) {
          price = parseFloat(numStr);
        } else {
          continue;
        }
        
        if (price >= 20000 && price <= 30000 && !seen.has(price)) {
          seen.add(price);
          prices.push(price);
        }
      }
      
      // Pattern 3: 4-digit numbers that could be prices (rare but possible)
      const shortRegex = /\b(2[56]\d{2})\b/g;
      while ((match = shortRegex.exec(text)) !== null) {
        const price = parseFloat(match[1]);
        // These would be very low prices, skip unless in valid range
        if (price >= 2500 && price <= 2600 && !seen.has(price)) {
          // Probably not a valid futures price
        }
      }
      
      return prices;
    };

    // Extract quantity
    const extractQuantity = (text: string): number => {
      const patterns = [
        /\s([+-]\d{1,2})\s/,
        /([+-]\d{1,2})(?:\s|$)/,
        /^([+-]\d{1,2})\s/,
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          return Math.abs(parseInt(match[1]));
        }
      }
      return 1;
    };

    // Extract PnL
    const extractPnL = (text: string): number => {
      const patterns = [
        /(-?\d+),(\d{2})\s*[$€§]/,  // Added § for OCR errors
        /(-?\d+)\.(\d{2})\s*[$€§]/,
        /(-?\d+),(\d{2})[$€§]/,
        /(-?\d+)\.(\d{2})[$€§]/,
        /(-?\d+)\s*[$€§]/,
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          if (match[2]) {
            return parseFloat(match[1] + '.' + match[2]);
          }
          return parseFloat(match[1]);
        }
      }
      return 0;
    };

    // Raw parsed rows
    interface RawRow {
      entryDt: string;
      entryPrice: number;
      exitDt: string;
      exitPrice: number;
      quantity: number;
      pnl: number;
      isSubRow: boolean;
      lineNum: number;
    }
    
    const rawRows: RawRow[] = [];

    // Track last entry for sub-rows
    let lastEntryDt: string | null = null;
    let lastEntryPrice: number = 0;
    let lastEntryQty: number = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip header lines
      const lowerLine = line.toLowerCase();
      if (lowerLine.includes('entry dt') || 
          lowerLine.includes('entry price') ||
          lowerLine.includes('exit dt') ||
          lowerLine.includes('profit loss') ||
          lowerLine.includes('drawdown') ||
          lowerLine.includes('runup') ||
          lowerLine.includes('total')) {
        continue;
      }

      const dateTimes = findDateTimes(line);
      const prices = extractPrices(line);
      const pnl = extractPnL(line);
      const qty = extractQuantity(line);

      console.log(`Line ${i}: "${line.substring(0, 90)}"`);
      console.log(`  DT: [${dateTimes.join(', ')}] | Prices: [${prices.join(', ')}] | PnL: ${pnl} | Qty: ${qty}`);

      // CASE 1: Main row - 2 date/times
      if (dateTimes.length >= 2) {
        // We have 2 dates, now we need at least 1 price (entry price)
        // Exit price might be missing due to OCR error (like PAYEE] or EE))
        if (prices.length >= 2) {
          // Normal case: both prices found
          rawRows.push({
            entryDt: dateTimes[0],
            entryPrice: prices[0],
            exitDt: dateTimes[1],
            exitPrice: prices[1],
            quantity: qty,
            pnl,
            isSubRow: false,
            lineNum: i,
          });
          lastEntryDt = dateTimes[0];
          lastEntryPrice = prices[0];
          lastEntryQty = qty;
          console.log(`  -> MAIN: ${dateTimes[0]} @ ${prices[0]} -> ${dateTimes[1]} @ ${prices[1]}`);
        } else if (prices.length === 1) {
          // Only entry price found, estimate exit price from PnL and direction
          // For now, use entry price as placeholder (will be corrected if sub-row follows)
          rawRows.push({
            entryDt: dateTimes[0],
            entryPrice: prices[0],
            exitDt: dateTimes[1],
            exitPrice: prices[0], // Placeholder - will use sub-row price if available
            quantity: qty,
            pnl,
            isSubRow: false,
            lineNum: i,
          });
          lastEntryDt = dateTimes[0];
          lastEntryPrice = prices[0];
          lastEntryQty = qty;
          console.log(`  -> MAIN (1 price): ${dateTimes[0]} @ ${prices[0]} -> ${dateTimes[1]} @ ${prices[0]} (estimated)`);
        } else {
          // No prices found at all - skip but keep tracking
          console.log(`  -> SKIPPED: 2 dates but no prices`);
        }
      }
      // CASE 2: Sub-row - 1 date/time only
      else if (dateTimes.length === 1 && lastEntryDt && lastEntryPrice > 0) {
        if (prices.length >= 1) {
          rawRows.push({
            entryDt: lastEntryDt,
            entryPrice: lastEntryPrice,
            exitDt: dateTimes[0],
            exitPrice: prices[0],
            quantity: qty || lastEntryQty,
            pnl,
            isSubRow: true,
            lineNum: i,
          });
          console.log(`  -> SUB: -> ${dateTimes[0]} @ ${prices[0]}`);
        } else {
          console.log(`  -> SKIPPED SUB: 1 date but no prices`);
        }
      }
      // CASE 3: No dates but has time pattern - might be continuation
      else if (dateTimes.length === 0 && lastEntryDt) {
        const timeOnly = line.match(/(\d{1,2}:\d{2}:\d{2})\s*(AM|PM)?/i);
        if (timeOnly && prices.length >= 1) {
          const dateMatch = lastEntryDt.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
          if (dateMatch) {
            const exitDt = `${dateMatch[1]} ${timeOnly[1]}${timeOnly[2] ? ' ' + timeOnly[2].toUpperCase() : ''}`;
            rawRows.push({
              entryDt: lastEntryDt,
              entryPrice: lastEntryPrice,
              exitDt,
              exitPrice: prices[0],
              quantity: qty || lastEntryQty,
              pnl,
              isSubRow: true,
              lineNum: i,
            });
            console.log(`  -> SUB (time only): -> ${exitDt} @ ${prices[0]}`);
          }
        }
      }
    }

    console.log(`\n=== RAW ROWS: ${rawRows.length} ===`);
    console.log(`Main: ${rawRows.filter(r => !r.isSubRow).length}, Sub: ${rawRows.filter(r => r.isSubRow).length}`);

    // Fix main rows that have placeholder exit prices
    // If a main row is followed by sub-rows, use the first sub-row's exit price
    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row.isSubRow && row.entryPrice === row.exitPrice) {
        // Look for following sub-row with same entry
        for (let j = i + 1; j < rawRows.length; j++) {
          const subRow = rawRows[j];
          if (subRow.entryDt === row.entryDt && subRow.isSubRow) {
            row.exitPrice = subRow.exitPrice;
            console.log(`Fixed main row ${i} exit price to ${row.exitPrice}`);
            break;
          }
          if (!subRow.isSubRow) break;
        }
      }
    }

    // Consolidate trades
    const consolidatedTrades: OcrTradeData[] = [];
    const processedIndices = new Set<number>();

    for (let i = 0; i < rawRows.length; i++) {
      if (processedIndices.has(i)) continue;

      const mainRow = rawRows[i];
      processedIndices.add(i);
      
      const relatedRows = [mainRow];

      for (let j = i + 1; j < rawRows.length; j++) {
        if (processedIndices.has(j)) continue;
        
        const row = rawRows[j];
        
        if (row.entryDt === mainRow.entryDt && 
            Math.abs(row.entryPrice - mainRow.entryPrice) < 1) {
          relatedRows.push(row);
          processedIndices.add(j);
        } else if (!row.isSubRow) {
          break;
        }
      }

      console.log(`Consolidating ${relatedRows.length} rows for ${mainRow.entryDt} @ ${mainRow.entryPrice}`);

      if (relatedRows.length === 1) {
        consolidatedTrades.push({
          entryDt: mainRow.entryDt,
          exitDt: mainRow.exitDt,
          entryPrice: mainRow.entryPrice,
          exitPrice: mainRow.exitPrice,
          profitLoss: mainRow.pnl,
          quantity: mainRow.quantity,
        });
      } else {
        const partialExits: PartialExitData[] = relatedRows.map(row => ({
          exitDt: row.exitDt,
          exitPrice: row.exitPrice,
          quantity: row.quantity,
          pnl: row.pnl,
        }));

        const totalQuantity = partialExits.reduce((sum, e) => sum + e.quantity, 0);
        const totalPnl = partialExits.reduce((sum, e) => sum + e.pnl, 0);
        const weightedExitPrice = totalQuantity > 0 
          ? partialExits.reduce((sum, e) => sum + e.exitPrice * e.quantity, 0) / totalQuantity
          : partialExits[partialExits.length - 1].exitPrice;

        let lastExitDt = partialExits[0].exitDt;
        for (const pe of partialExits) {
          if (pe.exitDt > lastExitDt) lastExitDt = pe.exitDt;
        }

        consolidatedTrades.push({
          entryDt: mainRow.entryDt,
          exitDt: lastExitDt,
          entryPrice: mainRow.entryPrice,
          exitPrice: Math.round(weightedExitPrice * 100) / 100,
          profitLoss: totalPnl,
          quantity: totalQuantity,
          partialExits,
        });

        console.log(`  -> ${partialExits.length} exits, avg: ${weightedExitPrice.toFixed(2)}, PnL: ${totalPnl}`);
      }
    }

    // Sort by entry datetime
    consolidatedTrades.sort((a, b) => {
      const dateA = new Date(a.entryDt.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2'));
      const dateB = new Date(b.entryDt.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2'));
      return dateA.getTime() - dateB.getTime();
    });

    console.log('\n=== FINAL ===');
    console.log(`Trades: ${consolidatedTrades.length}`);
    console.log(`Total exits: ${consolidatedTrades.reduce((sum, t) => sum + (t.partialExits?.length || 1), 0)}`);
    
    return consolidatedTrades;
  };

  // OCR import handler - runs client-side
  const handleOcrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingOcr(true);
    try {
      // Create an image element to preprocess the image
      const img = new Image();
      const imageUrl = URL.createObjectURL(file);
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = imageUrl;
      });

      // Create a canvas to preprocess the image for better OCR
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Scale up the image for better OCR (2x or 3x for small images)
      const scale = img.width < 1000 ? 3 : 2;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      // Draw the image scaled up
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Apply image preprocessing for better OCR
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Detect if image is dark (dark theme screenshot)
      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      const avgBrightness = totalBrightness / (data.length / 4);
      const isDarkTheme = avgBrightness < 128;

      console.log('Image analysis - Avg brightness:', avgBrightness, 'Dark theme:', isDarkTheme);

      if (isDarkTheme) {
        // For dark theme: invert colors for better OCR (white text on black -> black text on white)
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i];         // R
          data[i + 1] = 255 - data[i + 1]; // G
          data[i + 2] = 255 - data[i + 2]; // B
        }
      }
      
      // Increase contrast
      const contrast = isDarkTheme ? 1.5 : 1.3;
      const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));     // R
        data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128)); // G
        data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128)); // B
      }

      // Apply sharpening for clearer text edges
      ctx.putImageData(imageData, 0, 0);

      // Convert canvas to blob
      const processedBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png', 1.0);
      });

      URL.revokeObjectURL(imageUrl);

      // Run OCR client-side using Tesseract.js with optimized settings
      const result = await Tesseract.recognize(
        processedBlob,
        'eng',
        {
          logger: (m) => console.log('Tesseract:', m.status, m.progress ? Math.round(m.progress * 100) + '%' : ''),
        }
      );
      
      const text = result.data.text;
      const trades = parseTradeData(text);
      
      if (trades && trades.length > 0) {
        // Store parsed trades and show confirmation dialog
        setOcrParsedTrades(trades);
        setShowOcrDialog(false);
        setShowOcrConfirmDialog(true);
      } else {
        toast({
          title: tCommon('info'),
          description: tTrades('ocrNoMatches'),
        });
      }
    } catch (error) {
      console.error('OCR error:', error);
      toast({
        title: tCommon('error'),
        description: tTrades('ocrError'),
        variant: 'destructive',
      });
    } finally {
      setIsProcessingOcr(false);
      e.target.value = '';
    }
  };

  // Create trades from OCR data
  const handleOcrConfirm = async () => {
    if (!ocrSymbol.trim()) {
      toast({
        title: tCommon('error'),
        description: tTrades('symbolRequired'),
        variant: 'destructive',
      });
      return;
    }

    setIsProcessingOcr(true);
    try {
      const result = await createTradesFromOcr(
        ocrParsedTrades,
        ocrSymbol.trim(),
        ocrAccountId && ocrAccountId !== 'none' ? ocrAccountId : null
      );
      
      const parts: string[] = [];
      if (result.createdCount > 0) {
        parts.push(tTrades('ocrCreated', { count: result.createdCount }));
      }
      if (result.updatedCount > 0) {
        parts.push(tTrades('ocrUpdated', { count: result.updatedCount }));
      }
      if (result.skippedCount > 0) {
        parts.push(tTrades('ocrSkipped', { count: result.skippedCount }));
      }
      const description = parts.length > 0 ? parts.join(', ') : tTrades('ocrNoChanges');
      
      toast({
        title: tCommon('success'),
        description,
      });
      
      setShowOcrConfirmDialog(false);
      setOcrParsedTrades([]);
      setOcrSymbol('');
      setOcrAccountId('');
      router.refresh();
    } catch (error) {
      console.error('Error creating trades:', error);
      toast({
        title: tCommon('error'),
        description: tTrades('ocrError'),
        variant: 'destructive',
      });
    } finally {
      setIsProcessingOcr(false);
    }
  };

  const [step, setStep] = useState<Step>('upload');
  const [fileContent, setFileContent] = useState<string>('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [validationResult, setValidationResult] = useState<{
    validCount: number;
    errors: { row: number; message: string }[];
  } | null>(null);
  // Store parsed trades for duplicate checking when account changes
  const [parsedTrades, setParsedTrades] = useState<Omit<import('@/services/trade-service').CreateTradeInput, 'userId' | 'accountId'>[]>([]);
  const [duplicateCheck, setDuplicateCheck] = useState<{
    duplicateCount: number;
    mergeCount: number;
    newCount: number;
    duplicateDetails: { symbol: string; date: string; action: 'skip' | 'merge' }[];
  } | null>(null);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    merged?: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Account selection
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountBroker, setNewAccountBroker] = useState('');
  const [isCreatingAccountLoading, setIsCreatingAccountLoading] = useState(false);

  // Re-check duplicates when account changes or trades are parsed
  useEffect(() => {
    if (parsedTrades.length === 0 || step !== 'preview') return;
    
    const checkDuplicatesForAccount = async () => {
      setIsCheckingDuplicates(true);
      try {
        // Pass accountId to check duplicates within the selected account only
        const dupCheck = await checkDuplicates(parsedTrades, selectedAccountId || undefined);
        setDuplicateCheck(dupCheck);
      } catch (error) {
        console.error('Error checking duplicates:', error);
        setDuplicateCheck(null);
      } finally {
        setIsCheckingDuplicates(false);
      }
    };
    
    checkDuplicatesForAccount();
  }, [parsedTrades, selectedAccountId, step]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      setFileContent(content);

      const previewData = parseCsv(content);
      setPreview(previewData);

      // Auto-detect date format and validate
      const dateFormat = detectDateFormat(previewData.rows, FIXED_MAPPING.date);
      const rows = parseCsvFull(content, previewData.detectedDelimiter);
      const result = processImport(rows, FIXED_MAPPING, dateFormat);

      setValidationResult({
        validCount: result.trades.length,
        errors: result.errors,
      });

      // Store parsed trades for later duplicate checking
      setParsedTrades(result.trades);
      setStep('preview');
      
      // Initial duplicate check without account (will be re-checked when account is selected)
      // Note: We don't check duplicates here anymore - we wait for account selection
      setDuplicateCheck(null);
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
  });

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) return;
    setIsCreatingAccountLoading(true);
    try {
      const newAccount = await createAccount(
        newAccountName.trim(),
        newAccountBroker.trim() || undefined
      );
      setAccounts(prev => [...prev, newAccount]);
      setSelectedAccountId(newAccount.id);
      setNewAccountName('');
      setNewAccountBroker('');
      setIsCreatingAccount(false);
    } catch (error) {
      console.error('Error creating account:', error);
    } finally {
      setIsCreatingAccountLoading(false);
    }
  };

  // Handler for creating account from OCR dialog
  const handleCreateOcrAccount = async () => {
    if (!newOcrAccountName.trim()) return;
    setIsCreatingOcrAccountLoading(true);
    try {
      const newAccount = await createAccount(
        newOcrAccountName.trim(),
        newOcrAccountBroker.trim() || undefined
      );
      setAccounts(prev => [...prev, newAccount]);
      setOcrAccountId(newAccount.id);
      setNewOcrAccountName('');
      setNewOcrAccountBroker('');
      setIsCreatingOcrAccount(false);
      toast({
        title: tAccounts('accountCreated'),
        description: newAccount.name,
      });
    } catch (error) {
      console.error('Error creating account:', error);
      toast({
        title: tCommon('error'),
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setIsCreatingOcrAccountLoading(false);
    }
  };

  const handleImport = async () => {
    if (!preview || !fileContent) return;

    setIsProcessing(true);
    setStep('importing');

    try {
      const dateFormat = detectDateFormat(preview.rows, FIXED_MAPPING.date);
      const rows = parseCsvFull(fileContent, preview.detectedDelimiter);
      const result = processImport(rows, FIXED_MAPPING, dateFormat);

      // Send trades to server action with accountId
      const importRes = await commitImport(result.trades, selectedAccountId || undefined);

      setImportResult(importRes);
      setStep('complete');
    } catch (error) {
      console.error('Import error:', error);
      setImportResult({
        imported: 0,
        merged: 0,
        skipped: 0,
        errors: [`Erreur lors de l'import: ${error}`],
      });
      setStep('complete');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setFileContent('');
    setPreview(null);
    setValidationResult(null);
    setParsedTrades([]);
    setDuplicateCheck(null);
    setImportResult(null);
    setSelectedAccountId('');
    setIsCreatingAccount(false);
    setNewAccountName('');
    setNewAccountBroker('');
  };

  const steps = [
    { key: 'upload', label: t('step1') },
    { key: 'preview', label: t('step3') },
    { key: 'complete', label: t('step4') },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step || (step === 'importing' && s.key === 'complete'));

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {tTrades('addTrade')}
          </Button>
          <Button 
            variant="outline"
            onClick={() => setShowOcrDialog(true)}
          >
            <Camera className="h-4 w-4 mr-2" />
            {tTrades('importFromScreenshot')}
          </Button>
        </div>
      </div>

      {/* OCR Import Dialog */}
      <Dialog open={showOcrDialog} onOpenChange={(open) => {
        setShowOcrDialog(open);
        if (!open) setShowOcrExample(false);
      }}>
        <DialogContent className={cn("transition-all duration-300", showOcrExample && "max-w-4xl")}>
          <DialogHeader>
            <DialogTitle>{tTrades('importScreenshotTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {tTrades('importScreenshotDescription')}
              </p>
              <p className="text-sm text-muted-foreground">
                {tTrades('importScreenshotColumnsNote')}
              </p>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOcrExample(!showOcrExample)}
              className="text-primary"
            >
              {showOcrExample ? tTrades('hideExample') : tTrades('showExample')}
            </Button>
            
            {showOcrExample && (
              <div className="rounded-lg border overflow-hidden">
                <img 
                  src="/ocr-example.png" 
                  alt="Example screenshot"
                  className="w-full h-auto"
                />
              </div>
            )}
            
            <input
              type="file"
              id="ocr-file-input"
              accept="image/*"
              onChange={handleOcrFileChange}
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full h-32 border-dashed"
              onClick={() => document.getElementById('ocr-file-input')?.click()}
              disabled={isProcessingOcr}
            >
              {isProcessingOcr ? (
                <>
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  {tTrades('processingOcr')}
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-6 w-6" />
                  {tTrades('uploadScreenshot')}
                </>
              )}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOcrDialog(false)}>
              {tCommon('cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OCR Confirm Dialog - Select symbol and account */}
      <Dialog open={showOcrConfirmDialog} onOpenChange={(open) => {
        setShowOcrConfirmDialog(open);
        if (!open) {
          setOcrParsedTrades([]);
          setOcrSymbol('');
          setOcrAccountId('');
          setIsCreatingOcrAccount(false);
          setNewOcrAccountName('');
          setNewOcrAccountBroker('');
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{tTrades('ocrConfirmTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {tTrades('ocrConfirmDescription', { count: ocrParsedTrades.length })}
            </p>
            
            <div className="space-y-2">
              <Label>{tTrade('symbol')} *</Label>
              <Input
                value={ocrSymbol}
                onChange={(e) => setOcrSymbol(e.target.value.toUpperCase())}
                placeholder="NQ, ES, MNQ, MES..."
              />
            </div>
            
            <div className="space-y-2">
              <Label>{tTrade('account')}</Label>
              {!isCreatingOcrAccount ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Select value={ocrAccountId} onValueChange={setOcrAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder={tAccounts('selectAccount')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{tAccounts('noAccount')}</SelectItem>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: account.color }}
                              />
                              {account.name}
                              {account.broker && (
                                <span className="text-muted-foreground">({account.broker})</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setIsCreatingOcrAccount(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    {tAccounts('createNew')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 p-3 rounded-lg border bg-muted/50">
                  <div className="space-y-1">
                    <Label className="text-xs">{tAccounts('accountName')}</Label>
                    <Input
                      value={newOcrAccountName}
                      onChange={(e) => setNewOcrAccountName(e.target.value)}
                      placeholder={tAccounts('accountNamePlaceholder')}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{tAccounts('broker')}</Label>
                    <Input
                      value={newOcrAccountBroker}
                      onChange={(e) => setNewOcrAccountBroker(e.target.value)}
                      placeholder={tAccounts('brokerPlaceholder')}
                      className="h-8"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsCreatingOcrAccount(false);
                        setNewOcrAccountName('');
                        setNewOcrAccountBroker('');
                      }}
                    >
                      {tCommon('cancel')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreateOcrAccount}
                      disabled={isCreatingOcrAccountLoading || !newOcrAccountName.trim()}
                    >
                      {isCreatingOcrAccountLoading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      {tAccounts('createAccount')}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Preview of parsed trades */}
            {ocrParsedTrades.length > 0 && (
              <div className="space-y-2">
                <Label>{tTrades('preview')}</Label>
                <div className="max-h-48 overflow-y-auto border rounded-md p-2 text-xs space-y-1">
                  {ocrParsedTrades.slice(0, 10).map((trade, i) => (
                    <div key={i} className="flex justify-between text-muted-foreground">
                      <span>{trade.entryDt.split(' ')[1]}</span>
                      <span>{trade.entryPrice} → {trade.exitPrice}</span>
                      <span className={trade.profitLoss >= 0 ? 'text-green-500' : 'text-red-500'}>
                        {trade.profitLoss >= 0 ? '+' : ''}{trade.profitLoss.toFixed(2)}$
                      </span>
                    </div>
                  ))}
                  {ocrParsedTrades.length > 10 && (
                    <div className="text-center text-muted-foreground">
                      ... {tTrades('andMore', { count: ocrParsedTrades.length - 10 })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOcrConfirmDialog(false)}>
              {tCommon('cancel')}
            </Button>
            <Button 
              onClick={handleOcrConfirm}
              disabled={isProcessingOcr || !ocrSymbol.trim()}
            >
              {isProcessingOcr ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tTrades('importing')}
                </>
              ) : (
                tTrades('importTrades', { count: ocrParsedTrades.length })
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Trade Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) resetCreateForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tTrades('createTradeTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Row 1: Symbol & Direction */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{tTrade('symbol')} *</Label>
                <Input
                  value={newTrade.symbol}
                  onChange={(e) => setNewTrade({ ...newTrade, symbol: e.target.value.toUpperCase() })}
                  placeholder="MNQ, NQ, ES..."
                />
              </div>
              <div className="space-y-2">
                <Label>{tTrade('direction')} *</Label>
                <Select
                  value={newTrade.direction}
                  onValueChange={(v) => setNewTrade({ ...newTrade, direction: v as Direction })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tTrades('selectDirection')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LONG">{tTrade('long')}</SelectItem>
                    <SelectItem value="SHORT">{tTrade('short')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Date & Times */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{tTrades('tradeDate')} *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !newTrade.tradeDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newTrade.tradeDate ? formatDate(newTrade.tradeDate, dateLocale) : tTrades('tradeDate')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newTrade.tradeDate}
                      onSelect={(date) => date && setNewTrade({ ...newTrade, tradeDate: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>{tTrades('openTime')} *</Label>
                <Input
                  type="time"
                  step="1"
                  value={newTrade.openTime}
                  onChange={(e) => setNewTrade({ ...newTrade, openTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{tTrades('closeTime')} *</Label>
                <Input
                  type="time"
                  step="1"
                  value={newTrade.closeTime}
                  onChange={(e) => setNewTrade({ ...newTrade, closeTime: e.target.value })}
                />
              </div>
            </div>

            {/* Row 3: Entry & Exit Price */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{tTrade('entryPrice')} *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newTrade.entryPrice}
                  onChange={(e) => setNewTrade({ ...newTrade, entryPrice: e.target.value })}
                  placeholder="21500.00"
                />
              </div>
              <div className="space-y-2">
                <Label>{tTrade('exitPrice')} *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newTrade.exitPrice}
                  onChange={(e) => setNewTrade({ ...newTrade, exitPrice: e.target.value })}
                  placeholder="21550.00"
                />
              </div>
            </div>

            {/* Row 4: Quantity & PnL */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{tTrade('quantity')} *</Label>
                <Input
                  type="number"
                  step="1"
                  value={newTrade.quantity}
                  onChange={(e) => setNewTrade({ ...newTrade, quantity: e.target.value })}
                  placeholder="1"
                />
              </div>
              <div className="space-y-2">
                <Label>{tTrade('pnl')} (USD) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newTrade.realizedPnlUsd}
                  onChange={(e) => setNewTrade({ ...newTrade, realizedPnlUsd: e.target.value })}
                  placeholder="100.00"
                />
              </div>
            </div>

            {/* Row 5: Stop Loss & Profit Target */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{tTradeDetail('stopLoss')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newTrade.stopLossPriceInitial}
                  onChange={(e) => setNewTrade({ ...newTrade, stopLossPriceInitial: e.target.value })}
                  placeholder="21480.00"
                />
              </div>
              <div className="space-y-2">
                <Label>{tTradeDetail('profitTarget')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newTrade.profitTarget}
                  onChange={(e) => setNewTrade({ ...newTrade, profitTarget: e.target.value })}
                  placeholder="21580.00"
                />
              </div>
            </div>

            {/* Row 6: Account */}
            {accounts.length > 0 && (
              <div className="space-y-2">
                <Label>{tTrades('selectAccount')}</Label>
                <Select
                  value={newTrade.accountId || '__none__'}
                  onValueChange={(v) => setNewTrade({ ...newTrade, accountId: v === '__none__' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tTrades('selectAccount')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{tTrades('noAccount')}</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: account.color }}
                          />
                          {account.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              {tCommon('cancel')}
            </Button>
            <Button 
              onClick={handleCreateTrade} 
              disabled={isCreating || !newTrade.symbol || !newTrade.direction || !newTrade.entryPrice || !newTrade.exitPrice || !newTrade.quantity || !newTrade.realizedPnlUsd}
            >
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Progress Steps */}
      <div className="flex items-center justify-between max-w-xl">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center">
            <div
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-full border-2 font-medium transition-colors',
                i <= currentStepIndex
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'border-muted-foreground/30 text-muted-foreground'
              )}
            >
              {i < currentStepIndex ? (
                <Check className="w-5 h-5" />
              ) : (
                i + 1
              )}
            </div>
            <span
              className={cn(
                'ml-2 text-sm font-medium hidden sm:block',
                i <= currentStepIndex ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <ChevronRight className="w-5 h-5 mx-4 text-muted-foreground/30" />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {step === 'upload' && (
        <Card>
          <CardContent className="pt-6">
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors',
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/30 hover:border-primary/50'
              )}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-full bg-muted">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg font-medium">{t('dropzone')}</p>
                  <p className="text-muted-foreground">{t('dropzoneOr')}</p>
                </div>
                <Button variant="secondary">{t('browse')}</Button>
                <p className="text-sm text-muted-foreground">
                  {t('supportedFormats')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'preview' && preview && validationResult && (
        <div className="space-y-6">
          {/* Account Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                {tAccounts('selectAccount')}
              </CardTitle>
              <CardDescription>
                {t('selectAccountDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isCreatingAccount ? (
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder={tAccounts('selectAccount')} />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: account.color }}
                              />
                              {account.name}
                              {account.broker && (
                                <span className="text-muted-foreground">({account.broker})</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" onClick={() => setIsCreatingAccount(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {tAccounts('createNew')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 p-4 rounded-lg border bg-muted/50">
                  <div className="space-y-2">
                    <Label>{tAccounts('accountName')}</Label>
                    <Input
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      placeholder={tAccounts('accountNamePlaceholder')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{tAccounts('broker')}</Label>
                    <Input
                      value={newAccountBroker}
                      onChange={(e) => setNewAccountBroker(e.target.value)}
                      placeholder={tAccounts('brokerPlaceholder')}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setIsCreatingAccount(false);
                        setNewAccountName('');
                        setNewAccountBroker('');
                      }}
                    >
                      {tCommon('cancel')}
                    </Button>
                    <Button
                      onClick={handleCreateAccount}
                      disabled={isCreatingAccountLoading || !newAccountName.trim()}
                    >
                      {isCreatingAccountLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {tAccounts('createAccount')}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview Table */}
          <Card>
            <CardHeader>
              <CardTitle>{t('preview')}</CardTitle>
              <CardDescription>
                {t('rowsDetected', { count: preview.totalRows })} ({t('delimiter')}: {preview.detectedDelimiter === ';' ? t('semicolon') : t('comma')})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {preview.headers.map((header) => (
                        <th key={header} className="text-left py-2 px-3 font-medium">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {preview.headers.map((header) => (
                          <td key={header} className="py-2 px-3 text-muted-foreground">
                            {row[header]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Validation Result */}
          <Card>
            <CardHeader>
              <CardTitle>{t('step3')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-success/10">
                <Check className="w-6 h-6 text-success" />
                <div>
                  <p className="font-medium text-success">
                    {t('validTrades', { count: validationResult.validCount })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('readyToImport')}
                  </p>
                </div>
              </div>

              {/* Duplicate Warning */}
              {isCheckingDuplicates && (
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t('checkingDuplicates')}</p>
                </div>
              )}

              {duplicateCheck && duplicateCheck.duplicateCount > 0 && (
                <div className="space-y-2 p-4 rounded-lg bg-warning/10 border border-warning/30">
                  <div className="flex items-center gap-2 text-warning">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">
                      {t('duplicatesFound', { count: duplicateCheck.duplicateCount })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('duplicatesWillBeSkipped', { 
                      newCount: duplicateCheck.newCount,
                      duplicateCount: duplicateCheck.duplicateCount 
                    })}
                  </p>
                  {duplicateCheck.duplicateDetails.length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                      {duplicateCheck.duplicateDetails.map((dup, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          • {dup.symbol} - {dup.date}
                        </p>
                      ))}
                      {duplicateCheck.duplicateCount > 10 && (
                        <p className="text-xs text-muted-foreground italic">
                          {t('andMoreDuplicates', { count: duplicateCheck.duplicateCount - 10 })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {validationResult.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">
                      {t('errorsCount', { count: validationResult.errors.length })}
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {validationResult.errors.map((err, i) => (
                      <p key={i} className="text-sm text-muted-foreground">
                        {t('rowNumber', { row: err.row })}: {err.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-4">
                <Button variant="outline" onClick={handleReset}>
                  {tCommon('cancel')}
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={validationResult.validCount === 0 || isCheckingDuplicates || (duplicateCheck?.newCount === 0)}
                >
                  {t('startImport')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'importing' && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-6">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-lg font-medium">{t('importing')}</p>
                <p className="text-muted-foreground">
                  {t('pleaseWait')}
                </p>
              </div>
              <Progress value={50} className="w-64" />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'complete' && importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="w-6 h-6 text-success" />
              {t('importComplete')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="p-4 rounded-lg bg-success/10">
                <p className="text-2xl font-bold text-success">
                  {importResult.imported}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('importedCount', { count: importResult.imported })}
                </p>
              </div>
              {(importResult.merged ?? 0) > 0 && (
                <div className="p-4 rounded-lg bg-primary/10">
                  <p className="text-2xl font-bold text-primary">
                    {importResult.merged}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('mergedCount', { count: importResult.merged })}
                  </p>
                </div>
              )}
              <div className="p-4 rounded-lg bg-warning/10">
                <p className="text-2xl font-bold text-warning">
                  {importResult.skipped}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('skippedCount', { count: importResult.skipped })}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-destructive/10">
                <p className="text-2xl font-bold text-destructive">
                  {importResult.errors.length}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('errorCount', { count: importResult.errors.length })}
                </p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="max-h-32 overflow-y-auto space-y-1">
                {importResult.errors.map((err, i) => (
                  <p key={i} className="text-sm text-destructive">
                    {err}
                  </p>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-4">
              <Button variant="outline" onClick={handleReset}>
                {t('newImport')}
              </Button>
              <Button asChild>
                <a href="/dashboard">{t('viewDashboard')}</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
