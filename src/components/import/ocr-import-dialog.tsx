'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Camera, Loader2, Plus, RefreshCw, AlertTriangle, Info } from 'lucide-react';
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
  DialogDescription,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { parseOcrText, type OcrTradeData, type VisionParseResult } from '@/services/ocr-service';
import { createAccount } from '@/app/actions/accounts';
import { enrichTradesFromOcr } from '@/app/actions/trades';
import { useToast } from '@/hooks/use-toast';

// =============================================================================
// TYPES
// =============================================================================

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

type OcrProgress = 'converting' | 'uploading' | 'analyzing' | null;

interface OcrApiResponse extends VisionParseResult {
  metadata?: {
    imageSize: number;
    mimeType: string;
    visionApiUsed: boolean;
  };
}

interface OcrApiError {
  error: string;
  code?: string;
  retryable?: boolean;
  details?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convertit un fichier image en Base64
 */
async function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Extraire la partie base64 (retirer le préfixe data:image/xxx;base64,)
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

// =============================================================================
// COMPONENT
// =============================================================================

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
  const [ocrProgress, setOcrProgress] = useState<OcrProgress>(null);
  const [showOcrExample, setShowOcrExample] = useState(false);
  const [lastError, setLastError] = useState<OcrApiError | null>(null);
  const [lastImageBase64, setLastImageBase64] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 2;
  
  // Warning dialog state (shown before upload)
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [pendingFileInput, setPendingFileInput] = useState<HTMLInputElement | null>(null);
  
  // Confirm dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [parsedTrades, setParsedTrades] = useState<OcrTradeData[]>([]);
  const [rawOcrText, setRawOcrText] = useState('');
  const [qualityWarning, setQualityWarning] = useState<string | null>(null);
  const [symbol, setSymbol] = useState('');
  const [accountId, setAccountId] = useState('');
  
