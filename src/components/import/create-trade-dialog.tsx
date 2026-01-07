'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { CalendarIcon, Loader2 } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, formatDate } from '@/lib/utils';
import { createManualTrade } from '@/app/actions/trades';
import { useToast } from '@/hooks/use-toast';
import type { Direction } from '@prisma/client';

interface Account {
  id: string;
  name: string;
  broker: string | null;
  color: string;
}

interface CreateTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  onSuccess?: () => void;
}

interface NewTradeForm {
  symbol: string;
  direction: Direction | '';
  tradeDate: Date;
  openTime: string;
  closeTime: string;
  entryPrice: string;
  exitPrice: string;
  quantity: string;
  realizedPnlUsd: string;
  accountId: string;
  stopLossPriceInitial: string;
  profitTarget: string;
}

const initialFormState: NewTradeForm = {
  symbol: '',
  direction: '',
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
};

export function CreateTradeDialog({
  open,
  onOpenChange,
  accounts,
  onSuccess,
}: CreateTradeDialogProps) {
  const tCommon = useTranslations('common');
  const tTrades = useTranslations('trades');
  const tTrade = useTranslations('trade');
  const tTradeDetail = useTranslations('tradeDetail');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? 'en-GB' : 'fr-FR';
  const { toast } = useToast();

  const [isCreating, setIsCreating] = useState(false);
  const [newTrade, setNewTrade] = useState<NewTradeForm>(initialFormState);

  const resetForm = () => {
    setNewTrade(initialFormState);
  };

  const handleClose = (open: boolean) => {
    onOpenChange(open);
    if (!open) resetForm();
  };

  const handleCreate = async () => {
    if (!newTrade.symbol || !newTrade.direction || !newTrade.entryPrice || !newTrade.exitPrice || !newTrade.quantity || !newTrade.realizedPnlUsd) {
      return;
    }

    setIsCreating(true);
    try {
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
      
      handleClose(false);
      toast({
        title: tCommon('success'),
        description: tTrades('tradeCreated'),
      });
      onSuccess?.();
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

  const isValid = newTrade.symbol && newTrade.direction && newTrade.entryPrice && newTrade.exitPrice && newTrade.quantity && newTrade.realizedPnlUsd;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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
          <Button variant="outline" onClick={() => handleClose(false)}>
            {tCommon('cancel')}
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !isValid}>
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tCommon('create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

