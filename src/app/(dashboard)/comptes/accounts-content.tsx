'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Wallet,
  Link2,
  EyeOff,
  Archive,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn, formatCurrency } from '@/lib/utils';
import {
  createAccount,
  updateAccount,
  deleteAccount,
  deleteAccountTrades,
  hideAccount,
} from '@/app/actions/accounts';
import { archiveAccount } from '@/app/actions/profile';

interface Account {
  id: string;
  name: string;
  broker: string | null;
  description: string | null;
  color: string;
  initialBalance: number | null;
  currentBalance: number | null;
  tradesCount: number;
  totalPnl: number;
  roi: number | null;
}

interface AccountsContentProps {
  accounts: Account[];
}

const COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
];

export function AccountsContent({ accounts: initialAccounts }: AccountsContentProps) {
  const t = useTranslations('accounts');
  const tCommon = useTranslations('common');
  const router = useRouter();
  
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [isCreating, setIsCreating] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deletingTradesAccount, setDeletingTradesAccount] = useState<Account | null>(null);
  const [confirmDeleteTrades, setConfirmDeleteTrades] = useState(false);
  
  const [newName, setNewName] = useState('');
  const [newBroker, setNewBroker] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [newInitialBalance, setNewInitialBalance] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hidingAccount, setHidingAccount] = useState<string | null>(null);
  const [archivingAccount, setArchivingAccount] = useState<string | null>(null);

  const resetForm = () => {
    setNewName('');
    setNewBroker('');
    setNewDescription('');
    setNewColor(COLORS[0]);
    setNewInitialBalance('');
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setIsSaving(true);
    try {
      const initialBalance = newInitialBalance ? parseFloat(newInitialBalance) : undefined;
      const newAccount = await createAccount(
        newName.trim(),
        newBroker.trim() || undefined,
        newDescription.trim() || undefined,
        newColor,
        initialBalance
      );
      setAccounts(prev => [{
        ...newAccount,
        initialBalance: initialBalance ?? null,
        currentBalance: initialBalance ?? null,
        tradesCount: 0,
        totalPnl: 0,
        roi: null,
      }, ...prev]);
      resetForm();
      setIsCreating(false);
    } catch (error) {
      console.error('Error creating account:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingAccount || !newName.trim()) return;
    setIsSaving(true);
    try {
      const initialBalance = newInitialBalance ? parseFloat(newInitialBalance) : undefined;
      await updateAccount(
        editingAccount.id,
        newName.trim(),
        newBroker.trim() || undefined,
        newDescription.trim() || undefined,
        newColor,
        initialBalance
      );
      setAccounts(prev => prev.map(a => {
        if (a.id !== editingAccount.id) return a;
        const newInitBal = initialBalance ?? null;
        const currentBalance = newInitBal !== null ? newInitBal + a.totalPnl : null;
        const roi = newInitBal !== null && newInitBal > 0 ? (a.totalPnl / newInitBal) * 100 : null;
        return { 
          ...a, 
          name: newName.trim(), 
          broker: newBroker.trim() || null, 
          description: newDescription.trim() || null, 
          color: newColor,
          initialBalance: newInitBal,
          currentBalance,
          roi,
        };
      }));
      setEditingAccount(null);
      resetForm();
    } catch (error) {
      console.error('Error updating account:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingAccount) return;
    setIsDeleting(true);
    try {
      await deleteAccount(deletingAccount.id);
      setAccounts(prev => prev.filter(a => a.id !== deletingAccount.id));
      setDeletingAccount(null);
      setConfirmDeleteAccount(false);
      router.refresh();
    } catch (error) {
      console.error('Error deleting account:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const resetDeleteAccountDialog = () => {
    setDeletingAccount(null);
    setConfirmDeleteAccount(false);
  };

  const handleDeleteTrades = async () => {
    if (!deletingTradesAccount) return;
    setIsDeleting(true);
    try {
      await deleteAccountTrades(deletingTradesAccount.id);
      setAccounts(prev => prev.map(a => 
        a.id === deletingTradesAccount.id 
          ? { ...a, tradesCount: 0, totalPnl: 0, currentBalance: a.initialBalance, roi: null }
          : a
      ));
      setDeletingTradesAccount(null);
      setConfirmDeleteTrades(false);
      router.refresh();
    } catch (error) {
      console.error('Error deleting account trades:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const resetDeleteTradesDialog = () => {
    setDeletingTradesAccount(null);
    setConfirmDeleteTrades(false);
  };

  const handleHideAccount = async (accountId: string) => {
    setHidingAccount(accountId);
    try {
      await hideAccount(accountId);
      setAccounts(prev => prev.filter(a => a.id !== accountId));
      router.refresh();
    } catch (error) {
      console.error('Error hiding account:', error);
    } finally {
      setHidingAccount(null);
    }
  };

  const handleArchiveAccount = async (accountId: string) => {
    setArchivingAccount(accountId);
    try {
      const result = await archiveAccount(accountId);
      if (result.success) {
        setAccounts(prev => prev.filter(a => a.id !== accountId));
        router.refresh();
      }
    } catch (error) {
      console.error('Error archiving account:', error);
    } finally {
      setArchivingAccount(null);
    }
  };

  const openEdit = (account: Account) => {
    setNewName(account.name);
    setNewBroker(account.broker || '');
    setNewDescription(account.description || '');
    setNewColor(account.color);
    setNewInitialBalance(account.initialBalance ? account.initialBalance.toString() : '');
    setEditingAccount(account);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/comptes/brokers">
            <Button variant="outline">
              <Link2 className="h-4 w-4 mr-2" />
              {t('brokerConnections')}
            </Button>
          </Link>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('createAccount')}
        </Button>
        </div>
      </div>

      {/* Accounts List */}
      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">{t('noAccounts')}</h3>
              <p className="text-muted-foreground mb-4">{t('createFirst')}</p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('createAccount')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id} className="relative overflow-hidden">
              <div 
                className="absolute top-0 left-0 w-full h-1"
                style={{ backgroundColor: account.color }}
              />
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${account.color}20` }}
                    >
                      <Wallet className="h-5 w-5" style={{ color: account.color }} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{account.name}</CardTitle>
                      {account.broker && (
                        <p className="text-sm text-muted-foreground">{account.broker}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(account)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8" 
                      onClick={() => handleHideAccount(account.id)}
                      disabled={hidingAccount === account.id}
                      title={t('hideAccount') || 'Hide Account'}
                    >
                      {hidingAccount === account.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8" 
                      onClick={() => handleArchiveAccount(account.id)}
                      disabled={archivingAccount === account.id}
                      title={t('archiveAccount') || 'Archive Account'}
                    >
                      {archivingAccount === account.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Archive className="h-4 w-4 text-amber-500" />
                      )}
                    </Button>
                    {account.tradesCount > 0 && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8" 
                        onClick={() => setDeletingTradesAccount(account)}
                        title={t('deleteAccountTrades')}
                      >
                        <Trash2 className="h-4 w-4 text-orange-500" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeletingAccount(account)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {account.description && (
                  <p className="text-sm text-muted-foreground mb-4">{account.description}</p>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('tradesCount')}</p>
                    <p className="text-lg font-bold">{account.tradesCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('totalPnl')}</p>
                    <p className={cn(
                      'text-lg font-bold',
                      account.totalPnl >= 0 ? 'text-success' : 'text-destructive'
                    )}>
                      {account.totalPnl >= 0 ? '+' : ''}{formatCurrency(account.totalPnl)}
                    </p>
                  </div>
                  {account.initialBalance !== null && (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('initialBalance')}</p>
                        <p className="text-lg font-bold">{formatCurrency(account.initialBalance)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('currentBalance')}</p>
                        <p className={cn(
                          'text-lg font-bold',
                          account.currentBalance !== null && account.currentBalance >= account.initialBalance ? 'text-success' : 'text-destructive'
                        )}>
                          {account.currentBalance !== null ? formatCurrency(account.currentBalance) : '-'}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">{t('roi')}</p>
                        <p className={cn(
                          'text-lg font-bold',
                          account.roi !== null && account.roi >= 0 ? 'text-success' : 'text-destructive'
                        )}>
                          {account.roi !== null ? `${account.roi >= 0 ? '+' : ''}${account.roi.toFixed(2)}%` : '-'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreating} onOpenChange={(open) => { setIsCreating(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createAccount')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('accountName')}</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('accountNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('broker')}</Label>
              <Input
                value={newBroker}
                onChange={(e) => setNewBroker(e.target.value)}
                placeholder={t('brokerPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('description')}</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('initialBalance')}</Label>
              <Input
                type="number"
                step="0.01"
                value={newInitialBalance}
                onChange={(e) => setNewInitialBalance(e.target.value)}
                placeholder={t('initialBalancePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('color')}</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      'w-8 h-8 rounded-full transition-transform',
                      newColor === color && 'ring-2 ring-offset-2 ring-primary scale-110'
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreating(false); resetForm(); }}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={isSaving || !newName.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tCommon('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingAccount} onOpenChange={() => { setEditingAccount(null); resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editAccount')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('accountName')}</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('accountNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('broker')}</Label>
              <Input
                value={newBroker}
                onChange={(e) => setNewBroker(e.target.value)}
                placeholder={t('brokerPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('description')}</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('initialBalance')}</Label>
              <Input
                type="number"
                step="0.01"
                value={newInitialBalance}
                onChange={(e) => setNewInitialBalance(e.target.value)}
                placeholder={t('initialBalancePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('color')}</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      'w-8 h-8 rounded-full transition-transform',
                      newColor === color && 'ring-2 ring-offset-2 ring-primary scale-110'
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingAccount(null); resetForm(); }}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving || !newName.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation */}
      <AlertDialog open={!!deletingAccount} onOpenChange={resetDeleteAccountDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteAccount')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>{t('deleteAccountConfirm', { count: deletingAccount?.tradesCount || 0 })}</p>
                {deletingAccount && (
                  <p className="font-medium text-foreground">
                    {deletingAccount.name} - {deletingAccount.tradesCount} trade(s)
                  </p>
                )}
                {deletingAccount && deletingAccount.tradesCount > 0 && (
                  <div className="flex items-center gap-2 pt-2">
                    <Checkbox 
                      id="confirm-delete-account"
                      checked={confirmDeleteAccount}
                      onCheckedChange={(checked) => setConfirmDeleteAccount(checked === true)}
                    />
                    <label 
                      htmlFor="confirm-delete-account" 
                      className="text-sm font-medium text-foreground cursor-pointer"
                    >
                      {t('confirmCheckbox')}
                    </label>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={(deletingAccount?.tradesCount || 0) > 0 && !confirmDeleteAccount || isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Trades Confirmation - Double confirmation */}
      <AlertDialog open={!!deletingTradesAccount} onOpenChange={resetDeleteTradesDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteAccountTrades')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>{t('deleteAccountTradesConfirm')}</p>
                {deletingTradesAccount && (
                  <p className="font-medium text-foreground">
                    {deletingTradesAccount.name} - {deletingTradesAccount.tradesCount} trade(s)
                  </p>
                )}
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox 
                    id="confirm-delete-trades"
                    checked={confirmDeleteTrades}
                    onCheckedChange={(checked) => setConfirmDeleteTrades(checked === true)}
                  />
                  <label 
                    htmlFor="confirm-delete-trades" 
                    className="text-sm font-medium text-foreground cursor-pointer"
                  >
                    {t('confirmCheckbox')}
                  </label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteTrades} 
              disabled={!confirmDeleteTrades || isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

