'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
import { useToast } from '@/hooks/use-toast';
import {
  connectBrokerAction,
  disconnectBrokerAction,
  syncBrokerTradesAction,
  updateBrokerSyncSettings,
  type ConnectBrokerFormData,
} from '@/app/actions/broker';
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
  TRADOVATE: {
    name: 'Tradovate',
    logo: '📊',
    description: 'Futures trading platform',
  },
  IBKR: {
    name: 'Interactive Brokers',
    logo: '🏦',
    description: 'Multi-asset brokerage (via Flex Query)',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function BrokersContent({ initialConnections, accounts }: BrokersContentProps) {
  const t = useTranslations('brokers');
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
  
  // Form state
  const [formData, setFormData] = useState<ConnectBrokerFormData>({
    brokerType: 'TRADOVATE',
    apiKey: '',
    apiSecret: '',
    environment: 'live',
  });
  
  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  
  const handleConnect = async () => {
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
          brokerType: 'TRADOVATE',
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
                      ? new Date(connection.lastSyncAt).toLocaleString()
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
                            {new Date(sync.startedAt).toLocaleString()}
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
                  <SelectItem value="TRADOVATE">
                    <div className="flex items-center gap-2">
                      <span>{BROKER_INFO.TRADOVATE.logo}</span>
                      <span>{BROKER_INFO.TRADOVATE.name}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="IBKR">
                    <div className="flex items-center gap-2">
                      <span>{BROKER_INFO.IBKR.logo}</span>
                      <span>{BROKER_INFO.IBKR.name}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Environment (for Tradovate) */}
            {formData.brokerType === 'TRADOVATE' && (
              <div className="space-y-2">
                <Label>{t('environment')}</Label>
                <Select
                  value={formData.environment}
                  onValueChange={(value) => setFormData({ ...formData, environment: value as 'demo' | 'live' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="live">{t('envLive')}</SelectItem>
                    <SelectItem value="demo">{t('envDemo')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
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
                    
                    {/* Step 3 */}
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
                      </div>
                    </div>
                    
                    {/* Step 4 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">4</span>
                        <h4 className="font-medium text-sm">{t('ibkrTutorial.step4Title')}</h4>
                      </div>
                      <div className="ml-8 space-y-2">
                        <p className="text-xs text-muted-foreground">{t('ibkrTutorial.step4Desc')}</p>
                        <div className="rounded bg-muted/50 p-2">
                          <p className="text-xs font-medium text-foreground">{t('ibkrTutorial.step4Fields')}</p>
                          <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                            <li>• Symbol, Asset Category, Currency</li>
                            <li>• Buy/Sell, Quantity, Trade Price</li>
                            <li>• Trade Date, Trade Time</li>
                            <li>• Realized P&L, Commission</li>
                            <li>• Open/Close Indicator</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    {/* Step 5 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">5</span>
                        <h4 className="font-medium text-sm">{t('ibkrTutorial.step5Title')}</h4>
                      </div>
                      <div className="ml-8 space-y-2">
                        <p className="text-xs text-muted-foreground">{t('ibkrTutorial.step5Desc')}</p>
                        <div className="flex items-center gap-2 p-2 rounded bg-green-500/10 border border-green-500/20">
                          <Info className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <p className="text-xs text-green-600 dark:text-green-400">{t('ibkrTutorial.step5Note')}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Step 6 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">6</span>
                        <h4 className="font-medium text-sm">{t('ibkrTutorial.step6Title')}</h4>
                      </div>
                      <div className="ml-8 space-y-2">
                        <p className="text-xs text-muted-foreground">{t('ibkrTutorial.step6Desc')}</p>
                        <div className="rounded bg-muted/50 p-2 text-xs font-mono">
                          Settings → User Settings → Flex Web Service
                        </div>
                      </div>
                    </div>
                    
                    {/* Step 7 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">7</span>
                        <h4 className="font-medium text-sm">{t('ibkrTutorial.step7Title')}</h4>
                      </div>
                      <div className="ml-8 space-y-2">
                        <p className="text-xs text-muted-foreground">{t('ibkrTutorial.step7Desc')}</p>
                        <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                          <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                          <p className="text-xs text-amber-600 dark:text-amber-400">{t('ibkrTutorial.step7Warning')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* API Key / Flex Token */}
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
            </div>
            
            {/* Link to Account */}
            <div className="space-y-2">
              <Label>{t('linkToAccount')}</Label>
              <Select
                value={formData.accountId || 'none'}
                onValueChange={(value) => setFormData({ ...formData, accountId: value === 'none' ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectAccount')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('createNewAccount')}</SelectItem>
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
            
            {/* Help Text (for Tradovate only) */}
            {formData.brokerType === 'TRADOVATE' && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                <p>{t('apiKeyHelp')}</p>
              </div>
            )}
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
    </div>
  );
}

