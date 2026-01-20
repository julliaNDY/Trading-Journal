'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Check,
  AlertCircle,
  ChevronRight,
  Loader2,
  Plus,
  Wallet,
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
import { cn } from '@/lib/utils';
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
import { useToast } from '@/hooks/use-toast';
import { CreateTradeDialog, OcrImportDialog, ImportProfileSelector } from '@/components/import';
import { detectBrokerFromHeaders } from '@/services/broker-detection-service';
import type { ImportProfile } from '@/app/actions/import-profiles';

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
  const router = useRouter();
  const { toast } = useToast();

  // Shared account state
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  
  // Dialog states
  const [showOcrDialog, setShowOcrDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // CSV import state
  const [step, setStep] = useState<Step>('upload');
  const [fileContent, setFileContent] = useState<string>('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [validationResult, setValidationResult] = useState<{
    validCount: number;
    errors: { row: number; message: string }[];
  } | null>(null);
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

  // Account selection for CSV
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountBroker, setNewAccountBroker] = useState('');
  const [isCreatingAccountLoading, setIsCreatingAccountLoading] = useState(false);

  // Import profile selection
  const [selectedProfile, setSelectedProfile] = useState<ImportProfile | null>(null);
  
  // Available brokers with FILE_UPLOAD integration (Story 3.9)
  const [fileUploadBrokers, setFileUploadBrokers] = useState<Array<{
    name: string;
    displayName: string | null;
    country: string | null;
    region: string | null;
    csvTemplateUrl: string | null;
  }>>([]);
  const [loadingBrokers, setLoadingBrokers] = useState(false);
  const [detectedBroker, setDetectedBroker] = useState<{
    brokerName: string;
    displayName: string;
  } | null>(null);

  // Handlers for account creation
  const handleAccountCreated = (newAccount: Account) => {
    setAccounts(prev => [...prev, newAccount]);
  };

  // Re-check duplicates when account changes
  useEffect(() => {
    if (parsedTrades.length === 0 || step !== 'preview') return;
    
    const checkDuplicatesForAccount = async () => {
      setIsCheckingDuplicates(true);
      try {
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

  // Load file upload brokers on mount
  useEffect(() => {
    const fetchFileUploadBrokers = async () => {
      try {
        setLoadingBrokers(true);
        const params = new URLSearchParams({
          integrationStatus: 'FILE_UPLOAD',
          limit: '100',
        });
        
        const response = await fetch(`/api/brokers?${params}`);
        const data = await response.json();
        
        if (data.success && Array.isArray(data.data)) {
          setFileUploadBrokers(data.data.map((broker: any) => ({
            name: broker.name,
            displayName: broker.displayName || broker.name,
            country: broker.country,
            region: broker.region,
            csvTemplateUrl: broker.csvTemplateUrl,
          })));
        }
      } catch (error) {
        console.error('Error fetching file upload brokers:', error);
      } finally {
        setLoadingBrokers(false);
      }
    };
    
    fetchFileUploadBrokers();
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      setFileContent(content);

      const previewData = parseCsv(content);
      setPreview(previewData);

      // Detect broker from CSV headers
      const detected = detectBrokerFromHeaders(previewData.headers);
      if (detected) {
        setDetectedBroker({
          brokerName: detected.brokerName,
          displayName: detected.displayName,
        });
      }

      // Use FIXED_MAPPING for initial preview (will be replaced by profile mapping)
      const dateFormat = detectDateFormat(previewData.rows, FIXED_MAPPING.date);
      const rows = parseCsvFull(content, previewData.detectedDelimiter);
      const result = processImport(rows, FIXED_MAPPING, dateFormat);

      setValidationResult({
        validCount: result.trades.length,
        errors: result.errors,
      });

      setParsedTrades(result.trades);
      setStep('preview');
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

  const handleImport = async () => {
    if (!preview || !fileContent) return;

    setIsProcessing(true);
    setStep('importing');

    try {
      // Use selected profile mapping or fallback to FIXED_MAPPING
      const mapping = selectedProfile?.mapping || FIXED_MAPPING;
      const dateColumn = mapping.date || mapping.openedAt || 'DT';
      
      const dateFormat = detectDateFormat(preview.rows, dateColumn);
      const rows = parseCsvFull(fileContent, preview.detectedDelimiter);
      const result = processImport(rows, mapping, dateFormat);

      const importRes = await commitImport(result.trades, selectedAccountId || undefined);

      setImportResult(importRes);
      setStep('complete');
    } catch (error) {
      console.error('Import error:', error);
      setImportResult({
        imported: 0,
        merged: 0,
        skipped: 0,
        errors: [`Import error: ${error}`],
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
    setSelectedProfile(null);
    setDetectedBroker(null);
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
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {tTrades('addTrade')}
          </Button>
          <Button variant="outline" onClick={() => setShowOcrDialog(true)}>
            <Camera className="h-4 w-4 mr-2" />
            {tTrades('importFromScreenshot')}
          </Button>
        </div>
      </div>

      {/* Dialogs - Extracted Components */}
      <OcrImportDialog
        open={showOcrDialog}
        onOpenChange={setShowOcrDialog}
        accounts={accounts}
        onAccountCreated={handleAccountCreated}
        onSuccess={() => router.refresh()}
      />

      <CreateTradeDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        accounts={accounts}
        onSuccess={() => router.refresh()}
      />

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
              {i < currentStepIndex ? <Check className="w-5 h-5" /> : i + 1}
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
        <div className="space-y-6">
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
                  <p className="text-sm text-muted-foreground">{t('supportedFormats')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Compatible Brokers List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-success" />
                {t('compatibleBrokers') || 'Compatible Brokers'}
              </CardTitle>
              <CardDescription>
                {t('compatibleBrokersDescription') || 'List of brokers that support CSV file upload'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingBrokers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : fileUploadBrokers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t('noCompatibleBrokers') || 'No compatible brokers found'}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
                  {fileUploadBrokers.map((broker) => (
                    <div
                      key={broker.name}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {broker.displayName || broker.name}
                        </p>
                        {broker.country && (
                          <p className="text-xs text-muted-foreground truncate">
                            {broker.country} {broker.region ? `• ${broker.region}` : ''}
                          </p>
                        )}
                      </div>
                      {broker.csvTemplateUrl && (
                        <a
                          href={broker.csvTemplateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-xs flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Template
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!loadingBrokers && fileUploadBrokers.length > 0 && (
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  {t('compatibleBrokersCount', { count: fileUploadBrokers.length }) || 
                   `${fileUploadBrokers.length} brokers compatible with CSV import`}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'preview' && preview && validationResult && (
        <div className="space-y-6">
          {/* Import Profile Selection */}
          <Card>
            <CardHeader>
              <CardTitle>{t('importProfile')}</CardTitle>
              <CardDescription>{t('importProfileDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ImportProfileSelector
                csvHeaders={preview.headers}
                selectedProfileId={selectedProfile?.id}
                onProfileSelect={setSelectedProfile}
                detectedBroker={detectedBroker}
              />
            </CardContent>
          </Card>

          {/* Account Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                {tAccounts('selectAccount')}
              </CardTitle>
              <CardDescription>{t('selectAccountDescription')}</CardDescription>
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
                  <p className="text-sm text-muted-foreground">{t('readyToImport')}</p>
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
                <p className="text-muted-foreground">{t('pleaseWait')}</p>
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
                <p className="text-2xl font-bold text-success">{importResult.imported}</p>
                <p className="text-sm text-muted-foreground">
                  {t('importedCount', { count: importResult.imported })}
                </p>
              </div>
              {(importResult.merged ?? 0) > 0 && (
                <div className="p-4 rounded-lg bg-primary/10">
                  <p className="text-2xl font-bold text-primary">{importResult.merged}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('mergedCount', { count: importResult.merged })}
                  </p>
                </div>
              )}
              <div className="p-4 rounded-lg bg-warning/10">
                <p className="text-2xl font-bold text-warning">{importResult.skipped}</p>
                <p className="text-sm text-muted-foreground">
                  {t('skippedCount', { count: importResult.skipped })}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-destructive/10">
                <p className="text-2xl font-bold text-destructive">{importResult.errors.length}</p>
                <p className="text-sm text-muted-foreground">
                  {t('errorCount', { count: importResult.errors.length })}
                </p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="max-h-32 overflow-y-auto space-y-1">
                {importResult.errors.map((err, i) => (
                  <p key={i} className="text-sm text-destructive">{err}</p>
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
