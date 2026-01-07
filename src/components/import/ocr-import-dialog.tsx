'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Tesseract from 'tesseract.js';
import { Camera, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { cn } from '@/lib/utils';
import { parseOcrText, type OcrTradeData } from '@/services/ocr-service';
import { createAccount } from '@/app/actions/accounts';
import { createTradesFromOcr } from '@/app/actions/trades';
import { useToast } from '@/hooks/use-toast';

interface Account {
  id: string;
  name: string;
  broker: string | null;
  color: string;
}

interface OcrImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  onAccountCreated: (account: Account) => void;
  onSuccess?: () => void;
}

export function OcrImportDialog({
  open,
  onOpenChange,
  accounts,
  onAccountCreated,
  onSuccess,
}: OcrImportDialogProps) {
  const tCommon = useTranslations('common');
  const tTrades = useTranslations('trades');
  const tTrade = useTranslations('trade');
  const tAccounts = useTranslations('accounts');
  const router = useRouter();
  const { toast } = useToast();

  // OCR processing state
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [showOcrExample, setShowOcrExample] = useState(false);
  
  // Confirm dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [parsedTrades, setParsedTrades] = useState<OcrTradeData[]>([]);
  const [symbol, setSymbol] = useState('');
  const [accountId, setAccountId] = useState('');
  
  // Account creation state
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountBroker, setNewAccountBroker] = useState('');
  const [isCreatingAccountLoading, setIsCreatingAccountLoading] = useState(false);

  const resetState = () => {
    setParsedTrades([]);
    setSymbol('');
    setAccountId('');
    setIsCreatingAccount(false);
    setNewAccountName('');
    setNewAccountBroker('');
    setShowOcrExample(false);
  };

  const handleMainDialogClose = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      setShowOcrExample(false);
    }
  };

  const handleConfirmDialogClose = (open: boolean) => {
    setShowConfirmDialog(open);
    if (!open) {
      resetState();
    }
  };

  // Parse trade data using the centralized ocr-service
  const parseTradeData = (text: string, sym?: string): OcrTradeData[] => {
    const result = parseOcrText(text, sym);
    if (result.warnings.length > 0) {
      result.warnings.forEach(w => console.warn('OCR warning:', w));
    }
    return result.trades;
  };

  // OCR file handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingOcr(true);
    try {
      // Create image element for preprocessing
      const img = new Image();
      const imageUrl = URL.createObjectURL(file);
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = imageUrl;
      });

      // Create canvas for preprocessing
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Scale up for better OCR
      const scale = img.width < 1000 ? 3 : 2;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Image preprocessing
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Detect dark theme
      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      const avgBrightness = totalBrightness / (data.length / 4);
      const isDarkTheme = avgBrightness < 128;

      if (isDarkTheme) {
        // Invert colors for better OCR
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i];
          data[i + 1] = 255 - data[i + 1];
          data[i + 2] = 255 - data[i + 2];
        }
      }
      
      // Increase contrast
      const contrast = isDarkTheme ? 1.5 : 1.3;
      const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
        data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
        data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
      }

      ctx.putImageData(imageData, 0, 0);

      // Convert to blob
      const processedBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png', 1.0);
      });

      URL.revokeObjectURL(imageUrl);

      // Run OCR
      const result = await Tesseract.recognize(processedBlob, 'eng', {});
      
      const text = result.data.text;
      const trades = parseTradeData(text);
      
      if (trades && trades.length > 0) {
        setParsedTrades(trades);
        onOpenChange(false);
        setShowConfirmDialog(true);
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

  // Create account handler
  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) return;
    setIsCreatingAccountLoading(true);
    try {
      const newAccount = await createAccount(
        newAccountName.trim(),
        newAccountBroker.trim() || undefined
      );
      onAccountCreated(newAccount);
      setAccountId(newAccount.id);
      setNewAccountName('');
      setNewAccountBroker('');
      setIsCreatingAccount(false);
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
      setIsCreatingAccountLoading(false);
    }
  };

  // Confirm import handler
  const handleConfirm = async () => {
    if (!symbol.trim()) {
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
        parsedTrades,
        symbol.trim(),
        accountId && accountId !== 'none' ? accountId : null
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
      
      handleConfirmDialogClose(false);
      onSuccess?.();
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

  return (
    <>
      {/* Main OCR Dialog */}
      <Dialog open={open} onOpenChange={handleMainDialogClose}>
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
              onChange={handleFileChange}
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
            <Button variant="outline" onClick={() => handleMainDialogClose(false)}>
              {tCommon('cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={handleConfirmDialogClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{tTrades('ocrConfirmTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {tTrades('ocrConfirmDescription', { count: parsedTrades.length })}
            </p>
            
            <div className="space-y-2">
              <Label>{tTrade('symbol')} *</Label>
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="NQ, ES, MNQ, MES..."
              />
            </div>
            
            <div className="space-y-2">
              <Label>{tTrade('account')}</Label>
              {!isCreatingAccount ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Select value={accountId} onValueChange={setAccountId}>
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
                  <Button variant="outline" size="sm" onClick={() => setIsCreatingAccount(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    {tAccounts('createNew')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 p-3 rounded-lg border bg-muted/50">
                  <div className="space-y-1">
                    <Label className="text-xs">{tAccounts('accountName')}</Label>
                    <Input
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      placeholder={tAccounts('accountNamePlaceholder')}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{tAccounts('broker')}</Label>
                    <Input
                      value={newAccountBroker}
                      onChange={(e) => setNewAccountBroker(e.target.value)}
                      placeholder={tAccounts('brokerPlaceholder')}
                      className="h-8"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsCreatingAccount(false);
                        setNewAccountName('');
                        setNewAccountBroker('');
                      }}
                    >
                      {tCommon('cancel')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreateAccount}
                      disabled={isCreatingAccountLoading || !newAccountName.trim()}
                    >
                      {isCreatingAccountLoading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      {tAccounts('createAccount')}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Preview of parsed trades */}
            {parsedTrades.length > 0 && (
              <div className="space-y-2">
                <Label>{tTrades('preview')}</Label>
                {/* Check if any trade has DD/RU to show extended header */}
                {(() => {
                  const hasDrawdownRunup = parsedTrades.some(t => t.drawdown !== undefined || t.runup !== undefined);
                  return (
                    <div className="max-h-48 overflow-y-auto border rounded-md p-2 text-xs space-y-1">
                      {/* Header row */}
                      <div className={`flex justify-between text-muted-foreground font-medium border-b pb-1 mb-1 ${hasDrawdownRunup ? 'gap-2' : ''}`}>
                        <span className="w-16">Time</span>
                        <span className="flex-1 text-center">Entry → Exit</span>
                        <span className="w-20 text-right">PnL</span>
                        {hasDrawdownRunup && (
                          <>
                            <span className="w-16 text-right text-red-400">{tTrade('drawdown')}</span>
                            <span className="w-16 text-right text-green-400">{tTrade('runup')}</span>
                          </>
                        )}
                      </div>
                      {/* Data rows */}
                      {parsedTrades.slice(0, 10).map((trade, i) => (
                        <div key={i} className={`flex justify-between text-muted-foreground ${hasDrawdownRunup ? 'gap-2' : ''}`}>
                          <span className="w-16">{trade.entryDt.split(' ')[1]?.slice(0, 5) || '-'}</span>
                          <span className="flex-1 text-center">{trade.entryPrice.toFixed(2)} → {trade.exitPrice.toFixed(2)}</span>
                          <span className={`w-20 text-right ${trade.profitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {trade.profitLoss >= 0 ? '+' : ''}{trade.profitLoss.toFixed(2)}$
                          </span>
                          {hasDrawdownRunup && (
                            <>
                              <span className="w-16 text-right text-red-400/70">
                                {trade.drawdown !== undefined ? `-${trade.drawdown.toFixed(0)}$` : '-'}
                              </span>
                              <span className="w-16 text-right text-green-400/70">
                                {trade.runup !== undefined ? `+${trade.runup.toFixed(0)}$` : '-'}
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                      {parsedTrades.length > 10 && (
                        <div className="text-center text-muted-foreground">
                          ... {tTrades('andMore', { count: parsedTrades.length - 10 })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleConfirmDialogClose(false)}>
              {tCommon('cancel')}
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={isProcessingOcr || !symbol.trim()}
            >
              {isProcessingOcr ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tTrades('importing')}
                </>
              ) : (
                tTrades('importTrades', { count: parsedTrades.length })
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

