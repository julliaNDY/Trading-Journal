'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Format date consistently to avoid hydration mismatch between server and client.
 * Uses ISO-like format that doesn't depend on locale.
 */
function formatDateTime(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  // Use fixed format: YYYY-MM-DD HH:mm:ss
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
import { useRouter } from 'next/navigation';
import {
  Plus,
  RefreshCw,
  Trash2,
  Link2,
  LinkIcon,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Settings,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Info,
  BookOpen,
  Clock,
  Power,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  connectBrokerAction,
  disconnectBrokerAction,
  syncBrokerTradesAction,
  updateBrokerSyncSettings,
  type ConnectBrokerFormData,
} from '@/app/actions/broker';
import { createAccount } from '@/app/actions/accounts';
import { BrokerType } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

interface BrokerConnection {
  id: string;
  brokerType: BrokerType;
  status: string;
  brokerAccountId: string | null;
  brokerAccountName: string | null;
  syncEnabled: boolean;
  syncIntervalMin: number;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  linkedAccount: {
    id: string;
    name: string;
    color: string;
  } | null;
  recentSyncs: {
    id: string;
    status: string;
    tradesImported: number;
    tradesSkipped: number;
    startedAt: string;
    completedAt: string | null;
    durationMs: number | null;
    errorMessage: string | null;
  }[];
}

interface Account {
  id: string;
  name: string;
  color: string;
}

interface BrokersContentProps {
  initialConnections: BrokerConnection[];
  accounts: Account[];
}

// ============================================================================
// BROKER INFO
// ============================================================================

const BROKER_INFO: Record<BrokerType, { name: string; logo: string; description: string }> = {
  IBKR: {
    name: 'Interactive Brokers',
    logo: '🏦',
    description: 'Multi-asset brokerage (via Flex Query)',
  },
  TRADOVATE: {
    name: 'Tradovate',
    logo: '📈',
    description: 'Futures trading platform',
  },
  ALPACA: {
    name: 'Alpaca',
    logo: '🦙',
    description: 'Commission-free stock & options trading',
  },
  NINJATRADER: {
    name: 'NinjaTrader',
    logo: '⚔️',
    description: 'Advanced futures & forex platform',
  },
  TD_AMERITRADE: {
    name: 'TD Ameritrade',
    logo: '🎯',
    description: 'Full-service brokerage platform',
  },
  TRADESTATION: {
    name: 'TradeStation',
    logo: '📊',
    description: 'Professional trading tools & analysis',
  },
  THINKORSWIM: {
    name: 'thinkorswim',
    logo: '💡',
    description: 'Advanced trading platform by TD',
  },
  ETRADE: {
    name: 'E*TRADE',
    logo: '💰',
    description: 'Full-service online brokerage',
  },
  ROBINHOOD: {
    name: 'Robinhood',
    logo: '🦅',
    description: 'Commission-free trading app',
  },
  WEBULL: {
    name: 'Webull',
    logo: '📱',
    description: 'Mobile-first trading platform',
  },
  AMP_FUTURES: {
    name: 'AMP Futures',
    logo: '⚡',
    description: 'Low-cost futures trading',
  },
  BINANCE: {
    name: 'Binance',
    logo: '🔶',
    description: 'World\'s largest crypto exchange',
  },
  APEX_TRADER: {
    name: 'Apex Trader',
    logo: '🎯',
    description: 'Prop trading firm',
  },
  OANDA: {
    name: 'OANDA',
    logo: '💱',
    description: 'Forex & CFD trading platform',
  },
  TOPSTEPX: {
    name: 'TopstepX',
    logo: '🎓',
    description: 'Futures prop firm',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function BrokersContent({ initialConnections, accounts }: BrokersContentProps) {
  const t = useTranslations('brokers');
  const tAccounts = useTranslations('accounts');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const router = useRouter();
  
  const [connections, setConnections] = useState(initialConnections);
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<BrokerConnection | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showCreateAccountDialog, setShowCreateAccountDialog] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<ConnectBrokerFormData>({
    brokerType: 'IBKR',
    apiKey: '',
    apiSecret: '',
    environment: 'live',
  });
  
  // Create account form state
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountColor, setNewAccountColor] = useState('#6366f1');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  
  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  
  const handleConnect = async () => {
    // Handle OAuth brokers (TradeStation)
    if (formData.brokerType === 'TRADESTATION') {
      // Redirect to OAuth authorization endpoint
      window.location.href = `/api/broker/tradestation/authorize?environment=${formData.environment || 'live'}`;
      return;
    }
    
    // Handle API key brokers (IBKR, etc.)
    if (!formData.apiKey || !formData.apiSecret) {
      toast({
        title: t('error'),
        description: t('credentialsRequired'),
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const result = await connectBrokerAction(formData);
      
      if (result.success) {
        toast({
          title: t('connected'),
          description: t('connectedDescription'),
        });
        setIsConnectDialogOpen(false);
        setFormData({
          brokerType: 'IBKR',
          apiKey: '',
          apiSecret: '',
          environment: 'live',
        });
        router.refresh();
      } else {
        toast({
          title: t('connectionFailed'),
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDisconnect = async () => {
    if (!selectedConnection) return;
    
    setIsSubmitting(true);
    try {
      const result = await disconnectBrokerAction(selectedConnection.id);
      
      if (result.success) {
        toast({
          title: t('disconnected'),
          description: t('disconnectedDescription'),
        });
        setIsDisconnectDialogOpen(false);
        setSelectedConnection(null);
        router.refresh();
      } else {
        toast({
          title: t('error'),
          description: result.error,
          variant: 'destructive',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleSync = async (connectionId: string) => {
    setSyncingConnectionId(connectionId);
    try {
      const result = await syncBrokerTradesAction(connectionId);
      
      if (result.success) {
        toast({
          title: t('syncComplete'),
          description: t('syncCompleteDescription', {
            imported: result.tradesImported,
            skipped: result.tradesSkipped,
          }),
        });
        router.refresh();
      } else {
        toast({
          title: t('syncFailed'),
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSyncingConnectionId(null);
    }
  };
  
  const handleLinkAccount = async (connectionId: string, accountId: string | null) => {
    try {
      await updateBrokerSyncSettings(connectionId, { accountId });
      toast({
        title: t('accountLinked'),
        description: t('accountLinkedDescription'),
      });
      router.refresh();
    } catch (error) {
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };
  
  const handleToggleSyncEnabled = async (connectionId: string, enabled: boolean) => {
    try {
      await updateBrokerSyncSettings(connectionId, { syncEnabled: enabled });
      toast({
        title: enabled ? t('autoSyncEnabled') : t('autoSyncDisabled'),
        description: enabled ? t('autoSyncEnabledDescription') : t('autoSyncDisabledDescription'),
      });
      router.refresh();
    } catch (error) {
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };
  
  const handleUpdateSyncInterval = async (connectionId: string, intervalMin: number) => {
    // Validate interval (5min - 60min)
    if (intervalMin < 5 || intervalMin > 60) {
      toast({
        title: t('error'),
        description: t('invalidSyncInterval'),
        variant: 'destructive',
      });
      return;
    }
    
    try {
      await updateBrokerSyncSettings(connectionId, { syncIntervalMin: intervalMin });
      toast({
        title: t('syncIntervalUpdated'),
        description: t('syncIntervalUpdatedDescription', { interval: intervalMin }),
      });
      router.refresh();
    } catch (error) {
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) return;
    
    setIsCreatingAccount(true);
    try {
      const newAccount = await createAccount(
        newAccountName.trim(),
        undefined,
        undefined,
        newAccountColor
      );
      
      toast({
        title: tCommon('success'),
        description: tAccounts('accountCreated'),
      });
      
      // After creating account, refresh to get updated accounts list
      setShowCreateAccountDialog(false);
      setNewAccountName('');
      setNewAccountColor('#6366f1');
      // Select the newly created account in the form
      setFormData({ ...formData, accountId: newAccount.id });
      router.refresh();
    } catch (error) {
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingAccount(false);
    }
  };
  
  // ==========================================================================
  // RENDER
  // ==========================================================================
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONNECTED':
        return <Badge variant="success" className="gap-1"><CheckCircle className="h-3 w-3" />{t('statusConnected')}</Badge>;
      case 'ERROR':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />{t('statusError')}</Badge>;
      case 'DISCONNECTED':
        return <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" />{t('statusDisconnected')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Add Connection Button */}
      <div className="flex justify-end">
        <Button onClick={() => setIsConnectDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('addConnection')}
        </Button>
      </div>
      
      {/* Connections List */}
      {connections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <LinkIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('noConnections')}</h3>
            <p className="text-muted-foreground mb-4">{t('noConnectionsDescription')}</p>
            <Button onClick={() => setIsConnectDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addConnection')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {connections.map((connection) => (
            <Card key={connection.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{BROKER_INFO[connection.brokerType]?.logo}</span>
                    <div>
                      <CardTitle className="text-lg">
                        {BROKER_INFO[connection.brokerType]?.name}
                      </CardTitle>
                      <CardDescription>
                        {connection.brokerAccountName || connection.brokerAccountId}
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(connection.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Last Sync Info */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('lastSync')}:</span>
                  <span>
                    {connection.lastSyncAt
                      ? formatDateTime(connection.lastSyncAt)
                      : t('never')}
                  </span>
                </div>
                
                {/* Error Message */}
                {connection.lastSyncError && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                    {connection.lastSyncError}
                  </div>
                )}
                
                {/* Linked Account */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('linkedAccount')}:</span>
                  <Select
                    value={connection.linkedAccount?.id || 'none'}
                    onValueChange={(value) => handleLinkAccount(connection.id, value === 'none' ? null : value)}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder={t('selectAccount')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('noAccount')}</SelectItem>
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
                
                {/* Auto-Sync Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Power className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">{t('autoSync')}</div>
                      <div className="text-xs text-muted-foreground">{t('autoSyncDescription')}</div>
                    </div>
                  </div>
                  <Switch
                    checked={connection.syncEnabled}
                    onCheckedChange={(checked) => handleToggleSyncEnabled(connection.id, checked)}
                  />
                </div>
                
                {/* Sync Interval */}
                {connection.syncEnabled && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{t('syncInterval')}:</span>
                    </div>
                    <Select
                      value={connection.syncIntervalMin.toString()}
                      onValueChange={(value) => handleUpdateSyncInterval(connection.id, parseInt(value))}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">{t('interval5min')}</SelectItem>
                        <SelectItem value="10">{t('interval10min')}</SelectItem>
                        <SelectItem value="15">{t('interval15min')}</SelectItem>
                        <SelectItem value="30">{t('interval30min')}</SelectItem>
                        <SelectItem value="60">{t('interval60min')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {/* Recent Syncs */}
                {connection.recentSyncs.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-sm font-medium">{t('recentSyncs')}:</span>
                    <div className="space-y-1">
                      {connection.recentSyncs.slice(0, 3).map((sync) => (
                        <div
                          key={sync.id}
                          className="flex items-center justify-between text-xs p-2 rounded bg-muted/50"
                        >
                          <span className="text-muted-foreground">
                            {formatDateTime(sync.startedAt)}
                          </span>
                          <div className="flex items-center gap-2">
                            {sync.status === 'SUCCESS' ? (
                              <Badge variant="outline" className="text-green-500">
                                +{sync.tradesImported} trades
                              </Badge>
                            ) : sync.status === 'FAILED' ? (
                              <Badge variant="destructive">Failed</Badge>
                            ) : (
                              <Badge variant="secondary">{sync.status}</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(connection.id)}
                    disabled={connection.status !== 'CONNECTED' || syncingConnectionId === connection.id}
                  >
                    {syncingConnectionId === connection.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    {t('syncNow')}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setSelectedConnection(connection);
                      setIsDisconnectDialogOpen(true);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('disconnect')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Connect Dialog */}
      <Dialog open={isConnectDialogOpen} onOpenChange={(open) => {
        setIsConnectDialogOpen(open);
        if (!open) setShowTutorial(false);
      }}>
        <DialogContent className={formData.brokerType === 'IBKR' ? 'max-w-2xl max-h-[90vh] overflow-y-auto' : 'max-w-md'}>
          <DialogHeader>
            <DialogTitle>{t('connectBroker')}</DialogTitle>
            <DialogDescription>{t('connectBrokerDescription')}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Broker Selection */}
            <div className="space-y-2">
              <Label>{t('selectBroker')}</Label>
              <Select
                value={formData.brokerType}
                onValueChange={(value) => {
                  setFormData({ ...formData, brokerType: value as BrokerType });
                  setShowTutorial(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IBKR">
                    <div className="flex items-center gap-2">
                      <span>{BROKER_INFO.IBKR.logo}</span>
                      <span>{BROKER_INFO.IBKR.name}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="TRADESTATION">
                    <div className="flex items-center gap-2">
                      <span>{BROKER_INFO.TRADESTATION.logo}</span>
                      <span>{BROKER_INFO.TRADESTATION.name}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="TRADOVATE" disabled>
                    <div className="flex items-center gap-2">
                      <span>{BROKER_INFO.TRADOVATE.logo}</span>
                      <span>{BROKER_INFO.TRADOVATE.name}</span>
                      <Badge variant="outline" className="ml-2 text-blue-500 border-blue-500">
                        Coming Soon
                      </Badge>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* IBKR Tutorial Toggle */}
            {formData.brokerType === 'IBKR' && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowTutorial(!showTutorial)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-primary/10 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">{t('ibkrTutorialTitle')}</span>
                  </div>
                  {showTutorial ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                
                {showTutorial && (
                  <div className="p-4 pt-0 space-y-4 border-t border-primary/10">
                    {/* Step 1 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                        <h4 className="font-medium text-sm">{t('ibkrTutorial.step1Title')}</h4>
                      </div>
                      <div className="ml-8 space-y-2">
                        <p className="text-xs text-muted-foreground">{t('ibkrTutorial.step1Desc')}</p>
                        <a
                          href="https://www.interactivebrokers.com/sso/Login"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          {t('ibkrTutorial.openPortal')}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                    
                    {/* Step 2 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                        <h4 className="font-medium text-sm">{t('ibkrTutorial.step2Title')}</h4>
                      </div>
                      <div className="ml-8 space-y-2">
                        <p className="text-xs text-muted-foreground">{t('ibkrTutorial.step2Desc')}</p>
                        <div className="rounded bg-muted/50 p-2 text-xs font-mono">
                          Performance & Reports → Flex Queries
                        </div>
                      </div>
                    </div>
                    
                    {/* Step 3 - Create Activity Flex Query */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                        <h4 className="font-medium text-sm">{t('ibkrTutorial.step3Title')}</h4>
                      </div>
                      <div className="ml-8 space-y-2">
                        <p className="text-xs text-muted-foreground">{t('ibkrTutorial.step3Desc')}</p>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                          <li>{t('ibkrTutorial.step3Item1')}</li>
                          <li>{t('ibkrTutorial.step3Item2')}</li>
                          <li>{t('ibkrTutorial.step3Item3')}</li>
                        </ul>
                        <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                          <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                          <p className="text-xs text-amber-600 dark:text-amber-400">{t('ibkrTutorial.step3Warning')}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Step 4 - Configure Date Range */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">4</span>
                        <h4 className="font-medium text-sm">{t('ibkrTutorial.step4Title')}</h4>
                      </div>
                      <div className="ml-8 space-y-2">
                        <p className="text-xs text-muted-foreground">{t('ibkrTutorial.step4Desc')}</p>
                        <div className="rounded bg-muted/50 p-2 text-xs font-mono">
                          {t('ibkrTutorial.step4Period')}
                        </div>
                      </div>
                    </div>
                    
                    {/* Step 5 - Select Trades Section (CRITICAL) */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold">5</span>
                        <h4 className="font-medium text-sm text-red-600 dark:text-red-400">{t('ibkrTutorial.step5Title')}</h4>
                      </div>
                      <div className="ml-8 space-y-2">
                        <p className="text-xs text-muted-foreground">{t('ibkrTutorial.step5Desc')}</p>
                        <div className="flex items-center gap-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                          <p className="text-xs text-red-600 dark:text-red-400 font-medium">{t('ibkrTutorial.step5Critical')}</p>
                        </div>
                        <div className="rounded bg-muted/50 p-2 text-xs font-mono">
                          Sections → ✅ Trades
                        </div>
                      </div>
                    </div>
                    
                    {/* Step 6 - Configure Trade Fields */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">6</span>
                        <h4 className="font-medium text-sm">{t('ibkrTutorial.step6Title')}</h4>
                      </div>
                      <div className="ml-8 space-y-2">
                        <p className="text-xs text-muted-foreground">{t('ibkrTutorial.step6Desc')}</p>
                        <div className="rounded bg-muted/50 p-2">
                          <p className="text-xs font-medium text-foreground">{t('ibkrTutorial.step6FieldsRequired')}</p>
                          <ul className="text-xs text-muted-foreground mt-1 space-y-0.5 font-mono">
                            <li>☑️ <strong>IB Execution ID</strong> <span className="text-red-500">({t('ibkrTutorial.step6ExecIdNote')})</span></li>
                            <li>☑️ <strong>Date/Time</strong> <span className="text-amber-500">({t('ibkrTutorial.step6DateTimeNote')})</span></li>
                            <li>☑️ <strong>Symbol</strong></li>
                            <li>☑️ <strong>Buy/Sell</strong></li>
                            <li>☑️ <strong>Quantity</strong></li>
                            <li>☑️ <strong>TradePrice</strong></li>
                            <li>☑️ <strong>Proceeds</strong></li>
                            <li>☑️ <strong>IB Commission</strong></li>
                            <li>☑️ <strong>Currency</strong></li>
                            <li>☑️ <strong>Asset Class</strong></li>
                            <li>☑️ <strong>Exchange</strong></li>
                          </ul>
                        </div>
                        <div className="rounded bg-blue-500/10 p-2 border border-blue-500/20">
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">{t('ibkrTutorial.step6FieldsOptional')}</p>
                          <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                            <li>• Order Type, Order ID</li>
                            <li>• Underlying Symbol, Multiplier</li>
                            <li>• Open/Close, FIFO P&L Realized</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    {/* Step 7 - Save and Note Query ID */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">7</span>
                        <h4 className="font-medium text-sm">{t('ibkrTutorial.step7Title')}</h4>
                      </div>
                      <div className="ml-8 space-y-2">
                        <p className="text-xs text-muted-foreground">{t('ibkrTutorial.step7Desc')}</p>
                        <div className="flex items-center gap-2 p-2 rounded bg-green-500/10 border border-green-500/20">
                          <Info className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <p className="text-xs text-green-600 dark:text-green-400">{t('ibkrTutorial.step7Note')}</p>
                        </div>
                        <div className="rounded bg-muted/50 p-2 text-xs font-mono">
                          Query ID = <strong>1234567</strong> ({t('ibkrTutorial.step7QueryIdFormat')})
                        </div>
                      </div>
                    </div>
                    
                    {/* Step 8 - Enable Flex Web Service */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">8</span>
                        <h4 className="font-medium text-sm">{t('ibkrTutorial.step8Title')}</h4>
                      </div>
                      <div className="ml-8 space-y-2">
                        <p className="text-xs text-muted-foreground">{t('ibkrTutorial.step8Desc')}</p>
                        <div className="rounded bg-muted/50 p-2 text-xs font-mono">
                          Settings → User Settings → Flex Web Service
                        </div>
                      </div>
                    </div>
                    
                    {/* Step 9 - Generate Token */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">9</span>
                        <h4 className="font-medium text-sm">{t('ibkrTutorial.step9Title')}</h4>
                      </div>
                      <div className="ml-8 space-y-2">
                        <p className="text-xs text-muted-foreground">{t('ibkrTutorial.step9Desc')}</p>
                        <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                          <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                          <p className="text-xs text-amber-600 dark:text-amber-400">{t('ibkrTutorial.step9Warning')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* TradeStation Environment Selection */}
            {formData.brokerType === 'TRADESTATION' && (
              <div className="space-y-2">
                <Label>Environment</Label>
                <Select
                  value={formData.environment || 'live'}
                  onValueChange={(value) => setFormData({ ...formData, environment: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="live">Live Trading</SelectItem>
                    <SelectItem value="sim">Sim (Paper Trading)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* OAuth Notice for TradeStation */}
            {formData.brokerType === 'TRADESTATION' && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">OAuth 2.0 Authentication</h4>
                    <p className="text-xs text-muted-foreground">
                      TradeStation uses secure OAuth 2.0 authentication. When you click "Connect", 
                      you'll be redirected to TradeStation's login page to authorize this application.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      No API keys needed - just log in with your TradeStation credentials.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* API Key / Flex Token (only for non-OAuth brokers) */}
            {formData.brokerType !== 'TRADESTATION' && (
              <>
                <div className="space-y-2">
                  <Label>
                    {formData.brokerType === 'IBKR' ? t('flexToken') : t('apiKey')}
                  </Label>
                  <Input
                    type="text"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    placeholder={formData.brokerType === 'IBKR' ? t('flexTokenPlaceholder') : t('apiKeyPlaceholder')}
                  />
                </div>
                
                {/* API Secret / Query ID */}
                <div className="space-y-2">
                  <Label>
                    {formData.brokerType === 'IBKR' ? t('flexQueryId') : t('apiSecret')}
                  </Label>
                  <Input
                    type={formData.brokerType === 'IBKR' ? 'text' : 'password'}
                    value={formData.apiSecret}
                    onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                    placeholder={formData.brokerType === 'IBKR' ? t('flexQueryIdPlaceholder') : t('apiSecretPlaceholder')}
                  />
                  {formData.brokerType === 'IBKR' && (
                    <p className="text-xs text-muted-foreground">
                      {t('flexQueryIdHelp')}
                    </p>
                  )}
                </div>
              </>
            )}
            
            {/* Link to Account */}
            <div className="space-y-2">
              <Label>{t('linkToAccount')}</Label>
              <Select
                value={formData.accountId || 'none'}
                onValueChange={(value) => {
                  if (value === '__create__') {
                    setShowCreateAccountDialog(true);
                  } else {
                    setFormData({ ...formData, accountId: value === 'none' ? undefined : value });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectAccount')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('noAccount')}</SelectItem>
                  <SelectItem value="__create__">
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      {t('createNewAccount')}
                    </div>
                  </SelectItem>
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
            
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConnectDialogOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleConnect} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('connect')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Disconnect Confirmation */}
      <AlertDialog open={isDisconnectDialogOpen} onOpenChange={setIsDisconnectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmDisconnect')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirmDisconnectDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect} className="bg-destructive hover:bg-destructive/90">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('disconnect')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Account Dialog */}
      <Dialog open={showCreateAccountDialog} onOpenChange={setShowCreateAccountDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tAccounts('createAccount')}</DialogTitle>
            <DialogDescription>
              {t('createAccountDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{tAccounts('accountName')}</Label>
              <Input
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder={tAccounts('accountNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{tAccounts('color')}</Label>
              <div className="flex flex-wrap gap-2">
                {['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      'w-8 h-8 rounded-full transition-transform',
                      newAccountColor === color && 'ring-2 ring-offset-2 ring-primary scale-110'
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewAccountColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateAccountDialog(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleCreateAccount} disabled={isCreatingAccount || !newAccountName.trim()}>
              {isCreatingAccount && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

