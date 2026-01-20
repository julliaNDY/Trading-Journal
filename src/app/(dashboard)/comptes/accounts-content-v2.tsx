'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Wallet,
  Link2,
  EyeOff,
  Archive,
  Search,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useAccounts } from '@/hooks/use-accounts';
import { useDebounce } from '@/hooks/use-debounce';

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

export function AccountsContentV2() {
  const t = useTranslations('accounts');
  const tCommon = useTranslations('common');
  const router = useRouter();

  // Search and filter state
  const [searchInput, setSearchInput] = useState('');
  const [selectedBroker, setSelectedBroker] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);

  // Fetch accounts with pagination
  const { accounts, isLoading, error, loadMore, refresh, hasMore } = useAccounts({
    limit: 50,
    search: debouncedSearch,
    broker: selectedBroker,
  });

  // UI state
  const [isCreating, setIsCreating] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deletingTradesAccount, setDeletingTradesAccount] = useState<Account | null>(null);
  const [confirmDeleteTrades, setConfirmDeleteTrades] = useState(false);

  // Form state
  const [newName, setNewName] = useState('');
  const [newBroker, setNewBroker] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [newInitialBalance, setNewInitialBalance] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hidingAccount, setHidingAccount] = useState<string | null>(null);
  const [archivingAccount, setArchivingAccount] = useState<string | null>(null);

  // Grouping by broker
  const [activeTab, setActiveTab] = useState<string>('all');
  const [brokers, setBrokers] = useState<string[]>([]);

  // Fetch unique brokers
  useEffect(() => {
    const fetchBrokers = async () => {
      try {
        const response = await fetch('/api/accounts/brokers');
        if (response.ok) {
          const data = await response.json();
          setBrokers(data.brokers || []);
        }
      } catch (err) {
        console.error('Error fetching brokers:', err);
      }
    };
    fetchBrokers();
  }, [accounts]);

  // Group accounts by broker
  const groupedAccounts = useMemo(() => {
    const groups: Record<string, Account[]> = {
      all: accounts,
    };

    accounts.forEach((account) => {
      const broker = account.broker || 'Other';
      if (!groups[broker]) {
        groups[broker] = [];
      }
      groups[broker].push(account);
    });

    return groups;
  }, [accounts]);

  // Get current accounts based on active tab
  const currentAccounts = useMemo(() => {
    if (activeTab === 'all') {
      return accounts;
    }
    return groupedAccounts[activeTab] || [];
  }, [activeTab, accounts, groupedAccounts]);

  // Virtual scrolling setup
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: currentAccounts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // Estimated height of each account card
    overscan: 5,
  });

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
      await createAccount(
        newName.trim(),
        newBroker.trim() || undefined,
        newDescription.trim() || undefined,
        newColor,
        initialBalance
      );
      resetForm();
      setIsCreating(false);
      refresh();
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
      setEditingAccount(null);
      resetForm();
      refresh();
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
      setDeletingAccount(null);
      setConfirmDeleteAccount(false);
      refresh();
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
      setDeletingTradesAccount(null);
      setConfirmDeleteTrades(false);
      refresh();
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
      refresh();
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
        refresh();
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

  const handleClearSearch = () => {
    setSearchInput('');
  };

  // Render account card
  const renderAccountCard = (account: Account) => (
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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => openEdit(account)}
            >
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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setDeletingAccount(account)}
            >
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
            <p
              className={cn(
                'text-lg font-bold',
                account.totalPnl >= 0 ? 'text-success' : 'text-destructive'
              )}
            >
              {account.totalPnl >= 0 ? '+' : ''}
              {formatCurrency(account.totalPnl)}
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
                <p
                  className={cn(
                    'text-lg font-bold',
                    account.currentBalance !== null &&
                      account.currentBalance >= account.initialBalance
                      ? 'text-success'
                      : 'text-destructive'
                  )}
                >
                  {account.currentBalance !== null
                    ? formatCurrency(account.currentBalance)
                    : '-'}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">{t('roi')}</p>
                <p
                  className={cn(
                    'text-lg font-bold',
                    account.roi !== null && account.roi >= 0
                      ? 'text-success'
                      : 'text-destructive'
                  )}
                >
                  {account.roi !== null
                    ? `${account.roi >= 0 ? '+' : ''}${account.roi.toFixed(2)}%`
                    : '-'}
                </p>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

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

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder') || 'Search accounts...'}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchInput && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
              onClick={handleClearSearch}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Tabs for grouping by broker */}
      {brokers.length > 0 && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">
              {t('allAccounts') || 'All'} ({accounts.length})
            </TabsTrigger>
            {brokers.map((broker) => (
              <TabsTrigger key={broker} value={broker}>
                {broker} ({groupedAccounts[broker]?.length || 0})
              </TabsTrigger>
            ))}
            {groupedAccounts['Other'] && groupedAccounts['Other'].length > 0 && (
              <TabsTrigger value="Other">
                {t('other') || 'Other'} ({groupedAccounts['Other'].length})
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      )}

      {/* Error state */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-6">
            <p className="text-destructive text-center">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {isLoading && accounts.length === 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && currentAccounts.length === 0 && !error && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {searchInput || selectedBroker
                  ? t('noAccountsFound') || 'No accounts found'
                  : t('noAccounts')}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchInput || selectedBroker
                  ? t('tryDifferentSearch') || 'Try a different search'
                  : t('createFirst')}
              </p>
              {!searchInput && !selectedBroker && (
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('createAccount')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Virtual scrolling list */}
      {currentAccounts.length > 0 && (
        <div
          ref={parentRef}
          className="h-[calc(100vh-400px)] overflow-auto"
          style={{ contain: 'strict' }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const account = currentAccounts[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="px-1 py-2"
                >
                  {renderAccountCard(account)}
                </div>
              );
            })}
          </div>

          {/* Load more trigger */}
          {hasMore && (
            <div className="flex justify-center py-4">
              <Button onClick={loadMore} disabled={isLoading} variant="outline">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('loading') || 'Loading...'}
                  </>
                ) : (
                  t('loadMore') || 'Load More'
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog
        open={isCreating}
        onOpenChange={(open) => {
          setIsCreating(open);
          if (!open) resetForm();
        }}
      >
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
            <Button
              variant="outline"
              onClick={() => {
                setIsCreating(false);
                resetForm();
              }}
            >
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
      <Dialog
        open={!!editingAccount}
        onOpenChange={() => {
          setEditingAccount(null);
          resetForm();
        }}
      >
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
            <Button
              variant="outline"
              onClick={() => {
                setEditingAccount(null);
                resetForm();
              }}
            >
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
                <p>
                  {t('deleteAccountConfirm', {
                    count: deletingAccount?.tradesCount || 0,
                  })}
                </p>
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
              disabled={
                ((deletingAccount?.tradesCount || 0) > 0 && !confirmDeleteAccount) || isDeleting
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Trades Confirmation */}
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
