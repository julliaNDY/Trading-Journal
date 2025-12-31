'use client';

import { useState, useCallback } from 'react';
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
import { createManualTrade, createTradesFromOcr, type OcrTradeData } from '@/app/actions/trades';
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

  // Parse trade data from OCR text
  const parseTradeData = (text: string): OcrTradeData[] => {
    const trades: OcrTradeData[] = [];
    const lines = text.split('\n').filter(line => line.trim());

    console.log('OCR Raw text:', text);
    console.log('Lines:', lines);

    // Pattern to match trade rows from the screenshot format
    // Entry DT | Entry price | Entry qty | Exit DT | Exit price | Exit qty | Profit Loss | Drawdown | Runup
    // Example: 12/30/2025 10:09:48 AM 25717.25 -5 12/30/2025 10:12:05 AM 25699 +5 182,50 $ 5,00 $ -18,25 $
    
    // Regex pattern for date/time format: MM/DD/YYYY HH:MM:SS AM/PM (with flexible spacing)
    // Also handle cases where OCR might miss spaces or have different formatting
    const dateTimePattern = /(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s*[AP]M?)/gi;
    
    for (const line of lines) {
      // Skip header lines
      if (line.toLowerCase().includes('entry dt') || 
          line.toLowerCase().includes('entry price') ||
          line.toLowerCase().includes('exit dt')) continue;
      
      // Find all date/times in the line
      const dateTimes = line.match(dateTimePattern);
      
      console.log('Line:', line);
      console.log('DateTimes found:', dateTimes);
      
      if (!dateTimes || dateTimes.length < 2) continue;

      const entryDt = dateTimes[0].trim();
      const exitDt = dateTimes[1].trim();

      // Extract all numbers from the line (prices, quantities, etc.)
      // Match numbers that can have comma or dot as decimal separator
      const numberPattern = /[+-]?\d+[,.]?\d*/g;
      const allNumbers = line.match(numberPattern) || [];
      
      console.log('All numbers:', allNumbers);
      
      // Filter out numbers that are part of dates (year like 2025, day/month)
      const prices = allNumbers.filter(num => {
        const n = parseFloat(num.replace(',', '.'));
        // Prices are typically > 1000 for futures like ES/NQ, or could be smaller
        // Quantities are typically small (-10 to +10)
        // Years are 2024, 2025, etc.
        // We want prices (large numbers) and PnL (can be negative)
        return Math.abs(n) > 20 || (Math.abs(n) <= 20 && num.includes('.'));
      });
      
      console.log('Filtered prices:', prices);
      
      if (prices.length < 2) continue;

      // Entry price is typically the first large number after entry datetime
      // Exit price is typically the first large number after exit datetime
      // For this format: Entry DT | Entry price | Entry qty | Exit DT | Exit price | Exit qty | Profit Loss
      
      // Find the position of entry and exit datetimes in the line
      const entryDtIndex = line.indexOf(entryDt);
      const exitDtIndex = line.indexOf(exitDt);
      
      // Get the part between entry DT and exit DT for entry price
      const entryPart = line.substring(entryDtIndex + entryDt.length, exitDtIndex);
      const entryNumbers = entryPart.match(numberPattern) || [];
      
      // Get the part after exit DT for exit price and PnL
      const exitPart = line.substring(exitDtIndex + exitDt.length);
      const exitNumbers = exitPart.match(numberPattern) || [];
      
      console.log('Entry part:', entryPart, 'numbers:', entryNumbers);
      console.log('Exit part:', exitPart, 'numbers:', exitNumbers);
      
      // Entry price is the first number in entry part (skip if it looks like quantity)
      let entryPrice = 0;
      for (const num of entryNumbers) {
        const n = parseFloat(num.replace(',', '.'));
        if (Math.abs(n) > 100) { // Prices are typically > 100 for futures
          entryPrice = n;
          break;
        }
      }
      
      // Exit price is the first number in exit part (skip if it looks like quantity)
      let exitPrice = 0;
      for (const num of exitNumbers) {
        const n = parseFloat(num.replace(',', '.'));
        if (Math.abs(n) > 100) { // Prices are typically > 100 for futures
          exitPrice = n;
          break;
        }
      }
      
      // Find profit/loss - look for number followed by $ or number with comma as decimal
      const profitMatch = exitPart.match(/([+-]?\d+[,.]?\d*)\s*\$/) || 
                          exitPart.match(/([+-]?\d+,\d+)\s*\$/);
      
      let profitLoss = 0;
      if (profitMatch) {
        profitLoss = parseFloat(profitMatch[1].replace(',', '.'));
      }
      
      console.log('Parsed: entryPrice=', entryPrice, 'exitPrice=', exitPrice, 'profitLoss=', profitLoss);

      if (entryPrice > 0 && exitPrice > 0) {
        trades.push({
          entryDt,
          exitDt,
          entryPrice,
          exitPrice,
          profitLoss,
        });
      }
    }

    console.log('Total trades parsed:', trades.length, trades);
    return trades;
  };

  // OCR import handler - runs client-side
  const handleOcrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingOcr(true);
    try {
      // Run OCR client-side using Tesseract.js
      const result = await Tesseract.recognize(
        file,
        'eng',
        {
          logger: () => {}, // Silent logger
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
      
      let description = tTrades('ocrCreated', { count: result.createdCount });
      if (result.skippedCount > 0) {
        description += ` (${tTrades('ocrSkipped', { count: result.skippedCount })})`;
      }
      
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
  const [duplicateCheck, setDuplicateCheck] = useState<{
    duplicateCount: number;
    newCount: number;
    duplicateDetails: { symbol: string; date: string }[];
  } | null>(null);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
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

      setStep('preview');

      // Check for duplicates asynchronously
      if (result.trades.length > 0) {
        setIsCheckingDuplicates(true);
        try {
          const dupCheck = await checkDuplicates(result.trades);
          setDuplicateCheck(dupCheck);
        } catch (error) {
          console.error('Error checking duplicates:', error);
        } finally {
          setIsCheckingDuplicates(false);
        }
      }
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
              <Select value={ocrAccountId} onValueChange={setOcrAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder={tAccounts('selectAccount')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tAccounts('noAccount')}</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 rounded-lg bg-success/10">
                <p className="text-2xl font-bold text-success">
                  {importResult.imported}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('importedCount', { count: importResult.imported })}
                </p>
              </div>
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
