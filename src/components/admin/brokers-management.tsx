/**
 * Brokers Management Component
 * Story 3.8: Admin CRUD interface for brokers
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { BrokerAssetType, IntegrationStatus, Broker } from '@prisma/client';
import {
  createBroker,
  updateBroker,
  deleteBroker,
  getBrokerStats,
} from '@/app/actions/brokers';
import { Pencil, Trash2, Plus, Search } from 'lucide-react';
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

const ASSET_TYPES = Object.values(BrokerAssetType);
const INTEGRATION_STATUSES = Object.values(IntegrationStatus);

const STATUS_BADGES = {
  [IntegrationStatus.API]: { label: '✅ API', variant: 'default' as const },
  [IntegrationStatus.FILE_UPLOAD]: { label: '📁 File Upload', variant: 'secondary' as const },
  [IntegrationStatus.COMING_SOON]: { label: '🔄 Coming Soon', variant: 'outline' as const },
};

interface BrokerFormData {
  name: string;
  displayName: string;
  country: string;
  region: string;
  integrationStatus: IntegrationStatus;
  supportedAssets: BrokerAssetType[];
  logoUrl: string;
  websiteUrl: string;
  apiDocumentationUrl: string;
  csvTemplateUrl: string;
  description: string;
  priority: number;
  isActive: boolean;
}

const emptyForm: BrokerFormData = {
  name: '',
  displayName: '',
  country: '',
  region: '',
  integrationStatus: IntegrationStatus.COMING_SOON,
  supportedAssets: [],
  logoUrl: '',
  websiteUrl: '',
  apiDocumentationUrl: '',
  csvTemplateUrl: '',
  description: '',
  priority: 50,
  isActive: true,
};

export function BrokersManagement() {
  const { toast } = useToast();
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBroker, setEditingBroker] = useState<Broker | null>(null);
  const [formData, setFormData] = useState<BrokerFormData>(emptyForm);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [brokerToDelete, setBrokerToDelete] = useState<Broker | null>(null);
  const [stats, setStats] = useState<any>(null);

  // Fetch brokers
  const fetchBrokers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: '100', // API max limit is 100, not 1000
        ...(searchQuery && { search: searchQuery }),
        ...(filterStatus !== 'all' && { integrationStatus: filterStatus }),
      });

      const response = await fetch(`/api/brokers?${params}`);
      const data = await response.json();

      if (data.success) {
        setBrokers(data.data);
      }
    } catch (error) {
      console.error('Error fetching brokers:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch brokers',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    const result = await getBrokerStats();
    if (result.success) {
      setStats(result.data);
    }
  };

  useEffect(() => {
    fetchBrokers();
    fetchStats();
  }, [searchQuery, filterStatus]);

  // Handle create/update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const result = editingBroker
        ? await updateBroker(editingBroker.id, formData)
        : await createBroker(formData);

      if (result.success) {
        toast({
          title: 'Success',
          description: `Broker ${editingBroker ? 'updated' : 'created'} successfully`,
        });
        setIsDialogOpen(false);
        setEditingBroker(null);
        setFormData(emptyForm);
        fetchBrokers();
        fetchStats();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to save broker',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving broker:', error);
      toast({
        title: 'Error',
        description: 'Failed to save broker',
        variant: 'destructive',
      });
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!brokerToDelete) return;

    try {
      const result = await deleteBroker(brokerToDelete.id);

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Broker deleted successfully',
        });
        setDeleteDialogOpen(false);
        setBrokerToDelete(null);
        fetchBrokers();
        fetchStats();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to delete broker',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting broker:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete broker',
        variant: 'destructive',
      });
    }
  };

  // Open edit dialog
  const handleEdit = (broker: Broker) => {
    setEditingBroker(broker);
    setFormData({
      name: broker.name,
      displayName: broker.displayName || '',
      country: broker.country || '',
      region: broker.region || '',
      integrationStatus: broker.integrationStatus,
      supportedAssets: broker.supportedAssets,
      logoUrl: broker.logoUrl || '',
      websiteUrl: broker.websiteUrl || '',
      apiDocumentationUrl: broker.apiDocumentationUrl || '',
      csvTemplateUrl: broker.csvTemplateUrl || '',
      description: broker.description || '',
      priority: broker.priority,
      isActive: broker.isActive,
    });
    setIsDialogOpen(true);
  };

  // Open create dialog
  const handleCreate = () => {
    setEditingBroker(null);
    setFormData(emptyForm);
    setIsDialogOpen(true);
  };

  // Toggle asset type
  const toggleAssetType = (assetType: BrokerAssetType) => {
    setFormData((prev) => ({
      ...prev,
      supportedAssets: prev.supportedAssets.includes(assetType)
        ? prev.supportedAssets.filter((a) => a !== assetType)
        : [...prev.supportedAssets, assetType],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Brokers</div>
          </div>
          {stats.byStatus.map((stat: any) => (
            <div key={stat.integrationStatus} className="bg-card p-4 rounded-lg border">
              <div className="text-2xl font-bold">{stat._count}</div>
              <div className="text-sm text-muted-foreground">
                {STATUS_BADGES[stat.integrationStatus as IntegrationStatus].label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search brokers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {INTEGRATION_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_BADGES[status].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Broker
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assets</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : brokers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  No brokers found
                </TableCell>
              </TableRow>
            ) : (
              brokers.map((broker) => (
                <TableRow key={broker.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div>{broker.displayName || broker.name}</div>
                      {broker.country && (
                        <div className="text-xs text-muted-foreground">{broker.country}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{broker.region || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGES[broker.integrationStatus].variant}>
                      {STATUS_BADGES[broker.integrationStatus].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {broker.supportedAssets.slice(0, 2).map((asset) => (
                        <Badge key={asset} variant="outline" className="text-xs">
                          {asset}
                        </Badge>
                      ))}
                      {broker.supportedAssets.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{broker.supportedAssets.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{broker.priority}</TableCell>
                  <TableCell>
                    <Badge variant={broker.isActive ? 'default' : 'secondary'}>
                      {broker.isActive ? 'Yes' : 'No'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(broker)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBrokerToDelete(broker);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBroker ? 'Edit Broker' : 'Create Broker'}
            </DialogTitle>
            <DialogDescription>
              {editingBroker
                ? 'Update broker information'
                : 'Add a new broker to the database'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) =>
                    setFormData({ ...formData, displayName: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country Code</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="US, UK, EU, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                <Input
                  id="region"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  placeholder="North America, Europe, Asia, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="integrationStatus">Integration Status *</Label>
                <Select
                  value={formData.integrationStatus}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      integrationStatus: value as IntegrationStatus,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTEGRATION_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_BADGES[status].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority (0-100)</Label>
                <Input
                  id="priority"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: parseInt(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Supported Assets *</Label>
              <div className="grid grid-cols-3 gap-2">
                {ASSET_TYPES.map((assetType) => (
                  <div key={assetType} className="flex items-center space-x-2">
                    <Checkbox
                      id={assetType}
                      checked={formData.supportedAssets.includes(assetType)}
                      onCheckedChange={() => toggleAssetType(assetType)}
                    />
                    <label
                      htmlFor={assetType}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {assetType}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="websiteUrl">Website URL</Label>
              <Input
                id="websiteUrl"
                type="url"
                value={formData.websiteUrl}
                onChange={(e) =>
                  setFormData({ ...formData, websiteUrl: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                type="url"
                value={formData.logoUrl}
                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiDocumentationUrl">API Documentation URL</Label>
              <Input
                id="apiDocumentationUrl"
                type="url"
                value={formData.apiDocumentationUrl}
                onChange={(e) =>
                  setFormData({ ...formData, apiDocumentationUrl: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="csvTemplateUrl">CSV Template URL</Label>
              <Input
                id="csvTemplateUrl"
                type="url"
                value={formData.csvTemplateUrl}
                onChange={(e) =>
                  setFormData({ ...formData, csvTemplateUrl: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked as boolean })
                }
              />
              <label
                htmlFor="isActive"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Active
              </label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingBroker ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {brokerToDelete?.name}. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
