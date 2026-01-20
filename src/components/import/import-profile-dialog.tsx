'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createImportProfile, updateImportProfile } from '@/app/actions/import-profiles';
import { getSupportedBrokers } from '@/services/broker-detection-service';
import type { CsvMapping } from '@/services/import-service';
import type { ImportProfile } from '@/app/actions/import-profiles';

interface ImportProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: ImportProfile | null;
  csvHeaders?: string[];
  onSuccess?: () => void;
}

export function ImportProfileDialog({
  open,
  onOpenChange,
  profile,
  csvHeaders = [],
  onSuccess,
}: ImportProfileDialogProps) {
  const t = useTranslations('import.profiles');
  const tCommon = useTranslations('common');
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState('');
  const [brokerName, setBrokerName] = useState<string>('');
  const [mapping, setMapping] = useState<CsvMapping>({
    symbol: '',
    date: '',
    entryPrice: '',
    exitPrice: '',
    quantity: '',
    realizedPnlUsd: '',
  });

  const supportedBrokers = getSupportedBrokers();

  // Initialize form when profile changes
  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setBrokerName(profile.brokerName || '');
      setMapping(profile.mapping);
    } else {
      setName('');
      setBrokerName('');
      setMapping({
        symbol: '',
        date: '',
        entryPrice: '',
        exitPrice: '',
        quantity: '',
        realizedPnlUsd: '',
      });
    }
  }, [profile, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: t('error'),
        description: t('nameRequired'),
        variant: 'destructive',
      });
      return;
    }

    // Validate mapping has required fields
    if (!mapping.symbol || !mapping.entryPrice || !mapping.exitPrice || 
        !mapping.quantity || !mapping.realizedPnlUsd) {
      toast({
        title: t('error'),
        description: t('mappingIncomplete'),
        variant: 'destructive',
      });
      return;
    }

    // Validate date fields
    if (!mapping.date && !mapping.openedAt) {
      toast({
        title: t('error'),
        description: t('dateFieldRequired'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      if (profile) {
        await updateImportProfile(
          profile.id,
          name.trim(),
          brokerName || null,
          mapping
        );
        toast({
          title: t('success'),
          description: t('profileUpdated'),
        });
      } else {
        await createImportProfile(
          name.trim(),
          brokerName || null,
          mapping
        );
        toast({
          title: t('success'),
          description: t('profileCreated'),
        });
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('unknownError'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateMappingField = (field: keyof CsvMapping, value: string) => {
    setMapping((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {profile ? t('editProfile') : t('createProfile')}
          </DialogTitle>
          <DialogDescription>
            {t('profileDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('profileName')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('profileNamePlaceholder')}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="broker">{t('broker')}</Label>
              <Select value={brokerName} onValueChange={setBrokerName} disabled={isLoading}>
                <SelectTrigger id="broker">
                  <SelectValue placeholder={t('selectBroker')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('customBroker')}</SelectItem>
                  {supportedBrokers.map((broker) => (
                    <SelectItem key={broker.brokerName} value={broker.brokerName}>
                      {broker.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Column Mapping */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Label className="text-base font-semibold">{t('columnMapping')}</Label>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Required Fields */}
              <div className="space-y-2">
                <Label htmlFor="symbol" className="text-sm">
                  {t('symbolColumn')} <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={mapping.symbol}
                  onValueChange={(v) => updateMappingField('symbol', v)}
                  disabled={isLoading}
                >
                  <SelectTrigger id="symbol">
                    <SelectValue placeholder={t('selectColumn')} />
                  </SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date" className="text-sm">
                  {t('dateColumn')} <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={mapping.date || ''}
                  onValueChange={(v) => updateMappingField('date', v)}
                  disabled={isLoading}
                >
                  <SelectTrigger id="date">
                    <SelectValue placeholder={t('selectColumn')} />
                  </SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="entryPrice" className="text-sm">
                  {t('entryPriceColumn')} <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={mapping.entryPrice}
                  onValueChange={(v) => updateMappingField('entryPrice', v)}
                  disabled={isLoading}
                >
                  <SelectTrigger id="entryPrice">
                    <SelectValue placeholder={t('selectColumn')} />
                  </SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="exitPrice" className="text-sm">
                  {t('exitPriceColumn')} <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={mapping.exitPrice}
                  onValueChange={(v) => updateMappingField('exitPrice', v)}
                  disabled={isLoading}
                >
                  <SelectTrigger id="exitPrice">
                    <SelectValue placeholder={t('selectColumn')} />
                  </SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity" className="text-sm">
                  {t('quantityColumn')} <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={mapping.quantity}
                  onValueChange={(v) => updateMappingField('quantity', v)}
                  disabled={isLoading}
                >
                  <SelectTrigger id="quantity">
                    <SelectValue placeholder={t('selectColumn')} />
                  </SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pnl" className="text-sm">
                  {t('pnlColumn')} <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={mapping.realizedPnlUsd}
                  onValueChange={(v) => updateMappingField('realizedPnlUsd', v)}
                  disabled={isLoading}
                >
                  <SelectTrigger id="pnl">
                    <SelectValue placeholder={t('selectColumn')} />
                  </SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Optional Fields */}
              <div className="space-y-2">
                <Label htmlFor="direction" className="text-sm">
                  {t('directionColumn')} ({t('optional')})
                </Label>
                <Select
                  value={mapping.direction || ''}
                  onValueChange={(v) => updateMappingField('direction', v)}
                  disabled={isLoading}
                >
                  <SelectTrigger id="direction">
                    <SelectValue placeholder={t('selectColumn')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t('none')}</SelectItem>
                    {csvHeaders.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {profile ? t('updateProfile') : t('createProfile')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
