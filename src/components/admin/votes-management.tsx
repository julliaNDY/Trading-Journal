'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, Loader2, Vote as VoteIcon, MapPin } from 'lucide-react';
import {
  getAdminVotingOptions,
  createVotingOption,
  updateVotingOption,
  deleteVotingOption,
  toggleVotingOptionStatus,
} from '@/app/actions/admin-voting';
import { getAdminRoadmapVotes } from '@/app/actions/roadmap';
import { useToast } from '@/hooks/use-toast';
import { VotingOptionStatus } from '@prisma/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface VotingOption {
  id: string;
  title: string;
  description: string | null;
  status: VotingOptionStatus;
  voteCount: number;
  votes: Array<{
    id: string;
    userId: string;
    userEmail: string;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

interface VotesManagementProps {
  initialOptions?: VotingOption[];
}

interface RoadmapVote {
  roadmapItem: {
    id: string;
    type: string;
    title: string;
    status: string;
    priority: string | null;
    phase?: string;
    epic?: string;
    description?: string;
  };
  votingOption: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    voteCount: number;
    votes: Array<{
      id: string;
      userId: string;
      userEmail: string;
      discordUsername: string | null;
      createdAt: Date;
    }>;
    createdAt: Date;
  } | null;
}

export function VotesManagement({ initialOptions = [] }: VotesManagementProps) {
  const t = useTranslations('admin');
  const { toast } = useToast();
  const [options, setOptions] = useState<VotingOption[]>(initialOptions);
  const [roadmapVotes, setRoadmapVotes] = useState<RoadmapVote[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRoadmapVotes, setLoadingRoadmapVotes] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<VotingOption | null>(null);
  const [formData, setFormData] = useState({ title: '', description: '' });
  const [loadingOptionId, setLoadingOptionId] = useState<string | null>(null);

  const loadOptions = async () => {
    setLoading(true);
    try {
      const result = await getAdminVotingOptions();
      if (result.success) {
        setOptions(result.options);
      } else {
        toast({ title: result.error || 'Error loading options', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error loading voting options:', error);
      toast({ title: 'Error loading options', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadRoadmapVotes = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'votes-management.tsx:136',message:'loadRoadmapVotes called',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    setLoadingRoadmapVotes(true);
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'votes-management.tsx:140',message:'Before getAdminRoadmapVotes call',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      const result = await getAdminRoadmapVotes();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'votes-management.tsx:144',message:'After getAdminRoadmapVotes call',data:{success:result.success,hasRoadmapVotes:!!result.roadmapVotes,votesCount:result.roadmapVotes?.length||0},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      if (result.success) {
        setRoadmapVotes(result.roadmapVotes);
      } else {
        toast({ title: result.error || 'Error loading roadmap votes', variant: 'destructive' });
      }
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'votes-management.tsx:154',message:'loadRoadmapVotes error caught',data:{error:error instanceof Error?error.message:String(error),stack:error instanceof Error?error.stack:''},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      console.error('Error loading roadmap votes:', error);
      toast({ title: 'Error loading roadmap votes', variant: 'destructive' });
    } finally {
      setLoadingRoadmapVotes(false);
    }
  };

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'votes-management.tsx:153',message:'VotesManagement useEffect triggered',data:{initialOptionsLength:initialOptions.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    if (initialOptions.length === 0) {
      loadOptions();
    }
    loadRoadmapVotes();
  }, [initialOptions.length]);

  const handleCreate = async () => {
    if (!formData.title.trim()) {
      toast({ title: 'Title is required', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const result = await createVotingOption({
        title: formData.title,
        description: formData.description || undefined,
      });

      if (result.success) {
        toast({ title: t('createSuccess') });
        setIsCreateDialogOpen(false);
        setFormData({ title: '', description: '' });
        await loadOptions();
      } else {
        toast({ title: result.error || t('createError'), variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error creating option:', error);
      toast({ title: t('createError'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!editingOption || !formData.title.trim()) {
      toast({ title: 'Title is required', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const result = await updateVotingOption(editingOption.id, {
        title: formData.title,
        description: formData.description || undefined,
      });

      if (result.success) {
        toast({ title: t('updateSuccess') });
        setEditingOption(null);
        setFormData({ title: '', description: '' });
        await loadOptions();
      } else {
        toast({ title: result.error || t('updateError'), variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error updating option:', error);
      toast({ title: t('updateError'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (optionId: string) => {
    setLoadingOptionId(optionId);
    try {
      const result = await deleteVotingOption(optionId);
      if (result.success) {
        toast({ title: t('deleteSuccess') });
        await loadOptions();
      } else {
        toast({ title: result.error || t('deleteError'), variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error deleting option:', error);
      toast({ title: t('deleteError'), variant: 'destructive' });
    } finally {
      setLoadingOptionId(null);
    }
  };

  const handleToggleStatus = async (optionId: string) => {
    setLoadingOptionId(optionId);
    try {
      const result = await toggleVotingOptionStatus(optionId);
      if (result.success) {
        toast({ title: t('toggleSuccess') });
        await loadOptions();
      } else {
        toast({ title: result.error || t('toggleError'), variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      toast({ title: t('toggleError'), variant: 'destructive' });
    } finally {
      setLoadingOptionId(null);
    }
  };

  const openEditDialog = (option: VotingOption) => {
    setEditingOption(option);
    setFormData({ title: option.title, description: option.description || '' });
  };

  const closeDialogs = () => {
    setIsCreateDialogOpen(false);
    setEditingOption(null);
    setFormData({ title: '', description: '' });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalVotes = options.reduce((sum, opt) => sum + opt.voteCount, 0);
  const totalRoadmapVotes = roadmapVotes.reduce((sum, item) => sum + (item.votingOption?.voteCount || 0), 0);

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/5b880551-a79c-4cdc-a97b-e6cdfcf52409',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'votes-management.tsx:281',message:'Before render',data:{optionsCount:options.length,roadmapVotesCount:roadmapVotes.length,totalVotes,totalRoadmapVotes},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('votesManagement')}</h2>
          <p className="text-sm text-muted-foreground">
            Manage voting options and view results for general votes and roadmap features
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('createOption')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('createOption')}</DialogTitle>
              <DialogDescription>Create a new voting option for users to vote on.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="create-title">{t('optionTitle')}</Label>
                <Input
                  id="create-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter option title"
                />
              </div>
              <div>
                <Label htmlFor="create-description">{t('optionDescription')}</Label>
                <Textarea
                  id="create-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter option description (optional)"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialogs}>
                {t('cancel')}
              </Button>
              <Button onClick={handleCreate} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t('create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      {editingOption && (
        <Dialog open={!!editingOption} onOpenChange={() => closeDialogs()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('editOption')}</DialogTitle>
              <DialogDescription>Edit voting option details.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-title">{t('optionTitle')}</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter option title"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">{t('optionDescription')}</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter option description (optional)"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialogs}>
                {t('cancel')}
              </Button>
              <Button onClick={handleEdit} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Tabs: General Votes & Roadmap Votes */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <VoteIcon className="h-4 w-4" />
            General Votes ({totalVotes})
          </TabsTrigger>
          <TabsTrigger value="roadmap" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Roadmap Votes ({totalRoadmapVotes})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          {/* Options Table */}
          <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <VoteIcon className="h-5 w-5" />
            Voting Options
          </CardTitle>
          <CardDescription>
            {totalVotes} total votes across {options.length} option(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && options.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : options.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t('noOptions')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('voteCount')}</TableHead>
                  <TableHead>{t('percentage')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {options.map((option) => {
                  const percentage = totalVotes > 0 ? (option.voteCount / totalVotes) * 100 : 0;
                  const isLoading = loadingOptionId === option.id;

                  return (
                    <TableRow key={option.id}>
                      <TableCell className="font-medium">{option.title}</TableCell>
                      <TableCell className="max-w-md truncate">
                        {option.description || <span className="text-muted-foreground italic">-</span>}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={option.status === VotingOptionStatus.ACTIVE ? 'default' : 'secondary'}
                        >
                          {option.status === VotingOptionStatus.ACTIVE ? t('active') : t('inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell>{option.voteCount}</TableCell>
                      <TableCell>
                        {totalVotes > 0 ? `${percentage.toFixed(1)}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleStatus(option.id)}
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : option.status === VotingOptionStatus.ACTIVE ? (
                              <ToggleRight className="h-4 w-4" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(option)}
                            disabled={isLoading}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                disabled={isLoading}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('deleteOption')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('confirmDelete')}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(option.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  {t('delete')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="roadmap" className="space-y-6">
          {/* Roadmap Votes Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Roadmap Feature Votes
              </CardTitle>
              <CardDescription>
                Track votes on roadmap features (Epics/Phases). Only features with votes are shown.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRoadmapVotes ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : roadmapVotes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No votes on roadmap features yet. Votes will appear here when users vote on Epics from the roadmap.
                </p>
              ) : (
                <div className="space-y-6">
                  {roadmapVotes.map((item) => {
                    const votingOption = item.votingOption!;
                    const roadmapItem = item.roadmapItem;

                    return (
                      <Card key={roadmapItem.id} className="border-l-4 border-l-primary">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg mb-2">
                                {roadmapItem.epic}: {roadmapItem.title}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-3 flex-wrap">
                                <Badge variant="outline">{roadmapItem.phase}</Badge>
                                <Badge variant={roadmapItem.status === 'in_progress' ? 'default' : 'secondary'}>
                                  {roadmapItem.status === 'in_progress' ? 'In Progress' : roadmapItem.status === 'completed' ? 'Completed' : 'Upcoming'}
                                </Badge>
                                {roadmapItem.priority && (
                                  <Badge variant="outline">{roadmapItem.priority}</Badge>
                                )}
                                <span className="text-primary font-semibold">
                                  {votingOption.voteCount} vote{votingOption.voteCount !== 1 ? 's' : ''}
                                </span>
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {roadmapItem.description && (
                            <p className="text-sm text-muted-foreground mb-4">{roadmapItem.description}</p>
                          )}
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm mb-3">Users who voted:</h4>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>User Email</TableHead>
                                  <TableHead>Discord</TableHead>
                                  <TableHead>Voted At</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {votingOption.votes.map((vote) => (
                                  <TableRow key={vote.id}>
                                    <TableCell className="font-medium">{vote.userEmail}</TableCell>
                                    <TableCell>
                                      {vote.discordUsername || (
                                        <span className="text-muted-foreground italic">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell>{formatDate(vote.createdAt)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