  // Account creation state
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountBroker, setNewAccountBroker] = useState('');
  const [isCreatingAccountLoading, setIsCreatingAccountLoading] = useState(false);

  const resetState = () => {
    setParsedTrades([]);
    setRawOcrText('');
    setQualityWarning(null);
    setSymbol('');
    setAccountId('');
    setIsCreatingAccount(false);
    setNewAccountName('');
    setNewAccountBroker('');
    setShowOcrExample(false);
    setLastError(null);
    setLastImageBase64(null);
    setRetryCount(0);
    setShowWarningDialog(false);
    setPendingFileInput(null);
  };
  
  // Re-parse OCR text when symbol changes (for better price range filtering)
  useEffect(() => {
    if (rawOcrText && symbol.trim()) {
      const result = parseOcrText(rawOcrText, symbol.trim());
      if (result.trades && result.trades.length > 0) {
        setParsedTrades(result.trades);
      }
    }
  }, [symbol, rawOcrText]);

  const handleMainDialogClose = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      setShowOcrExample(false);
      setLastError(null);
    }
  };

  const handleConfirmDialogClose = (open: boolean) => {
    setShowConfirmDialog(open);
    if (!open) {
      resetState();
    }
  };

  /**
   * Process image via OCR API
   */
  const processImage = async (base64Image: string) => {
    setOcrProgress('uploading');
    setLastError(null);

    try {
      setOcrProgress('analyzing');

      const response = await fetch('/api/ocr/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Image,
          symbol: symbol || undefined,
        }),
      });

      if (!response.ok) {
        const responseText = await response.text();
        let errorData: OcrApiError;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { error: responseText || 'Unknown error', code: 'PARSE_ERROR' };
        }
        throw errorData;
      }

      const result: OcrApiResponse = await response.json();
      
      setRawOcrText(result.rawText);
      
      // Check quality and show warning if needed
      if (result.qualityAnalysis?.recommendation) {
        setQualityWarning(result.qualityAnalysis.recommendation);
      }
      
      if (result.trades.length > 0) {
        setParsedTrades(result.trades);
        onOpenChange(false);
        setShowConfirmDialog(true);
      } else if (result.rawText.trim()) {
        // Text detected but no trades parsed
        onOpenChange(false);
        setShowConfirmDialog(true);
        toast({
          title: tCommon('info'),
          description: tTrades('enterSymbolToReparse') || 'Enter a symbol to filter price ranges correctly',
        });
      } else {
        toast({
          title: tCommon('info'),
          description: tTrades('ocrNoMatches'),
        });
      }

      // Show warnings if any
      if (result.warnings.length > 0) {
        console.warn('OCR warnings:', result.warnings);
      }

      // Reset retry count on success
      setRetryCount(0);

    } catch (error) {
      console.error('OCR error:', error);
      
      const apiError = error as OcrApiError;
      setLastError(apiError);
      
      let description = tTrades('ocrError');
      
      if (apiError.code === 'TIMEOUT') {
        description = tTrades('ocrTimeout') || 'Processing took too long. Please try again.';
      } else if (apiError.code === 'QUOTA_EXCEEDED') {
        description = tTrades('ocrQuotaExceeded') || 'API quota exceeded. Please try again later.';
      } else if (apiError.code === 'IMAGE_TOO_LARGE') {
        description = tTrades('imageTooLarge') || 'Image is too large (max 10MB).';
      } else if (apiError.code === 'INVALID_FORMAT') {
        description = tTrades('imageFormatInvalid') || 'Invalid image format. Use JPEG, PNG, WebP or GIF.';
      } else if (apiError.code === 'SERVICE_UNAVAILABLE') {
        description = 'OCR service not configured. Please contact support.';
      } else if (apiError.error && apiError.error.includes('PERMISSION_DENIED')) {
        description = 'Google Cloud billing not enabled. Please enable billing on your GCP project.';
      } else if (apiError.error) {
        // Display the actual error message if available
        description = apiError.error.length > 150 ? apiError.error.substring(0, 150) + '...' : apiError.error;
      }
      
      toast({
        title: tCommon('error'),
        description,
        variant: 'destructive',
      });
    }
  };

  /**
   * Handle upload button click - show warning first
   */
  const handleUploadClick = () => {
    // Show warning dialog before allowing file selection
    setShowWarningDialog(true);
  };
  
  /**
   * Handle warning confirmation - proceed with file selection
   */
  const handleWarningConfirm = () => {
    setShowWarningDialog(false);
    // Trigger the file input
    document.getElementById('ocr-file-input')?.click();
  };

  /**
   * Handle file selection
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast({
        title: tCommon('error'),
        description: tTrades('imageTooLarge') || 'Image is too large (max 10MB).',
        variant: 'destructive',
      });
      e.target.value = '';
      return;
    }

    setIsProcessingOcr(true);
    setOcrProgress('converting');

    try {
      // Convert to Base64
      const base64Image = await imageToBase64(file);
      setLastImageBase64(base64Image);
      
      // Process via API
      await processImage(base64Image);

    } catch (error) {
      console.error('File processing error:', error);
      toast({
        title: tCommon('error'),
        description: tTrades('ocrError'),
        variant: 'destructive',
      });
    } finally {
      setIsProcessingOcr(false);
      setOcrProgress(null);
      e.target.value = '';
    }
  };

  /**
   * Retry last failed OCR
   */
  const handleRetry = async () => {
    if (retryCount >= MAX_RETRIES) {
      toast({
        title: tCommon('error'),
        description: tTrades('maxRetriesReached') || 'Maximum retry attempts reached.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!lastImageBase64) {
      toast({
        title: tCommon('error'),
        description: 'No image to retry. Please upload again.',
        variant: 'destructive',
      });
      return;
    }

    setRetryCount(prev => prev + 1);
    setIsProcessingOcr(true);
    
    try {
      await processImage(lastImageBase64);
    } finally {
      setIsProcessingOcr(false);
      setOcrProgress(null);
    }
  };

  /**
   * Create account handler
   */
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

  /**
   * Confirm enrichment handler
   * Now only enriches existing trades - no new trades created
   */
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
      const result = await enrichTradesFromOcr(
        parsedTrades,
        symbol.trim(),
        accountId && accountId !== 'none' ? accountId : null
      );
      
      const parts: string[] = [];
      if (result.enrichedCount > 0) {
        parts.push(tTrades('ocrEnrichedCount', { count: result.enrichedCount }));
      }
      if (result.notFoundCount > 0) {
        parts.push(tTrades('ocrNotFoundCount', { count: result.notFoundCount }));
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
      console.error('Error enriching trades:', error);
      toast({
        title: tCommon('error'),
        description: tTrades('ocrError'),
        variant: 'destructive',
      });
    } finally {
      setIsProcessingOcr(false);
    }
  };

  /**
   * Get progress message
   */
  const getProgressMessage = (): string => {
    switch (ocrProgress) {
      case 'converting':
        return tTrades('ocrConverting') || 'Preparing image...';
      case 'uploading':
        return tTrades('ocrUploading') || 'Uploading...';
      case 'analyzing':
        return tTrades('ocrAnalyzing') || 'Analyzing...';
      default:
        return tTrades('processingOcr');
    }
  };

  return (
    <>
      {/* Warning Dialog - Shown before upload */}
      <Dialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              {tTrades('screenshotWarningTitle')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {tTrades('screenshotWarningMessage')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm">
                {tTrades('screenshotWarningMessage')}
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowWarningDialog(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleWarningConfirm}>
              {tTrades('screenshotWarningConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

            {/* Error with retry option */}
            {lastError && lastError.retryable && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>{lastError.error}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    disabled={isProcessingOcr || retryCount >= MAX_RETRIES}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    {tTrades('ocrRetry') || 'Retry'}
                  </Button>
                </AlertDescription>
              </Alert>
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
              onClick={handleUploadClick}
              disabled={isProcessingOcr}
            >
              {isProcessingOcr ? (
                <>
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  {getProgressMessage()}
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
            <DialogDescription className="sr-only">
              {tTrades('ocrConfirmDescription', { count: parsedTrades.length })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert className="border-blue-500/50 bg-blue-500/10">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm">
                {tTrades('ocrConfirmDescription', { count: parsedTrades.length })}
                {' '}{tTrades('screenshotWarningMessage')?.split('.')[1]?.trim() || 'Only existing trades will be updated.'}
              </AlertDescription>
            </Alert>

            {/* Quality warning */}
            {qualityWarning && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{qualityWarning}</AlertDescription>
              </Alert>
            )}
            
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
